/* Laboratory of Curiosity sprites (lab design D3): code-drawn pixel bitmaps in the
   Code Quest palette. One char = one logical pixel; '.' is transparent. Rows shorter
   than the widest row are padded, so a hand-typed frame can never shear. */
import { CQ_HEX, Q } from '../palette.js';

const CH = Object.freeze({
  K: Q.outline, R: Q.red, W: Q.white, S: Q.sand, L: Q.sandLit, Y: Q.yellow, F: Q.lava,
  Q: Q.lilac, U: Q.purple, M: Q.magenta, V: Q.purpleDark, G: Q.green, H: Q.greenDark,
  I: Q.greenLit, C: Q.ice, B: Q.cyan, O: Q.woodDark, T: Q.wood, N: Q.snowShade, X: Q.steel,
  P: Q.pink, Z: Q.grey, D: Q.rockDark, E: Q.stoneMid, J: Q.stoneLit
});

const frame = rows => {
  const width = Math.max(...rows.map(row => row.length));
  return Object.freeze(rows.map(row => row.padEnd(width, '.')));
};

export const LAB_SPRITES = Object.freeze({
  redMushroom: frame([
    '....KKKK....', '..KKRRRRKK..', '.KRRWRRRWRK.', 'KRRRRRRRRRRK', 'KRWRRRRRRWRK', '.KKKKKKKKKK.',
    '....KLLK....', '....KSSK....', '....KSSK....', '...KSSSSK...', '...KKKKKK...'
  ]),
  echoCrystal: frame([
    '.....KK.....', '....KQUK....', '...KQUUK.K..', '...KQUUKKQK.', '.K.KQUUKQUK.', 'KQKKQUUKQUK.',
    'KQUKQUUKUUK.', 'KQUKQUUKUK..', '.KUKQUUKKK..', '..KKUUUUK...', '...KKKKKK...'
  ]),
  emberSeed: frame([
    '.....Y......', '....YFY.....', '....FRF.....', '...KKKKK....', '..KFFFFFK...', '.KFFYFFFFK..',
    '.KFFFFFFRK..', '.KFFFFFRRK..', '..KFFRRRK...', '...KRRRK....', '....KKK.....'
  ]),
  moonflower: frame([
    '....KKKK....', '..KKWWWWKK..', '.KWWQWWQWWK.', '.KWQWYYWQWK.', 'KWWWYYYYWWWK', '.KWQWYYWQWK.',
    '.KWWQWWQWWK.', '..KKWWWWKK..', '....KGGK....', '...KGKKGK...', '....KGGK....'
  ]),
  voidDust: frame([
    '....M.......', '...MUM...M..', '....M...MUM.', '..........M.', '....KKKK....', '..KKVVVVKK..',
    '.KVVUVVVUVK.', 'KVVVVVMVVVVK', 'KVUVVVVVVUVK', '.KKKKKKKKKK.'
  ]),
  lifeSap: frame([
    '.....KK.....', '....KIIK....', '....KIGK....', '...KIGGGK...', '...KIGGGK...', '..KIGGGGGK..',
    '..KIWGGGGK..', '.KIGGGGGGHK.', '.KIGGGGGHHK.', '..KGGGGHHK..', '...KKKKKK...'
  ]),
  frostDew: frame([
    '.....KK.....', '....KWWK....', '....KWCK....', '...KWCCCK...', '...KWCCCK...', '..KWCCBCCK..',
    '..KWWCCCCK..', '.KWCCCCCBNK.', '.KWCCCCBNNK.', '..KCCCCNNK..', '...KKKKKK...'
  ]),
  starDust: frame([
    '.....KK.....', '....KYYK....', '....KYYK....', 'KKKKKYYKKKKK', 'KYYYYWYYYYYK', '.KYYYYYYYYK.',
    '..KYYYYYYK..', '..KYYKKYYK..', '.KYYK..KYYK.', '.KYK....KYK.', '.KK......KK.'
  ]),
  owl: frame([
    '........KK..........', '.......KUUK.........', '......KUUUUK........', '.....KUUYUUUK.......',
    '....KUUUUUUUUK......', '..KKUUUUUUUUUUKK....', '.KUUUUUUUUUUUUUUK...', '..KKKKKKKKKKKKKK....',
    '...KTTTTTTTTTTK.....', '..KTSSSSTTSSSSTK....', '..KTSWWSTTSWWSTK....', '..KTWWKWTTWKWWTK....',
    '..KTSWWSTTSWWSTK....', '..KTTSSTYYTSSTTK....', '..KTTTTTTYTTTTTK....', '..KOTSSSSSSSSTOK....',
    '..KOTSLSLSLSSTOK....', '..KOTSSSSSSSSTOK....', '..KOTSLSLSLSSTOK....', '...KOTSSSSSSTOK.....',
    '....KKTTTTTTKK......', '.....KYK..KYK.......'
  ]),
  owlBlink: null,
  // Slice 05: the cute monstrosity that hops out of the cauldron.
  blob: frame([
    '....KKKK....', '..KKIIGGKK..', '.KIIGGGGGGK.', '.KIWKGGWKGK.', 'KGIWKGGWKGGK', 'KGGGGGGGGGGK',
    'KGGPGGGGPGGK', 'KGGGGKKGGGGK', '.KKKKKKKKKK.'
  ]),
  cat: frame([
    '....K.K.................', '...KVKVK................', '..KVVVVVK..KKKKKKK......', '..KVKVKVKKKVVVVVVVKK....',
    '..KVVVVVVVVVVVVVVVVVK...', '...KVVPVVVVVVVVVVVVVVK..', '...KVVVVVVVVVVVVVVVVVK..', '....KKVVVVVVVVVVVVVVVK..',
    '......KVVVVVVVVVVVVVK...', '......KKKKKKKKKKKKKK....'
  ]),
  catAwake: null
});

