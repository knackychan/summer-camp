/* High 3/4 top-down room renderer for Code Quest (redesign slice 02, design D1/D2).
   A pure projection of model.snapshot(): square floor tiles, wall blocks with a lit
   cap and a front face, upright sprites standing on their tile, torchlight. The whole
   room is always on screen at a whole-number device-pixel scale. Game rules never
   depend on anything here. */
import { CQ_HEX, Q } from './palette.js';
import { drawSprite, spriteSize, spriteBitmap } from './pixel-art.js';
import { nearestIndex } from '../../world/planet-palette.js';

export const TILE = 16;        // logical px per tile
export const FACE = 8;         // front face of an interior wall block
const BACK_FACE = 16;          // the north wall shows a tall face
const RIM_FACE = 3;            // the south wall is a low rim so nothing hides behind it
const MARGIN = 4;              // breathing room inside the canvas, in logical px
const TOP = BACK_FACE;         // logical y of row 0's top edge inside the room buffer

const key = (x, y) => x + ',' + y;
const clamp01 = v => Math.max(0, Math.min(1, v));
const ease = t => 1 - Math.pow(1 - clamp01(t), 3);
function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return (h ^ (h >>> 16)) >>> 0; }

export const MAX_ZOOM = 2;

/* One axis of the camera: centred when the buffer fits, otherwise the view centre `c`
   (logical buffer px) is clamped so the room buffer always covers that side of the canvas. */
function axis(canvasPx, bufPx, device, c) {
  const size = bufPx * device;
  if (size <= canvasPx || !Number.isFinite(c)) return { start: Math.floor((canvasPx - size) / 2), c: bufPx / 2 };
  const start = Math.max(canvasPx - size, Math.min(0, Math.round(canvasPx / 2 - c * device)));
  return { start, c: (canvasPx / 2 - start) / device };
}

/** Whole-number device-pixel fit of a room into a CSS box. `camera.zoom` (0–2) adds whole
    device pixels on top of the whole-room fit (UX polish U6); `camera.cx/cy` pan the view. */
export function fitRoom(room, cssWidth, cssHeight, dpr = 1, camera = null) {
  const ratio = Number(dpr) > 0 ? Number(dpr) : 1;
  const bufW = room.width * TILE + MARGIN * 2;
  const bufH = TOP + room.height * TILE + MARGIN * 2;
  const canvasW = Math.max(1, Math.round(cssWidth * ratio)), canvasH = Math.max(1, Math.round(cssHeight * ratio));
  const base = Math.max(1, Math.floor(Math.min(canvasW / bufW, canvasH / bufH)));
  const zoom = camera ? Math.max(0, Math.min(MAX_ZOOM, Math.round(Number(camera.zoom) || 0))) : 0;
  const device = base + zoom;
  const ax = axis(canvasW, bufW, device, zoom ? Number(camera.cx) : NaN), ay = axis(canvasH, bufH, device, zoom ? Number(camera.cy) : NaN);
  const ox = ax.start + MARGIN * device;
  const oy = ay.start + (MARGIN + TOP) * device;
  return { device, base, zoom, cx: ax.c, cy: ay.c, scale: device / ratio, dpr: ratio, canvasW, canvasH, bufW, bufH, ox, oy };
}

