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
