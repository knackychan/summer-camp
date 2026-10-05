# Slice 03 — Checks

**Requested by Papa, 2026-10-05.** Gates for design.md K1–K6.

**Depends on:** 01, 02.

## Changes
- `scripts/check-brick-lab-ui.py` — slice 07's "pans along the ground" / "stays over the island" checks now use one finger (left button); new checks: a touch slide keeps the grabbed ground under the finger, ↺ / ↻ turn 45°, + / − zoom within limits and the tilt follows, a tap still places, the selected piece still drags, two-finger pinch zooms (CDP touch).
- `scripts/check-android8-ui.py` with Chrome 138; a debug build installed on the tablets for Papa.

**DONE WHEN:** `check.mjs` green; `check-brick-lab-ui.py` all green; Android 8 check ok; Papa tries it on a tablet.
