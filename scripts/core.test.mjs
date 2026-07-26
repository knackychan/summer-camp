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

test("every game declares bilingual title, skill and at least one tier", () => {
  const ids = Object.keys(SQBrainData.GAMES);
  assert.ok(ids.length >= 1);
  for (const id of ids) {
    const g = SQBrainData.GAMES[id];
    assert.equal(g.id, id, `${id}: id mismatch`);
    assert.ok(g.icon, `${id}: missing icon`);
    assert.ok(g.title && g.title[0] && g.title[1], `${id}: title must be [en, zh]`);
    assert.ok(g.blurb && g.blurb[0] && g.blurb[1], `${id}: blurb must be [en, zh]`);
    assert.ok(g.skill, `${id}: missing skill tag`);
    const tiers = Object.keys(g.tiers);
    assert.ok(tiers.length >= 1, `${id}: no tiers`);
    for (const t of tiers) assert.ok(SQBrainData.TIERS.indexOf(t) >= 0, `${id}: bad tier ${t}`);
  }
});

test("every tier generator produces a well-formed item", () => {
  const rnd = SQBrainCore.mulberry32(1);
  for (const id of Object.keys(SQBrainData.GAMES)) {
    const g = SQBrainData.GAMES[id];
    for (const t of Object.keys(g.tiers)) {
      const cfg = g.tiers[t];
      assert.ok(cfg.items > 0, `${id}.${t}: items must be > 0`);
      assert.equal(typeof cfg.clock, "boolean", `${id}.${t}: clock must be boolean`);
      assert.ok(["keypad", "choice", "grid", "type"].indexOf(cfg.pad) >= 0, `${id}.${t}: bad pad`);
      if (typeof cfg.gen !== "function") continue;   // build()-driven tier, covered by its own test
      for (let n = 0; n < 25; n++) {
        const item = cfg.gen(rnd);
        assert.ok(item.prompt && item.prompt.type, `${id}.${t}: item missing prompt.type`);
        assert.equal(typeof item.answer, "string", `${id}.${t}: answer must be a string`);
        assert.ok(item.answer.length > 0, `${id}.${t}: empty answer`);
        if (cfg.pad === "choice") {
          assert.ok(Array.isArray(item.choices), `${id}.${t}: choice pad needs choices`);
          assert.ok(item.choices.indexOf(item.answer) >= 0, `${id}.${t}: answer not among choices`);
          assert.equal(new Set(item.choices).size, item.choices.length, `${id}.${t}: duplicate choices`);
        }
      }
    }
  }
});

test("tot tiers never run a clock", () => {
  for (const id of Object.keys(SQBrainData.GAMES)) {
    const tot = SQBrainData.GAMES[id].tiers.tot;
    if (tot) assert.equal(tot.clock, false, `${id}: tot tier must not be clocked`);
  }
});

test("buildRound produces the tier's item count and config", () => {
  const round = SQBrainCore.buildRound("calc", "mid", SQBrainCore.mulberry32(9));
  assert.equal(round.gameId, "calc");
  assert.equal(round.tier, "mid");
  assert.equal(round.pad, "keypad");
  assert.equal(round.clock, true);
  assert.equal(round.items.length, 20);
  assert.equal(round.items.filter((i) => typeof i.answer === "string").length, 20);
});

test("buildRound on a tot tier is unclocked", () => {
  const round = SQBrainCore.buildRound("calc", "tot", SQBrainCore.mulberry32(9));
  assert.equal(round.clock, false);
  assert.equal(round.pad, "choice");
  assert.equal(round.items.length, 10);
});

test("buildRound throws on an unknown game or tier", () => {
  assert.throws(() => SQBrainCore.buildRound("nope", "mid", SQBrainCore.mulberry32(1)));
  assert.throws(() => SQBrainCore.buildRound("calc", "nope", SQBrainCore.mulberry32(1)));
});

