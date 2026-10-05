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

import { PARTS, getPart } from "../js/brick-lab/brick-catalog.js";

test("all 16 minifigures are jointed; skirts have no legs; the seated one is minifigSeated", () => {
  const figs = PARTS.filter((p) => p.category === "figures");
  assert.equal(figs.length, 16);
  figs.forEach((p) => {
    assert.ok(p.joints && p.joints.head && p.joints.armL && p.joints.armR, p.id);
    ["head", "armL", "armR"].forEach((j) => assert.ok(p.model.some((m) => m.j === j), `${p.id} ${j} moves nothing`));
  });
  assert.ok(getPart("fig_boy").joints.legL && getPart("fig_boy").joints.legR);
  assert.ok(!getPart("fig_princess").joints.legL && !getPart("fig_wizard").joints.legL);
  assert.ok(getPart("fig_pirate_captain").joints.legR, "peg leg swings");
  assert.equal(getPart("fig_sitting").body, "minifigSeated");
  assert.ok(!getPart("fig_sitting").joints.legL);
  assert.equal(getPart("fig_boy").body, "minifig");
});

test("left is +x (a figure faces +z): mirror tags the −x copy R", () => {
  const boy = getPart("fig_boy");
  const arm = (j) => boy.model.find((m) => m.j === j && m.cyl);
  assert.ok(arm("armL").at[0] > 0 && arm("armR").at[0] < 0);
});

test("hats and hair turn with the head; torso extras stay on the body", () => {
  const knight = getPart("fig_knight");
  assert.ok(knight.model.filter((m) => m.c === "silver" && m.lathe).every((m) => m.j === "head"));
  const pirate = getPart("fig_pirate");
  assert.ok(pirate.model.filter((m) => m.box && m.at[1] < 2.7 && m.c === "main").every((m) => !m.j), "stripes stay on the torso");
});

import { JOINT_LABELS } from "../js/brick-lab/brick-pose.js";

test("focus mode: every preset has a sign, every jointed part's joints have EN + 中文 names (slice 02)", () => {
  Object.keys(POSES).forEach((body) => POSES[body].forEach((p) => assert.ok(typeof p.icon === "string" && p.icon.length, `${body} ${p.id}`)));
  PARTS.filter((p) => p.joints).forEach((p) => Object.keys(p.joints).forEach((j) => {
    assert.ok(JOINT_LABELS[j], `${p.id} ${j} has no chip name`);
    assert.match(JOINT_LABELS[j][1], /[\u3400-\u9fff]/);
  }));
});

/* Moving parts slice 03: animals by body type, a head that turns and nods,
   wings that open as a mirrored pair. */
import { jointDef, jointKeys } from "../js/brick-lab/brick-pose.js";

const quad = {
  id: "quad_test", body: "quad", width: 1, depth: 2, height: 1.3,
  joints: {
    head: { at: [0, 1, 0.4], axis: "y", step: 45, min: -90, max: 90, nod: { axis: "x", step: 22.5, min: -45, max: 22.5 } },
    tail: { at: [0, 0.9, -0.6], axis: "y", step: 22.5, min: -45, max: 45 },
    legsF: { at: [0, 0.4, 0.4], axis: "x", step: 22.5, min: -45, max: 45 },
    legsB: { at: [0, 0.4, -0.4], axis: "x", step: 22.5, min: -45, max: 45 },
  },
};

test("a nod is its own key on the head: head.nod", () => {
  assert.deepEqual(jointKeys(quad), ["head", "head.nod", "tail", "legsF", "legsB"]);
  assert.equal(jointDef(quad, "head.nod").axis, "x");
  assert.equal(jointDef(quad, "tail.nod"), null);
  assert.equal(jointAngles(quad, { p: "headUp" })["head.nod"], -22.5);
  assert.equal(jointAngles(quad, { p: "sniff" })["head.nod"], 22.5);
  assert.deepEqual(cleanPose(quad, { p: "stand", t: { "head.nod": 1, "tail.nod": 1 } }), { p: "stand", t: { "head.nod": 1 } });
  assert.ok(JOINT_LABELS["head.nod"]);
});

