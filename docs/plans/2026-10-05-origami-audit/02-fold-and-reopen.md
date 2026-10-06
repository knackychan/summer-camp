# Slice 02 — Precreases fold and reopen

**Approved by Papa, 2026-10-06** (audit C2). Implements design.md O4.

**Depends on:** slice 01 (`origami-fold.js`, hinge flap).

## Changes
- `js/vendor/origami-atelier/origami-engine.js`
  - A step is fold-and-reopen when `operation === "precrease"` or its diagram ends in `-open`,
    `-mark` or is `diag-cross` (covers the 2 `diag-mark` steps tagged `valley-fold`).
  - Moving side: the template flap's side if there is one; else the side whose middle is further
    left, or the top side for a level crease.
  - Cycle: fold (`s` 1 → −1), short hold, unfold (`s` −1 → 1), hold on the open sheet. The crease
    sits at 0.35 opacity before the fold and at full strength from the reopen to the reset, so the
    mark is what's left behind. (Durations come from slice 03; until then use 1500 / 600 / 1200 /
    800 ms inside the existing lead and reset.)
  - `diag-cross`: the first diagonal folds and reopens, then the second, in one cycle; both creases
    stay drawn.
  - `shape` (Lotus `petal-soften`): the sheet lifts (scale 1 → 1.04) and settles; no crease change.
  - `extraCrease` on pleat/crimp templates is unchanged (O3).
- `scripts/check-origami-ui.py`
  - Classic Crane steps 1–4: Play enabled; the flap is visible mid-cycle; on the last hold the flap
    matrix is identity (± 0.01) and the crease opacity ≥ 0.9.
  - Walk all 275 steps: every non-finish step has `hasMotion === true` (Play not greyed out).
- `sw.js` — bump `CACHE_NAME`.

**DONE WHEN:** `node scripts/check.mjs` green; `python scripts/check-origami-ui.py` passes,
including the 275-step walk; `fold-frames-02.png` shows Crane step 1 folding and reopening.
