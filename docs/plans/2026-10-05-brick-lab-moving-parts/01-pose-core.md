# Slice 01 — Pose core: joints on minifigures, saved poses, Sit

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A minifigure piece can hold a pose (Wave, Cheer, Sit…) that is drawn with turned limbs, saved with the world, undone, and sent as a `pose` change. A standing minifigure can sit on a chair.

**Architecture:** A new pure module `js/brick-lab/brick-pose.js` owns pose data and maths: presets, cleaning, joint angles and the Sit shape. Minifigure primitives in `brick-parts.js` get `j` joint tags plus a `joints` table. `brick-share.js` gets a `pose` op (with its inverse for Undo) and `PROTO` 4. `brick-lab.js` builds a jointed group only for posed pieces (M2): one pivot group per joint, with geometry cached per (part, joint, slot). Placement uses the sitting shape for a sitting piece. There is no UI in this slice. The focus-mode editor is slice 02. The browser harness drives poses through a `pose()` hook on the registry game.

**Tech Stack:** ES modules (Android 8 syntax gate: no `?.`, `??`, `.flat()`), Three.js via `three-runtime.js`, `node:test`, Playwright (Python) harness, `scripts/check.mjs`.

**Design:** [design.md](design.md) M1–M3, M6, M9, M12 and the M11 gates. **Depends on:** nothing.

**Implemented 2026-10-05** (commits `fdff736` … this one). As built, two changes from the steps below:
- The harness picks rail tiles with `.first`, because a part also shows in the Recent row.
- The harness shoots `pose-wave.png` and `pose-sit-chair.png` as close-ups: three wheel steps on the piece, then back to the home view.

Verified:
- `check.mjs` green, including `brick-pose.test.mjs` (10) and `brick-share.test.mjs` (14).
- `check-brick-lab-ui.py` 215/215, no page or console errors.
- Close-ups looked at: the right arm is raised for Wave; the seated figure sits on the chair seat, legs over the front, neither sunk nor floating.

Pending: Papa's look, which comes with slice 02, since there is no button yet.

## Files
- Create: `js/brick-lab/brick-pose.js`. Pure: presets, `cleanPose`, `jointAngles`, `isSitting`, `poseShape`, `sitShift`, `sitOffset`, `samePose`, `stopsOf`, `posesFor`.
- Create: `scripts/brick-pose.test.mjs`
- Modify: `js/brick-lab/brick-parts.js`. `mirror()` swaps an `L`/`R` joint tag; `minifig()` tags its primitives; new `minifigJoints()`; `figure()` adds `joints`, `body` and the head tag on extras.
- Modify: `js/brick-lab/brick-share.js`. `PROTO` 4; `copyPiece`, `stateOf` and `sameState` keep the pose; `checkOp` / `applyOp` get a `pose` case.
- Modify: `scripts/brick-share.test.mjs`. Pose op tests.
- Modify: `js/brick-lab/brick-lab.js`:
  - `makeJointedPiece()`; `addObject()` builds it for posed pieces.
  - `addPiece()` keeps the pose.
  - `shapeOf()`, used where an existing piece lands: `settle`, `landing`'s loop, rotate, move, drag, duplicate. Duplicate copies the pose.
  - `setPose()`; a `showOp()` `pose` case; `shareRules().pose`.
  - `snapshot().poseAngles`.
- Modify: `js/games/bricklab.js`. A `pose(id, pose)` hook for the harness and for slice 02.
- Modify: `scripts/check.mjs`. The joint / pose gate.
- Modify: `scripts/check-brick-lab-ui.py`. Browser checks for wave, Undo, sit on a chair, stand up, and the pose in the saved world.

---

### Task 1: `brick-pose.js`, the pure pose maths

**Files:**
- Create: `js/brick-lab/brick-pose.js`
- Test: `scripts/brick-pose.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `scripts/brick-pose.test.mjs`. Its fixture is a hand-made jointed part, so this task doesn't depend on Task 2:

```js
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
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test scripts/brick-pose.test.mjs`
Expected: FAIL. `Cannot find module '.../js/brick-lab/brick-pose.js'`.

- [ ] **Step 3: Write `js/brick-lab/brick-pose.js`**

```js
/* Brick Lab poses (docs/plans/2026-10-05-brick-lab-moving-parts/ M1, M5, M6, M12).
   Pure: no DOM, no Three, so node tests and check.mjs read it directly.

   A jointed part lists `joints`: { name: { at: [x, y, z], axis, step, min, max } }
   — the pivot in part space (x across, y up from the part's floor, z to its
   front), the axis it turns on and, in degrees, how far one ↻ turns and the
   range it wraps inside. Its `body` names its pose list below. A piece's pose
   is { p: presetId, t: { joint: steps } }; no pose means the first preset. */

/* Sitting (M12): the legs are 0.8 thick, so the body drops by the part of the
   thigh under the hip pivot, and moves half a stud back onto the back row. */
