/* Laboratory of Curiosity scene renderer (lab design D3, slice 03; lab-feel D1).
   One code-drawn room — moon window, ingredient shelf, cauldron on its burner, owl,
   cat, Journal and workbench tools — drawn at a whole-number device-pixel scale. The
   320×180 core always fits; the room then widens and grows (up to 480×240) to fill
   the box, its left, centre and right groups pinned to their edges. Pure projection
   of the state it is given; it returns the tap targets (CSS px) so the screen
   controller never has to know the layout. */
import { Q } from '../palette.js';
import { drawSprite, spriteSize } from '../pixel-art.js';
import { px, drawLabSprite, labSpriteSize, bayer, ramp, shadeRow, sphereLight, cylinderLight, ditherShadow, LAB_LIGHTS } from './lab-art.js';
import { LAB_INGREDIENTS, SHELF_IDS, BAG_IDS } from './ingredients.js';
import { fxTime, fxPose, drawEffect } from './lab-fx.js';

export const LAB_W = 320;
export const LAB_H = 180;
export const LAB_MAX_W = 480;
export const LAB_MAX_H = 240;

/* Tap targets in logical px of the 320×180 core, each tagged with the group it moves
   with. Each is ≥ 24 px on its short side — 48 CSS px at the smallest fit (2×) — and
   no two overlap at any room size (tested). */
const r = (id, kind, group, x, y, w, h, extra = {}) => Object.freeze({ id, kind, group, x, y, w, h, ...extra });
const LAYOUT = Object.freeze([
  ...SHELF_IDS.map((id, i) => r('jar:' + id, 'jar', 'right', 208 + (i % 4) * 26, i < 4 ? 24 : 62, 25, 28, { ingredient: id })),
  ...BAG_IDS.map((id, i) => r('bag:' + id, 'bag', 'left', 2 + i * 24, 152, 24, 26, { ingredient: id })),
  // `plate`: where the action name sits, from the hit's top-left (lab-feel D3). The tools'
  // hits reach down over their plates, so tapping the word works too.
  r('cauldron', 'cauldron', 'centre', 128, 76, 64, 52, { plate: [32, 30] }),
  r('prop:heat', 'prop', 'centre', 136, 129, 48, 37, { step: 'heat', plate: [24, 31] }),
  r('prop:grind', 'prop', 'centre', 84, 104, 40, 48, { step: 'grind', plate: [20, 43] }),
  r('prop:stir', 'prop', 'centre', 196, 104, 40, 48, { step: 'stir', plate: [20, 43] }),
  r('prop:cool', 'prop', 'centre', 240, 104, 40, 48, { step: 'cool', plate: [20, 43] }),
  r('scroll', 'scroll', 'right', 252, 152, 26, 26),
  r('book', 'book', 'left', 14, 114, 62, 34),
  r('owl', 'owl', 'left', 16, 68, 32, 26)
]);
// Core coordinates: every draw function below works in these, under its group's offset.
const AT = Object.fromEntries(LAYOUT.map(hit => [hit.id, hit]));

/** Where each group sits in a W×H room: left pinned left, centre centred, right pinned right, all on the bench. */
export function labGroups(W = LAB_W, H = LAB_H) {
  const dy = H - LAB_H;
  return Object.freeze({
    left: Object.freeze({ dx: 0, dy }),
    centre: Object.freeze({ dx: Math.floor((W - LAB_W) / 2), dy }),
    right: Object.freeze({ dx: W - LAB_W, dy })
  });
}
const LAYOUTS = new Map();
/** The room's tap targets in logical room px (memoised per size). At 320×180 it is the core layout. */
export function labLayout(W = LAB_W, H = LAB_H) {
  const key = W + 'x' + H;
  if (!LAYOUTS.has(key)) {
    const groups = labGroups(W, H);
    const hits = Object.freeze(LAYOUT.map(hit => Object.freeze({ ...hit, x: hit.x + groups[hit.group].dx, y: hit.y + groups[hit.group].dy })));
    LAYOUTS.set(key, Object.freeze({ W, H, groups, hits, at: Object.freeze(Object.fromEntries(hits.map(hit => [hit.id, hit]))) }));
  }
  return LAYOUTS.get(key);
}

// Cauldron liquid follows the mix's strongest property (resolve.js mixHint).
const TINT = Object.freeze({
  life: [Q.green, Q.greenLit], growth: [Q.greenDark, Q.green], fire: [Q.lava, Q.yellow], cold: [Q.ice, Q.white],
  water: [Q.ocean, Q.oceanLit], echo: [Q.purple, Q.lilac], space: [Q.purpleDark, Q.magenta], time: [Q.lilac, Q.white],
  light: [Q.yellow, Q.sandLit]
});
const EMPTY_LIQUID = [Q.stone, Q.stoneMid];
// One colour per ingredient for the little bits bobbing in the cauldron.
const BIT = Object.freeze({
  redMushroom: Q.red, echoCrystal: Q.purple, emberSeed: Q.lava, moonflower: Q.white, voidDust: Q.magenta,
  lifeSap: Q.green, frostDew: Q.ice, starDust: Q.yellow, sunHerb: Q.greenLit, moonBerry: Q.lilac,
  waterCrystal: Q.oceanLit, emberRoot: Q.rockLit
});

/* ---------- ingredient forms (lab-states D8): crushed heap, heated glow, frozen ice cube ---------- */
const formOf = key => { const [id, state] = String(key || '').split(':'); return { id, state: state || 'raw' }; };
function sizeOf(id) {
  return LAB_INGREDIENTS[id] && LAB_INGREDIENTS[id].where === 'bag' ? spriteSize(id, 1) : labSpriteSize(id);
}
function plainSprite(ctx, id, x, y) {
  if (LAB_INGREDIENTS[id] && LAB_INGREDIENTS[id].where === 'bag') drawSprite(ctx, id, x, y, 1); else drawLabSprite(ctx, id, x, y);
}
/** Draws an ingredient at (x, y) (top-left, its natural size) in a state. */
function drawForm(ctx, id, state, x, y) {
  const { width: w, height: h } = sizeOf(id);
  if (state === 'crushed') {
    // A little powder heap in the ingredient's colour, with a few bright grains.
    const colour = BIT[id] == null ? Q.grey : BIT[id], cx = x + Math.floor(w / 2), base = y + h - 1;
    for (let row = 0; row < 5; row++) {
      const half = Math.max(1, Math.round(w / 2) - row * 1.4 - (row > 2 ? 1 : 0));
      px(ctx, row === 0 ? Q.outline : colour, cx - half, base - row, half * 2, 1);
    }
    px(ctx, Q.outline, cx - Math.round(w / 2), base - 5, 1, 5);
    for (const [dx, dy] of [[-3, -2], [1, -3], [3, -1], [-1, -4]]) px(ctx, Q.white, cx + dx, base + dy);
    return;
  }
  if (state === 'heated') {
    glow(ctx, 0.5, () => ellipse(ctx, Q.lava, x + w / 2, y + h / 2, Math.ceil(w / 2) + 2, Math.ceil(h / 2) + 1));
    plainSprite(ctx, id, x, y);
    px(ctx, Q.lava, x + Math.floor(w / 2) - 2, y - 3, 1, 2); px(ctx, Q.yellow, x + Math.floor(w / 2) + 1, y - 4, 1, 2);
    return;
  }
  plainSprite(ctx, id, x, y);
  if (state === 'frozen') {
    glow(ctx, 0.45, () => px(ctx, Q.ice, x - 1, y - 1, w + 2, h + 2));
    px(ctx, Q.white, x - 1, y - 1, w + 2, 1); px(ctx, Q.white, x - 1, y, 1, h + 1);
    px(ctx, Q.oceanLit, x + w, y, 1, h + 1); px(ctx, Q.oceanLit, x, y + h, w + 1, 1);
    px(ctx, Q.white, x + 1, y + 1, 2, 1);
  }
}

