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
