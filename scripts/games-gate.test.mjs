// Daily points gate + home-help data (docs/plans/2026-10-08-games-gate-ai-guide/ slice 01).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const SQLock = require("../js/lock-core.js");
const Gate = require("../js/games-gate-core.js");
const Help = require("../js/home-help-data.js");
const SQPoints = require("../js/points.js");
const SQQuestData = require("../js/quest-data.js");

const DAY = "2026-10-08";
const ON = { enabled: true, threshold: { luis: 50, lili: 50, lucien: 40 } };

test("lock order: brain, then points; unknown gates stay open", () => {
  assert.equal(SQLock.computeLock({}).locked, false);
  assert.equal(SQLock.computeLock({ brainOpen: false, pointsOpen: false }).reason, "brain");
  assert.equal(SQLock.computeLock({ pointsOpen: false }).reason, "points");
  assert.equal(SQLock.computeLock({ brainOpen: true, pointsOpen: true }).locked, false);
});

test("settings: defaults off, thresholds in steps of 5 within 0..300", () => {
  const d = Gate.parseSettings(undefined);
  assert.equal(d.enabled, false);
  assert.deepEqual(d.threshold, { luis: 50, lili: 50, lucien: 40 });
  const s = Gate.parseSettings(JSON.stringify({ enabled: true, threshold: { luis: 42, lili: -5, lucien: 999 } }));
  assert.equal(s.enabled, true);
  assert.deepEqual(s.threshold, { luis: 40, lili: 0, lucien: 300 });
  assert.equal(Gate.parseSettings("not json").enabled, false);
});

test("today's points: pending counts, denied/started don't, queued op and claim count once", () => {
  const claims = [
    { kid_id: "lili", day: DAY, kind: "brain", slot: "calc", amount: 10, status: "confirmed" },
    { kid_id: "lili", day: DAY, kind: "room_rescue", slot: "default", amount: 10, status: "pending" },
    { kid_id: "lili", day: DAY, kind: "laundry_helper", slot: "default", amount: 15, status: "denied" },
    { kid_id: "lili", day: DAY, kind: "homework", slot: "default", amount: 30, status: "started" },
    { kid_id: "lili", day: "2026-10-07", kind: "reading", slot: "default", amount: 20, status: "confirmed" },
    { kid_id: "luis", day: DAY, kind: "reading", slot: "default", amount: 20, status: "confirmed" },
    { kid_id: "lili", day: DAY, kind: "table_helper", slot: "lunch", amount: 5, status: "queued" }
  ];
  const queue = [
    { type: "pointClaim", kid: "lili", claim: { kid_id: "lili", day: DAY, kind: "table_helper", slot: "lunch", amount: 5 } },
    { type: "pointClaim", kid: "lili", claim: { kid_id: "lili", day: DAY, kind: "table_helper", slot: "dinner", amount: 5 } },
    { type: "pointBegin", kid: "lili", claim: { kid_id: "lili", day: DAY, kind: "shower", slot: "default", amount: 5 } }
  ];
  assert.equal(Gate.todayPoints("lili", DAY, { claims, queue }), 10 + 10 + 5 + 5);
  assert.equal(Gate.todayPoints("lili", DAY, {}), 0);
});

test("gate state: off, threshold 0, papa, reached, remembered, closed", () => {
  assert.equal(Gate.state("lili", { settings: null, today: 0 }).reason, "off");
  assert.equal(Gate.state("lili", { settings: { enabled: true, threshold: { lili: 0 } }, today: 0 }).reason, "off");
  assert.equal(Gate.state("lili", { settings: ON, today: 0, papaOpen: true }).reason, "papa");
  assert.equal(Gate.state("lili", { settings: ON, today: 50 }).reason, "reached");
  assert.equal(Gate.state("lili", { settings: ON, today: 20, remembered: true }).open, true);
  const shut = Gate.state("lili", { settings: ON, today: 35 });
  assert.deepEqual([shut.open, shut.reason, shut.need, shut.threshold], [false, "points", 15, 50]);
  assert.equal(Gate.state("lucien", { settings: ON, today: 35 }).need, 5);
});

test("gift reminder uses the reward catalog, never cash", () => {
  const cat = [
    { id: "movie", cost: 200, kind: "experience", title: ["Choose the family movie", "選家庭電影"] },
    { id: "dessert", cost: 300, kind: "experience", title: ["Choose dessert", "選甜點"] },
    { id: "cash", cost: 100, kind: "cash", title: ["Cash", "現金"] },
    { id: "off", cost: 50, enabled: false, title: ["Off", "關"] }
  ];
  const saving = Gate.giftReminder(250, cat);
  assert.deepEqual([saving.kind, saving.reward.id, saving.need], ["saving", "dessert", 50]);
  const can = Gate.giftReminder(420, cat);
  assert.deepEqual([can.kind, can.reward.id], ["can", "dessert"]);
  assert.equal(Gate.giftReminder(0, [cat[2]]).kind, "generic");
  const line = Help.giftLine(saving);
  assert.match(line[0], /250/);
  assert.match(line[1], /選甜點/);
  assert.equal(Help.giftLine(Gate.giftReminder(0, [])).length, 2);
  const start = Help.giftLine(Gate.giftReminder(0, cat));
  assert.doesNotMatch(start[0], /You have 0/);
  assert.match(start[0], /Choose the family movie.*200/);
});