function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return (h ^ (h >>> 16)) >>> 0; }
function glow(ctx, a, fn) { ctx.save(); ctx.globalAlpha = a; fn(); ctx.restore(); }
function ellipse(ctx, color, cx, cy, rx, ry) {
  for (let y = -ry; y <= ry; y++) {
    const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
    if (hw > 0) px(ctx, color, cx - hw, cy + y, hw * 2, 1);
  }
}
/* Light pool: three stacked ellipses at low alpha, so light falls off in palette steps
   instead of showing a rectangle. */
function pool(ctx, color, cx, cy, rx, ry, a) {
  glow(ctx, a, () => { for (const k of [1, 0.7, 0.42]) ellipse(ctx, color, cx, cy, Math.round(rx * k), Math.round(ry * k)); });
}

/** Whole-number device-pixel fit into a CSS box: the 320×180 core always fits, then the
    room (W×H, capped at 480×240) takes the rest of the box, centred. */
export function fitLab(cssWidth, cssHeight, dpr = 1) {
  const ratio = Number(dpr) > 0 ? Number(dpr) : 1;
  const canvasW = Math.max(1, Math.round(cssWidth * ratio)), canvasH = Math.max(1, Math.round(cssHeight * ratio));
  const device = Math.max(1, Math.floor(Math.min(canvasW / LAB_W, canvasH / LAB_H)));
  const W = Math.max(LAB_W, Math.min(LAB_MAX_W, Math.floor(canvasW / device)));
  const H = Math.max(LAB_H, Math.min(LAB_MAX_H, Math.floor(canvasH / device)));
  return {
    device, dpr: ratio, canvasW, canvasH, W, H,
    ox: Math.floor((canvasW - W * device) / 2), oy: Math.floor((canvasH - H * device) / 2)
  };
}

export function hitAt(hits, x, y) {
  return (hits || []).find(hit => x >= hit.x && x < hit.x + hit.w && y >= hit.y && y < hit.y + hit.h) || null;
}

/* Where a lifted ingredient can go (lab-feel D4): the cauldron and the three tools that
   change it. The spoon only stirs, so it is never a target. */
export const DROP_TARGETS = Object.freeze(['cauldron', 'prop:grind', 'prop:heat', 'prop:cool']);
/**
 * The hit a drop at (x, y) lands on: the hit under the point, else the nearest drop
 * target whose rect is within `slack` (CSS px) — a near miss still counts for small fingers.
 */
export function hitNear(hits, x, y, slack = 0) {
  const exact = hitAt(hits, x, y);
  if (exact) return exact;
  let best = null, bestD = Infinity;
  for (const hit of hits || []) {
    if (!DROP_TARGETS.includes(hit.id)) continue;
    const dx = Math.max(hit.x - x, 0, x - (hit.x + hit.w)), dy = Math.max(hit.y - y, 0, y - (hit.y + hit.h)), d = Math.hypot(dx, dy);
    if (d <= slack && d < bestD) { best = hit; bestD = d; }
  }
  return best;
}

/* ---------- room (whole-room parts draw in room px: W×H, groups from labGroups) ---------- */
// Beyond the room caps the box is painted as more wall and bench, never black.
function drawBackdrop(ctx, fit) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const bench = Math.max(0, Math.min(fit.canvasH, fit.oy + (110 + fit.H - LAB_H) * fit.device));
  px(ctx, Q.stoneDark, 0, 0, fit.canvasW, bench);
  px(ctx, Q.woodDark, 0, bench, fit.canvasW, fit.canvasH - bench);
}

/* `paint` is the whole canvas in room px ({ x0, y0, x1, y1 }): wall, beam and bench carry
   on past the room caps so the box never shows bare bands. */
function drawWall(ctx, H, groups, paint) {
  const dy = H - LAB_H, fire = groups.centre.dx, top = 112 + dy;
  px(ctx, Q.stoneDark, paint.x0, paint.y0, paint.x1 - paint.x0, top - paint.y0);
  for (let y = Math.floor(paint.y0 / 8) * 8; y < top; y += 8) {
    const shift = Math.abs(y / 8) % 2 ? 8 : 0;
    for (let x = Math.floor(paint.x0 / 16) * 16 - shift; x < paint.x1; x += 16) {
      const bx = Math.floor(x / 16), by = Math.floor(y / 8);
      // Fire and lantern light fall off brick by brick through the dither (lab-feel D6)…
      const heat = Math.max(1 - Math.hypot(x + 8 - 160 - fire, (y + 4 - 110 - dy) * 1.4) / 86, 1 - Math.hypot(x + 8 - 96 - fire, y + 4 - 20 - dy) / 38);
      const warm = heat * 2 > bayer(bx, by);
      // …and the rest of the wall darkens away from the window, so the room has corners.
      const lit = 0.72 - Math.min(0.5, Math.hypot((x + 8 - 160 - fire) / 2.2, y + 4 - 50 - dy) / 220);
      const face = warm ? Q.warm : ramp(lit, bx, by, [Q.stoneDark, Q.stone, Q.stoneMid]);
      px(ctx, face, x + 1, y + 1, 15, 7);
      if (hash(x, y) % 5 === 0) px(ctx, warm ? Q.warmLit : face === Q.stoneDark ? Q.stone : Q.stoneMid, x + 1, y + 1, 15, 1);
      if (hash(y, x) % 9 === 0) px(ctx, Q.stoneDark, x + 4 + (hash(x, y) % 8), y + 3, 2, 1);
    }
  }
}

/* Side-wall slivers at the canvas's left and right edges: darker stone whose brick
   courses slant toward the vanishing point, so the room shows it has sides. */
const SIDE = 10;
function drawSides(ctx, H, groups, paint) {
  const dy = H - LAB_H, top = 112 + dy, vpy = 50 + dy;
  for (const side of [-1, 1]) {
    const edge = side < 0 ? paint.x0 : paint.x1 - SIDE, corner = side < 0 ? edge + SIDE : edge - 1;
    px(ctx, Q.stoneDark, edge, paint.y0, SIDE, top - paint.y0);
    for (let c = 0; c < SIDE; c++) {
      // c = 0 at the corner, SIDE − 1 at the canvas edge (nearest the viewer).
      const x = side < 0 ? corner - 1 - c : corner + 1 + c, slant = (c + 1) / SIDE * 0.35;
      for (let y = Math.floor(paint.y0 / 8) * 8; y < top; y += 8) {
        const yy = Math.round(y + (y - vpy) * slant);
        if (yy >= paint.y0 && yy < top) px(ctx, Q.deep, x, yy, 1, 1);
        if (c % 5 === 2 && yy + 4 < top) px(ctx, Q.deep, x, yy + 1 + (Math.abs(y / 8) % 2 ? 4 : 0), 1, 3);
      }
    }
    px(ctx, Q.outline, corner, paint.y0, 1, top - paint.y0);
    px(ctx, Q.stone, corner - side, paint.y0, 1, top - paint.y0);
  }
}

