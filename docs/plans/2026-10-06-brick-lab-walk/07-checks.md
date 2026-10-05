# Slice 07 — Checks

**Requested by Papa, 2026-10-06.** Gates for design.md W1–W13.

**Depends on:** 01–06.

## Changes
- `scripts/check-brick-lab-ui.py` — new checks: 🚶 only on standing minifigs; CDP touch joystick walks; a look drag turns; step up a brick, jump two, wall at three, island edge; crosshair place / remove / turn and Undo; 👀 both ways; Back snaps to the grid with riders; buttons never resize the view; frames stop when still (render on demand comes back).
- Two-page pretend-wifi run for slice 05.
- `scripts/check-android8-ui.py` with Chrome 138, including `--graphics webgl1`; walking on the reduced tier holds 30 fps with 50+ pieces in view.
- A debug build on both tablets for Papa.

**DONE WHEN:** `check.mjs` green; `check-brick-lab-ui.py` all green; Android 8 check ok; Papa walks a minifig on a tablet and signs off.
