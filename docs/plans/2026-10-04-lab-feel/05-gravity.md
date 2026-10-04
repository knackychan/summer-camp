# Slice 05 — Gravity, then home

**Status:** Approved by Papa 2026-10-04 (`design.md` D5).
**Goal:** An ingredient dragged and let go on nothing falls, lands on the bench with a shadow, slides to a stop, then floats back to its jar.
**Depends on:** 01 (needs `anchors.benchTop` and the room size). Independent of 02–04.
**Files:** `js/games/codequest/lab/lab-physics.js` (new), `js/games/codequest/lab/lab-view.js`, `js/games/codequest/lab/lab-screen.js`, `scripts/codequest-lab-physics.test.mjs` (new), `scripts/check.mjs` (only if test discovery needs it), `sw.js` cache bump.

## Change

- **`lab-physics.js`** (pure; logical px and seconds):
  - Constants: `PHYS = { g: 500, maxFall: 200, maxThrow: 400, friction: 0.92, restitution: 0.4, restSpeed: 5, restMs: 600, homeMs: 500, max: 15 }`.
  - `createBody({ key, x, y, vx, vy, home, now })` returns `{ key, x, y, vx, vy, phase: 'fall', home, … }`, with the throw velocity clamped to `maxThrow`.
  - `stepBodies(bodies, dt, world)` takes world `{ W, benchTop, floorAt(y0) }` and clamps `dt` to ≤ 50 ms. It returns a new array and never mutates its inputs. The phases:
    1. `fall`: Euler step with `vy = min(vy + g·dt, maxFall)`. Ground is `max(releaseY, benchTop)`. On landing, `vy = 0` and the phase becomes `slide`.
    2. `slide`: `vx *= friction ** (dt·60)`. The sides clamp, bouncing with `restitution`. Once at rest (`|vx| < restSpeed`) for `restMs`, the phase becomes `home`.
    3. `home`: an eased arc back to `home`, lifting 34 px, over `homeMs`. Then the body is removed.
  - `addBody(bodies, body)` keeps at most `max` bodies. When full, the oldest is sent `home` with 0 time left.
- **Screen:**
  - pointermove keeps the pointer samples from the last ~80 ms.
  - A release on nothing creates a body. "Nothing" means no target after `hitNear` from slice 04, if that slice has shipped. The body:
    - starts at the release point, converted to logical px
    - takes the sample velocity
    - has `key` = the held form and `home` = `homeOf(id)`
  - The selection clears, as today.
  - Bodies live in screen state, not in the pure experiment state.
  - The scheduler draws every frame while any body exists or a drag is active; otherwise it keeps the 48 ms throttle.
- **View:**
  - `drawLab` takes a `bodies` option and draws each body with `drawForm` in its state.
  - Each body has a shadow on the bench at `ground`. Width and alpha scale with its height above ground: 40 % and faint when lifted, 100 % at rest.
  - The drag ghost also gets a faint shadow at `benchTop` under the pointer.
  - Landing home shows the 6-px sparkle ring already used by Temporal Rupture.
- **Reduced motion:** no fall. The body fades out over 200 ms where it was released and fades in at home.

## DONE WHEN

- Physics tests:
  - a body falls and accelerates
  - fall speed is capped
  - it lands at ground and never goes below it
  - the sides clamp and bounce
  - friction stops it within 2 s, at both 60 fps and 20 fps (frame-rate independent within 5 %)
  - it goes home after resting and is removed
  - the 15-body cap holds
  - the functions are pure (inputs unchanged)
- Screen tests:
  - a drag released on nothing makes exactly one body, carrying the held form
  - a drag released on a target makes none
  - a tap-deselect makes none
- Manual check at 1280×800:
  - fling a mushroom up and to the right → it arcs, lands, slides and returns to its jar
  - 15 quick flings stay smooth (no frame > 33 ms in the harness trace)
- `node scripts/check.mjs` green.
