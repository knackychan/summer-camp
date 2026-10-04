/* Laboratory of Curiosity reaction effects (lab design rules table, D8, D13; slice 05).
   Every outcome is a small, funny event in the room: a ≤ 3 s main beat, and for a few
   (soot, the blob, the copies, the vines) a lingering part that stays until ✕ Clear or
   the next Brew. Pure drawing in logical px of the centre group's 320×180 core (the
   cauldron's frame); `o.shift` places spots on the left / right groups and `o.room` is
   the whole room (lab-feel D1). Palette colours only; effects never move a tap target.
   Under reduced motion: no shake, no flash, the explosion is a puff, half the
   particles, and the lingering parts hold still. */
import { Q } from '../palette.js';
import { drawSprite, spriteSize } from '../pixel-art.js';
import { px, drawLabSprite, labSpriteSize } from './lab-art.js';
import { LAB_INGREDIENTS } from './ingredients.js';
import { LAB_RULES } from './rules.js';

export const FX_BEAT = 3000;
export const FX_LINGER = Object.freeze(['explosion', 'monstrosity', 'duplication', 'overgrowth', 'snowflakeCopies', 'flamingVines']);
const STARTLE = ['explosion', 'fireball', 'singularity', 'thermalShock'];

const CX = 160, SURFACE = 86;   // cauldron centre and liquid surface (lab-view.js)
const ORB = { x: 160, y: 56 };  // above the cauldron, in front of the window
const clamp01 = v => Math.max(0, Math.min(1, v));
const lerp = (a, b, k) => a + (b - a) * k;
const easeOut = k => 1 - (1 - k) * (1 - k);
const rand = (i, salt = 0) => { let h = (i * 374761393 + salt * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const count = (n, reduced) => Math.max(1, reduced ? Math.ceil(n / 2) : n);
// Without a layout (old callers) the room is the 320×180 core and every group sits at 0.
const CORE_ROOM = Object.freeze({ x: 0, y: 0, w: 320, h: 180 });
const roomOf = o => o.room || CORE_ROOM;
const shiftX = (o, group) => (o.shift && o.shift[group] ? o.shift[group].x : 0);

function alpha(ctx, a, fn) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = Math.min(1, a); fn(); ctx.restore();
}
function disc(ctx, color, cx, cy, r) {
  const rr = Math.max(0, Math.round(r));
  if (!rr) { px(ctx, color, cx, cy); return; }
  for (let y = -rr; y <= rr; y++) {
    const hw = Math.round(Math.sqrt(Math.max(0, rr * rr - y * y)));
    px(ctx, color, cx - hw, cy + y, hw * 2 + 1, 1);
  }
}
function ring(ctx, color, cx, cy, rx, ry = rx) {
  const steps = Math.max(8, Math.round((rx + ry) * 3));
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    px(ctx, color, cx + Math.round(Math.cos(a) * rx), cy + Math.round(Math.sin(a) * ry));
  }
}
function ingredientSize(id) {
  return LAB_INGREDIENTS[id] && LAB_INGREDIENTS[id].where === 'bag' ? spriteSize(id, 1) : labSpriteSize(id);
}
/** Draws an ingredient centred on (x, y): bag items use the dungeon sprites, shelf items the lab ones. */
function ingredient(ctx, id, x, y) {
  if (!LAB_INGREDIENTS[id]) return;
  const { width, height } = ingredientSize(id), left = Math.round(x - width / 2), top = Math.round(y - height / 2);
  if (LAB_INGREDIENTS[id].where === 'bag') drawSprite(ctx, id, left, top, 1); else drawLabSprite(ctx, id, left, top);
}
const potionSprite = id => (id === 'healing' ? 'potion' : id === 'focus' ? 'moonBerry' : id);

/** Milliseconds since the effect started (0 without one). */
export function fxTime(effect, now) {
  return effect ? Math.max(0, (Number(now) || 0) - (Number(effect.start) || 0)) : 0;
}

