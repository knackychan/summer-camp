// kid-chat Edge Function logic with a fake fetch and database
// (docs/plans/2026-10-09-summer-chat-crash-test/).
import { test } from "node:test";
import assert from "node:assert/strict";
import { handle, request, readReply, SAFE_REPLY, RESTING, RETRY, PRICE, MODEL, MODERATION, ENDPOINT } from "../supabase/functions/kid-chat/chat.mjs";

const BODY = { kid: "lili", session: "abc123", messages: [
  { role: "kid", text: "Hi Summer!" }, { role: "summer", text: "Hi! 嗨！" }, { role: "kid", text: "Why is the sky blue?" }] };
const reply = (v, extra) => ({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(v) }] }],
  usage: { input_tokens: 300, output_tokens: 100 }, ...extra });
const GOOD = { en: "Sunlight bounces around in the air, and blue bounces the most!", zh: "陽光在空氣裡彈來彈去，藍色彈得最多！" };

function setup({ settings = null, flagKid = false, flagReply = false, model = reply(GOOD), status = 200, key = "k", saveFails = false } = {}) {
  const calls = [], rows = [];
  const deps = { apiKey: key,
    fetch: async (url, init) => {
      const body = JSON.parse(init.body); calls.push({ url, body });
      if (url === MODERATION) {
        const isReply = body.input.includes(GOOD.en) || body.input.includes("Grr");
        return { ok: true, status: 200, json: async () => ({ results: [{ flagged: isReply ? flagReply : flagKid }] }) };
      }
      if (model instanceof Error) throw model;
      return { ok: status < 300, status, json: async () => model };
    },
    db: { settings: async () => settings, save: async (r) => { if (saveFails) throw new Error("no table"); rows.push(r); } } };
  return { deps, calls, rows };
}

test("a good reply: moderation both ways, one model call, one saved row with cost", async () => {
  const { deps, calls, rows } = setup();
  const res = await handle(BODY, deps);
  assert.deepEqual(res.body, { ...GOOD, flagged: false });
  assert.deepEqual(calls.map((c) => c.url), [MODERATION, ENDPOINT, MODERATION]);
  const sent = calls[1].body;
  assert.equal(sent.model, MODEL);assert.equal(sent.text.format.strict, true);
  assert.deepEqual(sent.input.map((m) => m.role), ["user", "assistant", "user"]);
  assert.match(sent.instructions, /7 years old/);assert.ok(!JSON.stringify(sent).includes("Lili"), "no names");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kid_text, "Why is the sky blue?");assert.equal(rows[0].reply_zh, GOOD.zh);
  assert.equal(rows[0].cost_usd, Number((300 * PRICE.input + 100 * PRICE.output).toFixed(6)));
});

test("a flagged kid message: gentle Papa line, no model call, flagged row", async () => {
  const { deps, calls, rows } = setup({ flagKid: true });
  const res = await handle(BODY, deps);
  assert.deepEqual(res.body, { ...SAFE_REPLY, flagged: true });
  assert.deepEqual(calls.map((c) => c.url), [MODERATION]);
  assert.equal(rows[0].flagged, true);assert.equal(rows[0].reply_en, SAFE_REPLY.en);
});

test("a flagged reply is replaced before the kid sees it", async () => {
  const { deps, rows } = setup({ flagReply: true });
  assert.deepEqual((await handle(BODY, deps)).body, { ...SAFE_REPLY, flagged: true });
  assert.equal(rows[0].flagged, true);assert.equal(rows[0].reply_zh, SAFE_REPLY.zh);
});

test("Papa's switch off, no key, bad requests: fixed lines, no OpenAI call", async () => {
  for (const settings of [JSON.stringify({ enabled: false }), { enabled: false }]) {
    const { deps, calls } = setup({ settings });
    assert.deepEqual((await handle(BODY, deps)).body, { ...RESTING, fallback: true, reason: "off" });assert.equal(calls.length, 0);
  }
  assert.equal((await handle(BODY, setup({ settings: JSON.stringify({ enabled: true }) }).deps)).body.flagged, false, "on by setting");
  assert.equal((await handle(BODY, setup({ key: "" }).deps)).body.reason, "no key");
  for (const [patch, reason] of [
    [{ kid: "papa" }, "kid"], [{ session: "x" }, "session"], [{ messages: [] }, "messages"],
    [{ messages: [{ role: "summer", text: "hi" }] }, "messages"], [{ messages: [{ role: "kid", text: "   " }] }, "messages"],
    [{ messages: [{ role: "kid", text: "a".repeat(1001) }] }, "messages"],
    [{ messages: Array.from({ length: 21 }, () => ({ role: "kid", text: "hi" })) }, "messages"],
  ]) {
    const { deps, calls } = setup();
    const res = await handle({ ...BODY, ...patch }, deps);
    assert.equal(res.status, 400);assert.equal(res.body.reason, "invalid " + reason);assert.equal(calls.length, 0);
  }
});

test("model trouble: a bilingual try-again line, nothing saved", async () => {
  for (const [opts, reason] of [
    [{ status: 500 }, "http 500"], [{ model: reply({ en: "Hi", zh: "" }) }, "output"], [{ model: reply({ en: "Hi", zh: "Hello" }) }, "output"],
    [{ model: reply(GOOD, { status: "incomplete" }) }, "output"], [{ model: { output: [{ content: [{ type: "refusal", refusal: "no" }] }] } }, "output"],
    [{ model: Object.assign(new Error("slow"), { name: "TimeoutError" }) }, "timeout"],
  ]) {
    const { deps, rows } = setup(opts);
    const res = await handle(BODY, deps);
    assert.equal(res.body.reason, reason);assert.equal(res.body.en, RETRY.en);assert.equal(res.body.zh, RETRY.zh);assert.equal(rows.length, 0);
  }
});

test("a transcript that can't be saved never hides the reply", async () => {
  const { deps } = setup({ saveFails: true });
  const errors = console.error; console.error = () => {};
  try { assert.deepEqual((await handle(BODY, deps)).body, { ...GOOD, flagged: false }); } finally { console.error = errors; }
});

test("markup and control characters are stripped", () => {
  assert.deepEqual(readReply(reply({ en: "<i>Hi</i>\u0007", zh: "你好" })), { en: "iHi/i", zh: "你好" });
  assert.equal(request({ ...BODY, messages: [{ role: "kid", text: "<b>x</b>" }] }).input[0].content, "bx/b");
});
