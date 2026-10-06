import test from "node:test";
import assert from "node:assert/strict";
import {
  BEHIND, MOVE, REACH, WALKER,
  behindCamera, clampLook, eyesCamera, groundUnder, hitsWalker, inReach, ridersOf, snapOut, solids, step, walkBoxes,
} from "../js/brick-lab/brick-walk.js";

const HALF = 32;
const DT = 1 / 60;
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const box = (minX, maxX, minZ, maxZ, minY, maxY) => ({ minX, maxX, minZ, maxZ, minY, maxY });
/* A wall across the way ahead (+z), `top` high. */
const ahead = (top, minY = 0) => box(-4, 4, 1, 5, minY, top);
const standing = (over = {}) => ({ x: 0, y: 0, z: 0, vy: 0, yaw: 0, grounded: true, ...over });

/* Run `frames` frames; `input(i)` gives each frame's stick. Returns the last state and the highest y. */
function run(state, boxes, frames, input) {
  let s = state;
  let peak = s.y;
  for (let i = 0; i < frames; i++) {
    s = step(s, input(i), DT, boxes, HALF);
    peak = Math.max(peak, s.y);
  }
  return { s, peak };
}
const forward = () => ({ forward: 1, strafe: 0, yaw: 0 });
const forwardAndJump = (i) => ({ forward: 1, strafe: 0, yaw: 0, jump: i === 0 });

test("the stick walks along the look: forward at yaw 0 is +z, at 90° is +x, right at yaw 0 is −x", () => {
  const a = step(standing(), { forward: 1, strafe: 0, yaw: 0 }, DT, [], HALF);
  assert.ok(a.z > 0 && near(a.x, 0) && a.moving);
  const b = step(standing(), { forward: 1, strafe: 0, yaw: Math.PI / 2 }, DT, [], HALF);
  assert.ok(b.x > 0 && near(b.z, 0));
  const c = step(standing(), { forward: 0, strafe: 1, yaw: 0 }, DT, [], HALF);
  assert.ok(c.x < 0 && near(c.z, 0));
  assert.ok(near(a.z, MOVE.speed * DT), "full stick = MOVE.speed studs a second");
  assert.ok(near(a.yaw, 0) && near(b.yaw, Math.PI / 2), "it faces where it walks");
});

test("standing still is not moving and stays on the ground", () => {
  const s = step(standing(), { forward: 0, strafe: 0, yaw: 0 }, DT, [], HALF);
  assert.equal(s.moving, false);
  assert.equal(s.y, 0);
  assert.equal(s.grounded, true);
});

test("it steps up a plate and a brick by itself (W6)", () => {
  assert.ok(near(run(standing(), [ahead(0.4)], 30, forward).s.y, 0.4));
  assert.ok(near(run(standing(), [ahead(1.2)], 30, forward).s.y, 1.2));
});

test("two bricks are a wall when walking", () => {
  const { s } = run(standing(), [ahead(2.4)], 60, forward);
  assert.equal(s.y, 0);
  assert.ok(s.z < 0.6, `stopped at the wall, z ${s.z}`);
});

test("a jump gets onto two bricks but not three (W6)", () => {
  const two = run(standing(), [ahead(2.4)], 120, (i) => (i < 36 ? forwardAndJump(i) : {})).s;
  assert.ok(near(two.y, 2.4) && two.grounded, `landed at ${two.y}`);
  const three = run(standing(), [ahead(3.6)], 120, (i) => (i < 36 ? forwardAndJump(i) : {})).s;
  assert.equal(three.y, 0);
  assert.ok(three.z < 0.6);
});

test("a jump only starts from the ground and peaks at MOVE.jump", () => {
  const { peak } = run(standing(), [], 60, (i) => ({ jump: i < 30 }));
  assert.ok(peak <= MOVE.jump + 0.05 && peak > MOVE.jump - 0.15, `peak ${peak}`);
});

test("a ceiling stops the jump", () => {
  const { peak } = run(standing(), [box(-4, 4, -4, 4, 5, 6)], 60, (i) => ({ jump: i === 0 }));
  assert.ok(peak <= 5 - WALKER.height + 1e-6, `peak ${peak}`);
});

test("it can walk under a high roof", () => {
  const { s } = run(standing(), [ahead(6, 4.5)], 60, forward);
  assert.ok(s.z > 3, `walked under, z ${s.z}`);
  assert.equal(s.y, 0);
});

