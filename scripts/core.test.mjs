import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const SQTime = require("../js/time-core.js");
const SQLock = require("../js/lock-core.js");
const SQDrills = require("../js/drills.js");

const DAY = [
  { t: "8:00", title: "Wake", tz: "起床", kind: "routine", txtz: {} },
  { t: "10:00", title: "Homework", tz: "暑假作業", kind: "mission" },
  { t: "11:15", title: "Screen #1 — earned", tz: "螢幕#1", kind: "routine", txtz: {} },
  { t: "17:15", title: "Sport", tz: "運動", kind: "mission" },
  { t: "✨", title: "Bonus", tz: "加碼", kind: "mission" },
];

test("parseMins", () => {
  assert.equal(SQTime.parseMins("8:00"), 480);
  assert.equal(SQTime.parseMins("17:15"), 1035);
  assert.equal(SQTime.parseMins("✨"), null);
  assert.equal(SQTime.parseMins(undefined), null);
});

test("effMins uses override when present", () => {
  assert.equal(SQTime.effMins(DAY, {}, 1), 600);
  assert.equal(SQTime.effMins(DAY, { 1: "15:00" }, 1), 900);
  assert.equal(SQTime.effMins(DAY, {}, 4), null);
});

test("timedOrder sorts by effective time and skips untimed", () => {
  assert.deepEqual(SQTime.timedOrder(DAY, {}).map(x => x.i), [0, 1, 2, 3]);
  assert.deepEqual(SQTime.timedOrder(DAY, { 1: "15:00" }).map(x => x.i), [0, 2, 1, 3]);
});

test("timelineInfo current/next with and without overrides", () => {
  assert.deepEqual(SQTime.timelineInfo(DAY, {}, 7 * 60), { now: 420, current: 0, next: 0 });
  const mid = SQTime.timelineInfo(DAY, {}, 10 * 60 + 30);
  assert.equal(mid.current, 1);
  assert.equal(mid.next, 2);
  const late = SQTime.timelineInfo(DAY, {}, 23 * 60);
  assert.equal(late.current, 3);
  assert.equal(late.next, null);
  const moved = SQTime.timelineInfo(DAY, { 1: "15:00" }, 10 * 60 + 30);
  assert.equal(moved.current, 0);
  assert.equal(moved.next, 2);
  const aft = SQTime.timelineInfo(DAY, { 1: "15:00" }, 15 * 60 + 5);
  assert.equal(aft.current, 1);
  assert.equal(aft.next, 3);
});

test("timelineInfo before first block clamps to first timed", () => {
  const info = SQTime.timelineInfo(DAY, {}, 0);
  assert.equal(info.current, 0);
});

test("neededBefore respects effective order", () => {
  assert.deepEqual(SQTime.neededBefore(DAY, {}, 2), [0, 1]);
  assert.deepEqual(SQTime.neededBefore(DAY, { 1: "15:00" }, 2), [0]);
});

test("displayOrder = timed ascending then untimed in DAY order", () => {
  assert.deepEqual(SQTime.displayOrder(DAY, {}), [0, 1, 2, 3, 4]);
  assert.deepEqual(SQTime.displayOrder(DAY, { 1: "15:00" }), [0, 2, 1, 3, 4]);
});

test("resolveOverrides: kid row wins over all row", () => {
  const raw = {
    all: { 1: "15:00", 3: "17:30" },
    lili: { 1: "16:00" },
  };
  assert.deepEqual(SQTime.resolveOverrides(raw, "lili"), { 1: "16:00", 3: "17:30" });
  assert.deepEqual(SQTime.resolveOverrides(raw, "luis"), { 1: "15:00", 3: "17:30" });
  assert.deepEqual(SQTime.resolveOverrides(raw, null), { 1: "15:00", 3: "17:30" });
  assert.deepEqual(SQTime.resolveOverrides(null, "lili"), {});
});

const LDAY = [
  { t: "8:00", title: "Wake", tz: "起床" },
  { t: "10:00", title: "Homework", tz: "暑假作業" },
  { t: "11:15", title: "Screen #1 — earned", tz: "螢幕#1" },
  { t: "12:00", title: "Lunch", tz: "午餐" },
  { t: "✨", title: "Bonus", tz: "加碼" },
];
const noPass = () => false;
const lock = (now, done, passOk = noPass, overrides = {}, redos = {}) =>
  SQLock.computeLock({ day: LDAY, overrides, now, done, passOk, redos });

