# Slice 02 — Turn and zoom buttons

**Requested by Papa, 2026-10-05.** Implements design.md K3 and the new Explore hint.

**Depends on:** 01.

## Changes
- `js/brick-lab/brick-lab.js` — a `.sqbl-cam` cluster inside the stage (an overlay, never part of the layout): ↺ ↻ (`turn ∓45`), + − (`zoom`), each a `pointerdown` button with an EN + 中文 `aria-label`; the Explore hint string.
- `css/brick-lab.css` — the cluster bottom-right of the view, 56 px round buttons (60 px for pre-readers), clear of the selection tools and the info card; hidden while the world menu shows.

**DONE WHEN:** buttons are ≥ 56 px, turn the view 45° and zoom one step within the limits, and pressing them never resizes the 3D view.