export const SIT = Object.freeze({ drop: 0.85, back: 0.5 });

const preset = (id, en, zh, angles = {}, extra = {}) =>
  Object.freeze({ id, label: Object.freeze([en, zh]), angles: Object.freeze(angles), ...extra });

export const POSES = Object.freeze({
  minifig: Object.freeze([
    preset("stand", "Stand", "站好"),
    preset("sit", "Sit", "坐下", { legL: -90, legR: -90 }, { sit: true }),
    preset("wave", "Wave", "揮手", { armR: -135 }),
    preset("cheer", "Cheer", "歡呼", { armL: -180, armR: -180 }),
    preset("walk", "Walk", "走路", { armL: 45, armR: -45, legL: -22.5, legR: 22.5 }),
    preset("point", "Point", "指向", { armR: -90 }),
    preset("lookL", "Look left", "看左邊", { head: 45 }),
    preset("lookR", "Look right", "看右邊", { head: -45 }),
  ]),
  /* The Sitting Minifigure part comes seated: its rest is sitting. */
  minifigSeated: Object.freeze([
    preset("seated", "Sit", "坐好"),
    preset("wave", "Wave", "揮手", { armR: -135 }),
    preset("cheer", "Cheer", "歡呼", { armL: -180, armR: -180 }),
    preset("lookL", "Look left", "看左邊", { head: 45 }),
    preset("lookR", "Look right", "看右邊", { head: -45 }),
  ]),
});

const round = (n) => Math.round(n * 1000) / 1000;

/* The presets a part can take: those whose every joint it has. */
export function posesFor(part) {
  if (!part || !part.joints) return [];
  return (POSES[part.body] || []).filter((p) => Object.keys(p.angles).every((j) => part.joints[j]));
}

/* Every angle a joint can stop at, min → max. */
export function stopsOf(def) {
  const out = [];
  for (let a = def.min; a <= def.max + 1e-9; a += def.step) out.push(round(a));
  return out;
}

/* A saved or asked-for pose made safe for this part; null means rest. */
export function cleanPose(part, raw) {
  if (!part || !part.joints || !raw || typeof raw !== "object") return null;
  const presets = posesFor(part);
  if (!presets.length) return null;
  const chosen = presets.find((p) => p.id === raw.p) || presets[0];
  const t = {};
  if (raw.t && typeof raw.t === "object") {
    Object.keys(raw.t).sort().forEach((joint) => {
      const steps = raw.t[joint];
      if (part.joints[joint] && Number.isInteger(steps) && steps !== 0 && Math.abs(steps) <= 64) t[joint] = steps;
    });
  }
  const tweaked = Object.keys(t).length > 0;
  if (chosen === presets[0] && !tweaked) return null;
  return tweaked ? { p: chosen.id, t } : { p: chosen.id };
}

export function samePose(a, b) {
  return JSON.stringify(a || null) === JSON.stringify(b || null);
}

function presetOf(part, pose) {
  const presets = posesFor(part);
  return (pose && presets.find((p) => p.id === pose.p)) || presets[0] || null;
}

/* Degrees for every joint of the part in this pose. */
export function jointAngles(part, pose) {
  const out = {};
  if (!part || !part.joints) return out;
  const chosen = presetOf(part, pose);
  Object.keys(part.joints).forEach((joint) => {
    const stops = stopsOf(part.joints[joint]);
    const base = chosen && chosen.angles[joint] != null ? chosen.angles[joint] : 0;
    let index = stops.findIndex((a) => Math.abs(a - base) < 1e-6);
    if (index < 0) index = stops.findIndex((a) => Math.abs(a) < 1e-6);
    const steps = pose && pose.t && pose.t[joint] ? pose.t[joint] : 0;
    out[joint] = stops[(((index + steps) % stops.length) + stops.length) % stops.length];
  });
  return out;
}

export function isSitting(part, pose) {
  const chosen = pose ? presetOf(part, pose) : null;
  return !!(chosen && chosen.sit);
}

/* The box a piece fills in this pose: a sitting minifigure is 2 deep and lower (M12). */
export function poseShape(part, pose) {
  if (!isSitting(part, pose)) return part;
  return { ...part, depth: 2, height: round(part.height - SIT.drop), top: round(part.top - SIT.drop) };
}

/* How far the piece's centre moves when it sits (+1) or stands up (−1):
   half a stud towards its front, which turns with the piece. */
export function sitShift(rotation, sign = 1) {
  const r = rotation * Math.PI / 180;
  return { dx: round(Math.sin(r) * SIT.back * sign) + 0, dz: round(Math.cos(r) * SIT.back * sign) + 0 };
}

/* Where the standing model sits inside its sitting box, in part space before
   the piece's turn: lower by the drop less the box's own drop, half a stud back. */