test("locked during unticked activity block", () => {
  assert.deepEqual(lock(10 * 60 + 30, {}), { locked: true, blockIdx: 1 });
});

test("unlocked once current activity ticked", () => {
  assert.deepEqual(lock(10 * 60 + 30, { 1: true }), { locked: false, blockIdx: null });
});

test("pass on current block unlocks", () => {
  assert.deepEqual(lock(10 * 60 + 30, {}, i => i === 1), { locked: false, blockIdx: null });
});

test("overrun linger: screen block current, previous activity unticked", () => {
  assert.deepEqual(lock(11 * 60 + 30, { 0: true }), { locked: true, blockIdx: 1 });
  assert.deepEqual(lock(11 * 60 + 30, { 0: true, 1: true }), { locked: false, blockIdx: null });
});

test("current activity governs alone even if earlier one unticked", () => {
  assert.deepEqual(lock(12 * 60 + 10, { 3: true }), { locked: false, blockIdx: null });
  assert.deepEqual(lock(12 * 60 + 10, {}), { locked: true, blockIdx: 3 });
});

test("before first block: unlocked", () => {
  assert.deepEqual(lock(6 * 60, {}), { locked: false, blockIdx: null });
});

test("override moves the governing block", () => {
  assert.deepEqual(lock(10 * 60 + 30, {}, noPass, { 1: "15:00" }), { locked: true, blockIdx: 0 });
  assert.deepEqual(lock(10 * 60 + 30, { 0: true }, noPass, { 1: "15:00" }), { locked: false, blockIdx: null });
});

test("redo block locks games regardless of clock", () => {
  // 6:00 — before any block, normally unlocked; redo flag on homework forces the lock
  assert.deepEqual(lock(6 * 60, {}, noPass, {}, { 1: true }), { locked: true, blockIdx: 1 });
});

test("re-ticked redo block unlocks", () => {
  assert.deepEqual(lock(6 * 60, { 1: true }, noPass, {}, { 1: true }), { locked: false, blockIdx: null });
});

test("pass on redo block unlocks", () => {
  assert.deepEqual(lock(6 * 60, {}, i => i === 1, {}, { 1: true }), { locked: false, blockIdx: null });
});

test("redo lock outranks current-block verdict", () => {
  // 12:10 lunch current+ticked, homework redo-flagged and unticked → locked by homework
  assert.deepEqual(lock(12 * 60 + 10, { 3: true }, noPass, {}, { 1: true }), { locked: true, blockIdx: 1 });
});

test("practice-day alternation is deterministic and roughly half", () => {
  const days = ["2026-07-27","2026-07-28","2026-07-29","2026-07-30","2026-07-31","2026-08-01","2026-08-02","2026-08-03"];
  const flags = days.map(d => SQDrills.isPracticeDay(d));
  days.forEach((d, i) => assert.equal(SQDrills.isPracticeDay(d), flags[i]));
  const yes = flags.filter(Boolean).length;
  assert.ok(yes >= 2 && yes <= 6, `expected roughly half practice days, got ${yes}/8`);
});

test("sessionFor is deterministic per kid+date and respects DRILL_PLAN", () => {
  for (const kid of ["lucien","lili","luis"]) {
    const a = SQDrills.sessionFor(kid, "2026-07-28");
    const b = SQDrills.sessionFor(kid, "2026-07-28");
    assert.deepEqual(a, b);
    assert.ok(SQDrills.DRILL_PLAN[kid].includes(a.discipline));
    assert.ok(Array.isArray(a.drill.steps) && a.drill.steps.length >= 3);
  }
});

test("rotation varies across dates", () => {
  const picks = new Set(["2026-07-28","2026-07-30","2026-08-01","2026-08-03","2026-08-05","2026-08-07"]
    .map(d => JSON.stringify(SQDrills.sessionFor("lili", d))));
  assert.ok(picks.size >= 2, "same drill every practice day — rotation broken");
});

test("all drill steps are bilingual pairs", () => {
  for (const [disc, drills] of Object.entries(SQDrills.DRILLS)) {
    for (const drill of drills) {
      assert.ok(drill.name[0] && drill.name[1], `${disc} drill missing bilingual name`);
      for (const s of drill.steps)
        assert.ok(Array.isArray(s) && s.length === 2 && s[0] && s[1], `${disc}/${drill.name[0]} step not [en,zh]`);
    }
  }
});