/** How the room itself reacts this frame: shake, the owl, the cat and the leaning jars. */
export function fxPose(effect, t, reduced) {
  const pose = { shakeX: 0, shakeY: 0, owlDy: 0, owlBlink: false, soot: false, catDy: 0, catAwake: false, lean: 0 };
  if (!effect) return pose;
  const id = effect.ruleId;
  if (id === 'explosion') pose.soot = true;
  if (!reduced && t < 1100 && id !== 'fizzle') pose.owlDy = Math.floor(t / 140) % 2 ? -2 : 0; // the owl hops: surprised or pleased
  if (id === 'fizzle' && t < 900) pose.owlBlink = true;
  if (!reduced && id === 'explosion' && t < 540) { pose.shakeX = [2, -2, 1, -1, 2, -1, 1, 0, -1][Math.floor(t / 60)] || 0; pose.shakeY = t < 240 ? (Math.floor(t / 60) % 2 ? 1 : -1) : 0; }
  if (STARTLE.includes(id) && t < 900) {
    pose.catAwake = true;
    if (!reduced) pose.catDy = -Math.round(Math.sin(Math.PI * t / 900) * 9);
  }
  if (id === 'singularity' && t > 250 && t < 2700) pose.lean = Math.min(3, effect.intensity || 1);
  return pose;
}

/* ---------- one drawer per outcome; t = ms since Brew, k = intensity 1–3 ---------- */

function potion(ctx, e, t, o) {
  if (t >= FX_BEAT) return;
  const id = potionSprite(e.potionId || 'healing'), { width, height } = spriteSize(id, 2);
  const rise = easeOut(clamp01(t / 900)), y = lerp(SURFACE - 6, 48, rise);
  alpha(ctx, t < 2200 ? 1 : 1 - (t - 2200) / 800, () => {
    // A column of liquid lifts the bottle out of the cauldron.
    if (t < 700) px(ctx, Q.greenLit, CX - 3, y + height / 2, 6, Math.max(1, SURFACE - y - height / 2));
    drawSprite(ctx, id, Math.round(CX - width / 2), Math.round(y - height / 2), 2);
    const n = count(8, o.reduced);
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + t / 400, r = 16 + (i % 2) * 4;
      if ((Math.floor(t / 120) + i) % 3) px(ctx, i % 2 ? Q.yellow : Q.white, CX + Math.round(Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.7), 2, 2);
    }
  });
}

function pocketUniverse(ctx, e, t, o) {
  if (t >= FX_BEAT) return;
  const a = t < 400 ? t / 400 : t > 2300 ? (FX_BEAT - t) / 700 : 1, spin = t / (o.reduced ? 1600 : 650);
  const colors = [Q.white, Q.lilac, Q.magenta, Q.purple];
  alpha(ctx, a, () => {
    disc(ctx, Q.purpleDark, ORB.x, ORB.y, 9 + e.intensity);
    const n = count(18 + e.intensity * 6, o.reduced);
    for (let arm = 0; arm < 2; arm++) for (let i = 0; i < n; i++) {
      const r = 2 + i * (16 + e.intensity * 3) / n, ang = i * 0.42 + arm * Math.PI + spin;
      px(ctx, colors[Math.min(3, Math.floor(i / n * 4))], ORB.x + Math.round(Math.cos(ang) * r), ORB.y + Math.round(Math.sin(ang) * r * 0.55));
    }
    disc(ctx, Q.white, ORB.x, ORB.y, 1);
  });
}