/** A ceiling beam across the extra height above the core: the lantern and the plants hang from it. */
function drawBeam(ctx, H, paint) {
  const dy = H - LAB_H, x0 = paint.x0, w = paint.x1 - paint.x0;
  if (dy < 4) return;
  const h = Math.min(6, dy);
  px(ctx, Q.woodDark, x0, dy - h, w, h);
  px(ctx, Q.wood, x0, dy - h, w, Math.max(1, h - 3));
  px(ctx, Q.rockLit, x0, dy - h, w, 1);
  px(ctx, Q.outline, x0, dy, w, 1);
  for (let x = Math.floor(x0 / 64) * 64 + 12; x < paint.x1; x += 64) px(ctx, Q.woodDark, x, dy - h + 1, 2, 1);
}

function drawWindow(ctx, frame, still) {
  const cx = 160, top = 6, bottom = 72, radius = 32, mid = top + radius;
  for (let y = top - 3; y < bottom + 2; y++) {
    const dy = mid - y;
    const outer = y < mid ? Math.sqrt(Math.max(0, (radius + 3) ** 2 - dy * dy)) : radius + 3;
    if (outer < 1) continue;
    px(ctx, Q.stoneLit, cx - outer, y, outer * 2, 1);
    const inner = y < mid ? Math.sqrt(Math.max(0, radius ** 2 - dy * dy)) : radius;
    if (inner < 1 || y < top || y >= bottom) continue;
    px(ctx, y < 30 ? Q.space : y < 52 ? Q.space2 : Q.oceanDark, cx - inner, y, inner * 2, 1);
  }
  // Stars twinkle on a slow three-frame cycle.
  const stars = [[136, 30], [146, 18], [152, 40], [168, 34], [182, 44], [139, 48], [176, 12], [158, 24]];
  stars.forEach(([x, y], i) => {
    const phase = still ? 0 : (frame + i) % 3;
    if (phase === 2 && i % 2) return;
    px(ctx, phase === 1 ? Q.white : Q.lilac, x, y);
    if (phase === 1 && i % 3 === 0) { px(ctx, Q.lilac, x - 1, y); px(ctx, Q.lilac, x + 1, y); }
  });
  // Crescent moon.
  for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) {
    if (x * x + y * y > 36) continue;
    if ((x + 3) * (x + 3) + (y - 1) * (y - 1) <= 26) continue;
    px(ctx, x + y > 2 ? Q.sand : Q.sandLit, 176 + x, 22 + y);
  }
  // Distant castle silhouette.
  px(ctx, Q.space, 130, 60, 60, 12);
  for (const [x, w, h] of [[132, 6, 14], [142, 4, 9], [150, 8, 20], [162, 5, 11], [172, 7, 16], [183, 5, 10]]) {
    px(ctx, Q.space, x, 72 - h, w, h);
    px(ctx, Q.space, x + Math.floor(w / 2), 70 - h, 1, 2);
  }
  px(ctx, Q.yellow, 153, 58, 1, 2); px(ctx, Q.yellow, 175, 62, 1, 1);
  // Mullions and sill.
  px(ctx, Q.woodDark, 159, top, 2, bottom - top);
  px(ctx, Q.woodDark, cx - radius, 44, radius * 2, 2);
  px(ctx, Q.wood, 124, 72, 72, 3);
  px(ctx, Q.woodDark, 124, 75, 72, 1);
}

function drawLantern(ctx, frame, still) {
  px(ctx, Q.grey, 96, 0, 1, 12);
  pool(ctx, Q.yellow, 96, 19, 26, 22, 0.07);
  px(ctx, Q.outline, 91, 12, 11, 14);
  px(ctx, Q.woodDark, 92, 12, 9, 2); px(ctx, Q.woodDark, 92, 24, 9, 2);
  px(ctx, still || frame % 2 ? Q.yellow : Q.lava, 93, 14, 7, 10);
  px(ctx, Q.sandLit, 95, 16, 3, 5);
  px(ctx, Q.woodDark, 96, 14, 1, 10);
}

function drawPlants(ctx, frame, still) {
  const sway = still ? 0 : (frame % 4 < 2 ? 0 : 1);
  for (const [x, len] of [[6, 18], [12, 26], [20, 14], [30, 22], [38, 10]]) {
    for (let y = 0; y < len; y += 3) {
      const dx = ((y / 3) & 1 ? 1 : 0) + (y > len / 2 ? sway : 0);
      px(ctx, y % 6 ? Q.green : Q.greenDark, x + dx, y, 2, 3);
      if (y % 6 === 3) px(ctx, Q.greenLit, x + dx + 2, y, 2, 1);
    }
  }
  px(ctx, Q.woodDark, 2, 0, 42, 2);
}

function drawShelf(ctx) {
  px(ctx, Q.warmDark, 206, 14, 106, 78);
  px(ctx, Q.woodDark, 204, 10, 4, 84); px(ctx, Q.woodDark, 310, 10, 4, 84);
  for (const y of [10, 52, 90]) {
    px(ctx, Q.wood, 202, y, 114, 3);
    px(ctx, Q.rockLit, 202, y, 114, 1);
    px(ctx, Q.woodDark, 202, y + 3, 114, 1);
  }
  // Top-board clutter: bottles and a pot plant.
  for (const [x, h, c] of [[214, 7, Q.green], [222, 5, Q.purple], [229, 8, Q.oceanLit]]) {
    px(ctx, Q.outline, x - 1, 10 - h - 1, 5, h + 1);
    px(ctx, c, x, 10 - h, 3, h);
    px(ctx, Q.wood, x + 1, 10 - h - 2, 1, 2);
  }
  px(ctx, Q.rock, 292, 4, 9, 6); px(ctx, Q.rockLit, 292, 4, 9, 1);
  px(ctx, Q.green, 290, 0, 3, 4); px(ctx, Q.greenLit, 295, 0, 2, 4); px(ctx, Q.green, 299, 1, 3, 3);
  // A paper note pinned to the shelf side.
  px(ctx, Q.sandLit, 300, 96, 14, 10); px(ctx, Q.sand, 302, 99, 10, 1); px(ctx, Q.sand, 302, 102, 8, 1);
}

const JAR_GLASS = Object.freeze(Array.from({ length: 19 }, (_, i) =>
  ramp(cylinderLight((i - 9) / 9.5, [LAB_LIGHTS.moon, LAB_LIGHTS.lantern]) * 1.1, i, 0, [Q.space, Q.space2, Q.oceanDark])));
function drawJar(ctx, hit, selected, lean = 0, state = 'raw') {
  const x = hit.x + lean, y = hit.y - (selected ? 3 : 0);
  const edge = selected ? Q.yellow : Q.outline;
  px(ctx, edge, x + 2, y + 3, 21, 21);
  // Round glass: each column lit as a cylinder from the moon and the lantern.
  for (let i = 0; i < 19; i++) px(ctx, JAR_GLASS[i], x + 3 + i, y + 4, 1, 19);
  glow(ctx, 0.35, () => px(ctx, Q.snowShade, x + 3, y + 4, 19, 19));
  px(ctx, Q.outline, x + 21, y + 5, 1, 17);
  drawForm(ctx, hit.ingredient, state, x + 6, y + 8);
  px(ctx, Q.white, x + 4, y + 6, 1, 8);
  px(ctx, Q.snowShade, x + 4, y + 15, 1, 3);
  px(ctx, edge, x + 6, y, 13, 4);
  px(ctx, Q.wood, x + 7, y + 1, 11, 2);
  px(ctx, Q.sand, x + 5, y + 24, 15, 3);
  px(ctx, Q.woodDark, x + 7, y + 25, 11, 1);
}

