import test from "node:test";
import assert from "node:assert/strict";
import {
  POSES, SIT, cleanPose, isSitting, jointAngles, posesFor, poseShape, samePose, sitOffset, sitShift, stopsOf,
} from "../js/brick-lab/brick-pose.js";

const J = {
  head: { at: [0, 2.94, 0], axis: "y", step: 45, min: -90, max: 90 },
  armL: { at: [0.9, 2.62, 0], axis: "x", step: 45, min: -180, max: 45 },
  armR: { at: [-0.9, 2.62, 0], axis: "x", step: 45, min: -180, max: 45 },
  legL: { at: [0.47, 1.25, 0], axis: "x", step: 22.5, min: -90, max: 45 },
  legR: { at: [-0.47, 1.25, 0], axis: "x", step: 22.5, min: -90, max: 45 },
};
const fig = { id: "fig_test", body: "minifig", width: 2, depth: 1, height: 4.05, top: 4.0, joints: J };
const skirt = { ...fig, id: "fig_skirt", joints: { head: J.head, armL: J.armL, armR: J.armR } };

test("stops run min → max by step and include 0", () => {
  assert.deepEqual(stopsOf(J.armL), [-180, -135, -90, -45, 0, 45]);
  assert.deepEqual(stopsOf(J.legL), [-90, -67.5, -45, -22.5, 0, 22.5, 45]);
});

test("rest is no pose; unknown presets and joints are dropped; keys are sorted", () => {
  assert.equal(cleanPose(fig, null), null);
  assert.equal(cleanPose(fig, { p: "stand" }), null);
  assert.equal(cleanPose(fig, { p: "nope" }), null);
  assert.deepEqual(cleanPose(fig, { p: "wave" }), { p: "wave" });
  assert.deepEqual(cleanPose(fig, { p: "wave", t: { tail: 2, armR: 1, head: 0, armL: 1.5 } }), { p: "wave", t: { armR: 1 } });
  assert.deepEqual(cleanPose(fig, { p: "stand", t: { legR: -1, armL: 2 } }), { p: "stand", t: { armL: 2, legR: -1 } });
  assert.equal(cleanPose({ id: "brick" }, { p: "wave" }), null);
});

test("joint angles: preset, then steps that wrap inside min…max", () => {
  assert.deepEqual(jointAngles(fig, null), { head: 0, armL: 0, armR: 0, legL: 0, legR: 0 });
  assert.equal(jointAngles(fig, { p: "wave" }).armR, -135);
  assert.equal(jointAngles(fig, { p: "wave", t: { armR: 2 } }).armR, -45);
  assert.equal(jointAngles(fig, { p: "wave", t: { armR: 4 } }).armR, 45);
  assert.equal(jointAngles(fig, { p: "wave", t: { armR: 5 } }).armR, -180);
  assert.equal(jointAngles(fig, { p: "stand", t: { head: -1 } }).head, -45);
});

test("Sit: legs forward, a 2-deep lower box, half a stud forward", () => {
  assert.equal(isSitting(fig, { p: "sit" }), true);
  assert.equal(isSitting(fig, { p: "wave" }), false);
  assert.deepEqual([jointAngles(fig, { p: "sit" }).legL, jointAngles(fig, { p: "sit" }).legR], [-90, -90]);
  const shape = poseShape(fig, { p: "sit" });
  assert.equal(shape.depth, 2);
  assert.equal(Math.round(shape.height * 100) / 100, 3.2);
  assert.equal(Math.round(shape.top * 100) / 100, 3.15);
  assert.equal(poseShape(fig, { p: "wave" }), fig);
  assert.deepEqual(sitShift(0), { dx: 0, dz: 0.5 });
  assert.deepEqual(sitShift(90), { dx: 0.5, dz: 0 });
  assert.deepEqual(sitShift(180, -1), { dx: 0, dz: 0.5 });
  assert.deepEqual(sitOffset(), { y: -SIT.drop / 2, z: -SIT.back });
});

test("a skirt has no legs, so it has no Sit", () => {
  assert.ok(!posesFor(skirt).some((p) => p.id === "sit"));
  assert.equal(cleanPose(skirt, { p: "sit" }), null);
});

test("every preset has EN + 中文 and names only stops", () => {
  Object.keys(POSES).forEach((body) => POSES[body].forEach((p) => {
    assert.equal(p.label.length, 2);
    assert.match(p.label[1], /[㐀-鿿]/);
  }));
  posesFor(fig).forEach((p) => Object.keys(p.angles).forEach((j) => assert.ok(stopsOf(J[j]).includes(p.angles[j]), `${p.id} ${j}`)));
});

test("samePose compares cleaned poses", () => {
  assert.equal(samePose(null, undefined), true);
  assert.equal(samePose({ p: "wave" }, { p: "wave" }), true);
  assert.equal(samePose({ p: "wave" }, { p: "wave", t: { armR: 1 } }), false);
});
