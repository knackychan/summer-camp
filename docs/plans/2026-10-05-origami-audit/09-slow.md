# Slice 09 — 🐢 Slow

**Approved by Papa, 2026-10-06** (audit N1). Implements design.md O11.

**Depends on:** slice 03 (the WAAPI loop).

## Changes
- `js/vendor/origami-atelier/origami-engine.js` — `setSlow(on)`: every animation's `playbackRate`
  1 or 0.625 (×1.6 time); `show()` applies the current rate; `snapshot()` keeps the position in
  fold time, so a re-render picks up where it was.
- `js/vendor/origami-atelier/origami-atelier.js` — a toggle button in the top-left of the stage,
  "🐢 Slow / 🐢 慢慢看", `aria-pressed`, ≥ 48 px; stored per kid as `slow`.
- `js/vendor/origami-atelier/origami-storage.js` — `slow: false` in the initial state (additive).
- `js/vendor/origami-atelier/origami-atelier.css` — the toggle.
- `scripts/check-origami-ui.py` — Slow sets every stage animation to 0.625 and `aria-pressed`;
  it stays on after Next and after a language switch; off goes back to 1; the toggle is a ≥ 48 px
  target and fits at all three sizes.
- `sw.js` — bump `CACHE_NAME`.

**DONE WHEN:** `node scripts/check.mjs` green; `python scripts/check-origami-ui.py` passes.

**Shipped 2026-10-06.** `engine.setSlow()`, `slow` option, rate applied on every `show()`; the
toggle top-left of the picture; `slow` in the per-kid store. `check-origami-ui.py` 82/82 (new: ×1.6
on every animation, kept after Next and a language switch, off goes back to 1; the toggle is in the
frame and a ≥ 48 px target at all three sizes). Cache `v191-origami-slow`.
