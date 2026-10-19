// notify-parents logic (docs/plans/2026-10-19-parent-app/ D4). Plain JavaScript,
// no Deno APIs, so scripts/notify-parents-fn.test.mjs runs it in Node; index.ts
// wires it to HTTP, the database and the VAPID secret.
//
// Callers:
//   {type:"claim", id}    database trigger: a kid finished a task that waits for a parent
//   {type:"request", id}  database trigger: a kid asked for a reward
//   {type:"ask", id}      database trigger: a kid sent a message from the Ask panel
//                         (or a quest to verify); urgent asks ignore quiet hours
//   {type:"digest"}       pg_cron, every 15 minutes: one summary when a device's quiet hours end
//   {type:"test"}         a signed-in parent: "Send a test" to their own devices
// The first three carry the shared webhook secret; "test" carries the parent's session.
export const TZ_OFFSET_MIN = 8 * 60;          // Asia/Taipei, no daylight saving
export const DIGEST_WINDOW_MIN = 20;          // cron runs every 15; a little slack
export const KINDS = ["task", "reward", "ask"];
export const ASK_PREVIEW = 120;

const minutes = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ""));
  return m ? (Number(m[1]) % 24) * 60 + Math.min(59, Number(m[2])) : null;
};
export function taipei(now) {
  const t = new Date(now.getTime() + TZ_OFFSET_MIN * 60000);
  return { day: t.toISOString().slice(0, 10), min: t.getUTCHours() * 60 + t.getUTCMinutes() };
}
/* Quiet from `quiet_start` up to (not including) `quiet_end`, which may wrap past midnight. */
export function isQuiet(sub, now) {
  const s = minutes(sub.quiet_start), e = minutes(sub.quiet_end);
  if (s == null || e == null || s === e) return false;
  const m = taipei(now).min;
  return s < e ? m >= s && m < e : m >= s || m < e;
}
export function digestDue(sub, now) {
  const e = minutes(sub.quiet_end), s = minutes(sub.quiet_start);
  if (e == null || s == null || s === e) return false;
  const t = taipei(now), since = (t.min - e + 1440) % 1440;
  return since < DIGEST_WINDOW_MIN && sub.last_digest_day !== t.day;
}
export function wants(sub, kind, kid) {
  if (!sub.enabled) return false;
  if (Array.isArray(sub.kinds) && !sub.kinds.includes(kind)) return false;
  if (kid && Array.isArray(sub.kids) && sub.kids.length && !sub.kids.includes(kid)) return false;
  return true;
}

