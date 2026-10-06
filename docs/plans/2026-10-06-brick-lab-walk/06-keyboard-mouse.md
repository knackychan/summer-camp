# Slice 06 — Keyboard and mouse

**Requested by Papa, 2026-10-06.** Implements design.md W11.

**Depends on:** 03, 04.

## Changes
- `js/brick-lab/brick-walk-view.js` — while walking: W A S D walk (and arrow keys), a left-button drag looks, Space jumps, V switches the view, R turns the part, a left click without dragging (under `DRAG_START`) places at the crosshair, a right click removes (context menu suppressed on the view only). Keys are listened to only while walking and removed on exit. No pointer lock.

**DONE WHEN:** `check.mjs` green; in a desktop browser every key and click above works and none of them does anything outside walking.

**Shipped 2026-10-06** (before slice 05; it only needed 03 and 04): all in `brick-walk-view.js`, listening on `window` from entering a walk to leaving it. W A S D and the arrows walk (the stick wins while a finger is on it), Space jumps, V switches the view, R turns the part; keys typed into an input (the part search) are left alone, and a lost window focus lets go of held keys. A left click that travels under 10 px places at the crosshair; a drag looks; a right click removes (the kid camera already swallows the context menu on the view). Browser check (scratch), 55/55 on Edge SwiftShader, adding: S walks back, W forward, ← steps left, Space jumps, R turns, V to the eyes and back, a click places, a right click removes, a drag looks without placing, typing "www" in the search doesn't walk, and after leaving the walk R and W change nothing.