function explosion(ctx, e, t, o) {
  const k = e.intensity;
  if (t < FX_BEAT) {
    if (o.reduced) {
      // A soft puff instead of a bang.
      const p = clamp01(t / 1200);
      alpha(ctx, 1 - p, () => { disc(ctx, Q.grey, CX, SURFACE - 8 - p * 10, 5 + p * 14); disc(ctx, Q.snowShade, CX - 3, SURFACE - 10 - p * 10, 3 + p * 8); });
    } else {
      const room = roomOf(o);
      if (t < 200) alpha(ctx, 0.5 * (1 - t / 200), () => px(ctx, Q.white, room.x, room.y, room.w, room.h));
      const p = easeOut(clamp01(t / 700)), n = count(14 + k * 6, o.reduced);
      alpha(ctx, t < 900 ? 1 : 1 - (t - 900) / 600, () => {
        for (let i = 0; i < n; i++) {
          const ang = i / n * Math.PI * 2 + rand(i, 3) * 0.4, r = p * (26 + k * 9) * (0.7 + rand(i, 7) * 0.5);
          const size = t < 400 ? 2 : 1;
          px(ctx, [Q.yellow, Q.lava, Q.red][i % 3], CX + Math.cos(ang) * r, SURFACE - 6 + Math.sin(ang) * r * 0.7, size, size);
        }
        if (t < 260) disc(ctx, Q.yellow, CX, SURFACE - 6, 4 + k * 2);
      });
      // Smoke billows up after the bang.
      for (let i = 0; i < count(6, o.reduced); i++) {
        const age = t - 250 - i * 90;
        if (age < 0 || age > 2300) continue;
        const q = age / 2300;
        alpha(ctx, 0.85 * (1 - q), () => disc(ctx, i % 2 ? Q.grey : Q.stoneMid, CX - 18 + i * 7, SURFACE - 10 - q * 46, 4 + q * 8));
      }
    }
  }
  // Lingering: soot on the owl (a harmless smudge) and a curl of smoke above it.
  const owl = shiftX(o, 'left');
  for (const [x, y] of [[23, 81], [26, 83], [31, 82], [34, 80], [28, 86], [36, 85], [24, 88], [33, 89]]) px(ctx, Q.rockDark, owl + x, y, 2, 1);
  const curl = o.still ? 0 : Math.floor(o.now / 400) % 3;
  px(ctx, Q.grey, owl + 30 + curl, 66, 1, 2); px(ctx, Q.grey, owl + 29 - curl, 63, 1, 2);
}

function temporalRupture(ctx, e, t, o) {
  if (t >= FX_BEAT) return;
  // Rings tighten toward the cauldron: time running backwards.
  for (let i = 0; i < count(3, o.reduced); i++) {
    const r = 32 * (1 - (((t + i * 260) % 780) / 780));
    if (t < 2400 && r > 3) ring(ctx, i % 2 ? Q.lilac : Q.white, CX, SURFACE, r, r * 0.4);
  }
  const id = e.lastIngredient, home = id && o.home(id);
  if (!home) return;
  const p = clamp01(t / 1400), q = easeOut(p);
  const at = s => ({ x: lerp(CX, home.x, s), y: lerp(SURFACE - 4, home.y, s) - Math.sin(Math.PI * s) * 34 });
  if (p < 1) {
    for (let g = 3; g >= 1; g--) { const ghost = at(Math.max(0, q - g * 0.06)); alpha(ctx, 0.25, () => ingredient(ctx, id, ghost.x, ghost.y)); }
    const now = at(q); ingredient(ctx, id, now.x, now.y);
  } else if (t < 1900) {
    // A little sparkle as it lands back home.
    ring(ctx, Q.white, home.x, home.y, 6 + (t - 1400) / 80);
  }
}

function singularity(ctx, e, t, o) {
  if (t >= FX_BEAT) return;
  const grow = t < 400 ? t / 400 : t > 2600 ? (FX_BEAT - t) / 400 : 1, r = Math.max(0, (3 + e.intensity * 2) * grow);
  const n = count(16, o.reduced);
  for (let i = 0; i < n; i++) {
    const phase = (t / 900 + rand(i, 11)) % 1, dist = (1 - phase) * 44, ang = i * 2.4 + phase * 5;
    if (grow > 0.2) px(ctx, i % 3 ? Q.lilac : Q.white, ORB.x + Math.cos(ang) * dist, ORB.y + Math.sin(ang) * dist * 0.6);
  }
  if (r < 0.5) return;
  ring(ctx, Q.magenta, ORB.x, ORB.y, r + 2);
  disc(ctx, Q.outline, ORB.x, ORB.y, r + 1);
  disc(ctx, Q.purpleDark, ORB.x, ORB.y, r * 0.6);
  disc(ctx, Q.outline, ORB.x, ORB.y, r * 0.3);
}