const SQBrainCore = require("../js/brain-core.js");
const SQBrainData = require("../js/brain-data.js");

test("tierFor falls back to the per-kid default", () => {
  assert.equal(SQBrainCore.tierFor("lucien", {}), "tot");
  assert.equal(SQBrainCore.tierFor("lili", {}), "mid");
  assert.equal(SQBrainCore.tierFor("luis", {}), "hard");
  assert.equal(SQBrainCore.tierFor("nobody", {}), "mid");
});

test("tierFor honours a valid admin override", () => {
  assert.equal(SQBrainCore.tierFor("lucien", { brain_tier_lucien: "mid" }), "mid");
  assert.equal(SQBrainCore.tierFor("luis", { brain_tier_luis: "tot" }), "tot");
});

test("tierFor ignores an empty or unrecognised override", () => {
  assert.equal(SQBrainCore.tierFor("lucien", { brain_tier_lucien: "" }), "tot");
  assert.equal(SQBrainCore.tierFor("lucien", { brain_tier_lucien: "genius" }), "tot");
});

test("mulberry32 is deterministic and in range", () => {
  const a = SQBrainCore.mulberry32(42);
  const b = SQBrainCore.mulberry32(42);
  for (let i = 0; i < 20; i++) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1);
  }
});

/* a fake catalogue so these tests never break when real game content changes */
const FAKE = {
  TIERS: ["tot", "mid", "hard"],
  TIER_DEFAULT: { lucien: "tot", lili: "mid", luis: "hard" },
  GAMES: {
    a: { id: "a", skill: "math",      tiers: { tot: {}, mid: {}, hard: {} } },
    b: { id: "b", skill: "memory",    tiers: { tot: {}, mid: {}, hard: {} } },
    c: { id: "c", skill: "attention", tiers: { tot: {}, mid: {}, hard: {} } },
    d: { id: "d", skill: "math",      tiers: { mid: {}, hard: {} } },
    e: { id: "e", skill: "logic",     tiers: { mid: {}, hard: {} } },
  },
};

test("eligibleGames drops games with no tier for that kid", () => {
  assert.deepEqual(SQBrainCore.eligibleGames("lucien", {}, FAKE), ["a", "b", "c"]);
  assert.deepEqual(SQBrainCore.eligibleGames("lili", {}, FAKE), ["a", "b", "c", "d", "e"]);
});

test("eligibleGames follows an admin tier override", () => {
  assert.deepEqual(
    SQBrainCore.eligibleGames("lili", { brain_tier_lili: "tot" }, FAKE),
    ["a", "b", "c"]
  );
});

test("dailyThree is deterministic for the same kid and date", () => {
  const one = SQBrainCore.dailyThree("lili", "2026-07-27", {}, FAKE);
  const two = SQBrainCore.dailyThree("lili", "2026-07-27", {}, FAKE);
  assert.deepEqual(one, two);
  assert.equal(one.length, 3);
  assert.equal(new Set(one).size, 3);
});

test("dailyThree differs by kid and by date", () => {
  const lili = SQBrainCore.dailyThree("lili", "2026-07-27", {}, FAKE);
  const luis = SQBrainCore.dailyThree("luis", "2026-07-27", {}, FAKE);
  const next = SQBrainCore.dailyThree("lili", "2026-07-28", {}, FAKE);
  assert.ok(lili.join() !== luis.join() || lili.join() !== next.join());
});

test("dailyThree prefers three different skills when it can", () => {
  for (const day of ["2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30", "2026-08-01"]) {
    const trio = SQBrainCore.dailyThree("luis", day, {}, FAKE);
    const skills = trio.map((id) => FAKE.GAMES[id].skill);
    assert.equal(new Set(skills).size, 3, `${day} gave ${skills.join("/")}`);
  }
});

test("dailyThree returns the whole pool when fewer than three games are eligible", () => {
  const tiny = { TIERS: FAKE.TIERS, TIER_DEFAULT: FAKE.TIER_DEFAULT, GAMES: { a: FAKE.GAMES.a, b: FAKE.GAMES.b } };
  assert.deepEqual(SQBrainCore.dailyThree("lucien", "2026-07-27", {}, tiny).length, 2);
});