const pair = (v) => Array.isArray(v) && v.length === 2 && v.every((s) => typeof s === "string" && s.trim());
const hasHan = (s) => /[一-鿿]/.test(s);

test("home-help data: 8 activities, bilingual, unique, windows parse", () => {
  assert.equal(Help.ITEMS.length, 8);
  assert.equal(new Set(Help.ITEMS.map((i) => i.id)).size, 8);
  assert.equal(new Set(Help.ITEMS.map((i) => i.kind)).size, 8);
  for (const item of Help.ITEMS) {
    assert.ok(pair(item.label) && hasHan(item.label[1]), item.id + " label needs EN + 中文");
    for (const kid of ["lucien", "lili", "luis"]) {
      assert.ok(pair(item.goal[kid]) && hasHan(item.goal[kid][1]), `${item.id} goal for ${kid} needs EN + 中文`);
    }
    for (const w of item.windows) assert.ok(Help.mins(w[0]) < Help.mins(w[1]), item.id + " window");
    assert.ok(item.meal || item.windows.length, item.id + " needs a window or a meal");
    assert.ok(["self", "parent"].includes(item.verify));
  }
  for (const [key, value] of Object.entries(Help.TEXT)) assert.ok(pair(value) && hasHan(value[1]), "TEXT." + key);
  for (const line of Help.LINES) assert.ok(pair(line) && hasHan(line[1]) && line.every((s) => s.includes("{n}")));
});

test("every home-help activity resolves to a real award and quest", () => {
  const quests = new Map(SQQuestData.all().map((q) => [q.id, q]));
  for (const item of Help.ITEMS) {
    assert.ok(SQPoints.rules[item.kind], item.kind + " is a points kind");
    const qs = item.quest && typeof item.quest === "object" ? Object.values(item.quest) : item.quest ? [item.quest] : [];
    for (const q of qs) {
      assert.ok(quests.has(q), q + " is a quest");
      assert.equal(SQPoints.quest(quests.get(q)).kind, item.kind, q + " pays " + item.kind);
    }
    if (!qs.length) assert.equal(item.route, "day");
    assert.equal(!!SQPoints.rules[item.kind].parent, item.verify === "parent", item.id + " check matches the award rule");
  }
});

/* The database repeats the award policy (points_policy + the snapshot defaults in
   points_claim). The newest migration that defines them must agree with js/points.js. */
test("award kinds agree between js/points.js and the newest SQL policy", () => {
  const dir = new URL("../supabase/migrations/", import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const policySql = files.map((f) => readFileSync(new URL(f, dir), "utf8")).filter((t) => t.includes("function public.points_policy(")).pop();
  const claimSql = files.map((f) => readFileSync(new URL(f, dir), "utf8")).filter((t) => t.includes("function public.points_claim(")).pop();
  const rules = JSON.parse(policySql.match(/rules:='(\{[^']+\})'/)[1]);
  const defaults = Object.fromEntries([...claimSql.matchAll(/when '([a-z_]+)' then (\d+)/g)].map((m) => [m[1], +m[2]]));
  const category = { care: "care", help: "helping", learn: "learning", move: "movement", create: "creative", bonus: "bonus" };
  for (const [kind, rule] of Object.entries(SQPoints.rules)) {
    assert.ok(rules[kind], kind + " missing from SQL points_policy");
    const [amount, limit, cat, verify] = rules[kind];
    assert.deepEqual([amount, limit, cat], [rule.points, rule.limit, category[rule.category]], kind + " amount/limit/category");
    if (rule.category !== "bonus" && kind !== "brain") {
      assert.equal(verify, rule.parent ? "parent" : "self", kind + " verification");
      assert.equal(defaults[kind], rule.points, kind + " snapshot default in points_claim");
    }
  }
  assert.deepEqual(Object.keys(rules).sort(), Object.keys(SQPoints.rules).sort());
});

const meals = [{ slot: "breakfast", start: 495 }, { slot: "lunch", start: 720 }, { slot: "dinner", start: 1110 }];
function ctx(minutes, extra) {
  return Object.assign({
    minutes, meals,
    known: (kind) => !!SQPoints.rules[kind],
    claimed: () => false,
    atLimit: () => false,
    amount: (kind) => SQPoints.amount(kind, {})
  }, extra || {});
}

