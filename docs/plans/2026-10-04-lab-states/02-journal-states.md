# Slice 02 — Journal remembers forms

**Status:** Pending Papa's OK of `design.md`.
**Goal:** Each kid's Journal remembers which forms of which ingredients they have brewed with.
**Depends on:** 01.
**Files:** `js/games/codequest/lab/journal.js`, `scripts/codequest-lab.test.mjs`.

## Change

- `normalizeLab` keeps `states: ['<ingredientId>:<state>', …]`: known ids, known non-raw states, deduped, ≤ 128. Saves without it get `[]`. Still profile v12 (design D7).
- `recordStates(profile, mix)` adds the mix's changed forms; returns the same profile when nothing is new.
- `journalIngredients(lab)` gains `forms: [{ state, props }]` for discovered forms; `journalReactions` covers 18 rules with formulas for the four new ones.

## DONE WHEN

- Tests: unknown ids / states dropped, caps hold, repeat returns the same object, a Phase 1 save normalizes with `states: []` and nothing else changed; forms appear only once recorded.
- `node scripts/check.mjs` green.
