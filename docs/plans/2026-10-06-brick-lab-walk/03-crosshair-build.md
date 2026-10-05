# Slice 03 — Build from the crosshair

**Requested by Papa, 2026-10-06.** Implements design.md W9, W10.

**Depends on:** 02.

## Changes
- `js/brick-lab/brick-walk-view.js` — a crosshair at the view centre; each frame a ray from it hits a piece or the ground, `landing()` gives the spot for the part picked in the rail, and the usual ghost shows there when it is within 8 studs and does not overlap the walker (W9). Nothing hit / out of reach / overlap: no ghost, no message.
- Buttons ＋ Place 放上去, － Remove 拿掉, ⟳ Turn 轉一轉 (≥ 56 px, `pointerdown`). Place and Remove send the same `add` / `remove` ops as Build (Undo, save unchanged). Remove never targets the walker or its riders.
- The rail keeps picking part and colour while walking; the picked part stays armed.
- Strings: `place`, `remove`, `turn`.

**DONE WHEN:** `check.mjs` green; in the browser, walking, the kid places a 2×4 brick on the ground and another on top of it, turns one, removes one, and Undo takes them back in order; no ghost when aiming past 8 studs or into the minifig.