/* The bench top is a plane receding toward a vanishing point under the window (lab-feel
   D6): its planks run away from the viewer and their seams converge; the far edge is in
   shadow and the near edge catches the light. */
function drawBench(ctx, H, groups, paint) {
  const dy = H - LAB_H, back = 112 + dy, front = paint.y1, x0 = paint.x0, x1 = paint.x1;
  const vpx = 160 + groups.centre.dx, vpy = 30 + dy, depth = Math.max(1, front - back);
  // Plank seams are spaced 11 px at the back edge; at row y a seam sits at vpx + (sx − vpx)·k.
  const spread = (front - vpy) / (back - vpy), seams = [];
  for (let sx = Math.floor((vpx + (x0 - vpx) / spread) / 11) * 11 - 11; sx <= vpx + (x1 - vpx) / spread + 11; sx += 11) seams.push(sx);
  for (let y = back; y < front; y++) {
    const k = (y - vpy) / (back - vpy), near = (y - back) / depth;
    shadeRow(ctx, y, x0, x1, x => ramp(0.36 + near * 1.4, x, y, [Q.woodDark, Q.wood, Q.wood]));
    for (let i = 0; i < seams.length; i++) {
      const x = Math.round(vpx + (seams[i] - vpx) * k);
      if (x >= x0 && x < x1) px(ctx, near < 0.25 ? Q.outline : Q.woodDark, x, y, 1, 1);
      // Now and then a plank ends: a short butt joint across it.
      if (i + 1 < seams.length && hash(i, Math.floor((y - back) / 7)) % 23 === 0 && (y - back) % 7 === 3) {
        const xr = Math.round(vpx + (seams[i + 1] - vpx) * k);
        px(ctx, Q.woodDark, x + 1, y, Math.max(0, xr - x - 1), 1);
      }
    }
  }
  px(ctx, Q.woodDark, x0, 110 + dy, x1 - x0, 2);
  px(ctx, Q.rockLit, x0, 110 + dy, x1 - x0, 1);
  px(ctx, Q.outline, x0, 111 + dy, x1 - x0, 1);
}

/* ---------- depth: shadows and the moonlight shaft (lab-feel D6) ---------- */
// Half-density dithered dark: a soft shadow that still never leaves the palette.
function ditherRect(ctx, color, x, y, w, h, density = 0.5) {
  for (let row = y; row < y + h; row++) shadeRow(ctx, row, x, x + w, col => (density > bayer(col, row) ? color : null));
}
/** The shelf's shadow falls right and down onto the wall (right group, before the shelf). */
function drawShelfShadow(ctx) {
  ditherRect(ctx, Q.deep, 314, 14, 4, 84);
  ditherRect(ctx, Q.deep, 208, 94, 110, 4);
}
/** Contact shadows on the bench under the books and the cat's bed (left / right group). */
function drawBookShadow(ctx) { ditherShadow(ctx, Q.outline, 33, 111, 25, 2, 0.55); }
function drawCatShadow(ctx) { ditherShadow(ctx, Q.outline, 299, 153, 19, 2, 0.5); }
/** Under the burner's stones, on the cloth (centre group). */
function drawBurnerShadow(ctx) { ditherShadow(ctx, Q.outline, 160, 143, 31, 3, 0.6); }

/** A pale shaft of moonlight from the window down to the bench, with dust drifting in it (centre group). */
function drawShaft(ctx, now, still) {
  const top = 72, bottom = 124, at = y => {
    const k = (y - top) / (bottom - top);
    return [Math.round(130 - 34 * k), Math.round(190 - 26 * k)];
  };
  glow(ctx, 0.09, () => { for (let y = top; y < bottom; y++) { const [l, r] = at(y); px(ctx, Q.lilac, l, y, r - l, 1); } });
  const t = still ? 0 : now / 1000;
  for (let i = 0; i < 8; i++) {
    const y = top + ((i * 29 + t * (3 + (i % 3))) % (bottom - top)), [l, r] = at(y);
    const x = l + ((i * 37 + Math.sin(t * 0.7 + i) * 3) % (r - l) + (r - l)) % (r - l);
    glow(ctx, 0.6, () => px(ctx, i % 3 ? Q.lilac : Q.white, x, y, 1, 1));
  }
}

/* ---------- hints (lab-feel D4): soft glow, bobbing ▼, drag ring ---------- */
// Glow ellipses round each drop target's art and where its arrow floats (centre group, core px).
const HINT = Object.freeze({
  cauldron: Object.freeze({ glow: [160, 100, 38, 30], arrow: [160, 68] }),
  'prop:grind': Object.freeze({ glow: [104, 127, 25, 17], arrow: [108, 96] }),
  'prop:heat': Object.freeze({ glow: [160, 141, 30, 11], arrow: [160, 133] }),
  'prop:cool': Object.freeze({ glow: [260, 130, 25, 15], arrow: [260, 112] })
});
/** Glows behind the targets: a slow breath when idle, brighter while something is lifted. */
function drawHintGlow(ctx, hint, now, still) {
  const breath = still ? 0 : Math.sin((now / 2400) * Math.PI * 2);
  const a = hint && hint.lifted ? 0.2 : 0.1 + breath * 0.03;
  for (const id of DROP_TARGETS) {
    const [cx, cy, rx, ry] = HINT[id].glow;
    pool(ctx, id === (hint && hint.over) ? Q.white : Q.yellow, cx, cy, rx, ry, id === (hint && hint.over) ? 0.24 : a);
  }
}
function ringEllipse(ctx, color, cx, cy, rx, ry) {
  const steps = Math.max(12, Math.round((rx + ry) * 3));
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    px(ctx, color, cx + Math.round(Math.cos(t) * rx), cy + Math.round(Math.sin(t) * ry));
  }
}
/** A 7×4 ▼ (outlined) at (x, y) = its tip. */
function drawArrow(ctx, x, y) {
  for (let row = 0; row < 4; row++) {
    const half = 3 - row;
    px(ctx, Q.outline, x - half - 1, y - 4 + row, half * 2 + 3, 1);
    px(ctx, row === 0 ? Q.sandLit : Q.yellow, x - half, y - 4 + row, half * 2 + 1, 1);
  }
  px(ctx, Q.outline, x - 4, y - 5, 9, 1);
  px(ctx, Q.outline, x, y, 1, 1);
}
/** Over the targets: ▼ above each while something is lifted, a pulsing ring on the one under the finger. */
function drawHintMarks(ctx, hint, now, still) {
  if (!hint || !hint.lifted) return;
  const bob = still ? 0 : Math.round((Math.sin((now / 600) * Math.PI * 2) + 1));
  for (const id of DROP_TARGETS) { const [x, y] = HINT[id].arrow; drawArrow(ctx, x, y + bob); }
  if (HINT[hint.over]) {
    const [cx, cy, rx, ry] = HINT[hint.over].glow, pulse = still ? 0 : Math.floor(now / 200) % 2;
    ringEllipse(ctx, Q.yellow, cx, cy, rx - 4 + pulse, ry - 3 + pulse);
    ringEllipse(ctx, Q.white, cx, cy, rx - 5 + pulse, ry - 4 + pulse);
  }
}

