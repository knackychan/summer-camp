// Per-frame budget for drawGlobe. Wall-clock timing, so it lives outside the
// scripts/*.test.mjs glob that node scripts/check.mjs runs in parallel before every
// commit: machine load must not turn the commit gate red. Run with npm run test:world.
import test from "node:test";
import assert from "node:assert/strict";
import { buildPlanetMap, buildCloudMap } from "../js/world/planet-map.js";
import { facingQuat, drawGlobe } from "../js/world/planet-globe.js";

test("drawGlobe is fast enough for a tablet frame", () => {
  const map = buildPlanetMap(7), clouds = buildCloudMap(7);
  const width = 320, height = 200;
  const target = { data: new Uint32Array(width * height), width, height };
  const view = { rotation: facingQuat(18, 0), radius: 120, cx: 160, cy: 100 };
  drawGlobe(target, map, clouds, view, 0);
  // Best single frame, not the mean: one GC or scheduler stall on a busy machine must not fail the build.
  let best = Infinity;
  for (let i = 0; i < 10; i++) {
    const t = performance.now();
    drawGlobe(target, map, clouds, view, i * 0.01);
    best = Math.min(best, performance.now() - t);
  }
  assert.ok(best < 25, `drawGlobe took ${best.toFixed(1)} ms on desktop node`);
});