test("scoreRound counts correct answers and keeps ms only when clocked", () => {
  const items = [{ answer: "3" }, { answer: "5" }, { answer: "7" }];
  const clocked = SQBrainCore.scoreRound({ items: items, answers: ["3", "4", "7"], ms: 12000, clock: true });
  assert.equal(clocked.score, 2);
  assert.equal(clocked.total, 3);
  assert.equal(clocked.ms, 12000);
  assert.deepEqual(clocked.correct, [true, false, true]);

  const unclocked = SQBrainCore.scoreRound({ items: items, answers: ["3", "5", "7"], ms: 12000, clock: false });
  assert.equal(unclocked.score, 3);
  assert.equal(unclocked.ms, 0);
});

test("scoreRound compares answers as trimmed strings", () => {
  const out = SQBrainCore.scoreRound({ items: [{ answer: "13" }], answers: [" 13 "], ms: 0, clock: false });
  assert.equal(out.score, 1);
});

test("scoreRound treats a missing answer as wrong, never as a crash", () => {
  const out = SQBrainCore.scoreRound({ items: [{ answer: "1" }, { answer: "2" }], answers: ["1"], ms: 0, clock: false });
  assert.equal(out.score, 1);
  assert.deepEqual(out.correct, [true, false]);
});

test("scoreRound still scores plain items one point each", () => {
  const out = SQBrainCore.scoreRound({
    items: [{ answer: "1" }, { answer: "2" }], answers: ["1", "9"], ms: 0, clock: false,
  });
  assert.equal(out.score, 1);
  assert.equal(out.total, 2);
});

test("scoreRound honours item.worth", () => {
  const out = SQBrainCore.scoreRound({
    items: [{ answer: "a", worth: 0 }, { answer: "b", worth: 5 }],
    answers: ["zzz", "b"], ms: 0, clock: false,
  });
  assert.equal(out.score, 5);
  assert.equal(out.total, 5);
});

test("scoreRound honours item.grade for partial credit", () => {
  const item = {
    worth: 4,
    answer: "cat dog fish bird",
    grade: (given) => String(given).split(/\s+/).filter((w) => ["cat", "dog", "fish", "bird"].indexOf(w) >= 0).length,
  };
  const out = SQBrainCore.scoreRound({ items: [item], answers: ["cat bird zebra"], ms: 0, clock: false });
  assert.equal(out.score, 2);
  assert.equal(out.total, 4);
  assert.deepEqual(out.correct, [false]);   // partial is not "correct"
});

test("scoreRound clamps grade into 0..worth", () => {
  const item = { worth: 2, answer: "x", grade: () => 99 };
  const out = SQBrainCore.scoreRound({ items: [item], answers: ["x"], ms: 0, clock: false });
  assert.equal(out.score, 2);
});

test("buildRound uses a tier-level build() when present", () => {
  const FAKE_BUILD = {
    TIERS: ["tot", "mid", "hard"], TIER_DEFAULT: { lili: "mid" },
    GAMES: {
      chain: {
        id: "chain", skill: "memory", icon: "x", title: ["a", "b"], blurb: ["a", "b"],
        tiers: { mid: { items: 3, clock: true, pad: "keypad",
          build: (rnd, cfg) => [{ answer: "0", worth: 0 }, { answer: "1" }, { answer: "2" }] } },
      },
    },
  };
  const round = SQBrainCore.buildRound("chain", "mid", SQBrainCore.mulberry32(1), FAKE_BUILD);
  assert.equal(round.items.length, 3);
  assert.equal(round.items[0].worth, 0);
});

test("Sign Finder answers are always a real operator that makes the equation true", () => {
  const rnd = SQBrainCore.mulberry32(3);
  for (const tier of ["tot", "mid", "hard"]) {
    const round = SQBrainCore.buildRound("signs", tier, rnd);
    for (const item of round.items) {
      assert.ok(["+", "−", "×", "÷"].indexOf(item.answer) >= 0);
      const [a, b, r] = [item.prompt.a, item.prompt.b, item.prompt.r];
      const applied = { "+": a + b, "−": a - b, "×": a * b, "÷": a / b }[item.answer];
      assert.equal(applied, r, `${a} ${item.answer} ${b} should be ${r}`);
      assert.ok(item.choices.indexOf(item.answer) >= 0);
    }
  }
});

test("Sign Finder tot only ever asks for plus or minus", () => {
  const round = SQBrainCore.buildRound("signs", "tot", SQBrainCore.mulberry32(11));
  for (const item of round.items) {
    assert.ok(["+", "−"].indexOf(item.answer) >= 0);
    assert.ok(item.prompt.r >= 0);
  }
});

