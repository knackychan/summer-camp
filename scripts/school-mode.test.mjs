// School mode, after-school plan and home chores (docs/plans/2026-10-19-school-mode-chores/).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const School = require("../js/school-data.js");
const Gate = require("../js/games-gate-core.js");
const SQPoints = require("../js/points.js");

const zh = /[㐀-鿿]/;
const pair = (p, where) => {
  assert.ok(Array.isArray(p) && p.length === 2 && p[0] && p[1], where + " has EN + 中文");
  assert.match(p[1], zh, where + " 中文 is Chinese");
};

test("mode: holiday by default, school only Monday to Friday", () => {
  assert.equal(School.parseMode(undefined).mode, "holiday");
  assert.equal(School.parseMode("junk").mode, "holiday");
  assert.equal(School.parseMode(JSON.stringify({ mode: "school" })).mode, "school");
  const fs = { day_mode_v1: JSON.stringify({ mode: "school" }) };
  assert.equal(School.modeFor("2026-10-19", fs), "school"); // Monday
  assert.equal(School.modeFor("2026-10-23", fs), "school"); // Friday
  assert.equal(School.modeFor("2026-10-24", fs), "holiday"); // Saturday
  assert.equal(School.modeFor("2026-10-25", fs), "holiday"); // Sunday
  assert.equal(School.modeFor("2026-10-19", {}), "holiday");
});

test("after-school plan: ordered times, every line bilingual for every kid", () => {
  let last = -1;
  School.SCHEDULE.forEach((r, i) => {
    const m = School.mins(r.t);
    assert.ok(m > last, "row " + i + " is after the one before");
    last = m;
    pair(r.title, "row " + i);
    for (const kid of School.KIDS) pair(r.txt[kid], "row " + i + " " + kid);
  });
  assert.equal(School.currentRow(School.mins("15:00")), -1);
  assert.equal(School.currentRow(School.mins("16:25")), 1);
  assert.ok(School.SCHEDULE.some((r) => r.gate === "screen"), "screen time row says when it opens");
});

test("chores: Papa's list, real points kinds, bilingual, unique identities", () => {
  assert.equal(School.CHORES.length, 14);
  const ids = new Set(), identities = new Set();
  for (const c of School.CHORES) {
    assert.ok(SQPoints.rules[c.kind], c.id + " resolves to a points kind");
    assert.equal(SQPoints.rules[c.kind].category, "help");
    pair(c.label, c.id);
    pair(SQPoints.rules[c.kind].label, c.kind);
    assert.ok(!ids.has(c.id)); ids.add(c.id);
    const key = c.kind + ":" + (c.slot || "default");
    assert.ok(!identities.has(key), key + " pays once"); identities.add(key);
    assert.doesNotThrow(() => SQPoints.claim("lili", "2026-10-19", c.kind, { slot: c.slot }));
  }
  for (const k of ["rice_wash", "dishwasher_load", "dishwasher_unload", "desk_tidy", "bed_prepare", "floor_toys", "garden_toys", "garlic_peel", "bowls_tidy", "altar_water", "vacuum_floor"])
    assert.equal(SQPoints.rules[k].parent, true, k + " is Papa-checked");
  for (const t of Object.keys(School.TEXT)) pair(School.TEXT[t], "TEXT." + t);
});

test("chore state: todo, waiting (queued/pending), confirmed, denied", () => {
  const day = "2026-10-19", rice = School.CHORES.find((c) => c.id === "rice"), table = School.CHORES.find((c) => c.id === "table");
  assert.equal(School.choreState("lili", day, rice, {}), "todo");
  assert.equal(School.choreState("lili", day, rice, { queue: [{ type: "pointClaim", claim: { kid_id: "lili", day, kind: "rice_wash", slot: "default" } }] }), "waiting");
  assert.equal(School.choreState("lili", day, rice, { claims: [{ kid_id: "lili", day, kind: "rice_wash", slot: "default", status: "pending" }] }), "waiting");
  assert.equal(School.choreState("lili", day, rice, { claims: [{ kid_id: "lili", day, kind: "rice_wash", slot: "default", status: "confirmed" }] }), "confirmed");
  assert.equal(School.choreState("lili", day, rice, { claims: [{ kid_id: "lili", day, kind: "rice_wash", slot: "default", status: "denied" }] }), "denied");
  assert.equal(School.choreState("luis", day, rice, { claims: [{ kid_id: "lili", day, kind: "rice_wash", slot: "default", status: "confirmed" }] }), "todo");
  assert.equal(School.choreState("lili", day, table, { claims: [{ kid_id: "lili", day, kind: "table_helper", slot: "lunch", status: "confirmed" }] }), "todo", "lunch table is not the dinner chore");
});

test("gate: school-day thresholds are separate and default to the holiday ones", () => {
  const d = Gate.parseSettings(undefined);
  assert.deepEqual(d.schoolThreshold, d.threshold);
  const s = { enabled: true, threshold: { luis: 50, lili: 50, lucien: 40 }, schoolThreshold: { luis: 35, lili: 33, lucien: 0 } };
  assert.deepEqual(Gate.parseSettings(s).schoolThreshold, { luis: 35, lili: 35, lucien: 0 });
  assert.equal(Gate.state("luis", { settings: s, mode: "school", today: 35 }).open, true);
  assert.equal(Gate.state("luis", { settings: s, mode: "holiday", today: 35 }).open, false);
  assert.equal(Gate.state("lucien", { settings: s, mode: "school", today: 0 }).reason, "off");
  const legacy = { enabled: true, threshold: { luis: 60 } };
  assert.equal(Gate.parseSettings(legacy).schoolThreshold.luis, 60, "an old setting keeps one bar for both");
});

test("server migration carries every new chore kind with the client amount", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261019_school_chores_kinds.sql", import.meta.url), "utf8");
  for (const c of School.CHORES) {
    const r = SQPoints.rules[c.kind];
    assert.match(sql, new RegExp(`"${c.kind}":\\[${r.points},${r.limit},"helping","${r.parent ? "parent" : "self"}"\\]`), c.kind + " in points_policy");
    assert.match(sql, new RegExp(`when '${c.kind}' then ${r.points}\\b`), c.kind + " in the snapshot defaults");
  }
});

test("bonus tasks: Papa-checked extra points that never open Games", () => {
  assert.deepEqual(School.BONUS.map((b) => b.kind), ["gym_exercise", "music_bonus"]);
  assert.deepEqual(SQPoints.extraKinds().sort(), ["gym_exercise", "music_bonus"]);
  for (const b of School.BONUS) { pair(b.label, b.id); assert.equal(SQPoints.rules[b.kind].parent, true); }
  const day = "2026-10-19";
  const claims = [
    { kid_id: "lili", day, kind: "gym_exercise", slot: "default", amount: 20, status: "pending" },
    { kid_id: "lili", day, kind: "rice_wash", slot: "default", amount: 5, status: "pending" }
  ];
  assert.equal(Gate.todayPoints("lili", day, { claims, exclude: SQPoints.extraKinds() }), 5);
  assert.equal(Gate.todayPoints("lili", day, { claims }), 25, "without exclude every kind counts, as before");
  const sql = readFileSync(new URL("../supabase/migrations/20261019_school_chores_kinds.sql", import.meta.url), "utf8");
  assert.match(sql, /"gym_exercise":\[20,1,"movement","parent"\]/);
  assert.match(sql, /"music_bonus":\[15,1,"learning","parent"\]/);
  assert.match(sql, /when 'gym_exercise' then 20 when 'music_bonus' then 15/);
});
