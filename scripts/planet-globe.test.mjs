import test from "node:test";
import assert from "node:assert/strict";
import { buildPlanetMap, buildCloudMap } from "../js/world/planet-map.js";
import { facingQuat, project, unproject, drawGlobe, quatMul, quatAxisAngle, quatRotate, quatSlerp, quatNormalize } from "../js/world/planet-globe.js";

const close = (a, b, eps, label) => assert.ok(Math.abs(a - b) < eps, `${label}: ${a} vs ${b}`);
const lonClose = (a, b, eps, label) => close(((a - b + 540) % 360) - 180, 0, eps, label);

test("facing a lat/lon puts it at the disc centre, nearest the viewer", () => {
  for (const [lat, lon] of [[0, 0], [30, 55], [-26, 162], [40, -55]]) {
    const view = { rotation: facingQuat(lat, lon), radius: 50, cx: 100, cy: 80 };
    const p = project(lat, lon, view);
    close(p.x, 100, 1e-6, "x"); close(p.y, 80, 1e-6, "y"); close(p.z, 1, 1e-9, "z");
    const back = unproject(100, 80, view);
    close(back.lat, lat, 1e-6, "lat"); lonClose(back.lon, lon, 1e-6, "lon");
  }
});

test("facing keeps north up", () => {
  const view = { rotation: facingQuat(20, 70), radius: 50, cx: 0, cy: 0 };
  const north = quatRotate(view.rotation, [0, 1, 0]);
  close(north[0], 0, 1e-9, "north has no sideways lean");
  assert.ok(north[1] > 0, "north points up");
});

test("project then unproject round-trips on the visible side", () => {
  const view = { rotation: quatNormalize(quatMul(quatAxisAngle([0, 0, 1], 0.3), facingQuat(12, -40))), radius: 64, cx: 90, cy: 70 };
  for (const [lat, lon] of [[12, -40], [30, -10], [-20, -70], [0, -40], [50, -40]]) {
    const p = project(lat, lon, view);
    assert.ok(p.z > 0, `${lat},${lon} visible`);
    const back = unproject(p.x, p.y, view);
    close(back.lat, lat, 1e-6, "lat"); lonClose(back.lon, lon, 1e-6, "lon");
  }
});

test("the far side reports negative depth and unproject misses outside the disc", () => {
  const view = { rotation: facingQuat(0, 0), radius: 40, cx: 50, cy: 50 };
  assert.ok(project(0, 180, view).z < -0.99);
  assert.ok(project(10, 120, view).z < 0);
  assert.equal(unproject(50 + 41, 50, view), null);
});

test("slerp walks from one rotation to another", () => {
  const a = facingQuat(0, 0), b = facingQuat(0, 90);
  const mid = quatSlerp(a, b, 0.5), view = { rotation: mid, radius: 10, cx: 0, cy: 0 };
  close(project(0, 45, view).z, 1, 1e-6, "halfway faces 45°");
});

test("drawGlobe paints the disc and its rim only, leaving the rest transparent", () => {
  const map = buildPlanetMap(7), clouds = buildCloudMap(7);
  const width = 160, height = 120, R = 40, cx = 80, cy = 60;
  const target = { data: new Uint32Array(width * height).fill(123), width, height };
  drawGlobe(target, map, clouds, { rotation: facingQuat(18, 0), radius: R, cx, cy }, 0.4);
  let painted = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const v = target.data[y * width + x];
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d > R + 2.6) assert.equal(v, 0, `pixel ${x},${y} outside the rim was painted`);
    if (d < R - 1) { assert.notEqual(v, 0, `disc pixel ${x},${y} empty`); painted++; }
  }
  assert.ok(painted > Math.PI * (R - 1) * (R - 1) * 0.95);
});

test("drawGlobe is fast enough for a tablet frame", () => {
  const map = buildPlanetMap(7), clouds = buildCloudMap(7);
  const width = 320, height = 200;
  const target = { data: new Uint32Array(width * height), width, height };
  const view = { rotation: facingQuat(18, 0), radius: 120, cx: 160, cy: 100 };
  drawGlobe(target, map, clouds, view, 0);
  const t = performance.now();
  for (let i = 0; i < 10; i++) drawGlobe(target, map, clouds, view, i * 0.01);
  const each = (performance.now() - t) / 10;
  assert.ok(each < 25, `drawGlobe took ${each.toFixed(1)} ms on desktop node`);
});
