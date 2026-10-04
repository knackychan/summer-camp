/* Laboratory of Curiosity scene renderer (lab design D3, slice 03). One code-drawn
   320×180 room — moon window, ingredient shelf, cauldron on its burner, owl, cat,
   Journal and workbench tools — drawn at a whole-number device-pixel scale. Pure
   projection of the state it is given; it returns the tap targets (CSS px) so the
   screen controller never has to know the layout. */
import { Q } from '../palette.js';
import { drawSprite } from '../pixel-art.js';
import { px, drawLabSprite } from './lab-art.js';
import { LAB_INGREDIENTS, SHELF_IDS, BAG_IDS } from './ingredients.js';

export const LAB_W = 320;
export const LAB_H = 180;

/* Tap targets in logical px. Each is ≥ 24 px on its short side — 48 CSS px at the
   smallest fit (2×) — and no two overlap (tested). */
const r = (id, kind, x, y, w, h, extra = {}) => Object.freeze({ id, kind, x, y, w, h, ...extra });
const LAYOUT = Object.freeze([
  ...SHELF_IDS.map((id, i) => r('jar:' + id, 'jar', 208 + (i % 4) * 26, i < 4 ? 24 : 62, 25, 28, { ingredient: id })),
  ...BAG_IDS.map((id, i) => r('bag:' + id, 'bag', 2 + i * 24, 152, 24, 26, { ingredient: id })),
  r('cauldron', 'cauldron', 128, 76, 64, 52),
  r('prop:heat', 'prop', 136, 129, 48, 24, { step: 'heat' }),
  r('prop:grind', 'prop', 100, 152, 26, 26, { step: 'grind' }),
  r('prop:stir', 'prop', 194, 152, 26, 26, { step: 'stir' }),
  r('prop:cool', 'prop', 222, 152, 26, 26, { step: 'cool' }),
  r('scroll', 'scroll', 252, 152, 26, 26),
  r('book', 'book', 14, 114, 62, 34),
  r('owl', 'owl', 16, 68, 32, 26)
]);
const AT = Object.fromEntries(LAYOUT.map(hit => [hit.id, hit]));

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

/** Whole-number device-pixel fit of the 320×180 scene into a CSS box, centred. */
export function fitLab(cssWidth, cssHeight, dpr = 1) {
  const ratio = Number(dpr) > 0 ? Number(dpr) : 1;
  const canvasW = Math.max(1, Math.round(cssWidth * ratio)), canvasH = Math.max(1, Math.round(cssHeight * ratio));
  const device = Math.max(1, Math.floor(Math.min(canvasW / LAB_W, canvasH / LAB_H)));
  return {
    device, dpr: ratio, canvasW, canvasH,
    ox: Math.floor((canvasW - LAB_W * device) / 2), oy: Math.floor((canvasH - LAB_H * device) / 2)
  };
}

export function hitAt(hits, x, y) {
  return (hits || []).find(hit => x >= hit.x && x < hit.x + hit.w && y >= hit.y && y < hit.y + hit.h) || null;
}

/* ---------- room ---------- */
function drawBackdrop(ctx, fit) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  px(ctx, Q.deep, 0, 0, fit.canvasW, fit.canvasH);
}