test("it falls off a ledge and lands on the plate", () => {
  const top = box(-2, 2, -2, 2, 0, 1.2);
  const { s } = run(standing({ y: 1.2 }), [top], 120, (i) => (i < 60 ? forward() : {}));
  assert.equal(s.y, 0);
  assert.ok(s.grounded && s.z > 2);
});

test("it stops at the island edge", () => {
  const { s } = run(standing({ z: 30 }), [], 120, forward);
  assert.ok(near(s.z, HALF - WALKER.radius));
});

test("pushing into a wall slides along it", () => {
  const wall = box(-10, 10, 1, 2, 0, 2.4);
  const { s } = run(standing(), [wall], 60, () => ({ forward: 1, strafe: 1, yaw: 0 }));
  assert.ok(s.x < -1, `slid sideways, x ${s.x}`);
  assert.ok(s.z < 0.6);
});

test("a long frame is cut to MOVE.maxDt", () => {
  const s = step(standing(), { forward: 1, yaw: 0 }, 5, [], HALF);
  assert.ok(near(s.z, MOVE.speed * MOVE.maxDt));
});

test("groundUnder: the highest top under the column, up to a limit", () => {
  const boxes = [box(-1, 1, -1, 1, 0, 1.2), box(-1, 1, -1, 1, 1.2, 2.4), box(5, 6, 5, 6, 0, 9)];
  assert.equal(groundUnder(0, 0, boxes), 2.4);
  assert.equal(groundUnder(0, 0, boxes, 1.5), 1.2);
  assert.equal(groundUnder(3, 3, boxes), 0);
});

test("solids leaves out the walker and its riders", () => {
  const pieces = new Map([["fig", box(0, 1, 0, 1, 0, 4)], ["hat", box(0, 1, 0, 1, 3.5, 4.5)], ["wall", box(4, 5, 4, 5, 0, 1)]]);
  const list = solids(pieces, (p) => p, new Set(["fig", "hat"]));
  assert.deepEqual(list, [pieces.get("wall")]);
});

test("riders: a hat, a brick on the hat; not a roof or a neighbour (W3)", () => {
  const pieces = new Map([
    ["fig", box(-1, 1, -0.5, 0.5, 0, 4.05)],
    ["hat", box(-1, 1, -0.5, 0.5, 3.4, 4.6)],
    ["onHat", box(-0.5, 0.5, -0.5, 0.5, 4.6, 5.8)],
    ["roof", box(-4, 4, -4, 4, 4.05, 4.45)],
    ["beside", box(1, 2, -0.5, 0.5, 0, 1.2)],
  ]);
  const riders = ridersOf("fig", pieces, (p) => p);
  assert.deepEqual([...riders].sort(), ["hat", "onHat"]);
});

test("snapOut turns the facing to the nearest 90° (W2); x and z are left to landing()", () => {
  assert.deepEqual(snapOut({ x: 1.3, z: -2.7, yaw: Math.PI / 2 + 0.2 }), { x: 1.3, z: -2.7, rotation: 90 });
  assert.equal(snapOut({ x: 0, z: 0, yaw: -Math.PI / 2 }).rotation, 270);
  assert.equal(snapOut({ x: 0, z: 0, yaw: 3.1 }).rotation, 180);
  assert.equal(snapOut({ x: 0, z: 0, yaw: 0.7 }).rotation, 0);
});

test("reach is 8 studs across the ground (W9)", () => {
  assert.equal(REACH, 8);
  assert.ok(inReach({ x: 0, z: 0 }, { x: 4.8, y: 30, z: 6.4 }));
  assert.ok(!inReach({ x: 0, z: 0 }, { x: 6, z: 6 }));
});

test("hitsWalker: a piece in the walker's column, not beside it, under its feet or over its head", () => {
  const at = standing({ y: 1.2 });
  assert.ok(hitsWalker(box(-1, 1, -1, 1, 1.2, 2.4), at));
  assert.ok(!hitsWalker(box(1, 3, -1, 1, 1.2, 2.4), at), "beside");
  assert.ok(!hitsWalker(box(-1, 1, -1, 1, 0, 1.2), at), "the brick it stands on");
  assert.ok(!hitsWalker(box(-1, 1, -1, 1, 5.2, 6.4), at), "over its head");
});

test("clampLook keeps the tilt within ±60°", () => {
  assert.ok(near(clampLook({ yaw: 1, pitch: 3 }).pitch, Math.PI / 3));
  assert.ok(near(clampLook({ yaw: 1, pitch: -3 }).pitch, -Math.PI / 3));
  assert.equal(clampLook({ yaw: 1, pitch: 0.2 }).yaw, 1);
});

