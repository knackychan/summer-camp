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

## Implementation notes (2026-10-04)

- **Page builders** in `lab/journal.js`: `journalReactions(lab)`, `journalPotions(profile, recipes)`, `journalIngredients(lab)`. Recipes are passed in — `progression.js` already imports `journal.js`, so importing `RECIPES` back would be a cycle. Unfound reaction pages are `{ index, found:false, family }` and unfound potions `{ index, found:false }`: no id, label or line to leak. The icon formula per rule (its deciding properties, or the three ingredients of the Pocket Universe) is a small data table in `journal.js`; `rules.js` stays the only source of the tests.
- **Sheet** (`lab-screen.js`): a second `.cq-lab-sheet` (`.cq-lab-journal`, 54 % of the Lab height) with three ribbon tabs (emoji + one word). Reactions: "Your Journal has N of 14 reactions." counter, found cards (family icon, label, formula, line), "Not found yet" cards with the family icon and its name. Potions: discovered recipes with ingredients, numbered steps and "Put in cauldron 放進鍋子" (`labLoad`; the owl says "Ready — tap Brew!"); the rest "Not found yet". Ingredients: all 12 with Shelf / Bag, property chips once seen, else "Use it in a reaction to learn its powers."
- Not a modal: the room keeps animating above it; a tap on the room closes it (and does not also pick a jar); ✕, Back and Escape close it. Opening it clears the "New page!" tag; the owl's bubble hides while a sheet is up. The book tap no longer makes the owl read the count (slice 04's stand-in).
- New strings: `LAB` journal keys, `LAB_PROPS`, `LAB_FAMILIES` (EN + 中文, tested).
- **Host-bar click guard.** The Code Quest host bar's keyboard path now also requires a click with no `pointerType`, as the Lab dock does since slice 04: under touch emulation the 中文 toggle flipped twice. `check-codequest-ui.py` still passes (48 checks).
- **Tests:** 5 new in `scripts/codequest-lab.test.mjs` (30 total). Manual (scratch Playwright, 1280×800 and 1280×600): 3 reactions → 3 pages + 11 "Not found yet"; ingredients revealed = `lab.seen`; Put in cauldron → Brew → Healing +1; tap above closes without selecting; Back closes the Journal first; half-height with no page scroll; buttons ≥ 48 px; 中文. Screenshots `test-results/codequest-lab/journal-*.png`.
- `sw.js` cache `summer-quest-v151-lab-06` (no new files).

**Reviewed by Papa 2026-10-04** (chat, after the merge of knackychan/summer-camp#2: "im good with that") — screenshots in `test-results/codequest-lab/` accepted as they are.
