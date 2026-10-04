# Slice 01 — Wider room, edge to edge

**Status:** Approved by Papa 2026-10-04 (`design.md` D1).
**Goal:** The Lab fills the space between the host bar and the dock with no black bars, at a whole-number pixel scale.
**Depends on:** —
**Files:** `js/games/codequest/lab/lab-view.js`, `js/games/codequest/lab/lab-fx.js`, `js/games/codequest/lab/lab-screen.js`, `css/codequest.css`, `scripts/codequest-lab-view.test.mjs`, `sw.js` cache bump.

## Change

- `fitLab(cssW, cssH, dpr)` returns `{ device, dpr, canvasW, canvasH, W, H, ox, oy }`. `device` is computed exactly as today. `W = min(floor(canvasW / device), 480)` and `H = min(floor(canvasH / device), 240)`. `ox, oy` centre the W×H room. `LAB_W`/`LAB_H` stay exported as the core size (320×180) for old callers.
- `labLayout(W, H)` is pure, memoised per size, and returns `{ hits, anchors, groups }`.
  - Groups: left `dx = 0`, centre `dx = floor((W − 320) / 2)`, right `dx = W − 320`. All groups use `dy = H − 180`.
  - Every hit keeps its id, kind, ingredient and step.
  - At 320×180 the result equals today's `LAYOUT` exactly (regression test).
- Drawing:
  - Each draw function takes its group offset.
  - Wall bricks and bench planks tile the full W×H. The shelf, cat and scroll move with the right group.
  - Extra height above the core gets a ceiling beam (`drawBeam`).
  - Margins beyond the caps are painted as wall (top part) and bench (bottom part), never `Q.deep`.
- `lab-fx.js`:
  - Replace these constants with `o.anchors.*` from `labLayout`: `CX`, `SURFACE`, `ORB`, `COPY_SPOTS`, `VINES`, `FLAKE_SPOTS`, `monstrosity`'s landing spot and the glitter centre.
  - `drawEffect` gets `anchors` in `o`.
  - At 320×180 every anchor equals the old constant.
- `drawLab` returns `{ hits, fit, anchors }`. `homeOf` reads the layout.
- CSS: `.cq-lab` gap 0. `.cq-lab-scene` has no border, no radius and `min-height: 0`. The dock keeps its look.

## DONE WHEN

- `labLayout(320, 180)` equals the old layout.
- Room-size matrix test. Room sizes: {320×180, 381×189, 400×200, 423×210, 455×186, 480×220, 480×240}. Stages: the existing `STAGES` plus {1014×440@1, 1270×630@1, 1270×630@1.5, 1356×560@1}. For every room size and every stage:
  - all ids are present
  - no hits overlap
  - every hit is ≥ 48 CSS px
  - every hit is inside the canvas
  - fills are palette-only
  - on each axis, canvas minus room is less than one device step, or the room is exactly at the cap
- Every effect id draws palette-only at 320×180 and 480×240, with anchors in range.
- Manual check at 1280×800 and 1024×600: no black bars, no page scroll; owl, cauldron and shelf all in place.
- `node scripts/check.mjs` green.

## Implementation notes (2026-10-04)

- **Groups by transform, not new coordinates.** Each hit carries its `group`; every draw function keeps its core 320×180 coordinates and `drawLab` sets the group's offset on the canvas transform before calling it. `labLayout(W, H)` returns `{ W, H, groups, hits, at }`; at 320×180 the hits are the old layout (tested).
- **Effects** draw in the centre group's frame (the cauldron's), so `CX`, `SURFACE`, the orb, copy and flake spots keep their constants. `drawEffect` gets `o.shift` (left / right group offsets from the centre) and `o.room` (the whole room) instead of a named anchor list: the owl soot uses `shift.left`, the vines carry a group per root, the explosion flash and Glow fill `room`, and `home(id)` is converted into the centre frame. Without them (old callers) the room is the core and every shift is 0.
- **Past the caps** (e.g. 1280×600 → 2×, room 480×220 inside a 625-px-wide box) wall bricks, the ceiling beam and bench planks are painted across the whole canvas (`paint` rect in room px), and the soft dark frame sits at the canvas edge, so there are no bands at all, not just no black.
- **Ceiling beam** appears once the room is ≥ 4 px taller than the core.
- **CSS:** `.cq-lab` gap 0, `.cq-lab-scene` without border or radius. `min-height: 300px` stays: the stage has no definite height on desktop, and the scene's canvas is absolutely positioned, so `min-height: 0` would collapse it.
- **Tests:** 3 new (fit examples and the < 1 device step rule over 8 stages; layout matrix over 7 room sizes — ids, ≥ 24 logical px, inside, no overlap, pinning; the backdrop is never `Q.deep`), plus every effect palette-only in a 320×180 and a 480×240 room. 15 in `codequest-lab-view.test.mjs`.
- **Harness:** `check-codequest-lab-ui.py` now also runs 1024×600 and 1366×768 (pulled forward from slice 06): green at all 4 sizes, no page or console errors. Screenshots `test-results/codequest-lab/harness-*-{1280x800,1280x600,1024x600,1366x768}.png`.
- `dist/android-web` rebuilt (`node scripts/build-android-web.mjs`) so the payload verifier in `check.mjs` matches source. `sw.js` cache `summer-quest-v159-lab-feel-01`.