function drawWall(ctx) {
  px(ctx, Q.stoneDark, 0, 0, LAB_W, 112);
  for (let y = 0; y < 112; y += 8) {
    const shift = (y / 8) & 1 ? 8 : 0;
    for (let x = -shift; x < LAB_W; x += 16) {
      // Bricks near the fire and the lantern take the warm stone ramp.
      const warm = Math.hypot(x + 8 - 160, (y + 4 - 110) * 1.4) < 78 || Math.hypot(x + 8 - 96, y + 4 - 20) < 34;
      px(ctx, warm ? Q.warm : Q.stone, x + 1, y + 1, 15, 7);
      if (hash(x, y) % 5 === 0) px(ctx, warm ? Q.warmLit : Q.stoneMid, x + 1, y + 1, 15, 1);
      if (hash(y, x) % 9 === 0) px(ctx, Q.stoneDark, x + 4 + (hash(x, y) % 8), y + 3, 2, 1);
    }
  }
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

function drawJar(ctx, hit, selected) {
  const x = hit.x, y = hit.y - (selected ? 3 : 0);
  const edge = selected ? Q.yellow : Q.outline;
  px(ctx, edge, x + 2, y + 3, 21, 21);
  px(ctx, Q.space2, x + 3, y + 4, 19, 19);
  glow(ctx, 0.35, () => px(ctx, Q.snowShade, x + 3, y + 4, 19, 19));
  drawLabSprite(ctx, hit.ingredient, x + 6, y + 8);
  px(ctx, Q.white, x + 4, y + 6, 1, 8);
  px(ctx, Q.snowShade, x + 4, y + 15, 1, 3);
  px(ctx, edge, x + 6, y, 13, 4);
  px(ctx, Q.wood, x + 7, y + 1, 11, 2);
  px(ctx, Q.sand, x + 5, y + 24, 15, 3);
  px(ctx, Q.woodDark, x + 7, y + 25, 11, 1);
}

function drawBench(ctx) {
  px(ctx, Q.woodDark, 0, 110, LAB_W, 70);
  for (let y = 112; y < LAB_H; y += 9) {
    px(ctx, Q.wood, 0, y, LAB_W, 8);
    for (let x = (y * 7) % 37; x < LAB_W; x += 53) px(ctx, Q.woodDark, x, y + 2, 9, 1);
  }
  px(ctx, Q.rockLit, 0, 110, LAB_W, 1);
  px(ctx, Q.outline, 0, 111, LAB_W, 1);
  // A blue cloth under the cauldron, like the mock's.
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

function drawOwl(ctx, now, still) {
  const blink = !still && (now % 4200) < 160;
  drawLabSprite(ctx, blink ? 'owlBlink' : 'owl', 20, 71);
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

function drawCat(ctx, now, still) {
  px(ctx, Q.outline, 282, 146, 34, 6);
  px(ctx, Q.greenDark, 283, 147, 32, 4);
  px(ctx, Q.sandLit, 312, 148, 2, 2);
  const awake = !still && (now % 6400) > 5600;
  drawLabSprite(ctx, awake ? 'catAwake' : 'cat', 286, 136);
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
  // Front dial: the tap target for Heat.
  px(ctx, Q.outline, 152, 143, 16, 8);
  px(ctx, Q.woodDark, 153, 144, 14, 6);
  px(ctx, Q.red, 158, 145, 4, 4); px(ctx, Q.yellow, 159, 145, 2, 1);
}

function drawCauldron(ctx, options, frame, now, still) {
  const shake = options.shaky && !still ? ((frame % 2) ? 1 : -1) : 0;
  const cx = 160 + shake, cy = 100, rad = 28;
  const [liquid, liquidLit] = TINT[options.tint] || EMPTY_LIQUID;
  pool(ctx, liquidLit, cx, 80, 34, 14, 0.09);
  for (let y = 88; y <= 127; y++) {
    const hw = Math.floor(Math.sqrt(Math.max(0, rad * rad - (y - cy) * (y - cy))));
    if (hw < 1) continue;
    px(ctx, Q.outline, cx - hw - 1, y, hw * 2 + 2, 1);
    px(ctx, Q.deep, cx - hw, y, hw * 2, 1);
    px(ctx, Q.stoneDark, cx - hw + 2, y, Math.max(1, Math.floor(hw / 3)), 1);
    if (y < 120) px(ctx, Q.stoneMid, cx - hw + 3, y, 1, 1);
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
  (options.mix || []).forEach((id, i) => {
    const bob = still ? 0 : ((frame + i) % 2);
    px(ctx, Q.outline, cx - 16 + i * 9, 85 + bob, 5, 4);
    px(ctx, BIT[id] == null ? Q.grey : BIT[id], cx - 15 + i * 9, 85 + bob, 3, 3);
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

/* ---------- workbench tools ---------- */
function drawMortar(ctx) {
  const h = AT['prop:grind'], cx = h.x + 13;
  // Pestle leaning in the bowl.
  for (let i = 0; i < 12; i++) px(ctx, i < 3 ? Q.stoneLit : Q.grey, h.x + 19 - Math.floor(i * 0.6), h.y + 1 + i, 3, 1);
  ellipse(ctx, Q.outline, cx, h.y + 13, 13, 4);
  for (let i = 0; i < 11; i++) {
    const hw = 12 - Math.floor(i * i / 14);
    px(ctx, Q.outline, cx - hw - 1, h.y + 14 + i, hw * 2 + 2, 1);
    px(ctx, i > 6 ? Q.stone : Q.grey, cx - hw, h.y + 14 + i, hw * 2, 1);
    px(ctx, Q.stoneLit, cx - hw + 2, h.y + 14 + i, 1, 1);
  }
  ellipse(ctx, Q.stoneLit, cx, h.y + 13, 12, 3);
  ellipse(ctx, Q.stoneDark, cx, h.y + 13, 10, 2);
  px(ctx, Q.green, cx - 6, h.y + 12, 3, 2); px(ctx, Q.greenLit, cx + 2, h.y + 13, 3, 1); px(ctx, Q.red, cx - 1, h.y + 12, 2, 1);
}

function drawSpoon(ctx) {
  const h = AT['prop:stir'];
  // A big wooden ladle lying across the bench.
  for (let i = 0; i < 15; i++) {
    const x = h.x + 23 - i, y = h.y + 2 + i;
    px(ctx, Q.outline, x - 1, y - 1, 4, 3);
  }
  for (let i = 0; i < 15; i++) px(ctx, i % 5 ? Q.wood : Q.rockLit, h.x + 23 - i, h.y + 2 + i, 2, 1);
  ellipse(ctx, Q.outline, h.x + 8, h.y + 20, 8, 5);
  ellipse(ctx, Q.wood, h.x + 8, h.y + 20, 7, 4);
  ellipse(ctx, Q.woodDark, h.x + 8, h.y + 21, 5, 2);
  px(ctx, Q.rockLit, h.x + 4, h.y + 18, 4, 1);
}

function drawFrost(ctx, frame, still) {
  const h = AT['prop:cool'];
  px(ctx, Q.outline, h.x + 1, h.y + 13, 24, 10);
  px(ctx, Q.oceanLit, h.x + 2, h.y + 14, 22, 8);
  px(ctx, Q.ice, h.x + 2, h.y + 14, 22, 3);
  px(ctx, Q.white, h.x + 12, h.y + 15, 1, 5); px(ctx, Q.white, h.x + 10, h.y + 17, 5, 1);
  px(ctx, Q.white, h.x + 11, h.y + 16, 1, 1); px(ctx, Q.white, h.x + 13, h.y + 18, 1, 1);
  const lift = still ? 0 : frame % 3;
  px(ctx, Q.snowShade, h.x + 6, h.y + 10 - lift, 1, 1); px(ctx, Q.snowShade, h.x + 18, h.y + 8 - lift, 1, 1);
  if (!lift) px(ctx, Q.white, h.x + 12, h.y + 6, 1, 1);
}

function drawScroll(ctx) {
  const h = AT.scroll;
  px(ctx, Q.outline, h.x + 2, h.y + 9, 22, 13);
  px(ctx, Q.sandLit, h.x + 3, h.y + 10, 20, 11);
  px(ctx, Q.woodDark, h.x + 1, h.y + 8, 3, 15); px(ctx, Q.woodDark, h.x + 22, h.y + 8, 3, 15);
  for (let i = 0; i < 3; i++) px(ctx, Q.grey, h.x + 6, h.y + 12 + i * 3, 13 - i * 3, 1);
  px(ctx, Q.red, h.x + 16, h.y + 18, 4, 3);
}

function drawBag(ctx, selection) {
  px(ctx, Q.outline, 0, 154, 100, 26);
  px(ctx, Q.woodDark, 1, 155, 98, 25);
  px(ctx, Q.wood, 1, 155, 98, 2);
  for (const id of BAG_IDS) {
    const hit = AT['bag:' + id], lifted = selection === hit.id;
    if (lifted) { px(ctx, Q.yellow, hit.x + 5, hit.y + 2, 14, 14); px(ctx, Q.woodDark, hit.x + 6, hit.y + 3, 12, 12); }
    drawSprite(ctx, id, hit.x + 7, hit.y + (lifted ? 4 : 7), 1);
  }
}

function drawLight(ctx) {
  pool(ctx, Q.lava, 160, 132, 64, 30, 0.07);
  pool(ctx, Q.oceanLit, 160, 92, 40, 18, 0.04);
  glow(ctx, 0.35, () => {
    px(ctx, Q.deep, 0, 0, LAB_W, 2); px(ctx, Q.deep, 0, LAB_H - 2, LAB_W, 2);
    px(ctx, Q.deep, 0, 0, 2, LAB_H); px(ctx, Q.deep, LAB_W - 2, 0, 2, LAB_H);
  });
}

/**
 * Draws the lab and returns `{ hits, fit }`. `hits` are CSS-px tap targets:
 * `{ id, kind: 'jar'|'bag'|'cauldron'|'prop'|'scroll'|'book'|'owl', x, y, w, h, ingredient?, step? }`.
 * Options: cssWidth, cssHeight, dpr, time (s), now (ms), mix, steps, tint, shaky, selection,
 * effect (drawn by slice 05), paused, reduced.
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

  drawBackdrop(ctx, fit);
  ctx.setTransform(fit.device, 0, 0, fit.device, fit.ox, fit.oy);
  drawWall(ctx);
  drawWindow(ctx, frame, still);
  drawLantern(ctx, frame, still);
  drawPlants(ctx, frame, still);
  drawShelf(ctx);
  for (const id of SHELF_IDS) drawJar(ctx, AT['jar:' + id], selection === 'jar:' + id);
  drawBench(ctx);
  drawBookStack(ctx);
  drawOwl(ctx, now, still);
  drawJournal(ctx);
  drawCat(ctx, now, still);
  drawBurner(ctx, frame, still);
  drawCauldron(ctx, options, frame, now, still);
  drawMortar(ctx);
  drawSpoon(ctx);
  drawFrost(ctx, frame, still);
  drawScroll(ctx);
  drawBag(ctx, selection);
  drawLight(ctx);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const k = fit.device / fit.dpr;
  const hits = LAYOUT.map(hit => ({
    ...hit, x: (fit.ox + hit.x * fit.device) / fit.dpr, y: (fit.oy + hit.y * fit.device) / fit.dpr, w: hit.w * k, h: hit.h * k
  }));
  return { hits, fit };
}

export const LAB_LAYOUT = LAYOUT;
export { LAB_INGREDIENTS };
