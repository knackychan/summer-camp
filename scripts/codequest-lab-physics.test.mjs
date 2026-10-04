import test from 'node:test';
import assert from 'node:assert/strict';
import { PHYS, createBody, addBody, stepBodies, bodyLook } from '../js/games/codequest/lab/lab-physics.js';

const WORLD = Object.freeze({ x0: 0, x1: 400, top: 0, benchTop: 140, floor: 196 });
const HOME = { x: 330, y: 60 };
const run = (bodies, seconds, fps = 60) => {
  let out = bodies;
  for (let i = 0; i < Math.round(seconds * fps); i++) out = stepBodies(out, 1 / fps, WORLD);
  return out;
};
const one = extra => [createBody({ key: 'redMushroom', x: 200, y: 60, home: HOME, ...extra }, WORLD)];

test('a dropped ingredient falls faster and faster, never past the fall cap, and lands on the bench', () => {
  let bodies = one(), last = bodies[0].y, lastV = 0;
  assert.equal(bodies[0].phase, 'fall');
  assert.equal(bodies[0].ground, WORLD.benchTop + 4, 'let go over the wall: it lands on the bench edge');
  for (let i = 0; i < 20; i++) {
    bodies = stepBodies(bodies, 1 / 60, WORLD);
    const b = bodies[0];
    if (b.phase !== 'fall') break;
    assert.ok(b.y > last && b.vy >= lastV && b.vy <= PHYS.maxFall, 'accelerates down, capped');
    last = b.y; lastV = b.vy;
  }
  bodies = run(bodies, 1.2);
  assert.ok(bodies[0].y <= bodies[0].ground, 'never below the bench');
  const onBench = createBody({ key: 'x', x: 100, y: 170 }, WORLD);
  assert.equal(onBench.ground, 170, 'let go over the bench: it lands where it was let go');
  assert.equal(onBench.y, 170 - PHYS.held, 'from just above, like a dropped thing');
  assert.equal(createBody({ key: 'x', x: 100, y: 999 }, WORLD).ground, WORLD.floor, 'never below the floor');
});

test('throws are capped, the sides bounce, and friction stops it the same at 60 fps and 20 fps', () => {
  const fast = createBody({ key: 'x', x: 200, y: 170, vx: 3000, vy: -3000 }, WORLD);
  assert.ok(Math.hypot(fast.vx, fast.vy) <= PHYS.maxThrow + 1e-9);
  let wall = [createBody({ key: 'x', x: 390, y: 170, vx: 400 }, WORLD)];
  wall = stepBodies(wall, 0.05, WORLD);
  for (let i = 0; i < 10; i++) wall = stepBodies(wall, 0.05, WORLD);
  assert.ok(wall[0].x <= WORLD.x1 - PHYS.radius, 'kept inside the room');
  const slide = fps => {
    let b = [createBody({ key: 'x', x: 50, y: 170, vx: 300 }, WORLD)], t = 0;
    while (b.length && (b[0].phase === 'fall' || b[0].phase === 'slide') && t < 4) { b = stepBodies(b, 1 / fps, WORLD); t += 1 / fps; }
    return { x: b[0].from.x, t };
  };
  const at60 = slide(60), at20 = slide(20);
  assert.ok(Math.abs(at60.x - at20.x) / (at60.x - 50) < 0.05, `same slide: ${at60.x} vs ${at20.x}`);
  assert.ok(at60.t < 2 + PHYS.restMs / 1000 + 0.3, 'stops within 2 s, then rests');
});

test('at rest it goes home along an arc, sparkles, and is gone', () => {
  let bodies = one();
  const phases = new Set();
  for (let i = 0; i < 300 && bodies.length; i++) { bodies = stepBodies(bodies, 1 / 60, WORLD); if (bodies[0]) phases.add(bodies[0].phase); }
  assert.deepEqual([...phases], ['fall', 'slide', 'home', 'spark']);
  assert.equal(bodies.length, 0, 'removed after the sparkle');
  let mid = one();
  while (mid[0].phase !== 'home') mid = stepBodies(mid, 1 / 60, WORLD);
  mid = run(mid, PHYS.homeMs / 2000);
  assert.ok(mid[0].y < Math.min(mid[0].from.y, HOME.y), 'the trip home rises in an arc');
});

test('reduced motion: no fall — it fades out where it was let go and in at home', () => {
  let bodies = one({ reduced: true });
  assert.equal(bodies[0].phase, 'fadeOut');
  bodies = run(bodies, PHYS.fadeMs / 1000 + 0.08);
  assert.equal(bodies[0].phase, 'fadeIn');
  assert.deepEqual([bodies[0].x, bodies[0].y], [HOME.x, HOME.y]);
  assert.ok(bodyLook(bodies[0]).alpha > 0 && bodyLook(bodies[0]).alpha < 1);
  assert.equal(run(bodies, 0.5).length, 0);
});

test('at most 15 in play: the oldest jumps home; steps are pure', () => {
  let bodies = [];
  for (let i = 0; i < 17; i++) bodies = addBody(bodies, createBody({ key: 'k' + i, x: 20 + i * 10, y: 170, home: HOME }, WORLD));
  assert.equal(bodies.filter(b => b.phase !== 'spark').length, PHYS.max);
  assert.deepEqual(bodies.filter(b => b.phase === 'spark').map(b => b.key), ['k0', 'k1']);
  const before = JSON.stringify(bodies);
  stepBodies(bodies, 1 / 60, WORLD);
  assert.equal(JSON.stringify(bodies), before, 'stepBodies never mutates its input');
  assert.ok(Object.isFrozen(stepBodies(bodies, 1 / 60, WORLD)[0]));
  const look = bodyLook(createBody({ key: 'x', x: 50, y: 60 }, WORLD));
  assert.ok(look.shadow < 1 && look.shadow >= 0.4, 'a high body has a small shadow');
});
