// notify-parents Edge Function logic and the Web Push encoder
// (docs/plans/2026-10-19-parent-app/ D4). The encoder is checked by decrypting
// its output the way a browser would (RFC 8291) and verifying the VAPID JWT.
import { test } from "node:test";
import assert from "node:assert/strict";
import { encrypt, vapidHeader, makeVapidKeys, b64u, unb64u } from "../supabase/functions/notify-parents/webpush.mjs";
import { handle, isQuiet, digestDue, label, claimMessage } from "../supabase/functions/notify-parents/notify.mjs";

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();
async function hkdf(salt, ikm, info, n) {
  const k = await subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, n * 8));
}
async function browserKeys() {
  const pair = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const pub = new Uint8Array(await subtle.exportKey("raw", pair.publicKey));
  const auth = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return { pair, sub: { endpoint: "https://push.example.com/send/abc", p256dh: b64u(pub), auth: b64u(auth) }, pub, auth };
}
/* What a browser does on receipt (RFC 8291 §3.4 / RFC 8188). */
async function decrypt(msg, ua) {
  const salt = msg.slice(0, 16), rs = new DataView(msg.buffer, msg.byteOffset).getUint32(16), idlen = msg[20];
  const asPub = msg.slice(21, 21 + idlen), body = msg.slice(21 + idlen);
  const asKey = await subtle.importKey("raw", asPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await subtle.deriveBits({ name: "ECDH", public: asKey }, ua.pair.privateKey, 256));
  const info = new Uint8Array([...enc.encode("WebPush: info\0"), ...ua.pub, ...asPub]);
  const ikm = await hkdf(ua.auth, shared, info, 32);
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const key = await subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const plain = new Uint8Array(await subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, body));
  assert.equal(rs, 4096);
  assert.equal(plain[plain.length - 1], 2, "last-record delimiter");
  return new TextDecoder().decode(plain.slice(0, -1));
}

test("encrypt: a browser holding the subscription keys reads the message back", async () => {
  const ua = await browserKeys();
  const text = JSON.stringify({ title: "Lili finished a task", body: "Wash rice 洗米 · +10 points" });
  assert.equal(await decrypt(await encrypt(text, ua.sub), ua), text);
});

test("encrypt: refuses malformed subscription keys", async () => {
  await assert.rejects(encrypt("x", { p256dh: b64u(new Uint8Array(10)), auth: b64u(new Uint8Array(16)) }));
});

test("vapid: ES256 JWT for the push service's origin, signed by the public key it names", async () => {
  const keys = await makeVapidKeys();
  const header = await vapidHeader("https://fcm.googleapis.com/fcm/send/xyz", { ...keys, subject: "mailto:papa@example.com" }, 1_000_000);
  const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header);
  assert.ok(m);
  assert.equal(m[4], keys.publicKey);
  const claims = JSON.parse(new TextDecoder().decode(unb64u(m[2])));
  assert.deepEqual(claims, { aud: "https://fcm.googleapis.com", exp: 1_000_000 + 43200, sub: "mailto:papa@example.com" });
  const pub = await subtle.importKey("raw", unb64u(keys.publicKey), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  assert.ok(await subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pub, unb64u(m[3]), enc.encode(m[1] + "." + m[2])));
});

// 2026-10-19 12:00 Taipei = 04:00Z
const at = (hhmm) => new Date("2026-10-19T" + hhmm + ":00+08:00");
const SUB = (extra) => ({ id: "s1", user_id: "u1", enabled: true, kids: [], kinds: ["task", "reward"], quiet_start: "21:30", quiet_end: "07:00", last_digest_day: null, ...extra });

test("quiet hours wrap past midnight in Taipei time", () => {
  assert.equal(isQuiet(SUB(), at("12:00")), false);
  assert.equal(isQuiet(SUB(), at("21:30")), true);
  assert.equal(isQuiet(SUB(), at("02:00")), true);
  assert.equal(isQuiet(SUB(), at("07:00")), false);
  assert.equal(isQuiet(SUB({ quiet_start: "13:00", quiet_end: "14:00" }), at("13:30")), true);
  assert.equal(isQuiet(SUB({ quiet_start: "00:00", quiet_end: "00:00" }), at("02:00")), false, "same start and end = no quiet hours");
});

test("digest is due once, just after quiet hours end", () => {
  assert.equal(digestDue(SUB(), at("07:05")), true);
  assert.equal(digestDue(SUB(), at("07:30")), false);
  assert.equal(digestDue(SUB(), at("06:55")), false);
  assert.equal(digestDue(SUB({ last_digest_day: "2026-10-19" }), at("07:05")), false);
});

test("labels show the kid-facing EN + 中文 name, else a readable kind", () => {
  assert.equal(label(["Wash rice", "洗米"], "rice_wash"), "Wash rice 洗米");
  assert.equal(label({ en: "Bike ride", zh: "騎腳踏車" }), "Bike ride 騎腳踏車");
  assert.equal(label(null, "dishwasher_load"), "Dishwasher load");
  const m = claimMessage({ id: "c1", kind: "rice_wash", amount: 10, evidence: { label: ["Wash rice", "洗米"] } }, "Lili");
  assert.equal(m.title, "Lili finished a task");
  assert.equal(m.body, "Wash rice 洗米 · +10 points. Tap to check.");
  assert.equal(m.url, "admin.html#check/claim/c1");
});