/** A blue cloth under the cauldron, like the mock's (centre group). */
function drawCloth(ctx) {
  px(ctx, Q.oceanDark, 118, 142, 84, 16);
  for (let x = 120; x < 200; x += 6) px(ctx, Q.ocean, x, 144 + (x % 12 ? 0 : 6), 3, 1);
}

function drawBookStack(ctx) {
  for (const [y, c, w] of [[104, Q.red, 40], [98, Q.greenDark, 36], [93, Q.purpleDark, 38]]) {
    px(ctx, Q.outline, 12, y - 1, w + 2, 7);
    px(ctx, c, 13, y, w, 5);
    px(ctx, Q.sandLit, 13 + w - 3, y + 1, 2, 3);
    px(ctx, Q.yellow, 18, y + 2, 6, 1);
  }
}

function drawOwl(ctx, now, still, pose) {
  const blink = pose.owlBlink || (!still && (now % 4200) < 160);
  drawLabSprite(ctx, blink ? 'owlBlink' : 'owl', 20, 71 + pose.owlDy);
}

function drawJournal(ctx) {
  const b = AT.book;
  px(ctx, Q.outline, b.x + 1, b.y + 3, b.w - 2, b.h - 4);
  px(ctx, Q.rockDark, b.x + 2, b.y + 4, b.w - 4, b.h - 6);
  px(ctx, Q.sandLit, b.x + 4, b.y + 5, 26, b.h - 9);
  px(ctx, Q.sandLit, b.x + 32, b.y + 5, 26, b.h - 9);
  px(ctx, Q.sand, b.x + 30, b.y + 5, 2, b.h - 9);
  for (let i = 0; i < 5; i++) {
    px(ctx, Q.grey, b.x + 7, b.y + 9 + i * 4, 18 - (i % 2) * 6, 1);
    px(ctx, Q.grey, b.x + 35, b.y + 18 + i * 3, 18 - (i % 3) * 4, 1);
  }
  // A doodle: mushroom + crystal = potion.
  px(ctx, Q.red, b.x + 36, b.y + 8, 5, 3); px(ctx, Q.sand, b.x + 38, b.y + 11, 1, 3);
  px(ctx, Q.purple, b.x + 44, b.y + 8, 3, 6);
  px(ctx, Q.green, b.x + 51, b.y + 9, 4, 5); px(ctx, Q.outline, b.x + 52, b.y + 8, 2, 1);
  px(ctx, Q.red, b.x + 29, b.y + b.h - 4, 2, 6);
}

function drawCat(ctx, now, still, pose) {
  px(ctx, Q.outline, 282, 146, 34, 6);
  px(ctx, Q.greenDark, 283, 147, 32, 4);
  px(ctx, Q.sandLit, 312, 148, 2, 2);
  const awake = pose.catAwake || (!still && (now % 6400) > 5600);
  drawLabSprite(ctx, awake ? 'catAwake' : 'cat', 286, 136 + pose.catDy);
  const flick = !still && (now % 2600) < 400;
  px(ctx, Q.outline, 307, flick ? 137 : 141, 3, 2);
  px(ctx, Q.purpleDark, 308, flick ? 138 : 142, 4, 2);
  px(ctx, Q.purpleDark, 311, flick ? 136 : 140, 2, 3);
}

/* ---------- cauldron + burner ---------- */
function drawBurner(ctx, frame, still) {
  const tongues = still || frame % 2 ? [[144, 6], [152, 9], [160, 7], [168, 10], [176, 6]] : [[146, 8], [154, 6], [162, 10], [170, 7], [178, 5]];
  for (const [x, h] of tongues) {
    px(ctx, Q.red, x - 2, 132 - h, 5, h);
    px(ctx, Q.lava, x - 1, 133 - h, 3, h - 1);
    px(ctx, Q.yellow, x, 134 - Math.ceil(h / 2), 1, Math.ceil(h / 2) - 2);
  }
  for (let row = 0; row < 2; row++) {
    for (let x = 132 + row * 4; x < 188 - row * 4; x += 9) {
      px(ctx, Q.outline, x, 130 + row * 6, 9, 6);
      px(ctx, row ? Q.stone : Q.stoneMid, x + 1, 131 + row * 6, 7, 4);
      px(ctx, Q.stoneLit, x + 1, 131 + row * 6, 7, 1);
    }
  }
  // Front dial: the tap target for Heat (lab-feel D2: bigger).
  px(ctx, Q.outline, 148, 141, 24, 12);
  px(ctx, Q.woodDark, 149, 142, 22, 10);
  px(ctx, Q.wood, 149, 142, 22, 1);
  px(ctx, Q.outline, 155, 143, 10, 8);
  px(ctx, Q.red, 156, 144, 8, 6); px(ctx, Q.lava, 156, 144, 8, 2); px(ctx, Q.yellow, 159, 144, 2, 3);
  for (const x of [151, 168]) px(ctx, Q.rockLit, x, 146, 1, 2);
}

function drawCauldron(ctx, options, frame, now, still) {
  const shake = options.shaky && !still ? ((frame % 2) ? 1 : -1) : 0;
  const cx = 160 + shake, cy = 100, rad = 28;
  const [liquid, liquidLit] = TINT[options.tint] || EMPTY_LIQUID;
  pool(ctx, liquidLit, cx, 80, 34, 14, 0.09);
  // The pot is a sphere lit per pixel (lab-feel D6): moon and lantern from above, and a
  // red-hot rim where the burner's fire reaches round its belly.
  const flicker = still ? 0 : (frame % 2) * 0.08;
  for (let y = 88; y <= 127; y++) {
    const hw = Math.floor(Math.sqrt(Math.max(0, rad * rad - (y - cy) * (y - cy))));
    if (hw < 1) continue;
    px(ctx, Q.outline, cx - hw - 1, y, hw * 2 + 2, 1);
    shadeRow(ctx, y, cx - hw, cx + hw, x => {
      const nx = (x + 0.5 - cx) / rad, ny = (y + 0.5 - cy) / rad, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      // Fire only reaches the lower rim, where the surface turns away from the viewer.
      const rim = ny > 0.3 && nz < 0.62 ? sphereLight(nx, ny, nz, [LAB_LIGHTS.fire]) * (1 - nz / 0.62) * 1.6 + flicker : 0;
      if (rim > 0.3 + bayer(x, y) * 0.3) return rim > 0.62 ? Q.lava : Q.red;
      return ramp(sphereLight(nx, ny, nz) * 1.15, x, y, [Q.deep, Q.stoneDark, Q.stoneMid, Q.stoneLit]);
    });
  }
  // Handles and rim.
  px(ctx, Q.outline, cx - 33, 92, 4, 8); px(ctx, Q.outline, cx + 29, 92, 4, 8);
  px(ctx, Q.stone, cx - 32, 93, 2, 6); px(ctx, Q.stone, cx + 30, 93, 2, 6);
  ellipse(ctx, Q.outline, cx, 87, 31, 8);
  ellipse(ctx, Q.stoneMid, cx, 87, 30, 7);
  ellipse(ctx, Q.stoneLit, cx, 86, 28, 5);
  ellipse(ctx, Q.outline, cx, 87, 26, 5);
  ellipse(ctx, liquid, cx, 87, 25, 4);
  ellipse(ctx, liquidLit, cx - 4, 86, 14, 1);
  // Rune on the belly glows in the liquid's colour.
  px(ctx, liquid, cx - 1, 102, 2, 10); px(ctx, liquid, cx - 5, 105, 10, 2); px(ctx, liquidLit, cx - 3, 109, 6, 1);
  // Bits of the mix bob on the surface.
  (options.mix || []).forEach((key, i) => {
    const { id, state } = formOf(key), bob = still ? 0 : ((frame + i) % 2);
    // A changed bit wears its state on the rim: ice white when frozen, orange when heated, speckled when crushed.
    px(ctx, state === 'frozen' ? Q.white : state === 'heated' ? Q.lava : Q.outline, cx - 16 + i * 9, 85 + bob, 5, 4);
    px(ctx, BIT[id] == null ? Q.grey : BIT[id], cx - 15 + i * 9, 85 + bob, 3, 3);
    if (state === 'crushed') { px(ctx, Q.white, cx - 15 + i * 9, 85 + bob); px(ctx, Q.white, cx - 13 + i * 9, 87 + bob); }
  });
  // Bubbles rise and pop.
  const t = still ? 0 : now / 1000;
  for (let i = 0; i < 5; i++) {
    const phase = (t * 0.9 + i * 0.37) % 1;
    if (phase > 0.8) continue;
    const bx = cx - 18 + ((i * 13) % 38), by = 86 - Math.floor(phase * 14);
    px(ctx, liquidLit, bx, by, phase < 0.4 ? 2 : 1, phase < 0.4 ? 2 : 1);
  }
}

