# Slice 04 — Eyes view

**Requested by Papa, 2026-10-06.** Implements design.md W4 (eyes view and the switch).

**Depends on:** 03.

## Changes
- `js/brick-lab/brick-walk-view.js` — a 👀 button switches behind ↔ eyes with a 300 ms glide (instant with `prefers-reduced-motion`). Eyes: camera at the minifig's eye height, 75° field of view, the minifig and its riders hidden; behind: 60°. Crosshair, ghost and the build buttons work the same in both.
- The view chosen is remembered per kid on this tablet (a lab setting, not saved in the world).
- Strings: `viewBehind`, `viewEyes` (aria-labels; the button label shows the view it switches to).

**DONE WHEN:** `check.mjs` green; in the browser 👀 switches both ways, the minifig is hidden only in eyes view, and placing from eyes view lands where the crosshair points.

**Shipped 2026-10-06:** 👀 sits top right of the view (64 px). The walk view blends the behind and eyes cameras (position, target, lens) over 300 ms, at once with reduced motion; the stand-in hides once the blend is past halfway. The button names the view it switches to (👀 Eyes view 用眼睛看 / 🧍 Behind view 從後面看). The chosen view is `walkView` in the kid's tray prefs on this tablet (`brick-storage.js`), so the next walk starts in it. As built:
- `walkHide()` re-hides the real figure and riders every frame and draws again when it had to: something that rebuilds a piece's 3D object (an Undo, or the moving-parts tap reaction ending 2 s after the figure was selected) otherwise showed the real figure around the eyes camera in the last drawn frame.
- `snapshot().camera.fov` added; leaving a walk puts the lab's 34° lens back.
- Browser check (scratch), 43/43 on Edge SwiftShader on the committed tree alone, adding: 👀 offers the eyes; the glide ends at 75°, eye height, figure hidden; the button then offers the behind view; looking down from the eyes aims at the plate within reach and Place lands there; the next walk starts in the eyes; 👀 again glides back to 60° with the figure showing; leaving restores 34°.
