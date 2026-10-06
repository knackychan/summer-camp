# Slice 10 — Drag to scrub

**Approved by Papa, 2026-10-06** (audit N3). Implements design.md O12.

**Depends on:** slice 09 (same lesson controls).

## Changes
- `js/vendor/origami-atelier/origami-engine.js` — `seek(ms)`: pauses and sets every animation to
  that time, clamped to the end of the last loop.
- `js/vendor/origami-atelier/origami-atelier.js` — pointer events on the stage: a sideways drag
  past a few pixels pauses (if playing) and moves the fold by `dx / width × one loop` from where it
  was; letting go leaves it paused; the Play button follows (Resume). While paused, the companion
  line shows the scrub hint (EN + 中文).
- `js/vendor/origami-atelier/origami-atelier.css` — `touch-action: none` on the stage.
- `scripts/check-origami-ui.py` — a drag on the stage while playing pauses it; dragging right moves
  forward and left moves back by about the dragged share of a loop; Resume continues from the
  dragged frame; the hint shows in EN and 中文 while paused.
- `sw.js` — bump `CACHE_NAME`.

**DONE WHEN:** `node scripts/check.mjs` green; `python scripts/check-origami-ui.py` passes.

**Shipped 2026-10-06.** `engine.seek()` / `engine.time`; pointer drag on the stage (8 px threshold,
relative, one loop per stage width); the companion line switches to the scrub hint while the fold is
still (paused or resting); `touch-action: none` on the stage. `check-origami-ui.py` 87/87 (new: drag
right pauses and moves ¼ loop, drag left moves back, hint in EN + 中文 with the frame kept, Resume
carries on from the dragged frame). The companion is hidden on frames ≤ 620 px tall (as before), so
the hint shows on taller tablets only. Cache `v192-origami-scrub`.