test("all 20 animals have joints and a body; each only gets the poses its joints allow", () => {
  const animals = PARTS.filter((p) => p.category === "animals");
  assert.equal(animals.length, 20);
  animals.forEach((p) => {
    assert.ok(p.joints && Object.keys(p.joints).length && POSES[p.body], p.id);
    assert.ok(posesFor(p).length >= 2, `${p.id} has something to pose`);
  });
  const ids = (id) => posesFor(getPart(id)).map((p) => p.id);
  assert.ok(ids("dog").includes("headUp") && ids("dog").includes("lookL"));
  assert.ok(!ids("pig").includes("lookL"), "the pig's face is on its body: no head to turn");
  assert.ok(ids("dragon").includes("wingsOpen"));
  assert.ok(ids("crocodile").includes("mouthOpen") && ids("crocodile").includes("swish"));
  assert.ok(!ids("shark").includes("mouthOpen"));
  assert.ok(ids("fish").includes("swim") && ids("frog").includes("jump"));
  assert.equal(jointAngles(getPart("crocodile"), { p: "mouthOpen" }).jaw, -30);
  assert.equal(getPart("dragon").joints.wings.mirror, true);
  assert.equal(getPart("horse").top, 2.65, "the saddle is unchanged");
});

test("legs split by side of the body: front legs forward of the middle, back legs behind", () => {
  const dog = getPart("dog");
  dog.model.filter((m) => m.j === "legsF").forEach((m) => assert.ok(m.at[2] > 0));
  dog.model.filter((m) => m.j === "legsB").forEach((m) => assert.ok(m.at[2] < 0));
  assert.equal(dog.model.filter((m) => m.j === "legsF").length, 2);
});

/* Moving parts slice 04 (P1, P2): alive loops are pure maths, seeded per piece;
   the nearest pieces move, the rest stay still. */
import { aliveAngles, nearestIds, seedOf } from "../js/brick-lab/brick-pose.js";

test("alive angles: on top of the pose, inside every joint's range, the same at the same moment", () => {
  PARTS.filter((p) => p.joints).forEach((part) => {
    const seed = seedOf("piece-" + part.id);
    for (let t = 0; t < 12; t += 0.37) {
      const a = aliveAngles(part, null, t, seed, 1);
      Object.keys(a).forEach((key) => {
        const def = jointDef(part, key);
        assert.ok(a[key] >= def.min - 1e-6 && a[key] <= def.max + 1e-6, `${part.id} ${key} ${a[key]} at ${t}`);
      });
      assert.deepEqual(aliveAngles(part, null, t, seed, 1), a);
    }
  });
});

test("alive loops move something on every jointed part, and differ between pieces", () => {
  PARTS.filter((p) => p.joints).forEach((part) => {
    const seed = seedOf("a");
    const moved = [0.5, 1.3, 2.9, 4.1, 6.6].some((t) => JSON.stringify(aliveAngles(part, null, t, seed, 1)) !== JSON.stringify(aliveAngles(part, null, 0, seed, 1)));
    assert.ok(moved, `${part.id} never moves`);
  });
  const dog = getPart("dog");
  assert.notDeepEqual(aliveAngles(dog, null, 3, seedOf("a"), 1), aliveAngles(dog, null, 3, seedOf("b"), 1));
});

test("reduced motion moves half as far; the pose is the starting point", () => {
  const dog = getPart("dog");
  const seed = seedOf("x");
  const rest = jointAngles(dog, null);
  const full = aliveAngles(dog, null, 1.7, seed, 1);
  const half = aliveAngles(dog, null, 1.7, seed, 0.5);
  Object.keys(full).forEach((k) => assert.ok(Math.abs((half[k] - rest[k]) - (full[k] - rest[k]) / 2) < 1e-6, k));
  const fig = getPart("fig_boy");
  const cheer = aliveAngles(fig, { p: "cheer" }, 0.2, seed, 1);
  assert.ok(cheer.armL < -150, "a cheering figure keeps its arms up");
});

test("the nearest pieces move, up to the cap", () => {
  const points = Array.from({ length: 50 }, (_, i) => ({ id: "p" + i, x: i, z: 0 }));
  const near = nearestIds(points, 0, 0, 40);
  assert.equal(near.size, 40);
  assert.ok(near.has("p0") && near.has("p39") && !near.has("p40"));
  assert.equal(nearestIds(points, 49, 0, 3).has("p49"), true);
});