/* ---------- small drawing helpers (logical coordinates) ---------- */
function px(ctx, color, x, y, w = 1, h = 1) { ctx.fillStyle = CQ_HEX[color]; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
function alpha(ctx, a, fn) { ctx.save(); ctx.globalAlpha = a; fn(); ctx.restore(); }

function torchColumns(snapshot, walls) {
  const cols = [];
  for (let x = 1; x < snapshot.width - 1; x++) {
    if ((x % 3) !== 1) continue;
    if (walls.has(key(x, 0)) && !walls.has(key(x, 1))) cols.push(x);
  }
  if (!cols.length && snapshot.width > 2) cols.push(Math.floor(snapshot.width / 2));
  return cols;
}

/* ---------- static layer: backdrop + floor + light ---------- */
function drawBackdrop(ctx, fit) {
  const d = fit.device;
  const x0 = Math.floor(-fit.ox / d) - 1, y0 = Math.floor(-fit.oy / d) - 1;
  const x1 = Math.ceil((fit.canvasW - fit.ox) / d) + 1, y1 = Math.ceil((fit.canvasH - fit.oy) / d) + 1;
  px(ctx, Q.deep, x0, y0, x1 - x0, y1 - y0);
  for (let y = y0 - (((y0 % 8) + 8) % 8); y < y1; y += 8) {
    const row = Math.floor(y / 8), shift = (row & 1) ? 8 : 0;
    for (let x = x0 - (((x0 % 16) + 16) % 16) - shift; x < x1; x += 16) {
      px(ctx, Q.stoneDark, x + 1, y + 1, 15, 7);
      if (hash(x, y) % 4 === 0) px(ctx, Q.stone, x + 1, y + 1, 15, 1);
    }
  }
}

function lightAt(x, y, torches) {
  let best = Infinity;
  for (const tx of torches) best = Math.min(best, Math.hypot(x - tx, (y - 1) * 1.25));
  return best;
}

function drawFloorTile(ctx, x, y, walls, pits, torches) {
  const lx = x * TILE, ly = y * TILE, h = hash(x, y), d = lightAt(x, y, torches);
  if (pits.has(key(x, y))) {
    px(ctx, Q.outline, lx, ly, TILE, TILE);
    px(ctx, Q.deep, lx + 2, ly + 4, TILE - 4, TILE - 6);
    px(ctx, Q.stoneDark, lx, ly, TILE, 3);
    return;
  }
  // Stepped light bands: warm pool under a torch, warm-edged slabs, cold stone, then darker stone far away.
  const warm = d < 1.25, band = !warm && d < 2.1, far = d > 4.2;
  const base = warm ? Q.warm : far ? Q.stoneDark : Q.stone;
  const shade = warm ? Q.warmDark : far ? Q.deep : Q.stoneDark;
  const lit = warm || band ? Q.warmLit : far ? Q.stone : Q.stoneMid;
  px(ctx, base, lx, ly, TILE, TILE);
  // Slab layout: one big slab, two half slabs, or four quarter stones.
  const layout = h % 6;
  px(ctx, shade, lx, ly, TILE, 1); px(ctx, shade, lx, ly, 1, TILE);
  if (layout === 1 || layout === 2) { px(ctx, shade, lx, ly + 8, TILE, 1); px(ctx, lit, lx + 1, ly + 9, 6, 1); }
  if (layout === 3) { px(ctx, shade, lx + 8, ly, 1, TILE); px(ctx, shade, lx, ly + 8, TILE, 1); px(ctx, lit, lx + 9, ly + 1, 4, 1); }
  px(ctx, lit, lx + 1, ly + 1, 5, 1); px(ctx, lit, lx + 1, ly + 2, 1, 3);
  if (layout === 4) { px(ctx, shade, lx + 5, ly + 6, 1, 1); px(ctx, shade, lx + 6, ly + 7, 2, 1); px(ctx, shade, lx + 8, ly + 8, 1, 2); }
  if (layout === 5) { px(ctx, lit, lx + 11, ly + 11, 2, 1); px(ctx, shade, lx + 11, ly + 12, 2, 1); }
  // Stepped light band: ordered dither between warm and cold stone.
  // Contact shadow under walls to the north and west.
  if (walls.has(key(x, y - 1))) { px(ctx, Q.deep, lx, ly, TILE, 2); alpha(ctx, .55, () => px(ctx, Q.deep, lx, ly + 2, TILE, 2)); }
  if (walls.has(key(x - 1, y))) alpha(ctx, .55, () => px(ctx, Q.deep, lx, ly, 2, TILE));
}

function drawStatic(ctx, snapshot, fit, walls, pits, torches) {
  drawBackdrop(ctx, fit);
  for (let y = 0; y < snapshot.height; y++) for (let x = 0; x < snapshot.width; x++) {
    if (!walls.has(key(x, y))) drawFloorTile(ctx, x, y, walls, pits, torches);
  }
}

const staticCache = new Map();
function cachedStatic(canvas, snapshot, fit, walls, pits, torches) {
  if (typeof document === 'undefined' || !document.createElement) return null;
  const id = [snapshot.levelId, snapshot.width, snapshot.height, (snapshot.walls || []).length, (snapshot.pits || []).length, fit.canvasW, fit.canvasH, fit.device, fit.ox, fit.oy].join('|');
  let layer = staticCache.get(canvas);
  if (layer && layer.id === id) return layer.canvas;
  const off = document.createElement('canvas');
  off.width = fit.canvasW; off.height = fit.canvasH;
  const octx = off.getContext('2d');
  if (!octx) return null;
  octx.imageSmoothingEnabled = false;
  octx.setTransform(fit.device, 0, 0, fit.device, fit.ox, fit.oy);
  drawStatic(octx, snapshot, fit, walls, pits, torches);
  staticCache.set(canvas, { id, canvas: off });
  return off;
}

/* ---------- walls ---------- */
function faceHeight(x, y, snapshot, walls) {
  if (walls.has(key(x, y + 1))) return 0;          // hidden behind the wall in front
  if (y >= snapshot.height - 1) return RIM_FACE;
  return y === 0 ? BACK_FACE : FACE;
}

function drawWall(ctx, x, y, snapshot, walls) {
  const fh = faceHeight(x, y, snapshot, walls);
  const capH = y >= snapshot.height - 1 ? TILE - RIM_FACE : TILE;
  const lx = x * TILE, top = y * TILE + TILE - fh - capH;
  // Cap: two courses of cut stone, lit along the top edge.
  const h = hash(x, y);
  px(ctx, Q.stoneMid, lx, top, TILE, capH);
  px(ctx, Q.stoneLit, lx, top, TILE, 1);
  px(ctx, Q.stone, lx, top + capH - 1, TILE, 1);
  if (capH >= 12) {
    px(ctx, Q.stone, lx, top + 7, TILE, 1); px(ctx, Q.stoneLit, lx, top + 8, TILE, 1);
    px(ctx, Q.stone, lx + (h % 2 ? 5 : 10), top + 1, 1, 6); px(ctx, Q.stone, lx + (h % 2 ? 11 : 3), top + 9, 1, capH - 10);
  }
  if (!walls.has(key(x - 1, y))) px(ctx, Q.outline, lx, top, 1, capH);
  if (!walls.has(key(x + 1, y))) px(ctx, Q.outline, lx + TILE - 1, top, 1, capH);
  if (!walls.has(key(x, y - 1))) px(ctx, Q.outline, lx, top, TILE, 1);
  if (!fh) return;
  // Front face: brick courses, darker toward the floor.
  const fy = top + capH;
  px(ctx, Q.stoneDark, lx, fy, TILE, fh);
  for (let row = 0; row * 4 < fh; row++) {
    const yy = fy + row * 4, off = (row + x) & 1 ? 0 : 8;
    px(ctx, Q.deep, lx, yy, TILE, 1);
    px(ctx, Q.deep, lx + off, yy, 1, Math.min(4, fh - row * 4));
    if (row === 0) px(ctx, Q.stone, lx + 1, yy + 1, TILE - 2, 1);
  }
  px(ctx, Q.outline, lx, fy + fh - 1, TILE, 1);
}

/* ---------- entities ---------- */
function anchorOf(x, y) { return { x: x * TILE + TILE / 2, y: y * TILE + TILE - 2 }; }

function shadow(ctx, a, w) { alpha(ctx, .45, () => { px(ctx, Q.outline, a.x - w / 2 + 1, a.y, w - 2, 1); px(ctx, Q.outline, a.x - w / 2 + 2, a.y + 1, w - 4, 1); }); }

/* Sprites drawn this frame, so the x-ray pass can outline the ones a wall cap covers. */
let drawn = null;
function standing(ctx, id, a, options = {}) {
  const sz = spriteSize(id), x = Math.round(a.x - sz.width / 2), y = Math.round(a.y - sz.height + 1 - (options.lift || 0));
  drawSprite(ctx, id, x, y, 1, options);
  if (drawn) drawn.push({ id, x, y, flip: !!options.flip, tx: Math.round((a.x - TILE / 2) / TILE), ty: Math.round((a.y - TILE + 2) / TILE) });
  return sz;
}
function flat(ctx, id, x, y, lift = 0) {
  const sz = spriteSize(id), sx = x * TILE + Math.round((TILE - sz.width) / 2), sy = y * TILE + TILE - sz.height - lift;
  drawSprite(ctx, id, sx, sy, 1);
  if (drawn) drawn.push({ id, x: sx, y: sy, flip: false, tx: x, ty: y });
}

/* X-ray (UX polish U7): a wall block's cap rises into the row north of it. Anything standing
   there gets the covered part of its outline redrawn faintly over the wall. */
function drawXray(ctx, snapshot, walls) {
  for (const item of drawn || []) {
    if (walls.has(key(item.tx, item.ty)) || !walls.has(key(item.tx, item.ty + 1))) continue;
    const below = item.ty + 1, fh = faceHeight(item.tx, below, snapshot, walls);
    const capH = below >= snapshot.height - 1 ? TILE - RIM_FACE : TILE;
    const coverTop = below * TILE + TILE - fh - capH;
    const bitmap = spriteBitmap(item.id), h = bitmap.length, w = (bitmap[0] || '').length;
    const solid = (i, j) => j >= 0 && j < h && i >= 0 && i < w && bitmap[j][item.flip ? w - 1 - i : i] !== '.';
    alpha(ctx, .6, () => {
      for (let j = Math.max(0, coverTop - item.y); j < h; j++) for (let i = 0; i < w; i++) {
        if (solid(i, j) && (!solid(i - 1, j) || !solid(i + 1, j) || !solid(i, j - 1) || !solid(i, j + 1))) px(ctx, Q.sandLit, item.x + i, item.y + j);
      }
    });
  }
}

function motionPosition(entity, motion, now) {
  if (!motion || !motion.from || !motion.to || !Number.isFinite(motion.start)) return { x: entity.x, y: entity.y };
  const t = ease((now - motion.start) / Math.max(1, Number(motion.duration) || 280));
  if (t >= 1) return { x: entity.x, y: entity.y };
  return { x: motion.from.x + (motion.to.x - motion.from.x) * t, y: motion.from.y + (motion.to.y - motion.from.y) * t };
}

function hpPips(ctx, entity, cx, topY) {
  const max = Math.max(1, entity.maxHp || entity.hp || 1), hp = Math.max(0, entity.hp);
  if (max <= 1) return;
  const w = Math.min(14, max * 3), filled = Math.round(w * hp / max);
  px(ctx, Q.outline, cx - w / 2 - 1, topY, w + 2, 3);
  px(ctx, Q.greenLit, cx - w / 2, topY + 1, filled, 1);
  if (filled < w) px(ctx, Q.stoneDark, cx - w / 2 + filled, topY + 1, w - filled, 1);
}

const ENEMY_IDS = new Set(['slime', 'goblin', 'golem', 'bulwark', 'viper', 'archer', 'runeWarden', 'relicHydra', 'circuitGuardian', 'emberImp', 'frostMite']);

function drawEnemy(ctx, enemy, state, anchors) {
  if (enemy.hp <= 0) return;
  const pos = motionPosition(enemy, state.enemyMotions && state.enemyMotions[enemy.id], state.now);
  const a = anchorOf(pos.x, pos.y), type = ENEMY_IDS.has(enemy.type) ? enemy.type : 'slime';
  const frame = state.reducedMotion ? 0 : Math.floor(state.time * 2) % 2;
  const id = type + '-' + frame, w = spriteSize(id).width;
  if (state.selectedId === enemy.id) {
    px(ctx, Q.yellow, a.x - w / 2, a.y + 1, w, 1); px(ctx, Q.yellow, a.x - w / 2 - 1, a.y, 1, 1); px(ctx, Q.yellow, a.x + w / 2, a.y, 1, 1);
  }
  shadow(ctx, a, Math.min(w, 14));
  const sz = standing(ctx, id, a, { flip: enemy.dir === 'W' });
  const top = a.y - sz.height - 1;
  hpPips(ctx, enemy, a.x, top - 3);
  let bx = a.x + w / 2 - 2;
  if ((enemy.armor || 0) > 0) { px(ctx, Q.outline, bx - 1, top - 4, 5, 6); px(ctx, Q.steel, bx, top - 3, 3, 4); bx += 6; }
  if (enemy.statuses && enemy.statuses.burn > 0) { px(ctx, Q.lava, bx, top - 3, 3, 4); px(ctx, Q.yellow, bx + 1, top - 5, 1, 2); bx += 5; }
  if (enemy.statuses && enemy.statuses.freeze > 0) { px(ctx, Q.cyan, bx, top - 3, 4, 4); px(ctx, Q.white, bx + 1, top - 2, 2, 1); bx += 6; }
  if (enemy.intent === 'shot') {
    const blink = state.reducedMotion || Math.floor(state.time * 6) % 2;
    if (blink) { px(ctx, Q.outline, a.x - 3, top - 12, 7, 7); px(ctx, Q.yellow, a.x - 2, top - 11, 5, 5); px(ctx, Q.outline, a.x, top - 10, 1, 2); px(ctx, Q.outline, a.x, top - 7, 1, 1); }
  }
  anchors.set(enemy.id, { x: a.x, y: a.y - sz.height / 2 });
}

function heroFrame(dir, state, tick) {
  const facing = dir === 'N' ? 'n' : dir === 'E' || dir === 'W' ? 'e' : 's';
  const pose = state === 'attack' ? 'attack' : state === 'hurt' ? 'hurt' : state === 'walk' ? (tick % 2 ? 'walk-1' : 'walk-2') : 'idle';
  return 'hero-' + facing + '-' + pose;
}

function orb(ctx, x, y) { px(ctx, Q.outline, x - 3, y - 3, 6, 6); px(ctx, Q.purple, x - 2, y - 2, 4, 4); px(ctx, Q.lilac, x - 2, y - 2, 2, 2); }

function drawHero(ctx, hero, state, anchors) {
  const pos = motionPosition(hero, state.heroMotion, state.now), a = anchorOf(pos.x, pos.y);
  const tick = Math.floor(state.time * 8), accent = nearestIndex(state.kidColor || '#39d0c8');
  const poisoned = hero.statuses && hero.statuses.poison > 0, warded = hero.statuses && hero.statuses.ward > 0;
  // Ground ring shows who the hero is; tinted by status.
  const ring = poisoned ? Q.greenLit : warded ? Q.purple : Q.cyan;
  alpha(ctx, .8, () => { px(ctx, ring, a.x - 6, a.y, 12, 1); px(ctx, ring, a.x - 7, a.y - 1, 1, 1); px(ctx, ring, a.x + 6, a.y - 1, 1, 1); px(ctx, ring, a.x - 5, a.y + 1, 10, 1); });
  const id = heroFrame(hero.dir, state.heroState || 'idle', tick);
  const sz = standing(ctx, id, a, { accent, flip: hero.dir === 'W' });
  const top = a.y - sz.height;
  if (hero.carrying) orb(ctx, a.x, top - 3);
  if (hero.guarding) { px(ctx, Q.outline, a.x - 11, a.y - 14, 6, 8); px(ctx, Q.steel, a.x - 10, a.y - 13, 4, 6); }
  if (poisoned) { px(ctx, Q.greenLit, a.x + 7, top + 2, 2, 2); px(ctx, Q.green, a.x + 9, top, 1, 1); }
  if (warded) alpha(ctx, .5, () => { px(ctx, Q.purple, a.x - 9, top + 4, 1, sz.height - 6); px(ctx, Q.purple, a.x + 8, top + 4, 1, sz.height - 6); });
  anchors.set('hero', { x: a.x, y: a.y - sz.height / 2 });
  anchors.set('hero-head', { x: a.x, y: top });
  state.heroBox = { x: a.x - sz.width / 2, y: top, w: sz.width, h: sz.height + 2 };
}

/* Tiles the puzzle depends on, so overlays (the speech bubble) can avoid them. Logical px. */
const DIR_STEP = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
function focusRects(snapshot, preview) {
  const rects = [], tile = (x, y, lift = 0) => rects.push({ x: x * TILE, y: y * TILE - lift, w: TILE, h: TILE + lift });
  const hero = snapshot.hero, step = hero && DIR_STEP[hero.dir];
  if (step) {
    const ax = hero.x + step[0], ay = hero.y + step[1];
    if (ax >= 0 && ay >= 0 && ax < snapshot.width && ay < snapshot.height) tile(ax, ay, 8);
  }
  if (snapshot.exit) tile(snapshot.exit.x, snapshot.exit.y);
  for (const v of snapshot.enemies || []) if (v.hp > 0) tile(v.x, v.y, 8);
  for (const v of snapshot.chests || []) if (!v.open) tile(v.x, v.y);
  for (const v of snapshot.keys || []) if (!v.collected) tile(v.x, v.y);
  if (Array.isArray(preview)) for (const p of preview) tile(p.x, p.y);
  return rects;
}

function drawCompanion(ctx, item, anchors) {
  const a = anchorOf(item.x, item.y);
  shadow(ctx, a, 12);
  const sz = standing(ctx, 'companion', a, { flip: item.dir === 'W' });
  if (item.carrying) orb(ctx, a.x, a.y - sz.height - 3);
  if (item.guarding) alpha(ctx, .7, () => { px(ctx, Q.white, a.x - 9, a.y - sz.height, 1, sz.height); px(ctx, Q.white, a.x + 8, a.y - sz.height, 1, sz.height); });
  anchors.set('companion', { x: a.x, y: a.y - sz.height / 2 });
}

function drawNpc(ctx, item) {
  const a = anchorOf(item.x, item.y), id = item.helped ? 'npc-helped' : 'npc';
  shadow(ctx, a, 12);
  const sz = standing(ctx, id, a);
  if (!item.helped) { const t = a.y - sz.height - 9; px(ctx, Q.outline, a.x - 2, t - 1, 4, 9); px(ctx, Q.yellow, a.x - 1, t, 2, 4); px(ctx, Q.yellow, a.x - 1, t + 5, 2, 2); }
}

/* ---------- floor markings + preview ---------- */
function drawMarkings(ctx, snapshot, state) {
  const exit = snapshot.exit;
  if (exit) {
    if (exit.kind === 'stairs') flat(ctx, 'stairs', exit.x, exit.y, 0);
    else {
      flat(ctx, 'exit', exit.x, exit.y, 1);
      if (!state.reducedMotion && Math.floor(state.time * 3) % 2) alpha(ctx, .35, () => px(ctx, Q.white, exit.x * TILE + 5, exit.y * TILE + 9, 6, 2));
    }
  }
  for (const trap of snapshot.traps || []) flat(ctx, trap.disarmed ? 'trap-safe' : 'trap-active', trap.x, trap.y, 1);
  for (const trap of snapshot.cycleTraps || []) flat(ctx, trap.active ? 'cycle-trap-active' : 'cycle-trap-safe', trap.x, trap.y, 1);
  for (const item of snapshot.movingPlatforms || []) flat(ctx, 'moving-platform', item.x, item.y, 0);
  for (const item of snapshot.plates || []) flat(ctx, item.active ? 'plate-on' : 'plate-off', item.x, item.y, 1);
  const bobY = state.reducedMotion ? 0 : Math.floor(state.time * 3) % 2;
  for (const item of snapshot.keys || []) if (!item.collected) flat(ctx, 'key', item.x, item.y, 2 + bobY);
  for (const item of snapshot.questTokens || []) if (!item.collected) flat(ctx, 'quest-token', item.x, item.y, 1 + bobY);
  for (const item of snapshot.orbs || []) if (item && !item.heldBy) flat(ctx, 'rune-core', item.x, item.y, 1 + bobY);
}

function drawPreview(ctx, path) {
  if (!Array.isArray(path) || path.length < 2) return;
  for (let i = 1; i < path.length; i++) {
    const a = anchorOf(path[i - 1].x, path[i - 1].y), b = anchorOf(path[i].x, path[i].y);
    const ay = a.y - 6, by = b.y - 6, steps = Math.max(Math.abs(b.x - a.x), Math.abs(by - ay));
    for (let s = 2; s < steps - 1; s += 3) {
      const t = s / steps;
      px(ctx, Q.outline, a.x + (b.x - a.x) * t - 1, ay + (by - ay) * t - 1, 3, 3);
      px(ctx, Q.cyan, a.x + (b.x - a.x) * t, ay + (by - ay) * t, 1, 1);
    }
  }
  const last = path[path.length - 1], end = anchorOf(last.x, last.y);
  const dx = last.dir === 'E' ? 1 : last.dir === 'W' ? -1 : 0, dy = last.dir === 'S' ? 1 : last.dir === 'N' ? -1 : 0;
  const tip = { x: end.x + dx * 5, y: end.y - 6 + dy * 5 };
  px(ctx, Q.outline, tip.x - 2, tip.y - 2, 5, 5); px(ctx, Q.cyan, tip.x - 1, tip.y - 1, 3, 3);
}

/* ---------- facing (facing-and-rune D1, D2) ---------- */
const TURN_ANGLE = { E: 0, S: Math.PI / 2, W: Math.PI, N: Math.PI * 1.5 };
const fxRunning = (fx, now, kind, target) => !!(fx && fx.kind === kind && (!target || fx.target === target) && Number.isFinite(fx.start)
  && now >= fx.start && now - fx.start <= (Number(fx.duration) || 320));
/** Where the hero's facing chevron goes (logical px), or null while it is hidden:
    mid-move, mid-turn, or once the room is won. `dim` when the tile ahead is a wall or off the room. */
export function facingMarker(snapshot, options = {}) {
  const hero = snapshot && snapshot.hero, step = hero && DIR_STEP[hero.dir];
  if (!step || snapshot.phase === 'won' || !(hero.hp > 0)) return null;
  const now = Number(options.now) || 0, m = options.heroMotion;
  if (m && m.from && m.to && Number.isFinite(m.start) && now - m.start < (Number(m.duration) || 300)) return null;
  if (fxRunning(options.fx, now, 'turn', 'hero')) return null;
  const ax = hero.x + step[0], ay = hero.y + step[1];
  const off = ax < 0 || ay < 0 || ax >= snapshot.width || ay >= snapshot.height;
  const walls = options.walls || new Set(snapshot.walls || []);
  // Facing up, the hero's head covers the lower part of the tile ahead: sit near its top.
  return { x: ax * TILE + TILE / 2, y: ay * TILE + (hero.dir === 'N' ? 3 : TILE / 2), dir: hero.dir, dim: off || walls.has(key(ax, ay)) };
}
/* A solid pixel arrowhead with a one-pixel outline: tip row j = 0 is 1 wide, row 4 is 9 wide. */
function arrowCells(x, y, dir) {
  const cells = [];
  for (let j = 0; j < 5; j++) for (let i = -j; i <= j; i++) {
    if (dir === 'N') cells.push([x + i, y - 2 + j]);
    else if (dir === 'S') cells.push([x + i, y + 1 - j]);
    else if (dir === 'W') cells.push([x - 2 + j, y + i]);
    else cells.push([x + 1 - j, y + i]);
  }
  return cells;
}
function drawFacing(ctx, marker) {
  if (!marker) return;
  const cells = arrowCells(Math.round(marker.x), Math.round(marker.y), marker.dir);
  alpha(ctx, marker.dim ? .45 : 1, () => {
    for (const [x, y] of cells) { px(ctx, Q.outline, x - 1, y, 3, 1); px(ctx, Q.outline, x, y - 1, 1, 3); }
    for (const [x, y] of cells) px(ctx, Q.cyan, x, y);
    px(ctx, Q.white, cells[0][0], cells[0][1]);
  });
}
/* Turn beat: a quarter arc from the old facing to the new one, ending at the hero's own hand
   on the side it turned to (Left always ends at the hero's left hand). */
function drawTurn(ctx, fx, a, t, reducedMotion) {
  const from = TURN_ANGLE[fx.from], to = TURN_ANGLE[fx.to];
  if (!Number.isFinite(from) || !Number.isFinite(to)) return;
  let delta = to - from;
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  const steps = 8, shown = reducedMotion ? steps : Math.min(steps, Math.ceil(t * 2 * steps));
  const rx = 13, ry = 10, point = (angle, k = 1) => ({ x: a.x + Math.cos(angle) * rx * k, y: a.y + Math.sin(angle) * ry * k });
  for (let i = 0; i <= shown; i++) {
    const p = point(from + delta * i / steps);
    px(ctx, Q.outline, p.x - 2, p.y - 2, 4, 4); px(ctx, i === shown ? Q.white : Q.cyan, p.x - 1, p.y - 1, 2, 2);
  }
  if (shown < steps) return;
  const h = point(to, 1.25);
  px(ctx, Q.outline, h.x - 3, h.y - 3, 6, 6); px(ctx, Q.skin, h.x - 2, h.y - 2, 4, 4); px(ctx, Q.skinShade, h.x - 2, h.y + 1, 4, 1);
  px(ctx, Q.outline, h.x + 2, h.y - 4, 2, 3); px(ctx, Q.skin, h.x + 2, h.y - 3, 1, 1);
}

/* ---------- FX ---------- */
function drawFx(ctx, fx, anchors, now, reducedMotion) {
  if (!fx || !Number.isFinite(fx.start)) return;
  const t = (now - fx.start) / Math.max(1, Number(fx.duration) || 320);
  if (t < 0 || t > 1) return;
  const a = anchors.get(fx.target) || anchors.get('hero');
  if (!a) return;
  const phase = Math.floor(t * 4);
  if (fx.kind === 'turn') drawTurn(ctx, fx, a, t, reducedMotion);
  else if (fx.kind === 'signal') {
    const from = anchors.get(fx.actor) || anchors.get('hero');
    const to = anchors.get(fx.target) || anchors.get(fx.to) || (fx.actor === 'hero' ? anchors.get('companion') : anchors.get('hero'));
    if (!from || !to) return;
    const x = from.x + (to.x - from.x) * t, y = from.y + (to.y - from.y) * t;
    px(ctx, Q.white, x - 2, y - 2, 4, 4); px(ctx, Q.purple, x - 1, y - 1, 2, 2);
  } else if (fx.kind === 'state') {
    px(ctx, Q.cyan, a.x - 5 - phase, a.y - 14, 10 + phase * 2, 1); px(ctx, Q.white, a.x - 1, a.y - 17 - phase, 3, 3);
  } else if (fx.kind === 'attack') {
    for (let i = 0; i < 4 + phase; i++) px(ctx, i % 2 ? Q.yellow : Q.white, a.x - 5 + i * 2, a.y - 5 + i * 2 - phase, 2, 2);
  } else if (fx.kind === 'trap') {
    for (let i = 0; i < 4; i++) px(ctx, i % 2 ? Q.red : Q.lava, a.x - 6 + i * 4, a.y - 4 - phase * 2, 2, 2);
  } else if (fx.kind === 'shot') {
    px(ctx, Q.red, a.x - 14 + phase * 3, a.y - 2, 9, 1); px(ctx, Q.white, a.x - 6 + phase * 3, a.y - 3, 2, 3);
  } else if (fx.kind === 'poison') {
    for (let i = 0; i < 4; i++) px(ctx, i % 2 ? Q.greenLit : Q.green, a.x - 6 + i * 4, a.y - 4 - ((phase + i) % 3) * 3, 2, 2);
  } else if (fx.kind === 'fire') {
    for (let i = 0; i < 5; i++) px(ctx, i % 2 ? Q.yellow : Q.lava, a.x - 8 + i * 4, a.y - 4 - ((phase + i) % 4) * 3, 2, 3);
  } else if (fx.kind === 'frost') {
    for (let i = 0; i < 4; i++) { const x = a.x - 6 + i * 4, y = a.y - 8 - ((phase + i) % 2) * 2; px(ctx, Q.cyan, x - 1, y, 3, 1); px(ctx, Q.white, x, y - 1, 1, 3); }
  } else if (fx.kind === 'guard') {
    alpha(ctx, .8, () => { px(ctx, Q.steel, a.x - 9 - phase, a.y - 12, 1, 14); px(ctx, Q.steel, a.x + 8 + phase, a.y - 12, 1, 14); });
  } else if (fx.kind === 'open') {
    for (let i = 0; i < 5; i++) px(ctx, i % 2 ? Q.yellow : Q.white, a.x - 8 + i * 4, a.y - 8 - phase * 2 - (i % 2) * 2, 1, 1);
  }
}

/* ---------- torches ---------- */
function drawTorches(ctx, torches, state) {
  const flick = state.reducedMotion ? 0 : Math.floor(state.time * 6) % 2;
  for (const x of torches) {
    const cx = x * TILE + TILE / 2, top = -1;   // on the north wall's face (y 0..16)
    // Stepped glow: a few nested soft shapes instead of one hard square.
    alpha(ctx, .10 + flick * .03, () => { px(ctx, Q.lava, cx - 5, top + 1, 10, 6); px(ctx, Q.lava, cx - 3, top - 1, 6, 10); });
    alpha(ctx, .12, () => px(ctx, Q.yellow, cx - 2, top, 4, 7));
    drawSprite(ctx, flick ? 'torch-1' : 'torch', cx - 4, top, 1);
  }
}
function drawBanners(ctx, snapshot, walls, torches) {
  for (let x = 2; x < snapshot.width - 2; x++) {
    if ((x % 3) !== 2 || torches.includes(x) || !walls.has(key(x, 0)) || walls.has(key(x, 1))) continue;
    drawSprite(ctx, 'banner', x * TILE + 4, 1, 1);
  }
}

/** Draw the room. Returns CSS-pixel anchors (relative to the canvas box) for overlays. */
export function drawRoom(canvas, snapshot, options = {}) {
  if (!canvas || !snapshot) return null;
  const dpr = Number(options.dpr) > 0 ? Number(options.dpr) : 1;
  const cssW = Number(options.cssWidth) > 0 ? Number(options.cssWidth) : (canvas.width || 480) / dpr;
  const cssH = Number(options.cssHeight) > 0 ? Number(options.cssHeight) : (canvas.height || 270) / dpr;
  const fit = fitRoom(snapshot, cssW, cssH, dpr, options.camera);
  if (canvas.width !== fit.canvasW) canvas.width = fit.canvasW;
  if (canvas.height !== fit.canvasH) canvas.height = fit.canvasH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  const time = Number(options.time) || 0, now = Number(options.now) || time * 1000;
  const reducedMotion = !!options.reducedMotion;
  const walls = new Set(snapshot.walls || []);
  const pits = new Set((snapshot.pits || []).map(item => typeof item === 'string' ? item : key(item.x, item.y)));
  const torches = torchColumns(snapshot, walls);

  // Hit shake: a two-pixel jolt while a hit lands.
  let shakeX = 0;
  const fx = options.fx;
  if (!reducedMotion && fx && ['attack', 'trap', 'shot'].includes(fx.kind) && Number.isFinite(fx.start)) {
    const t = (now - fx.start) / Math.max(1, Number(fx.duration) || 300);
    if (t >= 0 && t < .45) shakeX = (Math.floor(t * 20) % 2 ? 1 : -1) * Math.min(2, fit.device);
  }
  const ox = fit.ox + shakeX, oy = fit.oy;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const layer = cachedStatic(canvas, snapshot, fit, walls, pits, torches);
  if (layer && !shakeX) ctx.drawImage(layer, 0, 0);
  ctx.setTransform(fit.device, 0, 0, fit.device, ox, oy);
  if (!layer || shakeX) drawStatic(ctx, snapshot, { ...fit, ox, oy }, walls, pits, torches);

  const state = {
    time, now, reducedMotion, kidColor: options.kidColor, heroState: options.heroState,
    heroMotion: options.heroMotion, enemyMotions: options.enemyMotions, selectedId: snapshot.hero && snapshot.hero.targetId
  };
  drawn = [];
  drawMarkings(ctx, snapshot, state);
  if (options.preview) drawPreview(ctx, options.preview);

  // Everything upright is depth sorted by row, then column.
  const items = [];
  const push = (kind, x, y, bias, value) => items.push({ kind, x, y, depth: y * 1000 + x * 10 + bias, value });
  for (let y = 0; y < snapshot.height; y++) for (let x = 0; x < snapshot.width; x++) if (walls.has(key(x, y))) push('wall', x, y, 0);
  for (const v of snapshot.doors || []) push('door', v.x, v.y, 1, v);
  for (const v of snapshot.runeGates || []) push('gate', v.x, v.y, 1, v);
  for (const v of snapshot.levers || []) push('lever', v.x, v.y, 2, v);
  for (const v of snapshot.crates || []) push('crate', v.x, v.y, 2, v);
  for (const v of snapshot.pushBlocks || []) push('push', v.x, v.y, 2, v);
  for (const v of snapshot.chests || []) push('chest', v.x, v.y, 2, v);
  for (const v of snapshot.npcs || []) push('npc', v.x, v.y, 3, v);
  for (const v of snapshot.enemies || []) if (v.hp > 0) {
    const m = options.enemyMotions && options.enemyMotions[v.id], p = motionPosition(v, m, now);
    push('enemy', p.x, p.y, 4, v);
  }
  if (snapshot.companion) push('companion', snapshot.companion.x, snapshot.companion.y, 5, snapshot.companion);
  if (snapshot.hero) { const p = motionPosition(snapshot.hero, options.heroMotion, now); push('hero', p.x, p.y, 6, snapshot.hero); }
  items.sort((a, b) => a.depth - b.depth);

  const anchors = new Map();
  drawBanners(ctx, snapshot, walls, torches);
  let torchesDrawn = false;
  for (const item of items) {
    if (!torchesDrawn && item.y >= 1) { drawTorches(ctx, torches, state); torchesDrawn = true; }
    const v = item.value;
    if (item.kind === 'wall') drawWall(ctx, item.x, item.y, snapshot, walls);
    else if (item.kind === 'door') { flat(ctx, v.open ? 'door-open' : 'door-closed', v.x, v.y); }
    else if (item.kind === 'gate') { flat(ctx, v.open ? 'rune-gate-open' : 'rune-gate-closed', v.x, v.y); }
    else if (item.kind === 'lever') flat(ctx, v.active ? 'lever-on' : 'lever-off', v.x, v.y);
    else if (item.kind === 'crate') flat(ctx, v.broken ? 'crate-broken' : 'crate', v.x, v.y);
    else if (item.kind === 'push') flat(ctx, 'push-block', v.x, v.y);
    else if (item.kind === 'chest') { flat(ctx, v.open ? 'chest-open' : 'chest-closed', v.x, v.y); anchors.set(v.id, anchorOf(v.x, v.y)); }
    else if (item.kind === 'npc') drawNpc(ctx, v);
    else if (item.kind === 'enemy') drawEnemy(ctx, v, state, anchors);
    else if (item.kind === 'companion') drawCompanion(ctx, v, anchors);
    else if (item.kind === 'hero') drawHero(ctx, v, state, anchors);
  }
  if (!torchesDrawn) drawTorches(ctx, torches, state);
  drawXray(ctx, snapshot, walls);
  drawn = null;

  for (const list of ['doors', 'traps', 'cycleTraps', 'keys', 'levers', 'plates', 'runeGates', 'crates', 'pushBlocks', 'questTokens', 'orbs', 'movingPlatforms', 'npcs']) {
    for (const v of snapshot[list] || []) if (v && v.id && !anchors.has(v.id)) anchors.set(v.id, anchorOf(v.x, v.y));
  }
  drawFacing(ctx, facingMarker(snapshot, { now, fx, heroMotion: options.heroMotion, walls }));
  drawFx(ctx, fx, anchors, now, reducedMotion);

  if (options.paused || options.dim) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    alpha(ctx, .65, () => { ctx.fillStyle = CQ_HEX[Q.outline]; ctx.fillRect(0, 0, fit.canvasW, fit.canvasH); });
  }
  if (options.paused) {
    const u = Math.max(2, fit.device * 2), cx = Math.round(fit.canvasW / 2), cy = Math.round(fit.canvasH / 2);
    ctx.fillStyle = CQ_HEX[Q.sandLit];
    ctx.fillRect(cx - u * 4, cy - u * 6, u * 3, u * 12); ctx.fillRect(cx + u, cy - u * 6, u * 3, u * 12);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Anchors and boxes in CSS px relative to the canvas box.
  const css = new Map();
  for (const [id, p] of anchors) css.set(id, { x: (ox + p.x * fit.device) / dpr, y: (oy + p.y * fit.device) / dpr });
  const cssRect = r => ({ x: (ox + r.x * fit.device) / dpr, y: (oy + r.y * fit.device) / dpr, w: r.w * fit.device / dpr, h: r.h * fit.device / dpr });
  return {
    anchors: css, scale: fit.scale, device: fit.device, origin: { x: ox / dpr, y: oy / dpr },
    camera: { zoom: fit.zoom, cx: fit.cx, cy: fit.cy, base: fit.base },
    heroBox: state.heroBox ? cssRect(state.heroBox) : null, focus: focusRects(snapshot, options.preview).map(cssRect)
  };
}

export const ROOM_VIEW = Object.freeze({ TILE, FACE, BACK_FACE, MARGIN, TOP, fitRoom });
