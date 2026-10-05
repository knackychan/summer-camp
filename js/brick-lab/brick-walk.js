/* Walking a minifig on the island (docs/plans/2026-10-06-brick-lab-walk/
   design.md W2, W3, W4, W6, W9; slice 01). Pure: no DOM, no Three.

   Units are the lab's: 1 stud = 1, a brick 1.2 tall, the baseplate top at
   y = 0. A box is { minX, maxX, minZ, maxZ, minY, maxY }, the lab's
   pieceBounds. Yaw is Three's rotation.y: yaw 0 faces +z, so a piece's
   rotation (in degrees) and the walker's yaw are the same angle. Pitch is
   how far the look tips down; negative looks up.

   The walker is a 1×1 column WALKER.height tall standing at (x, y, z), y its
   feet. Every piece is a solid box: no physics library (W6). */

export const WALKER = Object.freeze({ radius: 0.5, height: 4.0, eye: 3.5, head: 3.4 });
export const MOVE = Object.freeze({
  speed: 4,      /* studs a second at full stick (W5) */
  stepUp: 1.25,  /* a plate or a brick, by itself (W6) */
  airStep: 0.15, /* what a foot catches mid-air */
  jump: 2.5,     /* two bricks (W6) */
  gravity: 30,
  maxFall: 15,
  maxDt: 0.05,
});
export const REACH = 8; /* studs across the ground (W9) */
export const LOOK = Object.freeze({ maxPitch: Math.PI / 3 });
export const BEHIND = Object.freeze({ back: 8, up: 4, fov: 60, nearest: 1.5, minTilt: 5 * Math.PI / 180, maxTilt: 70 * Math.PI / 180 });
export const EYES = Object.freeze({ fov: 75 });

const EPS = 1e-6;
const PAD = 0.04;
const RIDE = Object.freeze({ above: 0.05, gap: 0.06, overhang: 0.5 });
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/* Does a box overlap the walker's column at (x, z)? */
function underColumn(b, x, z) {
  const r = WALKER.radius;
  return b.minX < x + r - PAD && b.maxX > x - r + PAD && b.minZ < z + r - PAD && b.maxZ > z - r + PAD;
}

/* The boxes the walker bumps into: every piece but those in `skip` (itself, its riders). */
export function solids(pieces, boxOf, skip = new Set()) {
  const out = [];
  for (const [id, piece] of pieces) if (!skip.has(id)) out.push(boxOf(piece));
  return out;
}

/* The highest top under the column at (x, z) no higher than `limit`; 0 is the baseplate. */
export function groundUnder(x, z, boxes, limit = Infinity) {
  let top = 0;
  for (const b of boxes) if (b.maxY <= limit + EPS && b.maxY > top && underColumn(b, x, z)) top = b.maxY;
  return top;
}

/* Can the column stand at (x, z), coming from height y and climbing at most `reach`? */
function fits(x, z, y, reach, boxes) {
  const floor = Math.max(y, groundUnder(x, z, boxes, y + reach));
  return !boxes.some((b) => underColumn(b, x, z) && b.maxY > y + reach + EPS && b.minY < floor + WALKER.height - EPS);
}

/* One frame. `state` is { x, y, z, vy, yaw, grounded }; `input` is
   { forward, strafe, jump, yaw }: the stick (−1…1) and the look yaw it walks
   along. Walls are tried one axis at a time, so pushing into one slides
   along it. Returns the next state plus `moving`. */
export function step(state, input, dt, boxes, half) {
  dt = clamp(dt, 0, MOVE.maxDt);
  let { x, y, z, vy, yaw } = state;
  const reach = state.grounded ? MOVE.stepUp : MOVE.airStep;
  const f = clamp(input.forward || 0, -1, 1);
  const s = clamp(input.strafe || 0, -1, 1);
  const len = Math.hypot(f, s);
  if (len > 0.05) {
    const look = input.yaw || 0;
    const dx = (f * Math.sin(look) - s * Math.cos(look)) / len;
    const dz = (f * Math.cos(look) + s * Math.sin(look)) / len;
    const dist = MOVE.speed * Math.min(1, len) * dt;
    const edge = half - WALKER.radius;
    const nx = clamp(x + dx * dist, -edge, edge);
    if (fits(nx, z, y, reach, boxes)) x = nx;
    const nz = clamp(z + dz * dist, -edge, edge);
    if (fits(x, nz, y, reach, boxes)) z = nz;
    yaw = Math.atan2(dx, dz);
  }
  const floor = groundUnder(x, z, boxes, y + reach);
  if (state.grounded && floor > y) y = floor;
  if (input.jump && state.grounded) vy = Math.sqrt(2 * MOVE.gravity * MOVE.jump);
  let ny = y + vy * dt - MOVE.gravity * dt * dt / 2;
  vy = Math.max(-MOVE.maxFall, vy - MOVE.gravity * dt);
  if (ny > y) {
    for (const b of boxes) {
      if (underColumn(b, x, z) && b.minY >= y + WALKER.height - EPS && b.minY < ny + WALKER.height) {
        ny = b.minY - WALKER.height;
        vy = 0;
      }
    }
  }
  let grounded = false;
  if (ny <= floor) { ny = floor; vy = 0; grounded = true; }
  return { x, y: ny, z, vy, yaw, grounded, moving: x !== state.x || z !== state.z };
}

