// games-guide Edge Function logic with a fake fetch and a fake database
// (docs/plans/2026-10-08-games-gate-ai-guide/ slice 05).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { handle, readPicks, request, taipei, slotAt, PRICE, MODEL } from "../supabase/functions/games-guide/guide.mjs";
import { ITEMS } from "../supabase/functions/games-guide/items.mjs";

const require = createRequire(import.meta.url);
const Help = require("../js/home-help-data.js");
const NOW = new Date("2026-10-09T02:05:00Z");   // 10:05 Taipei
const BODY = { kid: "lili", day: "2026-10-09", slot: "morning", reroll: 0, answers: { done: ["room"], time: "some" },
  candidates: ["homework", "shoes", "garden", "living", "office", "clothes"], need: 30, points: { homework: 30, shoes: 5 } };
const ON = JSON.stringify({ enabled: true, rerollsPerSlot: 3, ai: { enabled: true } });

function model(picks, extra) {
  return { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ picks }) }] }],
    usage: { input_tokens: 400, output_tokens: 120 }, ...extra };
}
const GOOD = [
  { id: "homework", en: "A calm 30 minutes of homework — you can do it!", zh: "專心寫三十分鐘作業，你可以的！" },
  { id: "shoes", en: "Line up the shoes like a parade.", zh: "把鞋子排成一列吧！" },
  { id: "garden", en: "The garden would love your help.", zh: "花園需要你的幫忙。" },
];
function setup({ settings = ON, saved = null, reply = model(GOOD), status = 200, key = "test-key" } = {}) {
  const calls = [], rows = [];
  const deps = {
    now: () => NOW, apiKey: key,
    fetch: async (url, init) => { calls.push({ url, body: JSON.parse(init.body), auth: init.headers.authorization });
      if (reply instanceof Error) throw reply;
      return { ok: status < 300, status, json: async () => reply }; },
    db: {
      get: async (k) => saved || rows.find((r) => r.kid_id === k.kid_id && r.day === k.day && r.slot === k.slot && r.reroll === k.reroll) || null,
      insert: async (row) => { rows.push(row); return row; },
      settings: async () => settings,
    },
  };
  return { deps, calls, rows };
}

test("the function's home-help copy matches SQHomeHelp", () => {
  assert.deepEqual(ITEMS, Help.ITEMS.map((i) => ({ id: i.id, label: i.label, minutes: i.minutes })));
  assert.equal(slotAt(11 * 60 + 59), "morning");assert.equal(slotAt(12 * 60), "afternoon");assert.equal(slotAt(17 * 60), "evening");
  assert.deepEqual(taipei(NOW), { day: "2026-10-09", minutes: 10 * 60 + 5 });
});

test("good output: one model call, one ai row with cost from tokens", async () => {
  const { deps, calls, rows } = setup();
  const res = await handle(BODY, deps);
  assert.equal(res.status, 200);assert.equal(calls.length, 1);assert.equal(rows.length, 1);
  assert.equal(calls[0].auth, "Bearer test-key");
  const sent = calls[0].body;
  assert.equal(sent.model, MODEL);assert.equal(sent.text.format.strict, true);
  assert.deepEqual(sent.text.format.schema.properties.picks.items.properties.id.enum, BODY.candidates);
  assert.ok(!sent.input.includes("lili") && !sent.input.includes("Lili"), "no names reach the model");
  assert.match(sent.input, /early primary/);assert.match(sent.input, /"timeNow":"10:05"/);
  const row = res.body;
  assert.equal(row.source, "ai");assert.deepEqual(row.picks.map((p) => p.id), ["homework", "shoes", "garden"]);
  assert.deepEqual(row.picks[1].line, ["Line up the shoes like a parade.", "把鞋子排成一列吧！"]);
  assert.equal(row.cost_usd, Number((400 * PRICE.input + 120 * PRICE.output).toFixed(6)));
  assert.equal(row.input_tokens, 400);assert.equal(row.output_tokens, 120);
});

