# Slice 08 — Crane narrows both sides; frog wording for a square

**Approved by Papa, 2026-10-06** (audit C4, F8). Implements design.md O10.

**Depends on:** nothing.

## Changes
- `js/vendor/origami-atelier/origami-data.js`
  - Classic Crane: steps 11–12 become five steps — fold the top layer's lower left edge to the
    center, the lower right edge, turn the crane over (`flip`), lower left edge, lower right edge
    (EN + 中文, diagrams `side-left-narrow` / `side-right-narrow` / `flip`). 15 → 18 steps; ids
    renumbered.
  - Jumping Frog steps 1–3: "Fold diagonally and reopen", "Fold the other diagonal and reopen",
    "Fold in half across the middle and reopen" (EN + 中文); no "top section".
- `scripts/check-origami-ui.py` — the all-steps count goes 273 → 276.

**DONE WHEN:** `node scripts/check.mjs` green; `python scripts/check-origami-ui.py` passes; every
crane step opens.

**Shipped 2026-10-06.** Crane 15 → 18 steps (left, right, turn over, left, right; template
pictures as today); frog steps 1–3 reworded for a square. `check.mjs` green;
`check-origami-ui.py` 78/78 with 276 steps drawing. Cache `v190-origami-crane`.
