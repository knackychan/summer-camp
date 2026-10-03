# Slice 04 — Android 8 / WebGL1 validation

**Depends on:** 01–03.

**Changes:** `scripts/check-android8-ui.py` — `bricklab` joins `solar` and `monster-truck` in the game loop (WebGL2, WebGL1/r162, no-GL retry, context loss + restore, offline).

**DONE WHEN:** `scripts/check-android8-ui.py` with Chrome 138 passes with Brick Lab included, and Brick Lab opens on the WebGL1 (r162) path.

**Verified 2026-10-03:** Chrome 138 headless shell — all four profiles `ok`, Brick Lab drew on `webgl2` and on `webgl` (r162 downloaded), recovered from no-GL retry and from context loss.
