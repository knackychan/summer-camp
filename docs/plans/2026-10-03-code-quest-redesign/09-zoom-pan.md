# Slice 09 — Zoom in, pan, x-ray silhouettes (U6, U7, U8)

**Status:** Approved by Papa 2026-10-04 (`design-ux-polish.md`). **Amends D2** (whole-room fit becomes the default framing, not the only one).
**Goal:** A kid can look closer at a room and nothing hides behind a wall. The camera never rotates.
**Depends on:** 02, 03 (shipped). Ideally lands after 07, so the bubble placement already reads from the anchors this slice moves.
**Files:** `js/games/codequest/room-view.js`, `js/games/codequest.js`, `js/games/codequest/strings.js`, `css/codequest.css`, `sw.js` cache bump, `scripts/codequest-renderer.test.mjs`.

## Change

- `fitRoom(room, w, h, dpr, camera)`: `camera = { zoom: 0|1|2, cx, cy }` (logical buffer px). Device scale = fit + zoom. Offsets are clamped so the viewport never leaves the room buffer plus its masonry margin, so there is never a void. `zoom: 0` returns today's result exactly.
- The static layer cache key includes the device scale and offsets.
- `drawRoom` options gain `camera`. Anchors stay in CSS px against the canvas box, so the bubble and FX need no change.
- X-ray: after the depth-sorted pass, any actor, prop or pickup whose sprite box intersects a wall cap drawn later gets a 1-logical-px outline silhouette in `Q.sandLit` at 60 % alpha over the wall.
- Input on `.cq-scene` (pointer events, `touch-action:none` on the canvas):
  - Two-finger pinch steps the zoom at ±40 % distance change, snapped.
  - The wheel steps the zoom.
  - A one-finger drag pans only when zoom > 0. A tap still passes through to the HUD buttons.
- On-scene buttons, bottom-left, mirroring 🐞 on the right: ＋, －, and ⌂ Home only when not at default. Labels: Zoom in 放大 · Zoom out 縮小 · Whole room 看整個房間.
- Follow: while executing with zoom > 0, `cx, cy` ease toward the hero (clamped).
- Reset, room change and win set the camera to `{ zoom: 0 }`.
- Reduced motion: zoom and follow snap with no tween.
- `snapshot()` gains `camera`, for the harness.

## DONE WHEN

- Renderer tests: `fitRoom(..., { zoom: 0 })` equals today's `fitRoom` for every authored room at 1280×600 and 1280×800 (D2 default untouched). Zoom 1/2 give device+1/+2. A pan request past the edge clamps so the buffer covers the canvas. The silhouette is drawn for a key placed directly north of an interior wall.
- Browser at both sizes: wheel → zoom 1; drag pans and clamps; ⌂ returns to the exact default `snapshot().camera`; Run while zoomed keeps the hero inside the viewport; all new buttons ≥ 48 px.
- `python scripts/check-android8-ui.py` with Chrome 138 (graphics change, per CLAUDE.md).
- `node scripts/check.mjs`, `node scripts/codequest.test.mjs`, `node scripts/codequest-renderer.test.mjs` green.

## Implementation notes (2026-10-04)

- `fitRoom(room, w, h, dpr, camera)` returns `base`, `zoom`, and the clamped `cx`/`cy`. `codequest.js` writes the clamped centre back after each draw, so dragging past an edge doesn't build up off-screen.
- No zoom tween: whole-device-pixel steps can't animate without blurring the art, so zoom always snaps (with or without reduced motion). Follow-the-hero eases at 25 % per frame, and snaps under reduced motion.
- Buttons sit bottom-left of the scene: ＋ always shows, and − and ⌂ appear to its right only while zoomed. ＋ stays first so the button under a finger never turns into a different one.
- `.cq-zoom` is a hard rect for the speech bubble (slice 07).
- X-ray works by having `standing()` / `flat()` record each sprite drawn in the frame. After the depth pass, any sprite whose tile has a wall block directly south gets the edge pixels of its covered rows redrawn in `Q.sandLit` at 60 %.
- Pinch steps the zoom once per 40 % change in finger spread; the wheel steps it at most once every 220 ms.
- Harness (`check-codequest-ui.py`): passes in Playwright Chromium and in Chrome 138 headless (`--browser .tmp/chrome138/...`), 48/48 checks each.
  - Checks: ＋/−/⌂, wheel, pinch (raw CDP touch points), drag-pan clamp, then q02 run while zoomed with the hero on screen throughout, then the next room opens at Home.
  - Headless Chrome 138 quirk: once mouse or raw CDP touch input has been used, it reports touch clicks with `detail: 0`, and the game's click handler treats `detail: 0` as a keyboard press, so one tap fires twice. The harness therefore taps the zoom buttons first and uses single activation after the mouse/pinch steps. Normal touch clicks (detail 1) are unaffected. Worth confirming on a real tablet that a tap fires once.
- `scripts/check-android8-ui.py --browser <Chrome 138>` green. It doesn't open Code Quest (2D canvas, no WebGL), so the Chrome 138 run of `check-codequest-ui.py` is the relevant evidence.