function monstrosity(ctx, e, t, o) {
  const land = { x: 230, y: 101 }, start = { x: CX, y: SURFACE - 6 };
  let x = land.x, y = land.y;
  if (t < 900) {
    const p = easeOut(t / 900);
    x = lerp(start.x, land.x, p); y = lerp(start.y, land.y, p) - Math.sin(Math.PI * p) * 30;
  } else if (!o.still) {
    y -= Math.round(Math.abs(Math.sin((o.now - (Number(e.start) || 0)) / 260)) * 4);  // happy bouncing
  }
  const { width, height } = labSpriteSize('blob');
  drawLabSprite(ctx, 'blob', Math.round(x - width), Math.round(y - height), { scale: 2 });
}

const COPY_SPOTS = [[86, 104], [214, 104], [100, 104], [240, 104], [72, 104], [254, 104], [112, 104], [266, 104]];
function duplication(ctx, e, t, o) {
  // Mix items may be "id:state" keys (lab-states); the copies are of the plain ingredient.
  const organic = (o.mix || []).map(key => String(key).split(':')[0]).find(id => LAB_INGREDIENTS[id] && (LAB_INGREDIENTS[id].props.life || 0) + (LAB_INGREDIENTS[id].props.growth || 0) > 0) || e.lastIngredient;
  if (!LAB_INGREDIENTS[organic]) return;
  const copies = Math.min(8, 2 ** Math.max(1, e.intensity));
  for (let i = 0; i < copies; i++) {
    const [sx, sy] = COPY_SPOTS[i], age = t - 150 - i * 170;
    if (age < 0) continue;
    const p = easeOut(clamp01(age / 500));
    const bob = p >= 1 && !o.still ? Math.floor((o.now / 300 + i) % 2) : 0;
    const x = lerp(CX, sx, p), y = lerp(SURFACE - 6, sy, p) - Math.sin(Math.PI * p) * 22 - bob;
    ingredient(ctx, organic, x, y);
    if (age < 260) ring(ctx, Q.white, x, y, 4 + age / 40);
  }
}

// Vine roots: on the shelf posts (right group), by the books (left) and either side of the cauldron.
const VINES = [[205, 92, 'right'], [311, 92, 'right'], [60, 100, 'left'], [118, 100, 'centre'], [196, 100, 'centre'], [250, 100, 'right']];
const vineAt = (o, v) => [VINES[v][0] + shiftX(o, VINES[v][2]), VINES[v][1]];
function overgrowth(ctx, e, t, o) {
  const n = Math.min(VINES.length, 2 + e.intensity * 2);
  for (let v = 0; v < n; v++) {
    const [x, base] = vineAt(o, v), full = 60 + Math.round(rand(v, 5) * 26), grow = easeOut(clamp01((t - v * 120) / 2000));
    const h = Math.round(full * grow), sway = o.still ? 0 : Math.floor((o.now / 500 + v) % 2);
    for (let y = 0; y < h; y += 2) {
      const dx = (Math.floor(y / 6) % 2 ? 1 : 0) + (y > h - 12 ? sway : 0);
      px(ctx, Q.greenDark, x + dx, base + 10 - y, 2, 2);
      if (y % 8 === 4) { px(ctx, Q.green, x + dx + (y % 16 === 4 ? 2 : -3), base + 10 - y, 3, 2); px(ctx, Q.greenLit, x + dx + (y % 16 === 4 ? 3 : -2), base + 10 - y, 1, 1); }
      if (y % 22 === 14 && grow > 0.8) px(ctx, Q.pink, x + dx + 2, base + 9 - y, 2, 2);
    }
  }
}

/* ---------- Phase 2 state reactions (lab-states slice 04) ---------- */

