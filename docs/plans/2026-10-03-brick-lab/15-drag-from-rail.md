# Slice 15 — Drag a part from the rail onto the plate

**Requested by Papa, 2026-10-04** (picked from the follow-ups to slice 13). Amends design.md with D27.

**Depends on:** 12.

## Decision

| # | Decision | Rationale |
|---|---|---|
| D27 | **Press a part and slide it sideways out of the rail; let go on the plate to place it.** A slide counts as a drag once it travels 10 px (`DRAG_START`) and is more sideways than up/down (by 1.2×). The tile then captures the pointer, the part is armed (info card closed), the hint reads "Let go where the piece should go. 拖到想放的地方再放手。", and the ghost follows the finger over the plate with the usual snapping, stacking and rail-join guide. Letting go over the plate runs the same placement as a tap there (blocked rails refused, recents updated, piece selected). Letting go over the rail leaves the part armed, as after a tap. A mostly vertical slide still scrolls the rail: tiles are `touch-action: pan-y`. Tap-to-arm and tap-to-place are unchanged; the click that ends a drag is not taken as a tap. | Picking a brick up and putting it down is what playing with bricks feels like. Reusing the tap's placement and the hover ghost means one placement path, not two. |

## Changes
- `js/brick-lab/brick-lab.js` — `bindTrayDrag()` (pointer down / move / up / cancel on the parts grid), `ghostAt()` split out of `onPointerMove()` and shared, `HINTS.dragDrop` (EN + 中文), `snapshot().render.trayDrag`.
- `css/brick-lab.css` — `.sqbl-part{touch-action:pan-y}`.
- `scripts/check-brick-lab-ui.py` — a sideways drag arms the part and the ghost follows; letting go over the plate places it with no info card; letting go over the rail leaves it armed and places nothing; a vertical slide is not a drag.

**DONE WHEN:** `node scripts/check.mjs` green; `check-brick-lab-ui.py` passes; `check-android8-ui.py` with Chrome 138 passes; tried with a finger on a real tablet (touch scroll vs. drag).

**Verified 2026-10-04:** `check.mjs` green; `check-brick-lab-ui.py` 82/82 (Edge headless, SwiftShader, mouse pointer), no page or console errors. Not yet run: `check-android8-ui.py` with Chrome 138, and real touch.
