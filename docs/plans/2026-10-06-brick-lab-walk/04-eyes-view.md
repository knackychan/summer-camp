# Slice 04 — Eyes view

**Requested by Papa, 2026-10-06.** Implements design.md W4 (eyes view and the switch).

**Depends on:** 03.

## Changes
- `js/brick-lab/brick-walk-view.js` — a 👀 button switches behind ↔ eyes with a 300 ms glide (instant with `prefers-reduced-motion`). Eyes: camera at the minifig's eye height, 75° field of view, the minifig and its riders hidden; behind: 60°. Crosshair, ghost and the build buttons work the same in both.
- The view chosen is remembered per kid on this tablet (a lab setting, not saved in the world).
- Strings: `viewBehind`, `viewEyes` (aria-labels; the button label shows the view it switches to).

**DONE WHEN:** `check.mjs` green; in the browser 👀 switches both ways, the minifig is hidden only in eyes view, and placing from eyes view lands where the crosshair points.