function thermalShock(ctx, e, t, o) {
  if (t >= FX_BEAT) return;
  // Ice shards crack off the rim and fly out; little pops ring where they burst; a hiss of steam.
  const n = count(10 + e.intensity * 4, o.reduced);
  for (let i = 0; i < n; i++) {
    const age = t - i * 40;
    if (age < 0 || age > 1100) continue;
    const q = easeOut(age / 1100), ang = Math.PI + (i / (n - 1 || 1)) * Math.PI + (rand(i, 21) - 0.5) * 0.4, r = 8 + q * (34 + e.intensity * 6);
    const x = CX + Math.cos(ang) * r * 1.3, y = 87 + Math.sin(ang) * r * 0.6 + q * q * 22;
    alpha(ctx, 1 - q * 0.6, () => { px(ctx, Q.white, x, y, 3, 2); px(ctx, Q.ice, x + 1, y + 2, 2, 2); px(ctx, Q.oceanLit, x + 3, y + 1); });
    if (age > 700 && age < 900) ring(ctx, Q.white, x, y, 2 + (age - 700) / 60);
  }
  // Cracks race across the frosted rim first.
  if (t < 900) alpha(ctx, 1 - t / 900, () => { ring(ctx, Q.white, CX, 87, 30, 7); for (const dx of [-22, -9, 6, 19]) px(ctx, Q.ice, CX + dx, 82, 1, 4); });
  for (let i = 0; i < count(5, o.reduced); i++) {
    const age = t - 200 - i * 120;
    if (age < 0 || age > 1600) continue;
    const q = age / 1600;
    alpha(ctx, 0.7 * (1 - q), () => disc(ctx, i % 2 ? Q.white : Q.snowShade, CX - 12 + i * 6, SURFACE - 6 - q * 40, 3 + q * 7));
  }
}

/** A six-armed pixel snowflake centred on (x, y). */
function snowflake(ctx, x, y, big) {
  const a = big ? 5 : 4;
  px(ctx, Q.white, x - a, y, a * 2 + 1, 1); px(ctx, Q.white, x, y - a, 1, a * 2 + 1);
  for (let d = 1; d < a - 1; d++) for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) px(ctx, Q.ice, x + sx * d, y + sy * d);
  // Little branch tips on the four main arms.
  for (const [dx, dy] of [[a - 1, 1], [a - 1, -1], [1 - a, 1], [1 - a, -1], [1, a - 1], [-1, a - 1], [1, 1 - a], [-1, 1 - a]]) px(ctx, Q.snowShade, x + dx, y + dy);
  px(ctx, Q.oceanLit, x, y);
}
const FLAKE_SPOTS = [[90, 104], [214, 104], [108, 103], [236, 104], [72, 104], [254, 103], [122, 104], [270, 104]];
function snowflakeCopies(ctx, e, t, o) {
  // One flake rises from the cauldron, splits 2 → 4 → 8 in front of the window, then each drifts down to the bench.
  const copies = Math.min(8, 2 ** Math.max(1, e.intensity)), top = { x: CX, y: 44 };
  if (t < 600) { const p = easeOut(t / 600); snowflake(ctx, CX, Math.round(lerp(SURFACE - 6, top.y, p)), true); return; }
  for (let i = 0; i < copies; i++) {
    const [sx, sy] = FLAKE_SPOTS[i], age = t - 600 - Math.floor(Math.log2(i + 1)) * 250;
    if (age < 0) continue;
    const split = easeOut(clamp01(age / 300)), fall = easeOut(clamp01((age - 300) / 1300));
    const spread = { x: top.x + (i - (copies - 1) / 2) * 15, y: top.y + (i % 2) * 8 };
    let x = lerp(top.x, spread.x, split), y = lerp(top.y, spread.y, split);
    if (fall > 0) { x = lerp(spread.x, sx, fall) + Math.sin(fall * 6 + i) * 3 * (1 - fall); y = lerp(spread.y, sy, fall); }
    // Settled flakes twinkle gently.
    const twinkle = fall >= 1 && !o.still && (Math.floor(o.now / 400) + i) % 4 === 0;
    snowflake(ctx, Math.round(x), Math.round(y), !twinkle);
  }
}

