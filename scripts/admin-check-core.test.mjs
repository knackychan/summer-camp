// The parents' phone screens: Awaiting cards and one kid's games day
// (docs/plans/2026-10-19-parent-app-layout/).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const C = require("../js/admin-check-core.js");
const G = require("../js/games-gate-core.js");
const S = require("../js/school-data.js");
const P = require("../js/points.js");
const deps = { rules: P.rules, extra: P.extraKinds(), chores: S.CHORES, bonus: S.BONUS };
const DAY = "2026-10-19";
const claim = (o) => ({ day: DAY, slot: "default", status: "pending", amount: 5, ...o });

test("a chore card shows the kid's own EN + 中文 label and icon; a bonus is marked", () => {
  const v = C.claimView(claim({ id: "a", kid_id: "lili", kind: "rice_wash", evidence: { label: ["Wash the rice", "洗米"] } }), deps);
  assert.deepEqual([v.label, v.icon, v.bonus], [["Wash the rice", "洗米"], "🍚", false]);
  assert.equal(C.claimView(claim({ id: "b", kid_id: "luis", kind: "gym_exercise", amount: 20 }), deps).bonus, true);
  assert.deepEqual(C.claimView(claim({ id: "c", kid_id: "luis", kind: "morning_teeth" }), deps).label, ["Morning Teeth", "早晨刷牙"]);
});
test("Awaiting lists pending claims and reward asks newest first", () => {
  const rows = {
    pointClaims: [claim({ id: "old", kid_id: "lili", kind: "desk_tidy", created_at: "2026-10-19T08:00:00Z" }), claim({ id: "done", kid_id: "lili", kind: "bed_prepare", status: "confirmed", created_at: "2026-10-19T08:30:00Z" })],
    pointRequests: [{ id: "r", kid_id: "luis", label: ["Movie pick", "選電影"], points: 200, status: "requested", created_at: "2026-10-19T08:10:00Z" }, { id: "x", status: "approved" }]
  };
  assert.deepEqual(C.items(rows, deps).map((i) => i.id), ["r", "old"]);
});
test("a kid's day: Brain Gym first, then the school bar; pending counts, bonus never", () => {
  const settings = { games_gate_v1: JSON.stringify({ enabled: true, threshold: { luis: 50 }, schoolThreshold: { luis: 40 } }) };
  const claimsToday = [claim({ kid_id: "luis", kind: "vacuum_floor", amount: 10, status: "confirmed" }), claim({ kid_id: "luis", kind: "dishwasher_unload", amount: 10 }), claim({ kid_id: "luis", kind: "gym_exercise", amount: 20 })];
  const ctx = { settings, gate: G, today: DAY, mode: "school", claimsToday, exclude: deps.extra, brain: { luis: 1 } };
  let d = C.kidDay("luis", ctx);
  assert.deepEqual([d.points, d.threshold, d.waiting, d.games.key], [20, 40, 10, "brain"]);
  d = C.kidDay("luis", { ...ctx, brain: { luis: 3 } });
  assert.deepEqual([d.games.key, d.games.text], ["points", "20 more points to open Games"]);
  d = C.kidDay("luis", { ...ctx, settings: { ...settings, braingate_luis: DAY } });
  assert.equal(d.games.key, "papa");
  d = C.kidDay("luis", { ...ctx, settings: { ...settings, catlock_luis_games: "1" }, brain: { luis: 3 } });
  assert.equal(d.games.key, "locked");
});
test("threshold steppers stay on 0..300 in steps of 5", () => {
  assert.deepEqual([C.step(0, -5), C.step(300, 5), C.step(42, 5), C.step(35, -5)], [0, 300, 45, 30]);
});
