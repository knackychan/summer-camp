# Slice 01 — Sprite atlas redraw (D3)

**Goal:** Code-drawn sprites big enough to read on a tablet at the new camera, with a hero that visibly faces four ways.
**Depends on:** —
**Files:** `js/games/codequest/pixel-art.js`, `scripts/codequest-renderer.test.mjs`.

## Change

- Redraw every frame on the Pixel Planet palette (`js/world/planet-palette.js`): actors 16×24, props 16×16, 1 px outline, 2-tone shading (base + lit/dark from the palette), no anti-aliasing.
- Hero: `hero-s-*`, `hero-n-*`, `hero-e-*` × `idle`, `walk-1`, `walk-2`, `attack`, `hurt` (west = east with `flip`). The `A` accent colour still maps to the kid colour.
- Keep every id in today's `CODEQUEST_SPRITE_IDS`; old hero ids (`hero-idle`, `hero-walk-1`, …) alias the south frames.
- Enemies: `<id>-0` / `<id>-1` idle frames; the bare id aliases `-0`.
- Add environment frames: `wall-top`, `wall-face`, `wall-face-torch`, `floor-a`, `floor-b`, `floor-crack`, `pillar`, `banner`, `rubble`, `skull`.
- `drawSprite` / `spriteSize` signatures unchanged.

## DONE WHEN

- `node scripts/codequest-renderer.test.mjs` green; it additionally asserts all hero facing frames and environment ids exist, every actor frame is 16 px wide × 24 px tall and every prop frame 16×16.
- Every pixel colour in every frame resolves to a palette index (test).
- `node scripts/check.mjs` green.