test("available: windows, meal slot, claimed dropped, unknown kinds last as soon", () => {
  const noon = Help.available(ctx(12 * 60 + 10));
  const table = noon.find((x) => x.item.id === "table");
  assert.deepEqual([table.slot, table.quest, table.points], ["lunch", "table_helper", 5]);
  assert.ok(noon.every((x) => x.ready), "all 8 kinds are startable since slice 02");
  // a kind or quest the app doesn't know (e.g. an older catalog) lists as "soon", last
  const older = Help.available(ctx(12 * 60 + 10, { known: (kind) => kind !== "garden_tidy" && kind !== "office_tidy" }));
  const firstSoon = older.findIndex((x) => !x.ready);
  assert.ok(firstSoon > 0 && older.slice(firstSoon).every((x) => !x.ready) && older.length - firstSoon === 2);
  const evening = Help.available(ctx(18 * 60 + 30)).map((x) => x.item.id);
  assert.ok(!evening.includes("homework") && !evening.includes("garden") && evening.includes("table"));
  assert.equal(Help.available(ctx(21 * 60)).length, 0);
  const done = Help.available(ctx(10 * 60, { claimed: (kind) => kind === "homework" })).map((x) => x.item.id);
  assert.ok(!done.includes("homework") && !done.includes("table"));
  assert.equal(Help.slotOf(11 * 60 + 59), "morning");
  assert.equal(Help.slotOf(12 * 60), "afternoon");
  assert.equal(Help.slotOf(17 * 60), "evening");
});

test("invite line is stable per kid/day and names the gap", () => {
  assert.deepEqual(Help.line("lili", DAY, 15), Help.line("lili", DAY, 15));
  assert.match(Help.line("lili", DAY, 15)[0], /15/);
});