/* ---------- workbench tools (lab-feel D2: drawn at ~1.5×, shaded like the room) ---------- */
/** A thick pestle from (x0, y0) down to (x1, y1), knob at the top. */
function drawPestle(ctx, x0, y0, x1, y1) {
  const n = Math.max(1, Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
    px(ctx, Q.outline, x - 1, y, 6, 1);
    px(ctx, i < 4 ? Q.stoneLit : Q.grey, x, y, 4, 1);
    px(ctx, Q.stoneLit, x, y, 1, 1);
  }
  ellipse(ctx, Q.outline, x0 + 2, y0, 4, 3);
  ellipse(ctx, Q.stoneLit, x0 + 2, y0, 3, 2);
}

function drawMortar(ctx) {
  const h = AT['prop:grind'], cx = h.x + 20, rim = h.y + 17, depth = 20;
  ditherShadow(ctx, Q.outline, cx, h.y + 40, 16, 2, 0.6);
  // The bowl: a half sphere lit from the moon and the lantern.
  for (let i = 0; i <= depth; i++) {
    const y = rim + i, hw = Math.round(18 * Math.sqrt(Math.max(0, 1 - (i / (depth + 3)) ** 2)));
    px(ctx, Q.outline, cx - hw - 1, y, hw * 2 + 2, 1);
    shadeRow(ctx, y, cx - hw, cx + hw, x => {
      const nx = (x + 0.5 - cx) / 19, ny = i / (depth + 3) * 0.85, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      return ramp(sphereLight(nx, ny, nz) * 1.3 + 0.05, x, y, [Q.stoneDark, Q.stone, Q.grey, Q.stoneLit]);
    });
  }
  px(ctx, Q.outline, cx - 9, rim + depth + 1, 18, 3);
  px(ctx, Q.stone, cx - 8, rim + depth + 1, 16, 1);
  // Rim and the herbs inside.
  ellipse(ctx, Q.outline, cx, rim, 19, 5);
  ellipse(ctx, Q.stoneLit, cx, rim, 18, 4);
  ellipse(ctx, Q.stoneDark, cx, rim + 1, 15, 3);
  px(ctx, Q.green, cx - 9, rim, 4, 2); px(ctx, Q.greenLit, cx + 3, rim + 1, 4, 1); px(ctx, Q.red, cx - 2, rim, 3, 1); px(ctx, Q.greenDark, cx + 8, rim, 2, 1);
  drawPestle(ctx, h.x + 32, h.y + 1, cx + 4, rim + 1);
}

function drawSpoon(ctx) {
  const h = AT['prop:stir'], cx = h.x + 17, top = h.y + 20, bottom = h.y + 38;
  ditherShadow(ctx, Q.outline, cx, bottom + 2, 14, 2, 0.6);
  // A clay crock, lit as a cylinder, with a blue band.
  px(ctx, Q.outline, cx - 12, top, 24, bottom - top + 1);
  for (let x = cx - 11; x < cx + 11; x++) {
    const tone = ramp(cylinderLight((x + 0.5 - cx) / 11) * 1.35, x, 0, [Q.warmDark, Q.warm, Q.warmLit]);
    px(ctx, tone, x, top, 1, bottom - top);
    px(ctx, tone === Q.warmLit ? Q.oceanLit : tone === Q.warm ? Q.ocean : Q.oceanDark, x, top + 7, 1, 3);
  }
  ellipse(ctx, Q.outline, cx, top, 12, 3);
  ellipse(ctx, Q.warmLit, cx, top, 11, 2);
  ellipse(ctx, Q.warmDark, cx, top + 1, 8, 1);
  // The big wooden spoon stands in it, handle up and to the right.
  for (let i = 0; i <= 18; i++) {
    const x = cx + 1 + Math.round(i * 0.6), y = top - i;
    px(ctx, Q.outline, x - 1, y, 5, 1);
    px(ctx, i % 6 ? Q.wood : Q.rockLit, x, y, 3, 1);
  }
  const bx = cx + 13, by = top - 23;
  ellipse(ctx, Q.outline, bx, by, 6, 7);
  ellipse(ctx, Q.wood, bx, by, 5, 6);
  ellipse(ctx, Q.woodDark, bx, by + 1, 3, 4);
  px(ctx, Q.rockLit, bx - 3, by - 4, 1, 4);
}

function drawFrost(ctx, frame, still) {
  const h = AT['prop:cool'], x0 = h.x + 2, x1 = h.x + 38, top = h.y + 19, edge = h.y + 27, base = h.y + 38;
  ditherShadow(ctx, Q.outline, h.x + 20, base + 2, 20, 2, 0.6);
  // An ice slab seen from above the front: a receding top face over a front face.
  const back = Math.round((edge - top) * 0.6);
  px(ctx, Q.outline, x0 + back - 1, top - 1, x1 - x0 - 2 * back + 2, 1);
  for (let y = top; y < edge; y++) {
    const inset = Math.round((edge - y) * 0.6);
    px(ctx, Q.outline, x0 + inset - 1, y, x1 - x0 - 2 * inset + 2, 1);
    shadeRow(ctx, y, x0 + inset, x1 - inset, x => ramp(0.45 + (y - top) / (edge - top) * 0.5, x, y, [Q.ice, Q.white]));
  }
  px(ctx, Q.outline, x0 - 1, edge, x1 - x0 + 2, base - edge + 1);
  for (let y = edge; y < base; y++) shadeRow(ctx, y, x0, x1, x => ramp(0.95 - (y - edge) / (base - edge) * 0.75, x, y, [Q.ocean, Q.oceanLit, Q.ice]));
  px(ctx, Q.white, x0, edge, x1 - x0, 1);
  // A snowflake etched on top, icicles under the front edge.
  const sx = h.x + 20, sy = top + 4;
  px(ctx, Q.oceanLit, sx - 5, sy, 11, 1); px(ctx, Q.oceanLit, sx, sy - 3, 1, 7);
  for (const [dx, dy] of [[-3, -2], [3, 2], [3, -2], [-3, 2]]) px(ctx, Q.oceanLit, sx + dx, sy + dy, 1, 1);
  for (const [dx, len] of [[5, 2], [12, 3], [22, 2], [30, 3]]) px(ctx, Q.ice, x0 + dx, base, 1, len);
  // Cold mist drifts up off it.
  const lift = still ? 0 : frame % 3;
  px(ctx, Q.snowShade, h.x + 8, top - 4 - lift, 1, 1); px(ctx, Q.snowShade, h.x + 31, top - 6 - lift, 1, 1);
  if (!lift) px(ctx, Q.white, h.x + 20, top - 9, 1, 1);
}

