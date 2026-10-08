// Daily points gate + home-help data (docs/plans/2026-10-08-games-gate-ai-guide/ slice 01).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("home-help kinds that exist resolve to real awards and quests", () => {
  const quests = new Set(SQQuestData.all().map((q) => q.id));
  for (const id of ["homework", "room", "clothes", "table"]) {
    const item = Help.ITEMS.find((i) => i.id === id);
    assert.ok(SQPoints.rules[item.kind], item.kind + " is a points kind");
    const qs = item.quest && typeof item.quest === "object" ? Object.values(item.quest) : item.quest ? [item.quest] : [];
    for (const q of qs) assert.ok(quests.has(q), q + " is a quest");
    if (!qs.length) assert.equal(item.route, "day");
  }
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
  const firstSoon = noon.findIndex((x) => !x.ready);
  assert.ok(firstSoon > 0 && noon.slice(firstSoon).every((x) => !x.ready));
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
