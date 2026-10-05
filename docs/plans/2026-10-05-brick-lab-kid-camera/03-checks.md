# Slice 03 — Checks

**Requested by Papa, 2026-10-05.** Gates for design.md K1–K6.

**Depends on:** 01, 02.

## Changes
- `scripts/check-brick-lab-ui.py` — slice 07's "pans along the ground" / "stays over the island" checks now use one finger (left button); new checks: a touch slide keeps the grabbed ground under the finger, ↺ / ↻ turn 45°, + / − zoom within limits and the tilt follows, a tap still places, the selected piece still drags, two-finger pinch zooms (CDP touch).
- `scripts/check-android8-ui.py` with Chrome 138; a debug build installed on the tablets for Papa.

**DONE WHEN:** `check.mjs` green; `check-brick-lab-ui.py` all green; Android 8 check ok; Papa tries it on a tablet.

**Shipped 2026-10-05:** `check.mjs` green (runs `scripts/brick-camera.test.mjs`, 7 tests); `check-brick-lab-ui.py` 209/209 on source (Edge, SwiftShader), including a CDP touch slide that keeps the grabbed ground under the finger, a two-finger spread zooming 100 → 32 without turning, a twist turning the view, ↻/↺ ±45°, + three times tilting lower, − capped at 128, the buttons never resizing the view; `--sheet` 5/5 and `--sheet --graphics webgl1` 4/4; `check-android8-ui.py` with Chrome 138 ok in all four modes. Debug build installed on both tablets for Papa's try.