// Variants: same frame with the eyes changed, so the two never drift apart.
const swapRows = (rows, at, lines) => frame(rows.map((row, i) => (i >= at && i < at + lines.length ? lines[i - at] : row)));
const SPRITES = {
  ...LAB_SPRITES,
  owlBlink: swapRows(LAB_SPRITES.owl, 10, ['..KTSSSSTTSSSSTK....', '..KTKKKKTTKKKKTK....', '..KTSSSSTTSSSSTK....']),
  catAwake: swapRows(LAB_SPRITES.cat, 3, ['..KVYVYVKKKVVVVVVVKK....'])
};

export function px(ctx, color, x, y, w = 1, h = 1) {
  ctx.fillStyle = CQ_HEX[color];
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function labSpriteSize(id) {
  const rows = SPRITES[id];
  return rows ? { width: rows[0].length, height: rows.length } : { width: 0, height: 0 };
}

/** Draws a lab bitmap at logical (x, y); `outline` recolours the K pixels (selection glow), `scale` sizes it up. */
export function drawLabSprite(ctx, id, x, y, options = {}) {
  const rows = SPRITES[id];
  if (!rows) return;
  const flip = !!options.flip, s = Math.max(1, Math.round(Number(options.scale) || 1));
  for (let row = 0; row < rows.length; row++) {
    const line = rows[row];
    for (let col = 0; col < line.length; col++) {
      const char = line[col];
      if (char === '.') continue;
      const color = char === 'K' && options.outline != null ? options.outline : CH[char];
      if (color == null) continue;
      px(ctx, color, x + (flip ? line.length - 1 - col : col) * s, y + row * s, s, s);
    }
  }
}

export const LAB_SPRITE_IDS = Object.freeze(Object.keys(SPRITES));

/* ---------- depth shading (lab-feel D6): the Pixel Planet's banded light ----------
   A light level in 0..1 picks one of three palette steps (shadow, base, lit); between
   bands a Bayer 4×4 ordered dither mixes neighbours, so light falls off in pixels,
   never in blended colours. Pure: same (level, x, y) → same index. */
export const BAYER4 = Object.freeze([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]);
/** Dither threshold in (0, 1) for a pixel. */
export function bayer(x, y) { return (BAYER4[((y & 3) << 2) | (x & 3)] + 0.5) / 16; }
/** Palette index for light `level` (0..1) at pixel (x, y) from a [shadow, base, lit] ramp. */
export function ramp(level, x, y, steps) {
  const v = Math.max(0, Math.min(1, Number(level) || 0)) * (steps.length - 1);
  const band = Math.floor(v), frac = v - band;
  return steps[Math.min(steps.length - 1, band + (frac > bayer(x, y) ? 1 : 0))];
}
/* Lights as unit directions toward the light (x right, y down, z toward the viewer). */
const unit = (x, y, z) => { const n = Math.hypot(x, y, z) || 1; return Object.freeze([x / n, y / n, z / n]); };
export const LAB_LIGHTS = Object.freeze({
  fire: Object.freeze({ dir: unit(0, 0.75, 0.65), strength: 0.75 }),     // the burner, below and in front
  moon: Object.freeze({ dir: unit(-0.15, -0.85, 0.5), strength: 0.55 }),  // the window, above
  lantern: Object.freeze({ dir: unit(-0.7, -0.5, 0.5), strength: 0.35 })  // upper left
});
/** Lambert light on a surface normal from a list of lights, clamped to 0..1. */
export function sphereLight(nx, ny, nz, lights = [LAB_LIGHTS.moon, LAB_LIGHTS.lantern]) {
  let sum = 0;
  for (const light of lights) sum += Math.max(0, nx * light.dir[0] + ny * light.dir[1] + nz * light.dir[2]) * light.strength;
  return Math.max(0, Math.min(1, sum));
}
/** A vertical cylinder seen from the front: `nx` in -1..1 across its width. */
export function cylinderLight(nx, lights) {
  const x = Math.max(-1, Math.min(1, nx));
  return sphereLight(x, 0, Math.sqrt(1 - x * x), lights);
}
/**
 * Fills a row of pixels whose colour is `colorAt(x)`, one fillRect per run of the same
 * colour (cheap on old tablets even when shading every pixel).
 */
export function shadeRow(ctx, y, x0, x1, colorAt) {
  let start = x0, color = x0 < x1 ? colorAt(x0) : null;
  for (let x = x0 + 1; x <= x1; x++) {
    const next = x < x1 ? colorAt(x) : null;
    if (next === color) continue;
    if (color != null) px(ctx, color, start, y, x - start, 1);
    start = x; color = next;
  }
}
/** A dithered contact shadow: `density` (0..1) of the ellipse's pixels, densest at the centre. */
export function ditherShadow(ctx, color, cx, cy, rx, ry, density = 0.6) {
  for (let y = -ry; y <= ry; y++) {
    const span = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry || 1))));
    shadeRow(ctx, cy + y, cx - span, cx + span + 1, x => {
      const d = Math.hypot((x - cx) / (rx || 1), y / (ry || 1));
      return density * (1 - d * 0.7) > bayer(x, cy + y) ? color : null;
    });
  }
}
