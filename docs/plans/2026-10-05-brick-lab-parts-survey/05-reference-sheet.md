# Slice 05 — Reference sheet of all 81 parts; Android 8 check

**Decisions:** none new; proves D2, D4, D7 and D10 on screen and on the target browser. **Depends on:** 01–04.

## Changes
- None in the app. Re-run the `--sheet` step of `scripts/check-brick-lab-ui.py` (more-parts slice 04; it renders every catalog part, so the 35 new ones join without code changes) and save `.tmp/brick-lab-ui/parts-sheet.png`.

## Tests
- `check-brick-lab-ui.py` on WebGL2 and forced WebGL1 (r162 fallback, reduced tier): every part builds and has an icon on both.
- `scripts/check-android8-ui.py` with Chrome 138.
- Frame-time check: the 64×64 island with ~300 mixed new parts (tiles, round bricks, doors, windows) stays render-on-demand when idle and doesn't step down on the standard tier sooner than the same count of plain bricks.
- The part search finds "tile", "光面板", "1x8" and "門".

**DONE WHEN:** `node scripts/check.mjs` green; both UI runs pass; `check-android8-ui.py` passes with Chrome 138 (or recorded as *not yet run* in *As built*, as in multiplayer slice 08); Papa has reviewed `parts-sheet.png`; Papa has built something with the new parts on a real tablet.

## As built (2026-10-05)
- No app change. `check-brick-lab-ui.py --sheet` (more-parts slice 04) draws all 81 parts; its note now also names the leaves and the door knob as keeping their own colours.
- WebGL2 / standard tier (Edge 141 headless, SwiftShader): 81/81 parts build with real-part icons in red and blue (`.tmp/brick-lab-ui/parts-sheet.png`, `parts-sheet-blue.png`); an idle lab draws 0 frames with 300 plain bricks or 300 new parts; orbiting, the new parts draw 8.4 fps vs plain bricks 5.7 (364 draw calls vs 307; 137k triangles vs 280k).
- Forced WebGL1 (r162, reduced tier): 81/81 icons in red and blue (`webgl1-parts-sheet*.png`); idle 0 frames with either world.
- `check-android8-ui.py` with Chrome 138 (`138.0.7204.183` headless shell, Android 8 identity, 2 GB): webgl2, webgl1, no-WebGL and offline-webgl1 all ok, Brick Lab included. Evidence refreshed in `test-results/android8/`.
- Search: `check-brick-lab-ui.py` now checks that "tile", "光面板", "1x8" and "門" find `tile_1x8`, `tile_quarter_1x1`, `plate_1x8` and `door_1x4x6`. Full suite 188/188.
- **Still open for DONE WHEN:** Papa reviews `parts-sheet.png` and builds something with the new parts on a real tablet.
- Papa reviewed the 81-part `parts-sheet.png` on 2026-10-05: "ok cool for part sheet". Left for DONE WHEN: Papa builds something with the new parts on a real tablet.
