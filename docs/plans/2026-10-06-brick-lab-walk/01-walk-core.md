# Slice 01 — The walk module

**Requested by Papa, 2026-10-06.** Implements the maths of design.md W2, W3, W4, W6, W9.

**Depends on:** brick-lab-kid-camera slice 01 (`brick-camera.js`, for its maths style); brick-lab-moving-parts slices 01–03 (jointed minifigs).

## Changes
- `js/brick-lab/brick-walk.js` (new). Pure: no DOM, no Three.
  - `solids(pieces, partsById, walkerIds)` — footprint boxes `{ minX, maxX, minZ, maxZ, bottom, top }` from `pieceBounds`-style maths, leaving out the walker and its riders.
  - `groundUnder(x, z, solids)` — the highest top under a 1×1 column at (x, z), or 0 (the baseplate).
  - `step(state, input, dt, solids, limits)` — moves `{ x, z, y, vy, yaw }` by joystick input `{ forward, strafe, jump }` and look yaw: walk speed up to 4 studs/s, auto step-up ≤ 1.25, jump to 2.5, gravity fall, walls block per axis (slide along them), clamp to the island. Returns the new state and `moving: boolean`.
  - `ridersOf(walkerId, pieces, partsById)` — ids of pieces resting on the walker, and on those, transitively.
  - `snapOut(state)` — nearest stud x/z, nearest 90° rotation (W2); landing height is left to `landing()`.
  - `inReach(walker, point, reach = 8)` — horizontal distance test (W9).
  - `behindCamera(state, look, obstacles)` and `eyesCamera(state, look)` — camera position and target for W4; behind pulls in when a solid box is between head and camera.
- `scripts/brick-walk.test.mjs` (new) — node test: flat walk, step up a plate and a brick, wall at 2 bricks, jump onto 2 bricks but not 3, falls off a ledge, stops at island edge, slides along a wall, riders found (hat, brick on a hat), snapOut rounds, reach, behind camera pulls in behind a wall.
- `scripts/check.mjs` runs the new test.
- `sw.js` — `brick-walk.js` precached; cache bumped.

**DONE WHEN:** `node scripts/check.mjs` green and runs `brick-walk.test.mjs`.

**Shipped 2026-10-06:** `js/brick-lab/brick-walk.js` + `scripts/brick-walk.test.mjs` (21 tests: stick directions, step up a plate and a brick, two bricks a wall, jump onto two but not three, peak 2.5, ceiling, walking under a high roof, ledge fall, island edge, wall slide, long-frame cut, riders (hat and a brick on it, not a roof or a neighbour), snapOut, reach, look clamp, behind view and its pull-in, eyes view). `check.mjs` already globs `scripts/*.test.mjs`, so no change there; green after `npm run build:android-web` refreshed the local payload for the new file. `sw.js` precaches it, cache `v179-brick-walk-core`. Nothing imports the module yet (slice 02). Convention noted in the module: yaw = Three's `rotation.y`, so yaw 0 faces +z, like a piece's `rotation`.
