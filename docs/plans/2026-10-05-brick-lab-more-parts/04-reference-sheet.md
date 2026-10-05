# Slice 04 — Reference sheet of all 46 parts; Android 8 check

**Decisions:** none new; proves D2, D4, D5 and D7 on screen and on the target browser. **Depends on:** 01, 02, 03.

## Changes
- `scripts/check-brick-lab-ui.py` — a `--sheet` step that renders every part's real-part icon (multiplayer slice 08) in red into one grid, grouped by category with the EN + 中文 label under each, and saves `.tmp/brick-lab-ui/parts-sheet.png`; a second pass in blue shows which parts recolour. No new runtime code.

## Tests
- Run `check-brick-lab-ui.py` on WebGL2 and forced WebGL1 (r162 fallback, reduced tier): every part builds and has an icon on both.
- `scripts/check-android8-ui.py` with Chrome 138.
- Frame-time check: the 64×64 island with ~300 mixed new parts (windows, rocks, logs included) stays render-on-demand when idle (0 frames drawn) and doesn't trigger the slice 14 step-down while orbiting on the standard tier any sooner than a build of the same count of plain bricks.

**DONE WHEN:** `node scripts/check.mjs` green; both UI runs pass; `check-android8-ui.py` passes with Chrome 138 (or, if no Chrome 138 is on the machine, recorded as *not yet run* in *As built*, as in multiplayer slice 08); Papa has reviewed `parts-sheet.png`; Papa has built something with the new parts on a real tablet.
