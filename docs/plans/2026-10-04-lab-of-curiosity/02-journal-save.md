# Slice 02 — Free brewing option + Journal save (profile v13)

**Status:** Approved by Papa 2026-10-04 (`design.md` D5, D9, D11).
**Goal:** The 4 dungeon potions can be brewed without consuming ingredients while D5 is on, and each kid's Lab discoveries persist.
**Depends on:** 01 (rule and ingredient ids).
**Files:** `js/games/codequest/progression.js`, `js/games/codequest/alchemy-code.js` (pass-through only), new `js/games/codequest/lab/journal.js`, `scripts/codequest.test.mjs`, `scripts/codequest-lab.test.mjs`, `sw.js` APP_SHELL + cache bump.

## Change

- `progression.js`
  - `brewLab(raw, tray, steps, options = {})`: when `options.free === true`, skip the `missing-ingredient` check and leave `ingredients` unchanged; potion +1 and `discoveredRecipes` as today. Without the option, behaviour is exactly today's.
  - Profile v13: accept versions 1–13; add `lab: normalizeLab(own(source, 'lab'))`; `version: 13`. Header comment names v13.
- `alchemy-code.js`: `runAlchemyCode(profile, source, options = {})` passes `options` to `brewLab`. No other change.
- `lab/journal.js` (pure)
  - `normalizeLab(raw)` → frozen `{ found: [ruleId…], seen: [ingredientId…] }`; ids filtered to known `LAB_RULES` / `LAB_INGREDIENTS`, deduped, ≤ 128 each.
  - `recordFound(profile, ruleId)`, `recordSeen(profile, ids)` → new normalized profile; the same object comes back when nothing is new, so callers can skip saving.

## DONE WHEN

- `codequest.test.mjs`: existing brewing tests unchanged and green; new: `free:true` brews with zero stock and leaves counts unchanged; without the option a zero-stock brew still returns `missing-ingredient`; a v12 save normalizes to v13 with an empty `lab` and every other field equal; a v13 save round-trips.
- `codequest-lab.test.mjs`: unknown ids dropped, duplicates removed, caps hold; a repeated `recordFound` returns the same object.
- `runAlchemyCode(profile, recipeToAlchemyCode(recipe), { free:true })` brews with zero stock.
- `node scripts/check.mjs` green.