test("the points card and its styles never use red (coach, not cop)", () => {
  const css = readFileSync(new URL("../css/app.css", import.meta.url), "utf8");
  const block = css.slice(css.indexOf("/* Daily points gate"), css.indexOf(".brainnudge{")).replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(block.length > 0);
  assert.doesNotMatch(block, /--bad|#f00|#ff0000|\bred\b|#FF6B6B/i);
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const fn = html.slice(html.indexOf("function pointsLockHtml(){"), html.indexOf("function sayPointsLine(){"));
  assert.ok(fn.length > 0);
  assert.doesNotMatch(fn, /--bad|\bred\b|late|遲到/i);
});

test("a family's saved quest catalog picks up the new home-help quests once", () => {
  const SQQuestConfig = require("../js/quest-config.js");
  globalThis.window = { SQQuestData, SQPoints };
  try {
    const saved = SQQuestData.all().filter((q) => !q.since).map((q) => Object.assign({}, q, { since: undefined }));
    saved.push(Object.assign({}, SQQuestData.byId("shoe_tidy"), { enabled: false }));
    const ids = SQQuestConfig.catalog({ quest_catalog_v1: JSON.stringify(saved) }).map((q) => q.id);
    for (const id of ["garden_tidy", "living_tidy", "office_tidy"]) assert.equal(ids.filter((x) => x === id).length, 1, id);
    assert.equal(ids.filter((x) => x === "shoe_tidy").length, 1, "a saved copy wins and is not duplicated");
    const catalog = SQQuestConfig.catalog({ quest_catalog_v1: JSON.stringify(saved) });
    assert.equal(catalog.find((q) => q.id === "shoe_tidy").enabled, false, "Papa's pause is kept");
    assert.equal(catalog.find((q) => q.id === "garden_tidy").verification, "parent");
    assert.equal(catalog.find((q) => q.id === "garden_tidy").rewardPoints, 15);
  } finally {
    delete globalThis.window;
  }
});

/* slice 04: schedule-aware ranking and reroll windows (design D6, D8) */
function guideCtx(minutes, extra) {
  return ctx(minutes, Object.assign({ time: "lots", need: 30, seed: "lili:2026-10-08:x" }, extra || {}));
}
test("ranking follows the schedule and the time the kid has", () => {
  const homework = Help.rank(guideCtx(10 * 60 + 5, { blockKinds: ["homework"] }));
  assert.equal(homework[0].item.id, "homework", "homework block puts homework first");
  const lunch = Help.rank(guideCtx(12 * 60 + 10, { blockKinds: ["table_helper"] }));
  assert.equal(lunch[0].item.id, "table");assert.equal(lunch[0].slot, "lunch");
  const evening = Help.rank(guideCtx(18 * 60 + 30)).map((x) => x.item.id);
  assert.ok(!evening.includes("homework") && !evening.includes("garden"));
  assert.equal(Help.rank(guideCtx(21 * 60)).length, 0);
  assert.equal(Help.rank(guideCtx(10 * 60, { time: "little" }))[0].item.id, "shoes", "a little time puts the 5-minute job first");
  const said = Help.rank(guideCtx(10 * 60, { done: ["room", "shoes"] })).map((x) => x.item.id);
  assert.ok(!said.includes("room") && !said.includes("shoes"), "what the kid says is done is never suggested");
  const capped = Help.rank(guideCtx(10 * 60, { atLimit: (kind) => kind === "laundry_helper" })).map((x) => x.item.id);
  assert.ok(!capped.includes("clothes"));
  const varied = Help.rank(guideCtx(10 * 60, { recent: ["homework"], blockKinds: [] })).map((x) => x.item.id);
  const plain = Help.rank(guideCtx(10 * 60, { blockKinds: [] })).map((x) => x.item.id);
  assert.ok(varied.indexOf("homework") >= plain.indexOf("homework"), "picked in an earlier slot sinks a little");
});
test("picks: stable, three per reroll, every activity before a repeat", () => {
  const c = guideCtx(10 * 60);
  const ids = (r) => Help.pick(c, r).map((x) => x.item.id);
  assert.deepEqual(ids(0), ids(0));
  assert.equal(ids(0).length, 3);
  assert.notDeepEqual(ids(1), ids(0));
  const ranked = Help.rank(c).map((x) => x.item.id);
  assert.ok(ranked.length >= 6);
  const seen = new Set();
  for (let r = 0; r * 3 < ranked.length; r++) ids(r).forEach((id) => seen.add(id));
  assert.equal(seen.size, ranked.length);
  assert.equal(Help.pick(guideCtx(20 * 60 + 25), 5).length <= 3, true);
});
test("saved decisions: today's only, the latest reroll of a slot is reused", () => {
  const d = (slot, reroll, day = DAY) => ({ kid_id: "lili", day, slot, reroll, picks: [], answers: {} });
  const all = { a: d("morning", 0), b: d("morning", 2), c: d("afternoon", 0), old: d("morning", 5, "2026-10-07") };
  assert.deepEqual(Object.keys(Help.todays(all, DAY)).sort(), ["lili:2026-10-08:afternoon:0", "lili:2026-10-08:morning:0", "lili:2026-10-08:morning:2"]);
  assert.equal(Help.latest(all, "lili", DAY, "morning").reroll, 2, "reopening the slot reuses the newest decision: no new pick");
  assert.equal(Help.latest(all, "lili", DAY, "evening"), null, "a new slot makes one new decision");
  assert.equal(Help.latest(all, "luis", DAY, "morning"), null);
});
test("saved decision cards: finished shows its state, started hides, the gap refills", () => {
  const c = guideCtx(10 * 60);
  const ranked = Help.rank(c);
  const [a, b, x] = ranked.map((r) => r.item.id);
  const dec = { picks: [{ id: a, line: ["A", "甲"] }, { id: b, line: ["B", "乙"] }, { id: x, line: ["C", "丙"] }], started_id: b };
  const cards = Help.view(dec, ranked.filter((r) => r.item.id !== a), (id) => (id === a ? "check" : null));
  assert.equal(cards.length, 3);
  assert.deepEqual(cards[0], { id: a, item: Help.ITEMS.find((i) => i.id === a), line: ["A", "甲"], state: "check" });
  assert.ok(!cards.some((k) => k.id === b), "a started pick is hidden");
  assert.equal(cards[1].id, x);assert.deepEqual(cards[1].line, ["C", "丙"]);
  assert.equal(cards[2].state, "live");assert.equal(cards[2].line, null, "a refill uses the goal line");
  assert.equal(Help.view({ picks: [], started_id: null }, [], () => null).length, 0);
});
test("guide words come from SQSummerAgent help stages, bilingual, never the remote", async () => {
  const Agent = require("../js/summer-agent.js");
  let remoteCalls = 0;
  Agent.setRemoteProvider(() => { remoteCalls++; return {}; });
  try {
    const done = await Agent.interact({ stage: "help_done", choices: [{ id: "room" }] });
    assert.equal(done.questionId, "help_done");assert.deepEqual(done.choices, [{ id: "room" }]);
    const time = await Agent.interact({ stage: "help_time", choices: Help.TIME_CHOICES });
    assert.equal(time.choices.length, 3);
    const pick = await Agent.interact({ stage: "help_pick", picks: ["room", "shoes"] });
    assert.deepEqual(pick.picks, ["room", "shoes"]);
    const rest = await Agent.interact({ stage: "help_pick", picks: [] });
    assert.match(rest.speech, /Rest time/);assert.match(rest.speechZh, /休息/);
    for (const r of [done, time, pick, rest]) assert.ok(r.speech && /[\u4e00-\u9fff]/.test(r.speechZh));
    assert.equal(remoteCalls, 0);
  } finally { Agent.setRemoteProvider(null); }
});
