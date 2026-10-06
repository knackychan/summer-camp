import test from "node:test";
import assert from "node:assert/strict";
import {
  apply, area, centroid, clipByLine, foldArrow, hingeMatrix, hingeSamples, reflect, sideOf,
} from "../js/vendor/origami-atelier/origami-fold.js";

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const nearP = (p, q, eps = 1e-6) => near(p[0], q[0], eps) && near(p[1], q[1], eps);
const SQUARE = [[75, 30], [225, 30], [225, 180], [75, 180]];
const DIAG = [[75, 30], [225, 180]];

/* Monotone-chain convex hull, then a point-inside test, for "no paper where paper can't be". */
function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (const q of p.reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}
function inside(poly, q, eps = 1e-6) {
  for (let i = 0; i < poly.length; i++) {
    if (sideOf(q, poly[i], poly[(i + 1) % poly.length]) < -eps) return false;
  }
  return true;
}

test("a diagonal cuts the square into two triangles that add up to it", () => {
  const lower = clipByLine(SQUARE, ...DIAG, 1);
  const upper = clipByLine(SQUARE, ...DIAG, -1);
  assert.equal(lower.length, 3);
  assert.equal(upper.length, 3);
  assert.ok(near(area(lower) + area(upper), area(SQUARE)));
  assert.ok(near(area(lower), area(SQUARE) / 2));
});

test("a line that misses the paper leaves it whole on one side and nothing on the other", () => {
  const line = [[0, 5], [300, 5]];
  assert.ok(near(area(clipByLine(SQUARE, ...line, Math.sign(sideOf([150, 100], ...line)))), area(SQUARE)));
  assert.deepEqual(clipByLine(SQUARE, ...line, -Math.sign(sideOf([150, 100], ...line))), []);
});

test("reflecting twice is where it started; s = 1 is no move, s = −1 the mirror", () => {
  const tri = [[75, 30], [75, 180], [225, 180]];
  reflect(reflect(tri, ...DIAG), ...DIAG).forEach((p, i) => assert.ok(nearP(p, tri[i])));
  const id = hingeMatrix(...DIAG, 1);
  [1, 0, 0, 1, 0, 0].forEach((v, i) => assert.ok(near(id[i], v)));
  /* Across the TL→BR diagonal the bottom-left corner lands on the top-right. */
  assert.ok(nearP(apply(hingeMatrix(...DIAG, -1), [75, 180]), [225, 30]));
});

test("points on the crease never move during the fold", () => {
  for (const { s } of hingeSamples()) {
    const m = hingeMatrix(...DIAG, s);
    for (const p of [[75, 30], [150, 105], [225, 180]]) assert.ok(nearP(apply(m, p), p));
  }
});

test("no frame puts the flap outside where the paper can be (flap ∪ its mirror)", () => {
  const cases = [
    { poly: SQUARE, line: DIAG },
    { poly: SQUARE, line: [[75, 105], [225, 105]] },
    { poly: [[150, 25], [230, 105], [150, 185], [70, 105]], line: [[110, 65], [190, 65]] },
  ];
  for (const { poly, line } of cases) {
    const side = Math.sign(sideOf(centroid(poly), ...line)) || 1;
    const flap = clipByLine(poly, ...line, -side);
    const room = hull(flap.concat(reflect(flap, ...line)));
    for (const { s } of hingeSamples()) {
      const m = hingeMatrix(...line, s);
      for (const p of flap) assert.ok(inside(room, apply(m, p), 1e-4), `${p} at s=${s}`);
    }
  }
});

test("the fold samples start flat, end mirrored and turn edge-on exactly halfway", () => {
  const samples = hingeSamples(16);
  assert.equal(samples.length, 17);
  assert.equal(samples[0].s, 1);
  assert.ok(near(samples[16].s, -1));
  assert.equal(samples[8].u, 0.5);
  assert.equal(samples[8].s, 0);
  samples.forEach(({ u, s }) => assert.ok(u < 0.5 ? s > 0 : u > 0.5 ? s < 0 : s === 0));
  for (let i = 1; i < samples.length; i++) assert.ok(samples[i].s < samples[i - 1].s);
});

test("the arrow starts on the moving part and ends where it lands", () => {
  const half = [[75, 105], [225, 105]];
  const flap = [[75, 30], [225, 30], [225, 105], [75, 105]];
  const [start, , end] = foldArrow(flap, ...half);
  assert.ok(start[1] < 105 && end[1] > 105, "goes down across the crease");
  assert.ok(near(start[0], 150) && near(end[0], 150), "from the middle of the far edge");
  const [s2, , e2] = foldArrow([[75, 30], [75, 180], [225, 180]], ...DIAG);
  assert.ok(sideOf(s2, ...DIAG) * sideOf(e2, ...DIAG) < 0, "crosses the diagonal");
  assert.ok(s2[0] < 150 && e2[0] > 150, "bottom-left corner up to top-right");
});
