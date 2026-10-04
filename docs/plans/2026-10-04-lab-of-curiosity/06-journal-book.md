# Slice 06 — Curiosity Journal

**Status:** Approved by Papa 2026-10-04 (`design.md` D11, Screen).
**Goal:** The book on the bench shows what the kid has found, as rules, and teases what is left.
**Depends on:** 02, 04.
**Files:** `js/games/codequest/lab/lab-screen.js` (sheet), new pure page builders in `js/games/codequest/lab/journal.js`, `js/games/codequest/strings.js`, `css/codequest.css`, `scripts/codequest-lab.test.mjs`, `sw.js` cache bump.

## Change

- Tap the book → half-height sheet from the bottom; the lab stays visible and animating above; tap outside or ✕ closes. Not a modal.
- Ribbon tabs (icon + one word): **Reactions 反應**, **Potions 藥水**, **Ingredients 材料**.
  - Reactions: one page per found rule — icon formula from its deciding properties, the rule `label` and its one-sentence `line`. Unfound rules: greyed "???" cards showing only the family icon. Counter "Found 6 of 14 · 已發現 6/14".
  - Potions: the 4 recipes — discovered ones show ingredients + ordered steps; undiscovered show "???". A discovered recipe has "Put in cauldron 放進鍋子", which fills mix + steps (the kid still taps Brew).
  - Ingredients: all 12; property icons revealed only once the ingredient is in `lab.seen`.
- Opening the Journal clears the "New page!" tag.
- Targets ≥ 48 px; the sheet scrolls inside itself, the page never scrolls.

## DONE WHEN

- Page builders unit-tested: counts match `lab.found`; unfound rules never leak their label or line; ingredient props hidden until seen.
- Manual: find 3 reactions → Journal shows 3 pages + 11 "???"; Potions "Put in cauldron" then Brew makes that potion.
- `node scripts/check.mjs` green.
