# Slice 02 — Turn and zoom buttons

**Requested by Papa, 2026-10-05.** Implements design.md K3 and the new Explore hint.

**Depends on:** 01.

## Changes
- `js/brick-lab/brick-lab.js` — a `.sqbl-cam` cluster inside the stage (an overlay, never part of the layout): ↺ ↻ (`turn ∓45`), + − (`zoom`), each a `pointerdown` button with an EN + 中文 `aria-label`; the Explore hint string.
- `css/brick-lab.css` — the cluster bottom-right of the view, 56 px round buttons (60 px for pre-readers), clear of the selection tools and the info card; hidden while the world menu shows.

**DONE WHEN:** buttons are ≥ 56 px, turn the view 45° and zoom one step within the limits, and pressing them never resizes the 3D view.

**Shipped 2026-10-05:** `check.mjs` green (runs `scripts/brick-camera.test.mjs`, 7 tests); `check-brick-lab-ui.py` 209/209 on source (Edge, SwiftShader), including a CDP touch slide that keeps the grabbed ground under the finger, a two-finger spread zooming 100 → 32 without turning, a twist turning the view, ↻/↺ ±45°, + three times tilting lower, − capped at 128, the buttons never resizing the view; `--sheet` 5/5 and `--sheet --graphics webgl1` 4/4; `check-android8-ui.py` with Chrome 138 ok in all four modes. Debug build installed on both tablets for Papa's try.
