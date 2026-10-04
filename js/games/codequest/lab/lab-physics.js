/* Laboratory of Curiosity: gravity, then home (lab-feel D5). An ingredient dragged and let
   go on nothing keeps its throw, falls onto the bench, slides to a stop, rests a moment and
   floats back to its jar or bag slot. Pure: logical room px and seconds, no DOM, every
   step returns new frozen bodies and never mutates its input. A body's (x, y) is the
   bottom-centre of the ingredient; `ground` is where its bottom comes to rest. */

export const PHYS = Object.freeze({
  g: 500,            // px/s² downward
  maxFall: 200,      // px/s
  maxThrow: 400,     // px/s, release speed cap
  friction: 0.92,    // per 1/60 s on the bench, frame-rate independent
  restitution: 0.4,  // bounce off the room's sides
  restSpeed: 5,      // px/s: slower than this is at rest
  restMs: 600,       // at rest this long, then it goes home
  homeMs: 500,       // the arc home
  sparkMs: 400,      // the sparkle as it lands home
  fadeMs: 200,       // reduced motion: fade out, then fade in at home
  lift: 34,          // px the arc home rises
  held: 12,          // px a held ingredient floats above where it will land
  radius: 6,         // px, half an ingredient's width, for the side walls
  max: 15
});
// Exact decay rate of the bench friction (0.92 per 60th of a second).
const DECAY = -60 * Math.log(PHYS.friction);
const ease = k => 1 - (1 - k) * (1 - k);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * A body for an ingredient let go at (x, y) with velocity (vx, vy) (px/s). `world`:
 * { x0, x1, top, benchTop, floor }. It lands at the release height when that is on the
 * bench, else on the bench's back edge; it starts `held` px above that, as if dropped
 * from the hand. `reduced` swaps the fall for a fade.
 */
export function createBody({ key, x, y, vx = 0, vy = 0, home = null, reduced = false }, world) {
  const speed = Math.hypot(vx, vy), k = speed > PHYS.maxThrow ? PHYS.maxThrow / speed : 1;
  const ground = clamp(Math.max(Number(y) || 0, world.benchTop + 4), world.benchTop + 4, world.floor);
  return Object.freeze({
    key: String(key), home: home ? Object.freeze({ x: home.x, y: home.y }) : null,
    x: clamp(Number(x) || 0, world.x0 + PHYS.radius, world.x1 - PHYS.radius),
    y: Math.min(Number(y) || 0, ground) - PHYS.held, vx: (Number(vx) || 0) * k, vy: (Number(vy) || 0) * k,
    ground, phase: reduced ? 'fadeOut' : 'fall', rest: 0, t: 0, from: null
  });
}

/** Adds a body, keeping at most PHYS.max in play: past that the oldest jumps straight home (a sparkle there). */
export function addBody(bodies, body) {
  const list = [...(bodies || []), body];
  let active = list.filter(b => b.phase !== 'spark').length;
  return Object.freeze(list.map(b => {
    if (active <= PHYS.max || b.phase === 'spark' || b === body) return b;
    active--;
    return Object.freeze({ ...b, phase: 'spark', t: 0, vx: 0, vy: 0, ...(b.home ? { x: b.home.x, y: b.home.y } : {}) });
  }));
}

function homeward(b) {
  return { ...b, phase: b.home ? 'home' : 'spark', t: 0, vx: 0, vy: 0, from: Object.freeze({ x: b.x, y: b.y }) };
}

/** One step of `dt` seconds (clamped to 50 ms). Bodies that finish their trip home are dropped. */
export function stepBodies(bodies, dt, world) {
  const d = clamp(Number(dt) || 0, 0, 0.05), ms = d * 1000, out = [];
  for (const body of bodies || []) {
    let b = { ...body };
    if (b.phase === 'fall' || b.phase === 'slide') {
      if (b.phase === 'fall') {
        const vy = Math.min(b.vy + PHYS.g * d, PHYS.maxFall);
        b.y += (b.vy + vy) / 2 * d;
        b.vy = vy;
        if (b.y < world.top) { b.y = world.top; b.vy = Math.max(0, b.vy); }
        if (b.y >= b.ground) { b.y = b.ground; b.vy = 0; b.phase = 'slide'; }
        b.x += b.vx * d;
      } else {
        // Exact exponential friction: the same slide at 20 fps and at 60 fps.
        const decay = Math.exp(-DECAY * d);
        b.x += b.vx * (1 - decay) / DECAY;
        b.vx *= decay;
      }
      const lo = world.x0 + PHYS.radius, hi = world.x1 - PHYS.radius;
      if (b.x < lo) { b.x = lo; b.vx = Math.abs(b.vx) * PHYS.restitution; }
      if (b.x > hi) { b.x = hi; b.vx = -Math.abs(b.vx) * PHYS.restitution; }
      if (b.phase === 'slide') {
        if (Math.abs(b.vx) < PHYS.restSpeed) { b.vx = 0; b.rest += ms; } else b.rest = 0;
        if (b.rest >= PHYS.restMs) b = homeward(b);
      }
    } else if (b.phase === 'home') {
      b.t += ms;
      const k = ease(clamp(b.t / PHYS.homeMs, 0, 1));
      b.x = b.from.x + (b.home.x - b.from.x) * k;
      b.y = b.from.y + (b.home.y - b.from.y) * k - Math.sin(Math.PI * k) * PHYS.lift;
      if (b.t >= PHYS.homeMs) b = { ...b, phase: 'spark', t: 0, x: b.home.x, y: b.home.y };
    } else if (b.phase === 'spark') {
      b.t += ms;
      if (b.t >= PHYS.sparkMs) continue;
    } else if (b.phase === 'fadeOut') {
      b.t += ms;
      if (b.t >= PHYS.fadeMs) b = b.home ? { ...b, phase: 'fadeIn', t: 0, x: b.home.x, y: b.home.y } : { ...b, phase: 'spark', t: PHYS.sparkMs };
    } else if (b.phase === 'fadeIn') {
      b.t += ms;
      if (b.t >= PHYS.fadeMs) continue;
    } else continue;
    out.push(Object.freeze(b));
  }
  return Object.freeze(out);
}

/** How a body looks this frame: alpha (fades), and its shadow's size (1 at rest, ~0.4 high up). */
export function bodyLook(b) {
  const height = Math.max(0, b.ground - b.y);
  const shadow = b.phase === 'home' || b.phase === 'spark' || b.phase === 'fadeIn' ? 0 : clamp(1 - height / 60, 0.4, 1);
  const alpha = b.phase === 'fadeOut' ? 1 - b.t / PHYS.fadeMs : b.phase === 'fadeIn' ? b.t / PHYS.fadeMs : b.phase === 'spark' ? 0 : 1;
  return { alpha: clamp(alpha, 0, 1), shadow };
}
