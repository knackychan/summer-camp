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

## As built (2026-10-04)
- **Orthographic, not perspective.** The fixed ¾ view is an orthographic camera fitted to each part's box, like a parts catalogue: a 1×1 brick and a 2×6 plate both fill their tile, centred, and nothing leans. Icon size is **56×36 CSS px** (× pixel ratio), not 96×64; the tile's picture row grew from 30 to 36 px.
- **Drawn in the canvas corner, not into a render target.** A render target skips the screen's tone mapping and sRGB output (the icon would not match the plate) and sRGB targets are shaky on WebGL1. Instead the lab's renderer draws the icon into the bottom-left corner of its own canvas, it is copied to a 2D canvas in the same task, and the scene is drawn over the corner that same frame. The context has no alpha, so each icon is drawn on black and on white and the difference gives each pixel's coverage: a clean transparent background, antialiased edges included.
- **Shadows off while drawing an icon**; the plate's lights (hemisphere, warm sun, cool fill on the standard tier) are copied.
- **Cache kept on context loss.** Icons are data URLs, so they outlive a lost GL context; only the queue waits until the context is back.
- Colour change keeps the old picture until the new one is ready (no flash back to the CSS drawing).
- `sw.js` precaches `brick-thumbs.js` (cache `summer-quest-v165-brick-icons`).

**Verified 2026-10-04:** `check.mjs` green (after `npm run build:android-web`); `check-brick-lab-ui.py` 92/92 (Edge headless, SwiftShader), including the 6 new checks: icons on screen are the real part in red, clear background (see-through corner, solid middle), still one canvas in the lab, blue redraws them in blue, rail icons don't change with colour, back to red comes from the cache. Forced WebGL1 (r162 fallback, reduced tier) draws every icon. `check-android8-ui.py` passes with Playwright Chromium 1228 (webgl2, webgl1, no-GL retry, offline) — **not yet with Chrome 138**, which isn't on this machine. Screenshots for Papa: `.tmp/brick-lab-ui/icons-all-webgl2.png`, `icons-all-webgl1.png`, `icons-red.png`, `icons-blue.png`, `icons-rails.png`. Not yet done: Papa's review of the screenshots, tray scrolling on the Android 8 tablet.