export function sitOffset() {
  return { y: -SIT.drop / 2, z: -SIT.back };
}
```

(`+ 0` turns a `-0` into `0`, so `deepEqual` with `{ dx: 0 }` holds.)

- [ ] **Step 4: Run it and see it pass**

Run: `node --test scripts/brick-pose.test.mjs`
Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add js/brick-lab/brick-pose.js scripts/brick-pose.test.mjs
git commit -m "feat(brick-lab): pose maths - presets, joint stops, Sit shape"
```

---

### Task 2: Joints on the 16 minifigures

**Files:**
- Modify: `js/brick-lab/brick-parts.js:29-34` (`mirror`), `:74-111` (`minifig`), `:115-119` (`figure`)
- Test: `scripts/brick-pose.test.mjs` (append)

- [ ] **Step 1: Write the failing test** (append to `scripts/brick-pose.test.mjs`)

```js
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
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test scripts/brick-pose.test.mjs`
Expected: FAIL in "all 16 minifigures are jointed" (`p.joints` is undefined).

- [ ] **Step 3: Tag the minifigure.** In `js/brick-lab/brick-parts.js`:

`mirror` (lines 29–34) becomes:

```js
/* The same primitive on both sides of x = 0. A joint tag ending in L (the
   figure's left is +x: it faces +z) becomes R on the copy. */
function mirror(p) {
  const other = { ...p, at: [-p.at[0], p.at[1], p.at[2]] };
  if (p.rot) other.rot = [p.rot[0], -p.rot[1], -p.rot[2]];
  if (p.j) other.j = p.j.replace(/L$/, "R");
  return [p, other];
}
```

Add after `face`:

```js
/* Tag every primitive in a (nested) list with a joint. */
const tag = (list, j) => flatten(list).map((p) => ({ ...p, j }));

/* A minifigure's pins (moving-parts M3): the neck turns, shoulders and hips swing. */
function minifigJoints({ sit = false, lower = "legs" } = {}) {
  const dy = sit ? -1.25 : 0;
  const dz = sit ? -0.5 : 0;
  const joints = {
    head: { at: [0, 2.94 + dy, dz], axis: "y", step: 45, min: -90, max: 90 },
    armL: { at: [0.9, 2.62 + dy, dz], axis: "x", step: 45, min: -180, max: 45 },
    armR: { at: [-0.9, 2.62 + dy, dz], axis: "x", step: 45, min: -180, max: 45 },
  };
  if (!sit && lower !== "skirt") {
    joints.legL = { at: [0.47, 1.25, 0], axis: "x", step: 22.5, min: -90, max: 45 };
    joints.legR = { at: [-0.47, 1.25, 0], axis: "x", step: 22.5, min: -90, max: 45 };
  }
  return Object.freeze(joints);
}
```

In `minifig()`, tag the moving primitives. These are the changes, written in full:

```js
  } else if (lower === "legs") {
    out.push(mirror({ box: [0.92, 1.25, 0.8], at: [0.47, 0.625, 0], c: legs, j: "legL" }));
    out.push({ box: [1.9, 0.32, 0.8], at: [0, 1.41, 0], c: legs });
  } else if (lower === "skirt") {
    out.push({ lathe: [[0.01, 0], [0.98, 0], [0.98, 0.08], [0.68, 1.57], [0.01, 1.57]], at: [0, 0, 0], c: legs });
  } else if (lower === "peg") {
    out.push({ box: [0.92, 1.25, 0.8], at: [0.47, 0.625, 0], c: legs, j: "legL" });
    out.push({ cyl: [0.16, 0.12, 1.25], at: [-0.47, 0.625, 0], c: "wood", j: "legR" });
    out.push({ box: [1.9, 0.32, 0.8], at: [0, 1.41, 0], c: legs });
  }
  const top = [
    { prism: [[-0.97, 1.57], [0.97, 1.57], [0.74, 2.88], [-0.74, 2.88]], len: 0.78, at: [0, 0, 0], c: torso },
    mirror({ cyl: [0.2, 0.24, 1.05], at: [0.93, 2.3, 0.02], rot: [0, 0, 12], c: arms || torso, j: "armL" }),
    mirror({ ball: 0.17, at: [1.06, 1.72, 0.14], c: hands, seg: 10, segH: 8, j: "armL" }),
    { cyl: [0.3, 0.12], at: [0, 2.94, 0], c: skin, j: "head" },
  ];
  if (head) {
    top.push({ lathe: [[0.01, 0], [0.44, 0], [0.52, 0.08], [0.52, 0.78], [0.44, 0.86], [0.01, 0.86]], at: [0, HEAD, 0], c: skin, j: "head" });
    top.push({ cyl: [0.3, 0.17], at: [0, HEAD + 0.94, 0], c: skin, j: "head" });
    if (eyes) top.push(tag(face(), "head"));
  }
```

