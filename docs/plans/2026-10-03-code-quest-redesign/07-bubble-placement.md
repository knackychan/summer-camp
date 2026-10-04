# Slice 07 — Speech bubble placement (U1, U2)

**Status:** Approved by Papa 2026-10-04 (`design-ux-polish.md`).
**Goal:** The bubble never covers the HUD or the hero, and it avoids the parts of the room the puzzle depends on.
**Depends on:** 03 (shipped). Browser checks extend 06's `scripts/check-codequest-ui.py`.
**Files:** new `js/games/codequest/bubble.js`, `js/games/codequest.js` (`placeBubble`), `js/games/codequest/room-view.js` (extra anchors only), `css/codequest.css`, `sw.js` APP_SHELL + cache bump, `scripts/codequest-renderer.test.mjs`.

## Change

- `bubble.js`: `placeBubbleRect({ box, size, head, feet, hard, soft, previous })` → `{ x, y, side, tail }`. Pure; all rects are in CSS px relative to the scene.
  - Candidates, in preference order: `above` (bottom edge 12 px over the head), `right`, `left` (vertically centred on the hero), `below` (top edge 8 px under the feet — measured from the anchors, not the old fixed `+56`).
  - Hard rects, which disqualify a candidate: the goal pill, `.cq-vitals`, the open `.cq-goal-pop`, a visible `.cq-debug-toggle` / `.cq-debug`, and the scene inset by 8 px. The hero's own sprite box is hard too.
  - Soft rects, scored by overlap area: the tile ahead of the hero, plus enemy, chest, key, exit and preview-path tiles.
  - Stickiness: if `previous.side` is still hard-clear and its soft score is within 10 % of the best, it stays.
  - If every side collides, return `side: 'caption'`: centred on the scene's bottom edge, no tail.
- `room-view.js`: also return anchors for `exit` and for the tile ahead of the hero (`hero-ahead`), plus `heroBox` (CSS px). Drawing does not change.
- `codequest.js`: `placeBubble()` collects the hard rects with `getBoundingClientRect` (relative to the scene box) and the soft rects from the anchors, calls `placeBubbleRect`, keeps `S.bubbleSide`, and toggles the `.below` / `.side-left` / `.side-right` / `.caption` classes.
- CSS: tail variants for the left and right sides; `.caption` hides the tail. The bubble keeps `pointer-events:none`, its border and its shadow.

## DONE WHEN

- Unit tests (`codequest-renderer.test.mjs`): the hero at the top row picks a side or `below`, never `above` into the HUD; the hero in a corner with the debug panel open never intersects a hard rect; when everything collides the result is `caption`, inside the scene; the side stays put across a one-tile move when it is still valid.
- Browser (`check-codequest-ui.py`) at 1280×600 and 1280×800: for every authored level, trigger a notice at room start and after one Step. Each time the bubble rect sits inside the scene and intersects none of goal pill / vitals / debug toggle / hero box.
- `node scripts/check.mjs` and `node scripts/codequest.test.mjs` green.

## Implementation notes (2026-10-04)

- `scripts/check-codequest-ui.py` is started here (bubble checks only); slice 06 adds its layout / q01 / language / sheet checks to the same file.
- The caption fallback tries bottom-centre, bottom-left, bottom-right, then the same along the top, and takes the first spot clear of the hard rects.
- `snapshot()` exposes `bubbleSide` and `heroBox` for the harness.
- Harness result: all 72 rooms at 1280×800 and 1280×600, at room start and again with the goal popover + debug panel open — bubble inside the scene and clear of HUD, debug and hero every time.
- Seen while testing (slice 09 material): at dpr 1 on 1280×600 the whole-room fit floors to 2× (32 CSS px tiles), leaving the room much smaller than the stage.
- The signature takes `hero: { box }` (the sprite box from `drawRoom`) rather than separate head / feet points; `drawRoom` returns `heroBox` plus `focus` rects (tile ahead, exit, live enemies, closed chests, keys, preview path).
- The second probe per room is Reset with the goal popover and debug panel open, rather than a Step, because it stresses more hard rects.