function drawScroll(ctx) {
  const h = AT.scroll;
  px(ctx, Q.outline, h.x + 2, h.y + 9, 22, 13);
  px(ctx, Q.sandLit, h.x + 3, h.y + 10, 20, 11);
  px(ctx, Q.woodDark, h.x + 1, h.y + 8, 3, 15); px(ctx, Q.woodDark, h.x + 22, h.y + 8, 3, 15);
  for (let i = 0; i < 3; i++) px(ctx, Q.grey, h.x + 6, h.y + 12 + i * 3, 13 - i * 3, 1);
  px(ctx, Q.red, h.x + 16, h.y + 18, 4, 3);
}

function drawBag(ctx, selection, held) {
  px(ctx, Q.outline, 0, 154, 100, 26);
  px(ctx, Q.woodDark, 1, 155, 98, 25);
  px(ctx, Q.wood, 1, 155, 98, 2);
  for (const id of BAG_IDS) {
    const hit = AT['bag:' + id], lifted = selection === hit.id;
    if (lifted) { px(ctx, Q.yellow, hit.x + 5, hit.y + 2, 14, 14); px(ctx, Q.woodDark, hit.x + 6, hit.y + 3, 12, 12); }
    drawForm(ctx, id, lifted ? formOf(held).state : 'raw', hit.x + 7, hit.y + (lifted ? 4 : 7));
  }
}

/** A tool just used on the lifted ingredient (or as a cauldron step): pestle bobs, burner flares, frost puffs. */
function drawToolUse(ctx, tool, clock, reduced) {
  if (!tool || !AT['prop:' + tool.step]) return;
  const t = Math.max(0, clock - (Number(tool.start) || 0));
  if (t > 600) return;
  const h = AT['prop:' + tool.step], k = 1 - t / 600, beat = reduced ? 0 : Math.floor(t / 100) % 2;
  if (tool.step === 'grind') {
    // The pestle pounds twice and a puff of powder jumps out of the bowl.
    const cx = h.x + 20, rim = h.y + 17;
    drawPestle(ctx, cx + 1, rim - 16 + beat * 4, cx + 1, rim - 2 + beat * 4);
    glow(ctx, 0.7 * k, () => { for (const [dx, dy] of [[-12, -3], [12, -4], [-6, -7], [8, -8], [0, -10]]) px(ctx, Q.sandLit, cx + dx, rim + dy - beat, 2, 2); });
  } else if (tool.step === 'heat') {
    // Taller flame tongues licking up round the cauldron, the burner's own shape.
    glow(ctx, k, () => {
      for (const [x, h0] of [[142, 9], [150, 13], [158, 11], [166, 14], [174, 10]]) {
        const h = h0 + beat * 2;
        px(ctx, Q.red, x - 2, 131 - h, 5, h);
        px(ctx, Q.lava, x - 1, 132 - h, 3, h - 1);
        px(ctx, Q.yellow, x, 133 - Math.ceil(h / 2), 1, Math.ceil(h / 2) - 2);
      }
    });
  } else if (tool.step === 'cool') {
    glow(ctx, 0.8 * k, () => { for (const [dx, dy] of [[6, 14], [14, 9], [22, 12], [30, 8], [18, 4]]) px(ctx, Q.white, h.x + dx, h.y + dy - Math.round((1 - k) * 8), 2, 2); });
  } else if (tool.step === 'stir') {
    // The spoon swirls in its crock: a bright arc either side of the handle.
    glow(ctx, 0.8 * k, () => { px(ctx, Q.rockLit, h.x + 21 + beat * 3, h.y + 6, 2, 12); px(ctx, Q.white, h.x + 12 - beat * 3, h.y + 16, 2, 3); });
  }
}

function drawLight(ctx, groups, paint, frame, still) {
  const cx = 160 + groups.centre.dx, dy = groups.centre.dy, { x0, y0, x1, y1 } = paint;
  // The fire's warm pool breathes with the burner's flicker.
  pool(ctx, Q.lava, cx, 132 + dy, 64, 30, still ? 0.07 : 0.06 + (frame % 2) * 0.02);
  pool(ctx, Q.oceanLit, cx, 92 + dy, 40, 18, 0.04);
  // A soft dark frame at the canvas edge (not the room edge, which may sit inside it).
  glow(ctx, 0.35, () => {
    px(ctx, Q.deep, x0, y0, x1 - x0, 2); px(ctx, Q.deep, x0, y1 - 2, x1 - x0, 2);
    px(ctx, Q.deep, x0, y0, 2, y1 - y0); px(ctx, Q.deep, x1 - 2, y0, 2, y1 - y0);
  });
}

/** Where an ingredient lives — the centre of its jar or bag slot, in room px — for effects that send it home. */
function homeIn(layout, id) {
  const jar = layout.at['jar:' + id];
  if (jar) return { x: jar.x + 12, y: jar.y + 13 };
  const bag = layout.at['bag:' + id];
  if (!bag) return null;
  const { width, height } = spriteSize(id, 1);
  return { x: bag.x + 7 + width / 2, y: bag.y + 7 + height / 2 };
}

/* ---------- parallax + cached static layers (lab-feel D6) ---------- */
export const PARALLAX_MAX = 4;
/** The back layer's offset in whole logical px: the screen's drag lean plus a slow ±1 px sway; 0 when still. */
export function parallaxOf(lean, now, still) {
  if (still) return { x: 0, y: 0 };
  const sway = Math.round(Math.sin((now / 6000) * Math.PI * 2));
  const clamp = v => Math.max(-PARALLAX_MAX, Math.min(PARALLAX_MAX, Math.round(v)));
  return { x: clamp((Number(lean && lean.x) || 0) + sway), y: clamp(Number(lean && lean.y) || 0) };
}
// Margin (logical px) the cached layers carry past the canvas, so parallax and shake never show an edge.
const LAYER_MARGIN = PARALLAX_MAX + 2;
const LAYERS = new WeakMap();
/**
 * Draws a layer that only changes with the room size. In a page it is drawn once into an
 * offscreen canvas and blitted at `offset` (logical px) each frame; without a document
 * (tests) it is drawn straight onto the canvas, so the palette checks still see every fill.
 */