(The sitting branch's legs stay untagged: the seated figure's legs don't move.)

`figure()` becomes:

```js
/* Extras at head height (a hat, hair, a helmet, a beard) turn with the head;
   lower ones (stripes, an apron, an air tank) stay on the body. An extra
   that already names a joint keeps it. */
const headExtras = (prims) => flatten(prims).map((p) => (p.j || !p.at || p.at[1] < HEAD - 0.1 ? p : { ...p, j: "head" }));

function figure(id, label, opts, extras = [], extra = {}) {
  const sit = !!opts.sit;
  const height = (extra.height || (sit ? FIG_TOP - 1.25 : FIG_TOP) + 0.05);
  return model(id, label, "figures", 2, sit ? 2 : 1, height, [minifig(opts), onHead(headExtras(extras), sit)],
    { head: true, top: sit ? FIG_TOP - 1.25 : FIG_TOP, joints: minifigJoints(opts), body: sit ? "minifigSeated" : "minifig", ...extra, height });
}
```

`model()` copies `extra` onto the part, so `joints` and `body` reach the catalog. `clean()` keeps `j`.

- [ ] **Step 4: Run it and see it pass**

Run: `node --test scripts/brick-pose.test.mjs`
Expected: all tests pass. If the hat test fails for a figure, its extra sits below `HEAD − 0.1`; tag that extra `j: "head"` by hand.

- [ ] **Step 5: Run the gate and the existing Brick Lab tests**

Run: `node scripts/check.mjs`
Expected: `Summer Quest check passed`. The tags change no part id, so `CATALOG_ID` is unchanged.

- [ ] **Step 6: Commit**

```bash
git add js/brick-lab/brick-parts.js scripts/brick-pose.test.mjs
git commit -m "feat(brick-lab): minifigures get head, arm and leg joints"
```

---

### Task 3: The `pose` op in `brick-share.js` and `PROTO` 4

**Files:**
- Modify: `js/brick-lab/brick-share.js:18` (`PROTO`), `:24-40` (`copyPiece`, `stateOf`, `sameState`), `checkOp`, `applyOp`, and the header comment's op list
- Test: `scripts/brick-share.test.mjs` (append)

- [ ] **Step 1: Write the failing tests** (append to `scripts/brick-share.test.mjs`)

```js
const fig = (extra = {}) => ({ id: "f", partId: "fig_boy", colorId: "red", x: 0, y: 2.025, z: 0.5, rotation: 0, ...extra });

test("a pose op sets the pose and the spot, and its inverse puts both back", () => {
  const world = worldOf(fig());
  const op = { type: "pose", id: "f", pose: { p: "sit" }, x: 0, y: 1.6, z: 1 };
  assert.equal(checkOp(op, world, rules), null);
  const back = applyOp(op, world);
  assert.deepEqual(world.get("f").pose, { p: "sit" });
  assert.equal(world.get("f").z, 1);
  assert.equal(checkOp(back, world, rules), null);
  applyOp(back, world);
  assert.equal("pose" in world.get("f"), false);
  assert.equal(world.get("f").z, 0.5);
});

test("a pose op is refused for a missing piece, a bad shape, the rules' veto or off the plate", () => {
  const world = worldOf(fig());
  assert.equal(checkOp({ type: "pose", id: "nope", pose: null, x: 0, y: 2, z: 0.5 }, world, rules), "id");
  assert.equal(checkOp({ type: "pose", id: "f", pose: "wave", x: 0, y: 2, z: 0.5 }, world, rules), "shape");
  assert.equal(checkOp({ type: "pose", id: "f", pose: { p: "wave" }, x: 0, y: 2, z: 0.5 }, world, { ...rules, pose: () => false }), "catalog");
  assert.equal(checkOp({ type: "pose", id: "f", pose: { p: "wave" }, x: 99, y: 2, z: 0.5 }, world, rules), "place");
});

test("a removed posed piece comes back posed; expect sees a pose change", () => {
  const world = worldOf(fig({ pose: { p: "wave" } }));
  const back = applyOp({ type: "remove", id: "f" }, world);
  applyOp(back, world);
  assert.deepEqual(world.get("f").pose, { p: "wave" });
  const before = { ...world.get("f") };
  applyOp({ type: "pose", id: "f", pose: { p: "cheer" }, x: 0, y: 2.025, z: 0.5 }, world);
  assert.equal(checkOp({ type: "move", id: "f", x: 2, y: 2.025, z: 0.5, rotation: 0, expect: { ...before, pose: JSON.stringify({ p: "wave" }) } }, world, rules), "changed");
});

test("PROTO is 4: poses are new on the wire", () => {
  assert.equal(PROTO, 4);
});
```

Add `PROTO` to that file's existing import from `brick-share.js`.

- [ ] **Step 2: Run them and see them fail**

Run: `node --test scripts/brick-share.test.mjs`
Expected: FAIL. `checkOp` returns `"shape"` for the pose op, and PROTO is 3.

- [ ] **Step 3: Implement.** In `js/brick-lab/brick-share.js`:

Header op list: add the line `{ type: "pose", id, pose, x, y, z }   (pose null = rest; sitting moves the piece)`.

```js
export const PROTO = 4; /* 2: a big world comes in several lines · 3: hello carries the catalog fingerprint · 4: poses (moving-parts M9) */
```

```js
function copyPiece(piece) {
  const out = { id: piece.id, partId: piece.partId, colorId: piece.colorId, x: piece.x, y: piece.y, z: piece.z, rotation: piece.rotation };
  if (typeof piece.by === "string") out.by = piece.by;
  if (piece.pose) out.pose = JSON.parse(JSON.stringify(piece.pose));
  return out;
}

/* The fields `expect` compares: where it is, which part, which colour, its pose. */
function stateOf(piece) {
  if (!piece) return null;
  const out = {};
  FIELDS.forEach((key) => { out[key] = piece[key]; });
  out.pose = piece.pose ? JSON.stringify(piece.pose) : null;
  return out;
}

export function sameState(a, b) {
  if (!a || !b) return !a && !b;
  return FIELDS.every((key) => a[key] === b[key]) && (a.pose || null) === (b.pose || null);
}
```

In `checkOp`'s switch, before `default`:

```js
    case "pose": {
      if (!current) return "id";
      const good = op.pose === null || (op.pose && typeof op.pose === "object" && typeof op.pose.p === "string" && op.pose.p.length <= 24);
      if (!good) return "shape";
      if (rules.pose && !rules.pose(current.partId, op.pose)) return "catalog";
      return placeOk({ ...current, x: op.x, y: op.y, z: op.z }, rules) ? null : "place";
    }
```

In `checkOp`'s `add` case, after the `catalog` line, so a duplicated or undone piece can't bring in a pose the catalog refuses:

```js
      if (piece.pose !== undefined && rules.pose && !rules.pose(piece.partId, piece.pose)) return "catalog";
```

In `applyOp`'s switch, before `default`:

```js
    case "pose": {
      const piece = world.get(op.id);
      const back = { type: "pose", id: op.id, pose: piece.pose || null, x: piece.x, y: piece.y, z: piece.z };
      if (op.pose) piece.pose = JSON.parse(JSON.stringify(op.pose));
      else delete piece.pose;
      Object.assign(piece, { x: op.x, y: op.y, z: op.z });
      back.expect = stateOf(piece);
      return back;
    }
```

Extend the `rules` doc comment above `checkOp` with `pose?(partId, pose) → bool`.

- [ ] **Step 4: Run the share and together tests**

Run: `node --test scripts/brick-share.test.mjs scripts/brick-together.test.mjs`
Expected: all pass. The together tests use `PROTO` relatively (`PROTO + 1`).

- [ ] **Step 5: Commit**

```bash
git add js/brick-lab/brick-share.js scripts/brick-share.test.mjs
git commit -m "feat(brick-lab): pose op with undo, PROTO 4"
```

---

### Task 4: The lab draws, places, saves and changes poses

**Files:**
- Modify: `js/brick-lab/brick-lab.js`:
  - imports
  - after `makeModelPiece` (~line 1335): `makeJointedPiece`
  - `addObject` (~2776)
  - `addPiece` (~2757)
  - `settle` (~2745)
  - `shareRules` (~2796)
  - `showOp` (~2837)
  - `landing` loop (~2962)
  - `ghostAt` (~3118), `onDragMove` (~3169), `onTap` move (~3225), `rotateSelected` (~3336), `duplicateSelected` (~3347)
  - new `setPose`
  - `snapshot` (~3556)
- Modify: `js/games/bricklab.js` (the `pose` hook)

- [ ] **Step 1: Import.** At the top of `brick-lab.js`, next to the other `./brick-*.js` imports:

```js
import { cleanPose, isSitting, jointAngles, poseShape, samePose, sitOffset, sitShift } from "./brick-pose.js";
```

- [ ] **Step 2: The jointed mesh (M1, M2).** Add after `makeModelPiece`:

```js
/* A posed model part (moving-parts M1, M2): the body plus one pivot group per
   joint, each holding its own merged geometry per colour slot, cached per
   (part, joint, slot). Joint geometry is built around its pivot so the group
   turns it in place. A sitting figure sits lower and back in its box (M12). */
function makeJointedPiece(part, colorHex, kit, pose) {
  const root = new THREE.Group();
  const inner = new THREE.Group();
  root.add(inner);
  if (isSitting(part, pose)) {
    const off = sitOffset();
    inner.position.set(0, off.y, off.z);
  }
  const angles = jointAngles(part, pose);
  const half = part.height / 2;
  ["", ...Object.keys(part.joints)].forEach((joint) => {
    let holder = inner;
    let pivot = [0, half, 0];
    if (joint) {
      const def = part.joints[joint];
      pivot = def.at;
      holder = new THREE.Group();
      holder.position.set(def.at[0], def.at[1] - half, def.at[2]);
      holder.rotation[def.axis] = angles[joint] * DEG;
      holder.userData.sqblJoint = joint;
      inner.add(holder);
    }
    modelSlots(part).forEach((slot) => {
      const prims = part.model.filter((p) => (p.c || "main") === slot && (p.j || "") === joint);
      if (!prims.length) return;
      const geometry = kit.geo(`${part.id}:${joint || "body"}:${slot}`, () => {
        const merged = mergeGeometries(prims.map((p) => primitiveGeometry(p, kit)));
        merged.translate(-pivot[0], -pivot[1], -pivot[2]);
        merged.computeBoundingBox();
        merged.computeBoundingSphere();
        return merged;
      });
      const finish = slot === "main" ? null : FINISHES[slot];
      const see = finish && (finish.opacity || finish.emissive);
      holder.add(mesh(geometry, slot === "main" ? kit.mat(colorHex) : kit.finish(slot), !see));
    });
  });
  return root;
}
```

(For the body, pivot `[0, half, 0]` gives the same `translate(0, -half, 0)` as `makeModelPiece`.)

- [ ] **Step 3: `addObject` builds it for a posed piece.** Replace its first line with:

```js
    const part = getPart(piece.partId);
    const object = part.joints && piece.pose ? makeJointedPiece(part, getColorHex(piece.colorId), this.kit, piece.pose)
      : makePieceMesh(part, getColorHex(piece.colorId), this.kit);
```

- [ ] **Step 4: `addPiece` keeps a clean pose.** After `if (typeof instance.by === "string") clean.by = instance.by;` add:

```js
    const pose = cleanPose(getPart(clean.partId), instance.pose);
    if (pose) clean.pose = pose;
```

- [ ] **Step 5: One shape helper for placing existing pieces.** Add near `pieceBounds` (module level):

```js
/* The box an existing piece fills: its part, or a sitting minifigure's lower 2×2 (moving-parts M12). */
function shapeOf(piece) {
  return poseShape(getPart(piece.partId), piece.pose);
}
```

Then use it:
- `settle`: `const shape = poseShape(part, cleanPose(part, raw.pose));`, then pass `shape` instead of `part` to `placementFor`.
- `landing`'s loop: `const otherPart = shapeOf(instance);` (replaces `getPart(instance.partId)`).
- `ghostAt`: `const part = instance ? shapeOf(instance) : getPart(this.activePartId);`
- `onDragMove`: `this.landing({ … }, shapeOf(instance), instance.rotation, drag.id)`
- `onTap`'s move branch: `this.landing(targetHit.point, shapeOf(instance), instance.rotation, this.moveId)`
- `rotateSelected`: `this.landing(instance, shapeOf(instance), rotation, id)`
- `duplicateSelected`:
  - `const part = shapeOf(original);`
  - The add op's piece gets `...(original.pose ? { pose: original.pose } : {})`.

Check that nothing else calls `landing` / `placementFor` with an existing piece's part:
Run: `grep -n "landing(\|placementFor(" js/brick-lab/brick-lab.js`
Expected: every hit is either one of the above, the armed part (`this.activePartId`), or `placementFor`'s own wrapper.

- [ ] **Step 6: The host checks a pose against the catalog.** In `shareRules()` add:

```js
      pose: (partId, pose) => pose === null || samePose(cleanPose(getPart(partId), pose), pose),
```

- [ ] **Step 7: `showOp` redraws a re-posed piece.** Add before `this.scheduleSave();`:

```js
    else if (op.type === "pose") {
      const old = this.sceneObjects.get(op.id);
      if (old) {
        this.scene.remove(old);
        disposeTree(old);
        this.sceneObjects.delete(op.id);
      }
      this.addObject(this.pieces.get(op.id));
      if (this.selectedId === op.id) this.selectPiece(op.id);
    }
```

`disposeTree` frees only what isn't in `SHARED`. The cached geometries (`kit.geo`) and materials survive.

- [ ] **Step 8: `setPose`, the one way a pose changes.** Add after `recolorSelected`:

```js
  /* Pose a piece (moving-parts M6, M9, M12). Sitting down or standing up moves
     its centre half a stud and lands it again by the usual rules. Returns
     whether the world now holds that pose. */
  setPose(id, raw) {
    const piece = this.pieces.get(id);
    if (!piece) return false;
    const part = getPart(piece.partId);
    const pose = cleanPose(part, raw);
    if (samePose(pose, piece.pose)) return true;
    const was = isSitting(part, piece.pose);
    const now = isSitting(part, pose);
    let point = { x: piece.x, z: piece.z };
    if (was !== now) {
      const shift = sitShift(piece.rotation, now ? 1 : -1);
      point = { x: piece.x + shift.dx, z: piece.z + shift.dz };
    }
    const pos = this.landing(point, poseShape(part, pose), piece.rotation, id).pos;
    const done = this.change({ type: "pose", id, pose, x: pos.x, y: pos.y, z: pos.z });
    this.invalidate();
    return !!done;
  }
```

- [ ] **Step 9: `snapshot()` reports the selected piece's joint angles.** Add next to `selectedColors`:

```js
      /* The selected piece's drawn joint angles in degrees (moving-parts checks). */
      poseAngles: this.selectedId && this.sceneObjects.get(this.selectedId) ? (() => {
        const out = {};
        this.sceneObjects.get(this.selectedId).traverse((node) => {
          if (node.userData.sqblJoint) out[node.userData.sqblJoint] = Math.round(node.rotation[getPart(this.pieces.get(this.selectedId).partId).joints[node.userData.sqblJoint].axis] / DEG * 10) / 10;
        });
        return out;
      })() : {},
```

- [ ] **Step 10: The registry hook.** In `js/games/bricklab.js`, add to the default export after `snapshot`:

```js
  /* Pose a piece by id (moving-parts slice 01): the harness, then slice 02's editor. */
  pose: function (id, pose) { return !!(lab && !lab.destroyed && lab.setPose(id, pose)); },
```

- [ ] **Step 11: Gate + unit tests**

Run: `node scripts/check.mjs`
Expected: `Summer Quest check passed`. If `tests: payload verifier` fails as stale, run `node scripts/build-android-web.mjs` first (it rebuilds the git-ignored `dist/android-web`), then re-run.

- [ ] **Step 12: Commit**

```bash
git add js/brick-lab/brick-lab.js js/games/bricklab.js
git commit -m "feat(brick-lab): posed pieces draw jointed, sit, save and undo"
```

---

### Task 5: The joint / pose gate in `check.mjs`

**Files:**
- Modify: `scripts/check.mjs`, right after the model-part gate (after the `fixed flag must match` loop, ~line 1159, inside the same `try`)

- [ ] **Step 1: Add the gate**

```js
  // Moving parts (docs/plans/2026-10-05-brick-lab-moving-parts/ M1, M11): every tagged primitive names a
  // declared joint, every joint moves something, has a sane range with 0 as a stop, every preset angle
  // is a stop, and every jointed part has a pose list with EN + 中文.
  var poseMod = await import(new URL("js/brick-lab/brick-pose.js", root));
  Object.keys(poseMod.POSES).forEach(function (body) {
    poseMod.POSES[body].forEach(function (p) { assertPair(p.label, "bricklab.pose." + body + "." + p.id); });
  });
  brickMod.PARTS.forEach(function (part) {
    var joints = part.joints || {};
    (part.model || []).forEach(function (prim, i) {
      if (prim.j != null && !joints[prim.j]) fail("bricklab", part.id + " primitive " + i + " names undeclared joint " + prim.j);
    });
    if (!part.joints) return;
    if (!poseMod.POSES[part.body] || !poseMod.posesFor(part).length) fail("bricklab", part.id + " has joints but no pose list fits them");
    Object.keys(joints).forEach(function (name) {
      var d = joints[name];
      if (!(Array.isArray(d.at) && d.at.length === 3 && finite(d.at)) || ["x", "y", "z"].indexOf(d.axis) < 0 || !(d.step > 0) || !(d.min <= 0 && d.max >= 0)) {
        fail("bricklab", part.id + " joint " + name + " needs at[3], an axis x/y/z, step > 0 and min ≤ 0 ≤ max");
        return;
      }
      if (!part.model.some(function (p) { return p.j === name; })) fail("bricklab", part.id + " joint " + name + " moves nothing");
      if (!poseMod.stopsOf(d).some(function (a) { return Math.abs(a) < 1e-6; })) fail("bricklab", part.id + " joint " + name + ": 0° must be a stop");
    });
    poseMod.posesFor(part).forEach(function (p) {
      Object.keys(p.angles).forEach(function (j) {
        if (!poseMod.stopsOf(joints[j]).some(function (a) { return Math.abs(a - p.angles[j]) < 1e-6; })) fail("bricklab", part.id + " pose " + p.id + " puts " + j + " between stops");
      });
    });
  });
```

- [ ] **Step 2: Prove the gate bites.** Temporarily change one `j: "armL"` in `minifig()` to `j: "armX"`.
Run: `node scripts/check.mjs`
Expected: `Summer Quest check failed`, with `fig_boy primitive … names undeclared joint armX`. Revert the edit.

- [ ] **Step 3: Run green**

Run: `node scripts/check.mjs`
Expected: `Summer Quest check passed`.

- [ ] **Step 4: Commit**

```bash
git add scripts/check.mjs
git commit -m "test(brick-lab): gate joints and pose presets"
```

---

### Task 6: Browser checks

**Files:**
- Modify: `scripts/check-brick-lab-ui.py`. Add `pose_checks(page, snap, check, out)` and call it right after `catalog_checks(page, snap, check, out)` (~line 1179).

- [ ] **Step 1: Add the checks**

```python
def pose_checks(page, snap, check, out):
    """Moving parts slice 01 (docs/plans/2026-10-05-brick-lab-moving-parts/): a posed minifig keeps its
    spot and turns its arm; Sit lands on a chair's seat and standing up returns to the 2×1 spot; Undo
    takes a pose back; a pose is saved with the world."""
    def tap(x, y):
        page.mouse.click(x, y)
        page.wait_for_timeout(150)

    def selected():
        s = snap()
        return next(p for p in s['pieces'] if p['id'] == s['selectedId'])

    def pose(pid, value):
        return page.evaluate("([id, pose]) => SQGames.get('bricklab').pose(id, pose)", [pid, value])

    box = page.locator('.sqbl-stage canvas').bounding_box()
    page.locator('.sqbl-app [data-action="home-view"]').click()
    page.wait_for_timeout(900)
    pick(page, 'figures')
    page.locator('.sqbl-part[data-part="fig_boy"]').first.click()
    page.locator('.sqbl-tray-title').click()
    tap(box['x'] + box['width'] * 0.35, box['y'] + box['height'] * 0.62)
    boy = selected()
    check('A minifig places', boy['partId'] == 'fig_boy')
    check('Wave turns the right arm up and keeps the spot', pose(boy['id'], {'p': 'wave'})
          and selected()['pose'] == {'p': 'wave'} and snap()['poseAngles'].get('armR') == -135
          and (selected()['x'], selected()['y'], selected()['z']) == (boy['x'], boy['y'], boy['z']))
    page.screenshot(path=str(out / 'pose-wave.png'))
    page.locator('.sqbl-app [data-action="undo"]').dispatch_event('pointerdown')
    page.wait_for_timeout(200)
    check('Undo takes the pose back', 'pose' not in next(p for p in snap()['pieces'] if p['id'] == boy['id']))

    pick(page, 'home')
    page.locator('.sqbl-part[data-part="chair"]').first.click()
    page.locator('.sqbl-tray-title').click()
    tap(box['x'] + box['width'] * 0.6, box['y'] + box['height'] * 0.62)
    chair = selected()
    pick(page, 'figures')
    page.locator('.sqbl-part[data-part="fig_boy"]').first.click()
    page.locator('.sqbl-tray-title').click()
    tap(chair['screen']['x'], chair['screen']['y'])
    sitter = selected()
    check('Sit lands the seat on the chair\'s top', pose(sitter['id'], {'p': 'sit'}) and abs(
          selected()['y'] - (chair['y'] - 1.1 + 1.0 + 1.6)) < 0.02 and snap()['poseAngles'].get('legL') == -90)
    page.screenshot(path=str(out / 'pose-sit-chair.png'))
    check('Standing up returns to the 2×1 spot', pose(sitter['id'], None)
          and abs(selected()['z'] - sitter['z']) < 1e-6 and abs(selected()['x'] - sitter['x']) < 1e-6)
    pose(sitter['id'], {'p': 'sit'})
    page.wait_for_timeout(400)  # the save runs 180 ms after a change
    saved = next((p for p in world_build(page, 'luis', 'pieces') if p['id'] == sitter['id']), None)
    check('A pose is saved with the world', saved is not None and saved.get('pose') == {'p': 'sit'})
```

`chair['y'] - 1.1 + 1.0` is the chair's floor (`y − height/2`, height 2.2) plus its `top` (1.0). `+ 1.6` is half the sitting height (3.2). The harness runs this part as kid `luis` (see the `world_build(page, 'luis', …)` check above `catalog_checks`). Loading a saved pose goes through `settle` + `addPiece`, which Task 4 covers; slice 06 reopens a posed world in the browser.

- [ ] **Step 2: Run the browser suite**

Run: `python scripts/check-brick-lab-ui.py`
Expected: every check `PASS`, including the 6 new ones; no page or console errors. Look at `pose-wave.png` and `pose-sit-chair.png` in the harness output folder. The arm should be raised forward; the figure should sit on the seat with its legs over the front, not sunk into the chair or floating. If the sitter floats or sinks, adjust `SIT.drop` in `brick-pose.js`, then update its unit test and the design's M12 numbers to match.

- [ ] **Step 3: Commit**

```bash
git add scripts/check-brick-lab-ui.py
git commit -m "test(brick-lab): pose, sit, undo and save in the browser"
```

---

**DONE WHEN:**
- `node scripts/check.mjs` is green, including `brick-pose.test.mjs` and the new `brick-share` tests.
- `python scripts/check-brick-lab-ui.py` passes with no page or console errors.
- `pose-wave.png` and `pose-sit-chair.png` have been looked at: arm raised; seated on the chair.
- An unposed minifigure still draws as one mesh per colour (M2): the `render.calls` reading at the starter village doesn't change.

**Not in this slice:** any button or screen for posing (slice 02), animals (03), Play (04), machines (05).
