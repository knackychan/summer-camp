import test from "node:test";
import assert from "node:assert/strict";
import { TILT, cameraPosition, clampView, groundAt, keepAnchor, pitchFor } from "../js/brick-lab/brick-camera.js";

const DEG = Math.PI / 180;
const FOV = 34;
const ASPECT = 1.6;
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const view = { x: 6, z: 9, yaw: 38 * DEG, distance: 100 };

test("tilt follows the distance: low close up, high far out (K4)", () => {
  assert.ok(near(pitchFor(TILT.near), TILT.low));
  assert.ok(near(pitchFor(2), TILT.low));
  assert.ok(near(pitchFor(TILT.far), TILT.high));
  assert.ok(near(pitchFor(1000), TILT.high));
  const home = pitchFor(view.distance) / DEG;
  assert.ok(home > 44 && home < 50, `home tilt ${home}`);
  assert.ok(pitchFor(20) < pitchFor(60));
});

test("the camera stands `distance` away from the ground point, at the tilt", () => {
  const eye = cameraPosition(view);
  assert.ok(near(Math.hypot(eye.x - view.x, eye.y, eye.z - view.z), view.distance));
  assert.ok(near(Math.asin(eye.y / view.distance), pitchFor(view.distance)));
  const front = cameraPosition({ x: 0, z: 0, yaw: 0, distance: 50 });
  assert.ok(near(front.x, 0) && front.z > 0, "yaw 0 looks from +z");
});

test("the screen centre looks at the view's ground point", () => {
  const g = groundAt(view, 0, 0, FOV, ASPECT);
  assert.ok(near(g.x, view.x, 1e-6) && near(g.z, view.z, 1e-6), JSON.stringify(g));
});

test("lower on screen is nearer the camera; right on screen is to the camera's right", () => {
  const eye = cameraPosition(view);
  const centre = groundAt(view, 0, 0, FOV, ASPECT);
  const low = groundAt(view, 0, -0.8, FOV, ASPECT);
  const d = (p) => Math.hypot(p.x - eye.x, p.z - eye.z);
  assert.ok(d(low) < d(centre));
  const top = groundAt({ x: 0, z: 0, yaw: 0, distance: 50 }, 0.5, 0, FOV, ASPECT);
  assert.ok(top.x > 0, "camera on +z looking at −z: screen right is +x");
});

test("sliding keeps the grabbed ground point under the finger (K1)", () => {
  const anchor = groundAt(view, 0.2, -0.3, FOV, ASPECT);
  /* A slide moves camera and ground point together, so one step is exact. */
  const v = keepAnchor(view, anchor, -0.4, 0.1, FOV, ASPECT);
  const under = groundAt(v, -0.4, 0.1, FOV, ASPECT);
  assert.ok(near(under.x, anchor.x, 1e-6) && near(under.z, anchor.z, 1e-6));
  assert.equal(v.yaw, view.yaw);
  assert.equal(v.distance, view.distance);
});

test("above the horizon there is no ground to grab (a wide lens sees past it)", () => {
  assert.equal(groundAt({ x: 0, z: 0, yaw: 0, distance: 5 }, 0, 1, 60, ASPECT), null);
});

test("the view stays over the island and within the distance limits (K5)", () => {
  const limits = { reach: 36, minDistance: 4, maxDistance: 128 };
  assert.deepEqual(clampView({ x: 80, z: -90, yaw: 7, distance: 900 }, limits), { x: 36, z: -36, yaw: 7, distance: 128 });
  assert.equal(clampView({ x: 0, z: 0, yaw: 0, distance: 1 }, limits).distance, 4);
});

/* Moving parts slice 02 (F1): focus mode looks at a height, turns around it and
   gives the exact view back. */
import { createKidCamera } from "../js/brick-lab/brick-camera.js";

function stubCamera() {
  const element = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 500 }), addEventListener() {}, removeEventListener() {}, setPointerCapture() {}, style: {} };
  const camera = { fov: FOV, position: { set(x, y, z) { this.at = [x, y, z]; } }, up: { set() {} }, lookAt(x, y, z) { this.look = [x, y, z]; }, updateMatrixWorld() {} };
  return { element, camera };
}

test("a lifted view raises the eye and looks at that height", () => {
  const base = cameraPosition(view);
  const lifted = cameraPosition({ ...view, lift: 2 });
  assert.ok(near(lifted.y, base.y + 2) && near(lifted.x, base.x) && near(lifted.z, base.z));
  assert.equal(clampView({ ...view, lift: 2 }, { reach: 40, minDistance: 3, maxDistance: 300 }).lift, 2);
  assert.equal(clampView(view, { reach: 40, minDistance: 3, maxDistance: 300 }).lift || 0, 0);
  const g = groundAt({ ...view, lift: 2 }, 0, 0, FOV, ASPECT);
  const eye = cameraPosition({ ...view, lift: 2 });
  assert.ok(Math.hypot(g.x - eye.x, g.z - eye.z) > Math.hypot(view.x - eye.x, view.z - eye.z), "the centre ray passes over the lifted point");
});

test("focusOn frames a point in the air with its own limits; unfocus gives the exact view back", () => {
  const { element, camera } = stubCamera();
  const start = { x: 6, z: 9, yaw: 38 * DEG, distance: 100 };
  const cam = createKidCamera({ camera: camera, element, limits: { reach: 40, minDistance: 5, maxDistance: 220 }, view: start, reducedMotion: true });
  assert.equal(cam.focused(), false);
  cam.focusOn({ x: 3, y: 2, z: -1, distance: 8, minDistance: 3, maxDistance: 12 });
  cam.update();
  const v = cam.view();
  assert.equal(cam.focused(), true);
  assert.deepEqual([v.x, v.z, v.lift, v.distance], [3, -1, 2, 8]);
  assert.deepEqual(camera.look, [3, 2, -1]);
  cam.zoom(0.1);
  assert.equal(cam.view().distance, 3);
  cam.turn(90);
  cam.unfocus();
  cam.update();
  const back = cam.view();
  assert.equal(cam.focused(), false);
  assert.deepEqual([back.x, back.z, back.yaw, back.distance, back.lift || 0], [start.x, start.z, start.yaw, start.distance, 0]);
  cam.zoom(0.01);
  assert.equal(cam.view().distance, 5, "the old limits are back");
});