const CLAIM = { id: "11111111-2222-3333-4444-555555555555", kid_id: "lili", kind: "rice_wash", status: "pending", amount: 10, evidence: { label: ["Wash rice", "洗米"] } };
function setup({ subs = [SUB()], claim = CLAIM, request = null, status = 201, pending = 3, parents = ["u1"] } = {}) {
  const sent = [], log = [];
  const deps = {
    secret: "s3cret",
    now: () => at("12:00"),
    send: async (sub, payload) => { sent.push({ sub: sub.id, payload: JSON.parse(payload) }); return typeof status === "function" ? status(sub) : status; },
    db: {
      claim: async () => claim, request: async () => request, kidName: async () => "Lili",
      subscriptions: async () => subs, pendingCount: async () => pending, isParent: async (u) => parents.includes(u),
      markOk: async (id) => log.push(["ok", id]), drop: async (id) => log.push(["drop", id]), markDigest: async (id, d) => log.push(["digest", id, d]),
    },
  };
  return { deps, sent, log };
}
const call = (deps, body, extra) => handle({ secret: "s3cret", user: null, body, ...extra }, deps);

test("a pending claim is pushed to every device that wants tasks for that kid and is not in quiet hours", async () => {
  const subs = [SUB({ id: "a" }), SUB({ id: "b", kids: ["luis"] }), SUB({ id: "c", kinds: ["reward"] }),
    SUB({ id: "d", enabled: false }), SUB({ id: "e", quiet_start: "11:00", quiet_end: "13:00" }), SUB({ id: "f", kids: ["lili"] })];
  const { deps, sent, log } = setup({ subs });
  const r = await call(deps, { type: "claim", id: CLAIM.id });
  assert.deepEqual(r.body, { sent: 2, dropped: 0, failed: 0 });
  assert.deepEqual(sent.map((s) => s.sub), ["a", "f"]);
  assert.equal(sent[0].payload.body, "Wash rice 洗米 · +10 points. Tap to check.");
  assert.deepEqual(log, [["ok", "a"], ["ok", "f"]]);
});

test("a claim already confirmed or gone sends nothing", async () => {
  const a = setup({ claim: { ...CLAIM, status: "confirmed" } });
  assert.equal((await call(a.deps, { type: "claim", id: CLAIM.id })).body.sent, 0);
  const b = setup({ claim: null });
  assert.equal((await call(b.deps, { type: "claim", id: CLAIM.id })).body.sent, 0);
  assert.equal(a.sent.length + b.sent.length, 0);
});

test("a reward request goes to devices that want rewards", async () => {
  const req = { id: CLAIM.id, kid_id: "luis", status: "requested", points: 200, label: ["Ice cream", "冰淇淋"], reward_id: "ice_cream" };
  const { deps, sent } = setup({ subs: [SUB({ id: "a", kinds: ["task"] }), SUB({ id: "b" })], request: req });
  await call(deps, { type: "request", id: req.id });
  assert.deepEqual(sent.map((s) => s.sub), ["b"]);
  assert.equal(sent[0].payload.title, "Lili asked for a reward");
  assert.equal(sent[0].payload.body, "Ice cream 冰淇淋 · 200 points. Tap to decide.");
});

test("expired subscriptions (404/410) are removed; other failures are kept", async () => {
  const { deps, log } = setup({ subs: [SUB({ id: "a" }), SUB({ id: "b" }), SUB({ id: "c" })], status: (s) => ({ a: 410, b: 500, c: 201 })[s.id] });
  const r = await call(deps, { type: "claim", id: CLAIM.id });
  assert.deepEqual(r.body, { sent: 1, dropped: 1, failed: 1 });
  assert.deepEqual(log, [["drop", "a"], ["ok", "c"]]);
});

test("webhook calls need the shared secret; bad bodies are refused", async () => {
  const { deps, sent } = setup();
  assert.equal((await handle({ secret: "nope", user: null, body: { type: "claim", id: CLAIM.id } }, deps)).status, 401);
  assert.equal((await call(deps, null)).status, 400);
  assert.equal((await call(deps, { type: "claim", id: "x' or 1=1" })).status, 400);
  assert.equal((await call(deps, { type: "other" })).status, 400);
  const noSecret = setup(); noSecret.deps.secret = "";
  assert.equal((await handle({ secret: "", user: null, body: { type: "claim", id: CLAIM.id } }, noSecret.deps)).status, 401);
  assert.equal(sent.length, 0);
});

test("digest: one summary per device when quiet hours just ended, marked so it is not repeated", async () => {
  const { deps, sent, log } = setup({ subs: [SUB({ id: "a" }), SUB({ id: "b", quiet_end: "08:00" })] });
  deps.now = () => at("07:05");
  const r = await call(deps, { type: "digest" });
  assert.equal(r.body.sent, 1);
  assert.equal(sent[0].payload.title, "3 things are waiting for you");
  assert.deepEqual(log[0], ["digest", "a", "2026-10-19"]);
  const empty = setup({ pending: 0 }); empty.deps.now = () => at("07:05");
  assert.equal((await call(empty.deps, { type: "digest" })).body.sent, 0);
  assert.equal(empty.sent.length, 0);
});

test("test push: only a signed-in parent, only to their own devices, even in quiet hours", async () => {
  const subs = [SUB({ id: "mine", user_id: "u1", quiet_start: "00:00", quiet_end: "23:59" }), SUB({ id: "theirs", user_id: "u2" })];
  const { deps, sent } = setup({ subs });
  assert.equal((await handle({ secret: "", user: null, body: { type: "test" } }, deps)).status, 403);
  assert.equal((await handle({ secret: "", user: "u9", body: { type: "test" } }, deps)).status, 403);
  const r = await handle({ secret: "", user: "u1", body: { type: "test" } }, deps);
  assert.equal(r.body.sent, 1);
  assert.deepEqual(sent.map((s) => s.sub), ["mine"]);
});