test("repeat key: the saved row, no model call", async () => {
  const { deps, calls } = setup();
  const first = await handle(BODY, deps);
  const again = await handle(BODY, deps);
  assert.equal(calls.length, 1);assert.equal(again.body.cached, true);assert.deepEqual(again.body.picks, first.body.picks);
  const local = setup({ saved: { kid_id: "lili", source: "local", picks: [] } });
  assert.equal((await handle(BODY, local.deps)).body.source, "local");assert.equal(local.calls.length, 0);
});

test("AI off, past the reroll limit or no key: fallback with no model call", async () => {
  for (const [opts, body, reason] of [
    [{ settings: null }, BODY, "off"],
    [{ settings: JSON.stringify({ ai: { enabled: false } }) }, BODY, "off"],
    [{}, { ...BODY, reroll: 4 }, "rerolls"],
    [{ settings: JSON.stringify({ rerollsPerSlot: 0, ai: { enabled: true } }) }, { ...BODY, reroll: 1 }, "rerolls"],
    [{ key: "" }, BODY, "no key"],
  ]) {
    const { deps, calls, rows } = setup(opts);
    const res = await handle(body, deps);
    assert.deepEqual(res.body, { fallback: true, reason });assert.equal(calls.length, 0);assert.equal(rows.length, 0);
  }
});

test("bad requests are refused before anything else", async () => {
  for (const [patch, reason] of [
    [{ kid: "papa" }, "kid"], [{ day: "2026-10-08" }, "day"], [{ slot: "evening" }, "slot"], [{ reroll: -1 }, "reroll"],
    [{ answers: { done: [], time: "forever" } }, "answers"], [{ answers: { done: ["hack"], time: "some" } }, "answers"],
    [{ candidates: ["homework", "shoes"] }, "candidates"], [{ candidates: ["homework", "shoes", "pizza"] }, "candidates"],
    [{ candidates: ["homework", "homework", "shoes"] }, "candidates"], [{ need: 9999 }, "need"], [{ points: { homework: 1e6 } }, "points"],
  ]) {
    const { deps, calls } = setup();
    const res = await handle({ ...BODY, ...patch }, deps);
    assert.equal(res.status, 400);assert.equal(res.body.reason, "invalid " + reason);assert.equal(calls.length, 0);
  }
  const edge = setup({}); edge.deps.now = () => new Date("2026-10-09T03:55:00Z");   // 11:55 Taipei
  assert.equal((await handle({ ...BODY, slot: "afternoon" }, edge.deps)).status, 200, "10 minutes' grace at a slot boundary");
});

test("bad model output, refusal, incomplete or HTTP error: fallback, nothing saved", async () => {
  const cases = [
    model(GOOD.slice(0, 2)),
    model([GOOD[0], GOOD[1], { id: "garden", en: "Garden time!", zh: "" }]),
    model([GOOD[0], GOOD[1], { id: "garden", en: "Garden time!", zh: "Garden" }]),
    model([GOOD[0], GOOD[1], { id: "table", en: "Table!", zh: "餐桌！" }]),
    model([GOOD[0], GOOD[0], GOOD[1]]),
    model(GOOD, { status: "incomplete" }),
    { output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }] },
    { output: [{ type: "message", content: [{ type: "output_text", text: "not json" }] }] },
  ];
  for (const reply of cases) {
    const { deps, rows } = setup({ reply });
    assert.deepEqual((await handle(BODY, deps)).body, { fallback: true, reason: "output" });assert.equal(rows.length, 0);
  }
  assert.equal((await handle(BODY, setup({ status: 429 }).deps)).body.reason, "http 429");
  const timeout = Object.assign(new Error("slow"), { name: "TimeoutError" });
  assert.equal((await handle(BODY, setup({ reply: timeout }).deps)).body.reason, "timeout");
});

test("lines are cleaned of markup and control characters", () => {
  const picks = readPicks(model([{ ...GOOD[0], en: "<b>Go!</b>\u0007" }, GOOD[1], GOOD[2]]), BODY.candidates);
  assert.equal(picks[0].line[0], "bGo!/b");
  assert.equal(request(BODY, NOW).max_output_tokens, 700);
});
