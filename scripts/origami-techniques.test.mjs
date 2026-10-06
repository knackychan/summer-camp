import test from "node:test";
import assert from "node:assert/strict";
import { TECHNIQUES, techniqueFor } from "../js/vendor/origami-atelier/origami-techniques.js";
import { ORIGAMI_MODELS } from "../js/vendor/origami-atelier/origami-data.js";

/* docs/plans/2026-10-05-origami-audit/ slice 11, design O13. */
const CARDS = ["inside-reverse", "outside-reverse", "petal-fold", "squash-fold", "rabbit-ear", "pleat", "crimp", "blintz"];

test("every technique the plan names has a card, and nothing else does", () => {
  assert.deepEqual(Object.keys(TECHNIQUES).sort(), [...CARDS].sort());
});

test("every card has its name and meaning in EN and 中文", () => {
  for (const [id, tech] of Object.entries(TECHNIQUES)) {
    for (const key of ["name", "meaning"]) {
      assert.ok(tech[key].en?.trim(), `${id} ${key} EN`);
      assert.match(tech[key].zhHant || "", /[一-鿿]/, `${id} ${key} 中文`);
      assert.ok(!tech[key].zhHant.includes("折"), `${id} ${key} uses 摺, not 折`);
    }
  }
});

test("every demo shape keeps its point count through its keyframes, inside the 120 × 90 box", () => {
  for (const [id, tech] of Object.entries(TECHNIQUES)) {
    assert.ok(tech.shapes.length > 0, id);
    const frames = tech.shapes[0].pts.length;
    for (const [i, shape] of tech.shapes.entries()) {
      assert.equal(shape.pts.length, frames, `${id} shape ${i}: same keyframe count as the others`);
      const n = shape.pts[0].length;
      assert.ok(n >= 3, `${id} shape ${i}: a polygon`);
      for (const poly of shape.pts) {
        assert.equal(poly.length, n, `${id} shape ${i}: point count kept`);
        for (const [x, y] of poly) assert.ok(x >= 0 && x <= 120 && y >= 0 && y <= 90, `${id} shape ${i}: (${x}, ${y}) inside the box`);
      }
      if (shape.turn != null) assert.ok(shape.turn > 0 && shape.turn < frames, `${id} shape ${i}: turns between its keyframes`);
    }
  }
});

test("every step that uses one of these folds finds its card", () => {
  const used = new Set(ORIGAMI_MODELS.flatMap((m) => m.steps.map((s) => s.operation)));
  for (const id of CARDS) assert.ok(used.has(id), `${id} is used by some model`);
  for (const m of ORIGAMI_MODELS) for (const s of m.steps) {
    if (CARDS.includes(s.operation)) assert.equal(techniqueFor(s)?.id, s.operation, `${m.id} ${s.id}`);
    else assert.equal(techniqueFor(s), null, `${m.id} ${s.id} needs no card`);
  }
});
