/* Flat-fold paper model (docs/plans/2026-10-05-origami-audit/ slice 06, design O8). Pure: no DOM.
   The sheet is a list of facets: a polygon in paper coordinates (the start sheet is the unit square,
   y down), the face showing (front / back) and a layer (higher is nearer the viewer). A step's
   `fold` says what happens to it; the picture of step k is the state after steps 0..k-1, so every
   step starts where the last one ended. */
import { area, clipByLine, hingeMatrix, sideOf } from "./origami-fold.js";

const EPS = 1e-9;

export function start(model) {
  const face = model?.paper?.startFace === "back" ? "back" : "front";
  let poly = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const turn = Number(model?.paper?.startRotate) || 0;
  if (turn) poly = rotatePoly(poly, [0.5, 0.5], turn);
  return { facets: [{ id: "s", poly, face, layer: 0 }] };
}

export function stateArea(state) {
  return state.facets.reduce((sum, f) => sum + area(f.poly), 0);
}

export function bounds(state) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const f of state.facets) for (const [x, y] of f.poly) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

function rotatePoly(poly, c, deg) {
  const r = deg * Math.PI / 180, cos = Math.cos(r), sin = Math.sin(r);
  return poly.map(([x, y]) => [c[0] + (x - c[0]) * cos - (y - c[1]) * sin, c[1] + (x - c[0]) * sin + (y - c[1]) * cos]);
}

function inside(poly, p) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

const other = (face) => face === "front" ? "back" : "front";

/* Renumber layers 0..n−1 keeping their order (ties keep facet order). */
function tidy(facets) {
  const order = [...new Set(facets.map(f => f.layer))].sort((a, b) => a - b);
  return facets.map(f => ({ ...f, layer: order.indexOf(f.layer) }));
}

/* Split every facet along the line; which pieces move depends on `layers`. */
function split(state, fold) {
  const [a, b] = fold.line;
  const side = Math.sign(sideOf(fold.move, a, b));
  if (!side) throw new Error("fold.move is on the fold line");
  const stay = [], moving = [];
  const pieces = [];
  for (const f of state.facets) {
    const go = clipByLine(f.poly, a, b, side), keep = clipByLine(f.poly, a, b, -side);
    const whole = !go.length || !keep.length;
    if (go.length && area(go) > EPS) pieces.push({ ...f, id: whole ? f.id : `${f.id}.m`, poly: go, side: 1 });
    if (keep.length && area(keep) > EPS) pieces.push({ ...f, id: whole ? f.id : `${f.id}.k`, poly: keep, side: -1 });
  }
  let pick = () => true;
  if (fold.layers === "top" || fold.layers === "bottom") {
    const under = pieces.filter(p => p.side === 1 && inside(p.poly, fold.move)).map(p => p.layer);
    if (!under.length) throw new Error("fold.move is not on the paper");
    const target = fold.layers === "top" ? Math.max(...under) : Math.min(...under);
    pick = (p) => p.layer === target;
  }
  for (const p of pieces) {
    const { side: s, ...facet } = p;
    if (s === 1 && pick(p)) moving.push(facet); else stay.push(facet);
  }
  return { stay, moving, line: [a, b] };
}

/* The motion the engine animates, and the state after it. */
export function apply(state, fold) {
  const op = fold?.op;
  if (op === "valley" || op === "mountain" || op === "precrease") {
    const { stay, moving, line } = split(state, fold);
    if (!moving.length || !stay.length) throw new Error(`${op}: the fold line does not cut the paper`);
    if (op === "precrease") return { state, motion: { kind: "precrease", stay, moving, line } };
    const m = hingeMatrix(line[0], line[1], -1);
    const lo = Math.min(...moving.map(f => f.layer)), hi = Math.max(...moving.map(f => f.layer));
    const top = Math.max(...stay.map(f => f.layer), hi), bottom = Math.min(...stay.map(f => f.layer), lo);
    const landed = moving.map(f => ({
      ...f,
      poly: f.poly.map(p => mul(m, p)),
      face: other(f.face),
      layer: op === "valley" ? top + 1 + (hi - f.layer) : bottom - 1 - (f.layer - lo),
    }));
    return { state: { facets: tidy([...stay, ...landed]) }, motion: { kind: op, stay, moving, line } };
  }
  if (op === "flip") {
    const { minX, maxX } = bounds(state);
    const cx = (minX + maxX) / 2;
    const facets = state.facets.map(f => ({ ...f, poly: f.poly.map(([x, y]) => [2 * cx - x, y]), face: other(f.face), layer: -f.layer }));
    return { state: { facets: tidy(facets) }, motion: { kind: "flip", stay: [], moving: state.facets, line: [[cx, 0], [cx, 1]] } };
  }
  if (op === "rotate") {
    const { minX, maxX, minY, maxY } = bounds(state);
    const c = [(minX + maxX) / 2, (minY + maxY) / 2], deg = Number(fold.deg) || 180;
    const facets = state.facets.map(f => ({ ...f, poly: rotatePoly(f.poly, c, deg) }));
    return { state: { facets }, motion: { kind: "rotate", stay: [], moving: state.facets, centre: c, deg } };
  }
  if (op === "keyframe") {
    const to = fold.to || {};
    for (const id of Object.keys(to)) {
      const f = state.facets.find(x => x.id === id);
      if (!f) throw new Error(`keyframe: no facet ${id}`);
      if (to[id].length !== f.poly.length) throw new Error(`keyframe: ${id} has ${f.poly.length} points, target has ${to[id].length}`);
    }
    const facets = state.facets.map(f => to[f.id] ? { ...f, poly: to[f.id], layer: fold.layer?.[f.id] ?? f.layer } : f);
    return { state: { facets: tidy(facets) }, motion: { kind: "keyframe", from: state.facets, to: facets } };
  }
  if (op === "finish") return { state, motion: { kind: "finish" } };
  throw new Error(`unknown fold op ${op}`);
}

const mul = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];

/* Every step's start state and motion for a model whose steps all carry `fold`. Memoised. */
const cache = new WeakMap();
export function replay(model) {
  if (cache.has(model)) return cache.get(model);
  let state = start(model);
  const steps = model.steps.map((step) => {
    const { state: next, motion } = apply(state, step.fold);
    const out = { before: state, after: next, motion };
    state = next;
    return out;
  });
  cache.set(model, steps);
  return steps;
}

export function isPaperModel(model) {
  return Boolean(model?.steps?.length) && model.steps.every(s => s.fold);
}
