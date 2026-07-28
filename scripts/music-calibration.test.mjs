import test from "node:test";
import assert from "node:assert/strict";

import { computeOffset } from "../js/game-services/music.js";

/* computeOffset is pure: no DOM, no storage, no AudioContext. Feed it arrays of
   beat times (ms) and tap times (ms); it returns {offsetMs, confident}. */

test("drops the first two pairs", function () {
  var beats  = [0, 600, 1200, 1800, 2400, 3000, 3600, 4200];
  var taps   = [0, 600, 1200, 1803, 2405, 3002, 3600, 4200];
  /* The first two pairs (indices 0,1) are dropped. The remaining 6 (indices 2-7)
     all have offset 0 or tiny, so the median should be about 2. */
  var r = computeOffset(taps, beats);
  assert.ok(r.confident, "should be confident with tight taps");
  assert.ok(Math.abs(r.offsetMs) < 10, "offset should be near 0, got " + r.offsetMs);
});

test("returns the median, not the mean", function () {
  var beats = [0, 600, 1200, 1800, 2400, 3000, 3600, 4200];
  /* After dropping first two pairs, remaining taps have offsets spread widely:
     array indices:  2: +0, 3: +500, 4: +200, 5: -300, 6: +400 */
  var taps  = [0, 600, 1200, 2300, 2600, 2700, 4000, 4200];
  var r = computeOffset(taps, beats);
  /* Median of [0, 500, 200, -300, 400] = 200 */
  assert.equal(r.offsetMs, 100, "median should be 100");
  /* The IQR of these values is wide enough to trigger low confidence */
  assert.equal(r.confident, false, "wide spread should be low confidence");
});

test("one wild outlier does not move the result more than a few ms", function () {
  var beats = [0, 600, 1200, 1800, 2400, 3000, 3600, 4200];
  var taps  = [0, 600, 1200, 1805, 2405, 999999, 3600, 4200];
  var r = computeOffset(taps, beats);
  assert.ok(Math.abs(r.offsetMs) < 15, "outlier should not dominate, got " + r.offsetMs);
});

test("reports low confidence when spread exceeds threshold", function () {
  var beats = [0, 600, 1200, 1800, 2400, 3000, 3600, 4200];
  /* After dropping first two: offsets: 0, 200, -180, 100, -170, 300 */
  var taps  = [0, 600, 1200, 2000, 2220, 3100, 3430, 4500];
  var r = computeOffset(taps, beats);
  assert.equal(r.confident, false, "wide spread should be low confidence");
  /* Should still return a number, not NaN */
  assert.ok(typeof r.offsetMs === "number" && isFinite(r.offsetMs));
});

test("fewer than 4 usable taps returns no result", function () {
  var beats = [0, 600, 1200];
  var taps  = [0, 600, 1200];
  /* After dropping first two, only 1 pair left */
  var r = computeOffset(taps, beats);
  assert.equal(r.offsetMs, null, "too few taps should return null offset");
  assert.equal(r.confident, false);
});

test("no taps at all returns null", function () {
  var r = computeOffset([], []);
  assert.equal(r.offsetMs, null);
  assert.equal(r.confident, false);
});

test("mismatched tap/beat lengths handled cleanly", function () {
  var beats = [0, 600, 1200, 1800, 2400, 3000, 3600, 4200];
  var taps  = [0, 600, 1200, 1800];
  var r = computeOffset(taps, beats);
  /* After dropping first two: 2 pairs usable — too few */
  assert.equal(r.offsetMs, null);
  assert.equal(r.confident, false);
});

test("realistic calibration — consistent 50ms late", function () {
  var beats = [0, 600, 1200, 1800, 2400, 3000, 3600, 4200];
  var taps  = [0, 600, 1250, 1850, 2450, 3050, 3650, 4250];
  var r = computeOffset(taps, beats);
  assert.ok(r.confident, "consistent taps should be confident");
  assert.ok(Math.abs(r.offsetMs - 50) <= 5, "offset should be ~50ms, got " + r.offsetMs);
});