function flamingVines(ctx, e, t, o) {
  // Vines like Overgrowth, burning at the tips: orange leaves and flickering flame crowns.
  const n = Math.min(VINES.length, 2 + e.intensity * 2);
  for (let v = 0; v < n; v++) {
    const [x, base] = vineAt(o, v), full = 50 + Math.round(rand(v, 9) * 24), grow = easeOut(clamp01((t - v * 120) / 1800));
    const h = Math.round(full * grow), flick = o.still ? 0 : Math.floor((o.now / 140 + v) % 3);
    for (let y = 0; y < h; y += 2) {
      const dx = Math.floor(y / 6) % 2 ? 1 : 0;
      px(ctx, Q.woodDark, x + dx, base + 10 - y, 2, 2);
      if (y % 8 === 4) px(ctx, y % 16 === 4 ? Q.lava : Q.red, x + dx + (y % 16 === 4 ? 2 : -3), base + 10 - y, 3, 2);
    }
    if (h > 4) {
      const tipX = x + (Math.floor(h / 6) % 2 ? 1 : 0), tipY = base + 10 - h;
      px(ctx, Q.red, tipX - 1, tipY - 3 - flick, 4, 4 + flick);
      px(ctx, Q.lava, tipX, tipY - 2 - flick, 2, 3 + flick);
      px(ctx, Q.yellow, tipX, tipY - 1, 1, 2);
    }
  }
}

function glitterStorm(ctx, e, t, o) {
  if (t >= FX_BEAT) return;
  // Sparkles swirl round the room, then drift down and wink out.
  const n = count(24 + e.intensity * 10, o.reduced), colours = [Q.yellow, Q.white, Q.pink, Q.lilac, Q.sandLit];
  const spin = t / (o.reduced ? 1400 : 600), drop = clamp01((t - 1600) / 1400);
  for (let i = 0; i < n; i++) {
    const r = 30 + rand(i, 13) * 90, ang = rand(i, 17) * Math.PI * 2 + spin * (0.6 + rand(i, 19) * 0.6);
    const x = 160 + Math.cos(ang) * r, y = 70 + Math.sin(ang) * r * 0.45 + drop * (40 + rand(i, 23) * 50);
    if (drop > rand(i, 29) * 1.1 + 0.4) continue;
    const winkle = (Math.floor(t / 90) + i) % 3 === 0;
    px(ctx, colours[i % colours.length], x, y, 2, 2);
    if (winkle && !o.reduced) { px(ctx, Q.white, x - 1, y); px(ctx, Q.white, x + 2, y + 1); }
  }
}

function fireball(ctx, e, t, o) {
  if (t >= 1600) return;
  const p = clamp01(t / 1300), r = 2 + e.intensity;
  const at = s => ({ x: CX + 175 * s, y: SURFACE - 6 - Math.sin(Math.PI * Math.min(1, s * 1.25)) * 62 + s * 6 });
  for (let i = count(8, o.reduced); i >= 1; i--) {
    const s = Math.max(0, p - i * 0.025), q = at(s);
    alpha(ctx, 1 - i / 9, () => disc(ctx, i < 3 ? Q.lava : Q.red, q.x, q.y, Math.max(0, r - i / 2.5)));
  }
  const head = at(p);
  disc(ctx, Q.red, head.x, head.y, r + 1); disc(ctx, Q.lava, head.x, head.y, r); disc(ctx, Q.yellow, head.x - 1, head.y - 1, Math.max(1, r - 2));
  if (t < 200) alpha(ctx, 1 - t / 200, () => disc(ctx, Q.yellow, CX, SURFACE - 4, 6));
}

function iceBurst(ctx, e, t, o) {
  if (t >= FX_BEAT) return;
  const grow = easeOut(clamp01(t / 600)), fade = t > 2300 ? 1 - (t - 2300) / 700 : 1, len = (3 + e.intensity * 2) * grow;
  alpha(ctx, fade, () => {
    const n = count(16, o.reduced);
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, bx = CX + Math.cos(a) * 30, by = 87 + Math.sin(a) * 7;
      const dy = Math.sin(a) < 0 ? -1 : 0.6;
      for (let s = 0; s < len; s++) px(ctx, s < len - 1 ? Q.ice : Q.white, bx + Math.cos(a) * s * 0.4, by + dy * s);
    }
    ring(ctx, Q.white, CX, 87, 30, 7);
    for (let i = 0; i < count(10, o.reduced); i++) {
      const fall = (t / 1800 + rand(i, 2)) % 1;
      px(ctx, Q.white, CX - 34 + rand(i, 9) * 68, 52 + fall * 34);
    }
  });
}

