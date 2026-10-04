# Slice 08 — Part icons show the real part in the picked colour

**Decisions:** D12. **Depends on:** nothing (brick-lab slices 12 and 13 already shipped). May ship before 01.

**Requested by Papa, 2026-10-04:** "it look way to simplify, it would be better if it look exactly like the shape you are going to choose with the color picked".

## Today
Tray tiles (`.sqbl-part-preview`, `brick-lab.js:1302`, and the info card at `:1372`) are CSS drawings keyed on `data-shape` / `data-preview` (`css/brick-lab.css:72`, `:101`–`:134`): a rounded rectangle with two dots for every brick and plate, clip-path shapes for slopes and peaks. They don't show the real stud count or proportions, and not every part takes the picked colour.

## Changes
- `js/brick-lab/brick-thumbs.js` (new) — `createThumbs(renderer, kit)`:
  - Its own small scene, lights matching the plate, a fixed ¾ camera fitted to the part's bounding box; one `WebGLRenderTarget` (96×64 × device pixel ratio, capped at 2; 1 on the reduced tier).
  - `get(part, colorId)` → cached data URL (`part:colour`), else queues it; `onReady(cb)`.
  - At most 3 renders per animation frame (1 on the reduced tier), on the existing renderer — no second WebGL context. The mesh comes from `makePieceMesh(part, colorHex, kit)`, so the icon is exactly what lands on the plate; geometry and material disposed after each render.
  - Cache cleared on `destroy()` and on context loss.
- `js/brick-lab/brick-lab.js` — a tile's preview becomes an `<img>` once its picture is ready; only tiles on screen are queued (`IntersectionObserver` on the parts grid). Changing colour re-queues the visible tiles. Parts whose colour is fixed (rails, trees) render once.
- `css/brick-lab.css` — the CSS drawings stay as the fallback until the image is ready, or if WebGL is lost.
- Works with on-demand rendering (brick-lab slice 13): queueing a thumbnail requests a frame.

## Tests
- `scripts/check-brick-lab-ui.py` — every visible tile gets an image; picking blue re-renders the visible brick tiles; a rail tile doesn't change with colour; no second canvas / GL context is created.
- Screenshot of the tray for Papa (Bricks and Rails categories, red and blue).

**DONE WHEN:** `node scripts/check.mjs` green; `check-brick-lab-ui.py` passes; `check-android8-ui.py` with Chrome 138 passes; Papa has reviewed the screenshot; scrolling the tray on the Android 8 tablet stays smooth.
