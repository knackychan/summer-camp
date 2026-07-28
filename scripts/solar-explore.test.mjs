import test from "node:test";
import assert from "node:assert/strict";

test("solar module exports the expected contract without touching vendor files", async function () {
  /* Dynamic import of solar-data works because it has no DOM/Three imports. */
  var { PLANETS } = await import("../js/games/solar-data.js");

  /* Named exports from solar.js — these are pure and import from data/sim only. */
  var solar = await import("../js/games/solar.js");

  /* hitRadius floor for Mercury (size 0.3 → 2.5×0.3=0.75, floor 0.9 → 0.9) */
  assert.ok(typeof solar.hitRadius === "function");
  assert.equal(solar.hitRadius(0.3), 0.9);
  assert.equal(solar.hitRadius(0.5), 1.25);
  assert.equal(solar.hitRadius(1.2), 3.0);

  /* angleAt for Earth at 365 days gives exactly 2π (full turn) */
  assert.ok(typeof solar.angleAt === "function");
  var earth = PLANETS.find(function (p) { return p.id === "earth"; });
  var a = solar.angleAt(earth, 365);
  assert.ok(Math.abs(a - Math.PI * 2) < 1e-9, "Earth at 365 days should be one full turn");

  assert.equal(solar.focusDistance("sun", 2), 18);
  assert.equal(solar.focusDistance("mercury", 0.3), 7);
  assert.equal(solar.focusDistance("jupiter", 1.2), 9.6);
  assert.equal(solar.focusPanLimit("sun", 2), 9);
  assert.equal(solar.focusPanLimit("mercury", 0.3), 2.5);
  assert.equal(solar.focusPanLimit("jupiter", 1.2), 3.5999999999999996);
  assert.equal(solar.bodyOpacity("earth", null), 1);
  assert.equal(solar.bodyOpacity("earth", "earth"), 1);
  assert.equal(solar.bodyOpacity("earth", "sun"), 0.82);
  assert.equal(solar.bodyOpacity("earth", "mars"), 0.55);
  assert.equal(solar.photoIsVendored("assets/solar/sun.jpg"), true);
  assert.deepEqual(solar.bodyNamePair(earth), ["Earth", "\u5730\u7403"]);

  /* Module default export matches the manifest */
  assert.equal(solar.default.id, "solar");
  assert.equal(solar.default.bestKey, null);
  assert.equal(solar.default.keyboard, false);
  assert.ok(solar.default.meta.icon);
  assert.ok(solar.default.meta.title);
  assert.ok(solar.default.meta.tz);
});