/* Ids of the pieces riding on `id` (a hat, a brick on the hat…): resting on
   it, and no wider than it plus half a stud, so a roof it touches stays (W3). */
export function ridersOf(id, pieces, boxOf) {
  const out = new Set();
  const queue = [id];
  while (queue.length) {
    const base = boxOf(pieces.get(queue.shift()));
    for (const [other, piece] of pieces) {
      if (other === id || out.has(other)) continue;
      const b = boxOf(piece);
      const rests = b.minY > base.minY + RIDE.above && b.minY <= base.maxY + RIDE.gap;
      const within = b.minX >= base.minX - RIDE.overhang && b.maxX <= base.maxX + RIDE.overhang
        && b.minZ >= base.minZ - RIDE.overhang && b.maxZ <= base.maxZ + RIDE.overhang;
      if (rests && within) { out.add(other); queue.push(other); }
    }
  }
  return out;
}

/* Leaving: the facing turns to the nearest 90° (W2). x and z go to the lab's
   landing(), which snaps them to the studs for the part's footprint. */
export function snapOut(state) {
  const deg = state.yaw * 180 / Math.PI;
  return { x: state.x, z: state.z, rotation: ((Math.round(deg / 90) * 90) % 360 + 360) % 360 };
}

export function inReach(walker, point, reach = REACH) {
  return Math.hypot(point.x - walker.x, point.z - walker.z) <= reach + EPS;
}

export function clampLook(look) {
  return { yaw: look.yaw, pitch: clamp(look.pitch, -LOOK.maxPitch, LOOK.maxPitch) };
}

function lookDir(yaw, pitch) {
  return { x: Math.sin(yaw) * Math.cos(pitch), y: -Math.sin(pitch), z: Math.cos(yaw) * Math.cos(pitch) };
}

/* Distance along a ray to a box, or Infinity (slab test). */
function rayBox(o, d, b) {
  let nearT = 0;
  let farT = Infinity;
  for (const [axis, lo, hi] of [["x", b.minX, b.maxX], ["y", b.minY, b.maxY], ["z", b.minZ, b.maxZ]]) {
    if (Math.abs(d[axis]) < EPS) {
      if (o[axis] < lo || o[axis] > hi) return Infinity;
      continue;
    }
    let t1 = (lo - o[axis]) / d[axis];
    let t2 = (hi - o[axis]) / d[axis];
    if (t1 > t2) [t1, t2] = [t2, t1];
    nearT = Math.max(nearT, t1);
    farT = Math.min(farT, t2);
    if (nearT > farT) return Infinity;
  }
  return nearT;
}

/* Behind view (W4): BEHIND.back studs back and BEHIND.up up from the head at
   level look, tipping with the look's pitch; pulled in in front of a piece
   in the way. `boxes` leaves out the walker and its riders. */
export function behindCamera(state, look, boxes) {
  const tilt = clamp(look.pitch + Math.atan2(BEHIND.up, BEHIND.back), BEHIND.minTilt, BEHIND.maxTilt);
  const target = { x: state.x, y: state.y + WALKER.head, z: state.z };
  const dir = lookDir(look.yaw, tilt);
  const back = { x: -dir.x, y: -dir.y, z: -dir.z };
  let dist = Math.hypot(BEHIND.back, BEHIND.up);
  const hit = Math.min(...boxes.map((b) => rayBox(target, back, b)));
  if (hit < dist) dist = Math.max(BEHIND.nearest, hit - 0.3);
  return {
    position: { x: target.x + back.x * dist, y: target.y + back.y * dist, z: target.z + back.z * dist },
    target,
    fov: BEHIND.fov,
  };
}

/* Eyes view (W4): at the minifig's eyes, looking along the look. */
export function eyesCamera(state, look) {
  const position = { x: state.x, y: state.y + WALKER.eye, z: state.z };
  const dir = lookDir(look.yaw, look.pitch);
  return { position, target: { x: position.x + dir.x, y: position.y + dir.y, z: position.z + dir.z }, fov: EYES.fov };
}
