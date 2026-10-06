import test from "node:test";
import assert from "node:assert/strict";
import { apply, bounds, replay, start, stateArea } from "../js/vendor/origami-atelier/origami-paper.js";
import { area } from "../js/vendor/origami-atelier/origami-fold.js";

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const DIAG = [[0, 0], [1, 1]];
const sheet = () => start({});
const outline = (state) => { const b = bounds(state); return (b.maxX - b.minX) * (b.maxY - b.minY); };
const top = (state) => state.facets.reduce((a, f) => (f.layer > a.layer ? f : a));

test("a diagonal valley fold gives two triangles: the folded one on top, back side up", () => {
  const { state, motion } = apply(sheet(), { op: "valley", line: DIAG, move: [0, 1] });
  assert.equal(state.facets.length, 2);
  assert.ok(near(stateArea(state), 1));
  assert.ok(state.facets.every((f) => near(area(f.poly), 0.5)));
  assert.equal(top(state).face, "back");
  assert.equal(motion.kind, "valley");
  assert.equal(motion.moving.length, 1);
  /* The bottom-left corner lands on the top-right. */
  assert.ok(top(state).poly.some(([x, y]) => near(x, 1, 1e-6) && near(y, 0, 1e-6)));
});

test("a mountain fold puts the folded part underneath", () => {
  const { state } = apply(sheet(), { op: "mountain", line: DIAG, move: [0, 1] });
  const moved = state.facets.find((f) => f.face === "back");
  assert.equal(moved.layer, 0);
  assert.equal(top(state).face, "front");
});

test("two valley folds stack in reverse order and keep the area", () => {
  const one = apply(sheet(), { op: "valley", line: [[0, 0.5], [1, 0.5]], move: [0.5, 0] }).state;
  const two = apply(one, { op: "valley", line: [[0.5, 0], [0.5, 1]], move: [0.9, 0.7] }).state;
  assert.equal(two.facets.length, 4);
  assert.ok(near(stateArea(two), 1));
  assert.ok(near(outline(two), 0.25, 1e-9), "a quarter of the sheet");
  const layers = two.facets.map((f) => f.layer).sort();
  assert.deepEqual(layers, [0, 1, 2, 3]);
});

test("layers: top moves only the uppermost layer at the move point", () => {
  const half = apply(sheet(), { op: "valley", line: [[0, 0.5], [1, 0.5]], move: [0.5, 0] }).state;
  const { state, motion } = apply(half, { op: "valley", line: [[0, 0.75], [1, 0.75]], move: [0.5, 0.9], layers: "top" });
  assert.equal(motion.moving.length, 1);
  assert.ok(near(stateArea(state), 1));
  const all = apply(half, { op: "valley", line: [[0, 0.75], [1, 0.75]], move: [0.5, 0.9] });
  assert.equal(all.motion.moving.length, 2);
});

test("flip swaps every face and reverses the layer order", () => {
  const one = apply(sheet(), { op: "valley", line: DIAG, move: [0, 1] }).state;
  const { state } = apply(one, { op: "flip" });
  const before = Object.fromEntries(one.facets.map((f) => [f.id, f]));
  for (const f of state.facets) {
    assert.notEqual(f.face, before[f.id].face);
    assert.equal(f.layer, one.facets.length - 1 - before[f.id].layer);
  }
});

test("rotating 180° twice is where it started", () => {
  const one = apply(sheet(), { op: "valley", line: DIAG, move: [0, 1] }).state;
  const back = apply(apply(one, { op: "rotate", deg: 180 }).state, { op: "rotate", deg: 180 }).state;
  one.facets.forEach((f, i) => f.poly.forEach((p, j) => {
    assert.ok(near(p[0], back.facets[i].poly[j][0], 1e-9) && near(p[1], back.facets[i].poly[j][1], 1e-9));
  }));
});

test("a precrease leaves the paper as it was", () => {
  const s = sheet();
  const { state, motion } = apply(s, { op: "precrease", line: [[0.5, 0], [0.5, 1]], move: [0.2, 0.5] });
  assert.equal(state, s);
  assert.equal(motion.kind, "precrease");
  assert.equal(motion.moving.length, 1);
});

test("a fold line that misses the paper, and a keyframe with the wrong point count, throw", () => {
  assert.throws(() => apply(sheet(), { op: "valley", line: [[0, 2], [1, 2]], move: [0.5, 0.5] }));
  assert.throws(() => apply(sheet(), { op: "keyframe", to: { s: [[0, 0], [1, 0], [1, 1]] } }));
  assert.throws(() => apply(sheet(), { op: "keyframe", to: { nope: [[0, 0], [1, 0], [1, 1], [0, 1]] } }));
});

test("replay gives each step the state the previous one ended on", () => {
  const model = { paper: { startRotate: 45 }, steps: [
    { fold: { op: "valley", line: [[0, 0.5], [1, 0.5]], move: [0.5, 0] } },
    { fold: { op: "flip" } },
    { fold: { op: "finish" } },
  ] };
  const steps = replay(model);
  assert.equal(steps.length, 3);
  assert.equal(steps[1].before, steps[0].after);
  assert.equal(steps[2].before, steps[1].after);
  assert.ok(steps.every((s) => near(stateArea(s.after), 1)));
});
