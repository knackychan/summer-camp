import test from "node:test";
import assert from "node:assert/strict";
import { buildPlanetMap, buildCloudMap } from "../js/world/planet-map.js";
import { RGBA, C } from "../js/world/planet-palette.js";
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

test("cloud shadows fall away from the upper-left light, down and to the right", () => {
  const map = buildPlanetMap(7);
  const base = { color: new Uint8Array(map.color.length).fill(map.color[0]) };
  const width = 400, height = 400, R = 180, cx = 200, cy = 200;
  const view = { rotation: facingQuat(0, 0), radius: R, cx, cy };
  const draw = (clouds) => {
    const target = { data: new Uint32Array(width * height), width, height };
    drawGlobe(target, base, clouds, view, 0);
    return target.data;
  };
  const clear = new Uint8Array(base.color.length), one = new Uint8Array(base.color.length);
  const cloudRow = 60, cloudCol = 128;
  one[cloudRow * 256 + cloudCol] = 1;
  const before = draw(clear), after = draw(one);
  const cloud = project(90 - (cloudRow + 0.5) / 128 * 180, (cloudCol + 0.5) / 256 * 360 - 180, view);
  let sx = 0, sy = 0, n = 0;
  for (let i = 0; i < before.length; i++) {
    if (before[i] === after[i]) continue;
    const x = i % width, y = (i / width) | 0;
    if (after[i] === RGBA[C.white]) continue;
    sx += x + 0.5; sy += y + 0.5; n++;
  }
  assert.ok(n > 0, "a shadow is drawn");
  assert.ok(sx / n > cloud.x + 1, `shadow sits right of the cloud (${(sx / n).toFixed(1)} vs ${cloud.x.toFixed(1)})`);
  assert.ok(sy / n > cloud.y + 1, `shadow sits below the cloud (${(sy / n).toFixed(1)} vs ${cloud.y.toFixed(1)})`);
});

test("tapping finds the same cloud cell that drawGlobe paints, including drift", async () => {
  const { cloudAtPoint } = await import("../js/world/planet-globe.js");
  const view = { rotation: facingQuat(10, 20), radius: 120, cx: 160, cy: 120 };
  for (const shift of [0, 0.37, 7.1]) {
    for (const [row, col] of [[60, 140], [50, 130], [70, 150]]) {
      const clouds = new Uint8Array(256 * 128);
      clouds[row * 256 + col] = 1;
      // the cell drifts east with the shift, so it shows at lon - shift
      const lat = 90 - (row + 0.5) / 128 * 180, lon = (col + 0.5) / 256 * 360 - 180 - shift * 180 / Math.PI;
      const p = project(lat, lon, view);
      assert.ok(p.z > 0, "cell visible");
      assert.equal(cloudAtPoint(clouds, p.x, p.y, view, shift), true, `hit at shift ${shift}`);
      const east = project(lat, lon + 360 / 256, view), south = project(lat - 180 / 128, lon, view);
      assert.equal(cloudAtPoint(clouds, east.x, east.y, view, shift), false, "east neighbour is clear");
      assert.equal(cloudAtPoint(clouds, south.x, south.y, view, shift), false, "south neighbour is clear");
    }
  }
  assert.equal(cloudAtPoint(new Uint8Array(256 * 128).fill(1), 0, 0, view, 0), false, "outside the disc never hits");
});