test("Color Words asks for the ink, never the word", () => {
  const round = SQBrainCore.buildRound("stroop", "mid", SQBrainCore.mulberry32(5));
  for (const item of round.items) {
    assert.equal(item.answer, item.prompt.ink);
    assert.ok(item.choices.indexOf(item.answer) >= 0);
    assert.equal(item.choices.length, 4);
  }
});

test("Color Words tot uses swatches and never a written word", () => {
  const round = SQBrainCore.buildRound("stroop", "tot", SQBrainCore.mulberry32(5));
  for (const item of round.items) {
    assert.equal(item.prompt.type, "swatch");
    assert.equal(item.choiceStyle, "swatch");
    assert.ok(item.say && item.say[0] && item.say[1]);
  }
});

test("Number Cruncher's answer equals the real count in the field", () => {
  const rnd = SQBrainCore.mulberry32(7);
  for (const tier of ["tot", "mid", "hard"]) {
    const round = SQBrainCore.buildRound("crunch", tier, rnd);
    for (const item of round.items) {
      const actual = item.prompt.glyphs.filter((g) => g === item.prompt.target).length;
      assert.equal(Number(item.answer), actual);
      assert.ok(actual >= 1, "never ask for a count of zero");
    }
  }
});

test("Time Lapse answers are valid 12-hour clock strings", () => {
  const rnd = SQBrainCore.mulberry32(13);
  for (const tier of ["tot", "mid", "hard"]) {
    const round = SQBrainCore.buildRound("clock", tier, rnd);
    for (const item of round.items) {
      assert.match(item.answer, /^([1-9]|1[0-2]):[0-5][0-9]$/);
      assert.ok(item.prompt.h >= 1 && item.prompt.h <= 12);
      assert.ok(item.prompt.m >= 0 && item.prompt.m <= 59);
      assert.ok(item.choices.indexOf(item.answer) >= 0);
    }
  }
});

test("Time Lapse tot only shows whole hours", () => {
  const round = SQBrainCore.buildRound("clock", "tot", SQBrainCore.mulberry32(2));
  for (const item of round.items) assert.equal(item.prompt.m, 0);
});

test("Change Maker never asks for negative change", () => {
  const rnd = SQBrainCore.mulberry32(17);
  for (const tier of ["mid", "hard"]) {
    const round = SQBrainCore.buildRound("change", tier, rnd);
    for (const item of round.items) {
      assert.ok(item.prompt.paid > item.prompt.price);
      assert.equal(Number(item.answer), item.prompt.paid - item.prompt.price);
    }
  }
});

test("Change Maker tot compares two coins and names the bigger one", () => {
  const round = SQBrainCore.buildRound("change", "tot", SQBrainCore.mulberry32(4));
  for (const item of round.items) {
    assert.equal(item.choices.length, 2);
    assert.equal(item.answer, String(Math.max(Number(item.choices[0]), Number(item.choices[1]))));
  }
});

test("Low to High answers are the cells sorted ascending", () => {
  const rnd = SQBrainCore.mulberry32(21);
  for (const tier of ["tot", "mid", "hard"]) {
    const round = SQBrainCore.buildRound("lowhigh", tier, rnd);
    assert.equal(round.pad, "grid");
    for (const item of round.items) {
      const ns = item.prompt.cells.map((c) => c.n);
      assert.equal(new Set(ns).size, ns.length, "no duplicate numbers in a grid");
      assert.equal(item.answer, ns.slice().sort((a, b) => a - b).join(","));
      assert.ok(item.prompt.flashMs >= 1000);
    }
  }
});

test("Low to High grows with the tier", () => {
  const tot = SQBrainCore.buildRound("lowhigh", "tot", SQBrainCore.mulberry32(1));
  const hard = SQBrainCore.buildRound("lowhigh", "hard", SQBrainCore.mulberry32(1));
  assert.equal(tot.items[0].prompt.cells.length, 3);
  assert.equal(hard.items[0].prompt.cells.length, 7);
  assert.ok(tot.items[0].prompt.flashMs > hard.items[0].prompt.flashMs, "tot gets a longer look");
});