test("behind view: 8 back and 4 up from beside the head, over the right shoulder (W4)", () => {
  const cam = behindCamera(standing(), { yaw: 0, pitch: 0 }, []);
  assert.ok(near(cam.target.y, WALKER.head));
  assert.ok(near(cam.target.x, -BEHIND.shoulder) && near(cam.target.z, 0), "right of a walker facing +z is −x");
  assert.ok(near(cam.position.z, -BEHIND.back) && near(cam.position.x, -BEHIND.shoulder));
  assert.ok(near(cam.position.y, WALKER.head + BEHIND.up));
  assert.equal(cam.fov, BEHIND.fov);
  const east = behindCamera(standing(), { yaw: Math.PI / 2, pitch: 0 }, []);
  assert.ok(near(east.target.z, BEHIND.shoulder) && near(east.position.x, -BEHIND.back), "facing +x, right is +z");
});

test("behind view: the shoulder comes in when a piece is right beside the head", () => {
  const wall = box(-3, -1, -4, 4, 0, 20);
  const cam = behindCamera(standing(), { yaw: 0, pitch: 0 }, [wall]);
  assert.ok(cam.target.x > -1 && cam.target.x <= 0, `target x ${cam.target.x}`);
});

test("behind view pulls in in front of a wall", () => {
  const wall = box(-5, 5, -4, -3, 0, 20);
  const cam = behindCamera(standing(), { yaw: 0, pitch: 0 }, [wall]);
  assert.ok(cam.position.z > -3, `camera z ${cam.position.z}`);
  const d = Math.hypot(cam.position.x - cam.target.x, cam.position.y - cam.target.y, cam.position.z - cam.target.z);
  assert.ok(d >= BEHIND.nearest - 1e-6);
});

test("eyes view: at eye height, looking along yaw and pitch", () => {
  const cam = eyesCamera(standing({ x: 2, y: 1.2, z: 3 }), { yaw: Math.PI / 2, pitch: 0 });
  assert.ok(near(cam.position.x, 2) && near(cam.position.y, 1.2 + WALKER.eye) && near(cam.position.z, 3));
  assert.ok(cam.target.x > cam.position.x && near(cam.target.y, cam.position.y));
  const down = eyesCamera(standing(), { yaw: 0, pitch: 0.5 });
  assert.ok(down.target.y < down.position.y, "positive pitch looks down");
});

/* Stairs 2×4 as the catalog draws them: four one-brick steps, the lowest at local +z. */
const STAIRS = { width: 2, depth: 4, height: 4.8, walk: [0, 1, 2, 3].map((i) => ({ x: [-1, 1], z: [1 - i, 2 - i], top: 1.2 * (i + 1) })) };

test("walkBoxes: a part's steps, turned and placed with the piece", () => {
  const flat = walkBoxes({ x: 0, y: 2.4, z: 0, rotation: 0 }, STAIRS);
  assert.equal(flat.length, 4);
  assert.deepEqual(flat[0], box(-1, 1, 1, 2, 0, 1.2), "the lowest step at +z");
  assert.deepEqual(flat[3], box(-1, 1, -2, -1, 0, 4.8));
  const turned = walkBoxes({ x: 10, y: 3.6, z: 5, rotation: 90 }, STAIRS);
  const low = turned[0];
  assert.ok(near(low.minX, 11) && near(low.maxX, 12) && near(low.minZ, 4) && near(low.maxZ, 6) && near(low.minY, 1.2) && near(low.maxY, 2.4),
    `turned 90°, the lowest step faces +x: ${JSON.stringify(low)}`);
});

test("stairs: the walker climbs them one step at a time, no jump needed", () => {
  const boxes = solids(new Map([["s", { x: 0, y: 2.4, z: 0, rotation: 0 }]]), (p) => walkBoxes(p, STAIRS));
  /* 40 frames at full stick end on the top step (the stairs climb toward −z). */
  const { s } = run(standing({ z: 4 }), boxes, 80, (i) => (i < 40 ? { forward: 1, yaw: Math.PI } : {}));
  assert.ok(near(s.y, 4.8), `at the top, y ${s.y}`);
  const wall = run(standing({ z: 4 }), [box(-1, 1, -2, 2, 0, 4.8)], 240, () => ({ forward: 1, yaw: Math.PI })).s;
  assert.equal(wall.y, 0, "as one solid box the same stairs were a wall");
});