const humanize = (kind) => {
  const s = String(kind || "task").replace(/[_:]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};
/* Kid-facing task names are stored EN + 中文; the notification shows both. */
export function label(pair, fallback) {
  if (Array.isArray(pair) && pair[0]) return pair[1] ? pair[0] + " " + pair[1] : String(pair[0]);
  if (pair && typeof pair === "object" && pair.en) return pair.zh ? pair.en + " " + pair.zh : String(pair.en);
  if (typeof pair === "string" && pair) return pair;
  return humanize(fallback);
}
export function claimMessage(claim, kidName) {
  const ev = claim.evidence || {};
  return {
    title: kidName + " finished a task",
    body: label(ev.label, claim.kind) + " · +" + Number(claim.amount || 0) + " points. Tap to check.",
    tag: "claim-" + claim.id,
    url: "admin.html#check/claim/" + claim.id,
  };
}
export function requestMessage(req, kidName) {
  return {
    title: kidName + " asked for a reward",
    body: label(req.label, req.reward_id) + " · " + Number(req.points || 0) + " points. Tap to decide.",
    tag: "request-" + req.id,
    url: "admin.html#check/request/" + req.id,
  };
}
/* asks.kind: question | canned | urgent (Ask panel), quest_verify:<quest>:<day>
   (a finished quest to check), reward:* (already sent as a reward request). */
export function askKind(row) {
  const k = String(row && row.kind || "");
  if (k.startsWith("reward:")) return null;
  return k.startsWith("quest_verify:") ? "task" : "ask";
}
export function askMessage(row, kidName) {
  const k = String(row.kind || "");
  let text = String(row.body || "").replace(/\s+/g, " ").trim();
  if (text.length > ASK_PREVIEW) text = text.slice(0, ASK_PREVIEW - 1) + "…";
  if (k.startsWith("quest_verify:")) {
    return { title: kidName + " finished a quest", body: (text || "Ready for your check") + ". Tap to check.", tag: "ask-" + row.id, url: "admin.html#inbox" };
  }
  const urgent = k === "urgent";
  return {
    title: urgent ? kidName + " needs you now" : kidName + " sent you a message",
    body: text || (row.audio_path ? "Voice message. Tap to listen." : "Tap to read."),
    tag: "ask-" + row.id,
    url: "admin.html#inbox",
  };
}
export function digestMessage(count) {
  return {
    title: count === 1 ? "1 thing is waiting for you" : count + " things are waiting for you",
    body: "Tasks, reward asks and messages from while you were in quiet hours. Tap to check.",
    tag: "digest",
    url: "admin.html#check",
  };
}

async function deliver(subs, message, deps) {
  const payload = JSON.stringify(message);
  let sent = 0, dropped = 0, failed = 0;
  for (const sub of subs) {
    let status = 0;
    try { status = await deps.send(sub, payload); } catch (error) { status = 0; }
    if (status >= 200 && status < 300) { sent++; await deps.db.markOk(sub.id); }
    else if (status === 404 || status === 410) { dropped++; await deps.db.drop(sub.id); }
    else failed++;
  }
  return { sent, dropped, failed };
}

/* req = {secret, user (from a verified session, or null), body} */
export async function handle(req, deps) {
  const body = req.body;
  if (!body || typeof body !== "object" || typeof body.type !== "string") return { status: 400, body: { error: "body" } };
  const now = deps.now();

  if (body.type === "test") {
    if (!req.user || !(await deps.db.isParent(req.user))) return { status: 403, body: { error: "parent" } };
    const subs = (await deps.db.subscriptions()).filter((s) => s.user_id === req.user && s.enabled);
    const result = await deliver(subs, { title: "Summer Quest", body: "Notifications work on this device.", tag: "test", url: "admin.html#check" }, deps);
    return { status: 200, body: result };
  }

  if (!deps.secret || req.secret !== deps.secret) return { status: 401, body: { error: "secret" } };
  const subs = await deps.db.subscriptions();

  if (body.type === "digest") {
    const due = subs.filter((s) => s.enabled && digestDue(s, now));
    if (!due.length) return { status: 200, body: { sent: 0 } };
    const count = await deps.db.pendingCount();
    const day = taipei(now).day;
    for (const s of due) await deps.db.markDigest(s.id, day);
    if (!count) return { status: 200, body: { sent: 0 } };
    return { status: 200, body: await deliver(due, digestMessage(count), deps) };
  }

  if (body.type !== "claim" && body.type !== "request" && body.type !== "ask") return { status: 400, body: { error: "type" } };
  if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) return { status: 400, body: { error: "id" } };
  if (body.type === "ask") {
    const ask = await deps.db.ask(body.id);
    if (!ask) return { status: 200, body: { sent: 0, reason: "gone" } };
    const kind = askKind(ask);
    if (!kind || ask.answered_at) return { status: 200, body: { sent: 0, reason: "not needed" } };
    const urgent = ask.kind === "urgent";
    const name = (await deps.db.kidName(ask.kid_id)) || ask.kid_id;
    const targets = subs.filter((s) => wants(s, kind, ask.kid_id) && (urgent || !isQuiet(s, now)));
    return { status: 200, body: await deliver(targets, askMessage(ask, name), deps) };
  }
  const row = body.type === "claim" ? await deps.db.claim(body.id) : await deps.db.request(body.id);
  if (!row) return { status: 200, body: { sent: 0, reason: "gone" } };
  if (body.type === "claim" && row.status !== "pending") return { status: 200, body: { sent: 0, reason: "not pending" } };
  if (body.type === "request" && row.status !== "requested") return { status: 200, body: { sent: 0, reason: "not requested" } };
  const kind = body.type === "claim" ? "task" : "reward";
  const kidName = (await deps.db.kidName(row.kid_id)) || row.kid_id;
  const targets = subs.filter((s) => wants(s, kind, row.kid_id) && !isQuiet(s, now));
  const message = body.type === "claim" ? claimMessage(row, kidName) : requestMessage(row, kidName);
  return { status: 200, body: await deliver(targets, message, deps) };
}
