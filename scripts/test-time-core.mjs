/* Ripple + template math. node scripts/test-time-core.mjs */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const SQT = createRequire(import.meta.url)("../js/time-core.js");

const fresh = () => [
  { t: "8:00" }, { t: "9:00" }, { t: "10:00" }, { t: "✨" }
];

/* ---- ripple: this block and every later one, never the earlier ones ---- */
{
  const day = fresh();
  const r = SQT.ripple(day, {}, 1);
  assert.deepEqual(r.group.map(x => x.i), [1, 2], "ripple carries the tail only");
  assert.equal(r.min, -55, "may rise to 5 min after the block above");
  assert.equal(r.max, 23 * 60 + 55 - 600, "last block may not pass 23:55");
  assert.equal(SQT.ripple(day, {}, 3), null, "untimed block has no ripple");
}

/* Clamping is what makes overlap impossible — the whole reason there is no
   collision handling anywhere in the schedule code. */
{
  const day = fresh();
  const r = SQT.ripple(day, {}, 1);
  assert.equal(SQT.clampDelta(r, -600), r.min, "cannot cross the block above");
  assert.equal(SQT.clampDelta(r, 9999), r.max, "cannot run off the end of the day");
  assert.equal(SQT.clampDelta(r, -30), -30, "an in-range drag passes through");
  // shifted tail still sorts the same way => no reorder surprise after a save
  const moved = Object.fromEntries(r.group.map(x => [x.i, x.t + SQT.clampDelta(r, -600)]));
  assert.ok(moved[1] > SQT.parseMins(day[0].t), "8:00 still comes first");
  assert.ok(moved[2] > moved[1], "order preserved through a full-clamp shift");
}

/* ---- template: stamped onto DAY, idempotent, always clearable ---- */
{
  const day = fresh();
  SQT.applyTemplate(day, { 1: "9:30" });
  assert.equal(day[1].t, "9:30", "template time wins");
  assert.equal(day[1].t0, "9:00", "day-data.js value is kept");
  SQT.applyTemplate(day, { 1: "9:30" });
  assert.equal(day[1].t0, "9:00", "re-applying does not eat the original");
  SQT.applyTemplate(day, {});
  assert.equal(day[1].t, "9:00", "clearing the entry restores day-data.js");
  assert.equal(day[3].t, "✨", "untimed block survives untouched");
}

assert.deepEqual(SQT.parseTemplate("{oops"), {}, "bad JSON must not brick the day");
assert.deepEqual(SQT.parseTemplate(null), {});

/* Collapsed maps happened in the wild: every visible block inherited the first
   "Wake up" time, so both admin and tablets rendered a day full of 8:00 slots. */
{
  const day = [{ t: "8:00" }, { t: "9:00" }, { t: "10:00" }, { t: "11:00" }, { t: "âœ¨" }];
  SQT.applyTemplate(day, { 1: "8:00", 2: "8:00", 3: "8:00" });
  assert.deepEqual(day.map(b => b.t), ["8:00", "9:00", "10:00", "11:00", "âœ¨"], "collapsed template restores the original day");
}

{
  const day = [{ t: "8:00" }, { t: "9:00" }, { t: "10:00" }, { t: "11:00" }];
  const clean = SQT.resolveOverrides({ all: { 0: "8:00", 1: "8:00", 2: "8:00", 3: "8:00" } }, null, day);
  assert.deepEqual(clean, {}, "collapsed today overrides are ignored");
}

{
  const day = [{ t: "8:00" }, { t: "9:00" }, { t: "10:00" }, { t: "11:00" }];
  const clean = SQT.cleanTimeMap(day, { 0: "8:00", 1: "8:00", 2: "8:00", 3: "12:00" });
  assert.deepEqual(clean, { 3: "12:00" }, "valid edits survive while repeated first-time entries are dropped");
}

{
  const day = fresh();
  const clean = SQT.cleanTimeMap(day, { 3: "11:00" });
  assert.deepEqual(clean, {}, "untimed blocks stay untimed");
}

{
  const day = fresh();
  const kids = { lucien: {}, lili: {}, luis: {} };
  const collapsed = Object.fromEntries(Object.keys(kids).map(kid => [
    kid,
    Object.fromEntries(day.slice(1).map((_, i) => [i + 1, 0]))
  ]));
  assert.deepEqual(SQT.repairReplacementMap(day, kids, collapsed), { _v: 2 }, "all legacy replacements reset to the original schedule");
  assert.deepEqual(
    SQT.repairReplacementMap(day, kids, { lili: { 2: 3 } }),
    { _v: 2 },
    "the one-time reset clears even valid old replacements"
  );
  assert.deepEqual(
    SQT.repairReplacementMap([...day, { t: "12:00" }], kids, { lili: { 1: 0, 2: 0, 3: 0, 4: 2 } }),
    { _v: 2 },
    "manual edits layered over a collapsed legacy schedule reset with that schedule"
  );
  assert.deepEqual(
    SQT.repairReplacementMap(day, kids, { _v: 2, lucien: { 1: 0, 2: 0, 3: 0 } }),
    { lucien: { 1: 0, 2: 0, 3: 0 }, _v: 2 },
    "library choices made after the reset remain untouched"
  );
}

{
  const day = fresh();
  const map = { _v: 2, lili: { 2: 3 } };
  assert.equal(SQT.replacementSource(day, map, "lili", 2), 3, "a real replacement resolves");
  assert.equal(SQT.replacementSource(day, map, "lili", 1), null, "an untouched slot keeps its own block, not block 0");
  assert.equal(SQT.replacementSource(day, map, "luis", 2), null, "another kid is unaffected");
  assert.equal(SQT.replacementSource(day, {}, "lili", 0), null, "an empty map never replaces slot 0 with itself");
  assert.equal(SQT.replacementSource(day, { lili: { 2: 99 } }, "lili", 2), null, "an out-of-range source is ignored");
}

console.log("time-core ok: ripple clamping, template/replacement cleanup, replacement lookup, bad JSON");