function staticLayer(canvas, ctx, fit, paint, name, offset, draw) {
  const doc = canvas.ownerDocument;
  if (!doc || typeof ctx.drawImage !== 'function') {
    ctx.setTransform(fit.device, 0, 0, fit.device, fit.ox + offset.x * fit.device, fit.oy + offset.y * fit.device);
    draw(ctx);
    return;
  }
  let store = LAYERS.get(canvas);
  if (!store) LAYERS.set(canvas, store = {});
  const key = [fit.canvasW, fit.canvasH, fit.device, fit.W, fit.H].join('x');
  if (!store[name] || store[name].key !== key) {
    const off = doc.createElement('canvas');
    off.width = (paint.x1 - paint.x0) * fit.device;
    off.height = (paint.y1 - paint.y0) * fit.device;
    const c = off.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.setTransform(fit.device, 0, 0, fit.device, -paint.x0 * fit.device, -paint.y0 * fit.device);
    draw(c);
    store[name] = { key, off };
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(store[name].off, fit.ox + (paint.x0 + offset.x) * fit.device, fit.oy + (paint.y0 + offset.y) * fit.device);
}

/**
 * Draws the lab and returns `{ hits, fit }`. `hits` are CSS-px tap targets:
 * `{ id, kind: 'jar'|'bag'|'cauldron'|'prop'|'scroll'|'book'|'owl', x, y, w, h, ingredient?, step? }`.
 * Options: cssWidth, cssHeight, dpr, time (s), now (ms), mix, steps, tint, shaky, selection,
 * effect ({ ruleId | 'potion', intensity, start (ms, same clock as now), potionId?, lastIngredient? },
 * drawn by lab-fx.js), paused, reduced, parallax ({ x, y } logical px the screen leans the
 * back layer by; clamped to ±4, ignored when paused or reduced). Effects and parallax never
 * change the hits.
 */
export function drawLab(canvas, options = {}) {
  if (!canvas) return null;
  const fit = fitLab(Number(options.cssWidth) || 640, Number(options.cssHeight) || 360, options.dpr);
  if (canvas.width !== fit.canvasW) canvas.width = fit.canvasW;
  if (canvas.height !== fit.canvasH) canvas.height = fit.canvasH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  const still = !!(options.paused || options.reduced);
  const now = still ? 0 : (Number(options.now) || (Number(options.time) || 0) * 1000);
  const frame = Math.floor(now / 300);
  const selection = options.selection || null;
  // Effects keep their own clock: a reaction still plays under reduced motion, just calmer.
  const clock = Number(options.now) || (Number(options.time) || 0) * 1000;
  const effect = options.effect || null, t = fxTime(effect, clock), pose = fxPose(effect, t, !!options.reduced);

  const layout = labLayout(fit.W, fit.H), { W, H, groups } = layout, room = { dx: 0, dy: 0 };
  // Each group draws in core coordinates under its own offset; `room` parts span the whole W×H.
  const place = g => ctx.setTransform(fit.device, 0, 0, fit.device, fit.ox + (g.dx + pose.shakeX) * fit.device, fit.oy + (g.dy + pose.shakeY) * fit.device);

  // The whole canvas in room px, so wall and bench reach every edge of the box.
  const paint = {
    x0: -Math.ceil(fit.ox / fit.device), y0: -Math.ceil(fit.oy / fit.device),
    x1: W + Math.ceil((fit.canvasW - fit.ox - W * fit.device) / fit.device), y1: H + Math.ceil((fit.canvasH - fit.oy - H * fit.device) / fit.device)
  };

  // The back layer (wall, side walls, beam, window, lantern, plants) leans with the parallax;
  // everything you can tap stays put.
  const par = parallaxOf(options.parallax, now, still);
  const lean = g => ({ dx: g.dx + par.x, dy: g.dy + par.y });
  const wide = { x0: paint.x0 - LAYER_MARGIN, y0: paint.y0 - LAYER_MARGIN, x1: paint.x1 + LAYER_MARGIN, y1: paint.y1 + LAYER_MARGIN };

  drawBackdrop(ctx, fit);
  staticLayer(canvas, ctx, fit, wide, 'back', { x: par.x + pose.shakeX, y: par.y + pose.shakeY }, c => {
    drawWall(c, H, groups, wide);
    drawSides(c, H, groups, paint);
    drawBeam(c, H, wide);
  });
  place(lean(groups.centre));
  drawWindow(ctx, frame, still);
  drawLantern(ctx, frame, still);
  place(lean(groups.left));
  drawPlants(ctx, frame, still);
  place(groups.right);
  drawShelfShadow(ctx);
  drawShelf(ctx);
  // Jars lean toward a singularity (every jar sits right of it).
  for (const id of SHELF_IDS) drawJar(ctx, AT['jar:' + id], selection === 'jar:' + id, -pose.lean, selection === 'jar:' + id ? formOf(options.held).state : 'raw');
  staticLayer(canvas, ctx, fit, wide, 'bench', { x: pose.shakeX, y: pose.shakeY }, c => drawBench(c, H, groups, wide));
  place(groups.centre);
  drawCloth(ctx);
  drawBurnerShadow(ctx);
  drawShaft(ctx, now, still);
  drawHintGlow(ctx, options.hint, clock, still);
  place(groups.left);
  drawBookShadow(ctx);
  drawBookStack(ctx);
  drawOwl(ctx, now, still, pose);
  drawJournal(ctx);
  place(groups.right);
  drawCatShadow(ctx);
  drawCat(ctx, now, still, pose);
  place(groups.centre);
  drawBurner(ctx, frame, still);
  drawCauldron(ctx, options, frame, now, still);
  drawMortar(ctx);
  drawSpoon(ctx);
  drawFrost(ctx, frame, still);
  place(groups.right);
  drawScroll(ctx);
  place(groups.centre);
  drawToolUse(ctx, options.tool, clock, !!options.reduced);
  place(groups.left);
  drawBag(ctx, selection, options.held);
  place(groups.centre);
  drawHintMarks(ctx, options.hint, clock, still);
  place(room);
  drawLight(ctx, groups, paint, frame, still);
  // Effects are cauldron-centred: they draw in the centre group's core coordinates;
  // `shift` and `room` say where the other groups and the whole room sit from there.
  const c = groups.centre;
  place(c);
  drawEffect(ctx, effect, {
    t, now: clock, reduced: !!options.reduced, still, mix: options.mix || [],
    home: id => { const at = homeIn(layout, id); return at && { x: at.x - c.dx, y: at.y - c.dy }; },
    shift: { left: { x: groups.left.dx - c.dx, y: 0 }, centre: { x: 0, y: 0 }, right: { x: groups.right.dx - c.dx, y: 0 } },
    room: { x: -c.dx, y: -c.dy, w: W, h: H }
  });
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const k = fit.device / fit.dpr;
  const hits = layout.hits.map(hit => ({
    ...hit, x: (fit.ox + hit.x * fit.device) / fit.dpr, y: (fit.oy + hit.y * fit.device) / fit.dpr, w: hit.w * k, h: hit.h * k,
    ...(hit.plate ? { plate: [(fit.ox + (hit.x + hit.plate[0]) * fit.device) / fit.dpr, (fit.oy + (hit.y + hit.plate[1]) * fit.device) / fit.dpr] } : {})
  }));
  return { hits, fit };
}

export const LAB_LAYOUT = LAYOUT;
export { LAB_INGREDIENTS };
