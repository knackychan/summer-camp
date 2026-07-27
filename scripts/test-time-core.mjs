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

console.log("time-core ok: ripple clamping, template apply/clear, bad JSON");