function glow(ctx, e, t, o) {
  if (t >= FX_BEAT) return;
  const fade = t < 300 ? t / 300 : t > 2300 ? 1 - (t - 2300) / 700 : 1;
  const pulse = o.reduced ? 0.12 : 0.1 + 0.06 * Math.sin(t / 180) + e.intensity * 0.02;
  const room = roomOf(o);
  alpha(ctx, pulse * fade, () => px(ctx, Q.yellow, room.x, room.y, room.w, room.h));
  alpha(ctx, fade, () => { ring(ctx, Q.sandLit, 176, 22, 9 + e.intensity + (o.reduced ? 0 : Math.floor(t / 250) % 2)); ring(ctx, Q.yellow, 176, 22, 12 + e.intensity); });
}

function steam(ctx, e, t, o) {
  const n = count(6 + e.intensity * 4, o.reduced);
  for (let i = 0; i < n; i++) {
    const age = t - i * 110;
    if (age < 0 || age > 1900) continue;
    const q = age / 1900, x = CX - 16 + rand(i, 4) * 32 + Math.sin(q * 6 + i) * 4;
    alpha(ctx, 0.8 * (1 - q), () => disc(ctx, i % 2 ? Q.white : Q.snowShade, x, SURFACE - 4 - q * 60, 3 + q * 9));
  }
}

function bubbles(ctx, e, t, o) {
  const n = count(8 + e.intensity * 4, o.reduced);
  for (let i = 0; i < n; i++) {
    const age = t - i * 140;
    if (age < 0 || age > 1800) continue;
    const q = age / 1600, x = CX - 20 + rand(i, 6) * 40 + Math.round(Math.sin(age / 180 + i) * 2);
    if (q < 1) {
      const y = SURFACE - 2 - q * 70, r = 2 + (i % 2);
      ring(ctx, Q.oceanLit, x, y, r); px(ctx, Q.white, x - 1, y - 1);
    } else {
      // Pop!
      const y = SURFACE - 72;
      for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) px(ctx, Q.white, x + dx, y + dy);
    }
  }
}

function smoke(ctx, e, t, o) {
  for (let i = 0; i < count(e.intensity, o.reduced); i++) {
    const age = t - i * 450;
    if (age < 0 || age > 2200) continue;
    const q = age / 2200, r = 6 + q * 14;
    alpha(ctx, 1 - q, () => { ring(ctx, Q.grey, CX, SURFACE - 6 - q * 60, r, r * 0.45); ring(ctx, Q.stoneLit, CX, SURFACE - 7 - q * 60, r - 1, r * 0.45 - 1); });
  }
}

function fizzle(ctx, e, t, o) {
  if (t >= 1200) return;
  for (let i = 0; i < count(6, o.reduced); i++) {
    const age = t - i * 120;
    if (age < 0 || age > 300) continue;
    const x = CX - 14 + rand(i, 8) * 28, y = SURFACE - 1 - age / 60;
    px(ctx, age < 150 ? Q.yellow : Q.white, x, y);
  }
  if (t < 900) alpha(ctx, 0.6 * (1 - t / 900), () => disc(ctx, Q.grey, CX + 4, SURFACE - 6 - t / 60, 2 + t / 300));
}

const DRAW = { potion, pocketUniverse, explosion, thermalShock, temporalRupture, singularity, snowflakeCopies, monstrosity, duplication, overgrowth, flamingVines, fireball, iceBurst, glitterStorm, glow, steam, bubbles, smoke, fizzle };
// Outcomes with a drawn effect; a rule without one (until its effect slice ships) just shows the room.
export const FX_IDS = Object.freeze(['potion', ...LAB_RULES.map(rule => rule.id).filter(id => Object.hasOwn(DRAW, id))]);

/**
 * Draws the active effect over the room. `o`: { t, now, reduced, still, mix, home(id) → {x, y},
 * shift?: { left, centre, right: {x, y} }, room?: {x, y, w, h} }, all in the centre group's
 * logical px; `home` is where an ingredient lives (its jar or bag slot).
 */
export function drawEffect(ctx, effect, o) {
  const fn = effect && DRAW[effect.ruleId];
  if (!fn) return;
  const e = { ...effect, intensity: Math.min(3, Math.max(1, Math.round(Number(effect.intensity) || 1))) };
  fn(ctx, e, o.t, o);
}
