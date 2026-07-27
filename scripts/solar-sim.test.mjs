import test from "node:test";
import assert from "node:assert/strict";
import { SPEEDS, daysPerSec, advance, orbitCount } from "../js/games/solar-sim.js";

test("SPEEDS has five steps with pause at 0 and bilingual labels", function () {
  assert.equal(SPEEDS.length, 5);
  assert.deepEqual(SPEEDS[0], { id: "pause", en: "Pause", tz: "\u66ab\u505c", daysPerSec: 0 });
  assert.deepEqual(SPEEDS[1], { id: "day", en: "1 day", tz: "1 \u5929", daysPerSec: 1 });
  assert.deepEqual(SPEEDS[2], { id: "10day", en: "10 days", tz: "10 \u5929", daysPerSec: 10 });
  assert.deepEqual(SPEEDS[3], { id: "month", en: "1 month", tz: "1 \u500b\u6708", daysPerSec: 30 });
  assert.deepEqual(SPEEDS[4], { id: "year", en: "1 year", tz: "1 \u5e74", daysPerSec: 365 });
});

test("daysPerSec returns the correct step or 10-day fallback", function () {
  assert.equal(daysPerSec("pause"), 0);
  assert.equal(daysPerSec("day"), 1);
  assert.equal(daysPerSec("10day"), 10);
  assert.equal(daysPerSec("month"), 30);
  assert.equal(daysPerSec("year"), 365);
  assert.equal(daysPerSec("bogus"), 10);
  assert.equal(daysPerSec(""), 10);
});

test("advance accumulates sim-days from wall-clock dt", function () {
  assert.equal(advance(0, 1000, 10), 10);      // 1 s at 10 days/s = 10 days
  assert.equal(advance(10, 500, 10), 15);       // half a second at 10 days/s = 5 more
  assert.equal(advance(10, 1000, 0), 10);       // paused: no advance
  assert.equal(advance(100, 365000, 1), 465);   // 365 s at 1 day/s = 365 more
});

test("orbitCount for Earth at 365 days gives exactly 1 count and 0 angle", function () {
  var oc = orbitCount(365, 365);
  assert.equal(oc.count, 1);
  assert.ok(Math.abs(oc.angle) < 1e-9); // full turn = angle 0 (mod 2π)
});

test("orbitCount for Mercury at 365 days gives ~4.15 orbits", function () {
  var oc = orbitCount(365, 88);
  assert.equal(oc.count, 4);
  // 365/88 = 4.1477…; fractional is 0.1477… → angle ~0.928 rad
  assert.ok(oc.angle > 0.8 && oc.angle < 1.0, "Mercury angle should be ~0.93 rad after 4 orbits in 365 days");
});

test("orbitCount for Neptune at 88 days floors to 0", function () {
  var oc = orbitCount(88, 60190);
  assert.equal(oc.count, 0);
  var expectedAngle = (88 / 60190) * Math.PI * 2;
  assert.ok(Math.abs(oc.angle - expectedAngle) < 1e-9);
});

test("orbitCount angle is always in [0, 2π)", function () {
  for (var total = 0; total < 1000; total += 37) {
    for (var i = 0; i < 8; i++) {
      var y = [88, 225, 365, 687, 4333, 10759, 30687, 60190][i];
      var oc = orbitCount(total, y);
      assert.ok(oc.angle >= 0 && oc.angle < Math.PI * 2, "angle out of range for total=" + total + " yearDays=" + y);
    }
  }
});
