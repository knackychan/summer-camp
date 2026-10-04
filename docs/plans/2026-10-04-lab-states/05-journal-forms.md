# Slice 05 — Journal shows forms

**Status:** Approved by Papa 2026-10-04 (`design.md`).
**Goal:** The Journal's Ingredients page shows the forms a kid has found; Reactions counts 18.
**Depends on:** 02, 03.
**Files:** `js/games/codequest/lab/lab-screen.js`, `js/games/codequest/strings.js`, `css/codequest.css`, `sw.js` cache bump.

## Change

- Ingredients card: under the fresh points, one small row per discovered form (state icon + its points). Undiscovered forms are not hinted at.
- Reactions: 18 pages, counter "Your Journal has N of 18 reactions."; new families and formulas render like Phase 1's.

## DONE WHEN

- Manual: brew a frozen and a crushed form → both rows show on their cards; 18-page count; 中文.
- `node scripts/check.mjs` green.

## Implementation notes (2026-10-04)

- Ingredients cards: under the fresh points, one dashed-ruled row per discovered form — state badge (🔨 / 🔥 / 🧊), state name (EN or 中文) and that form's points as chips. No row, and no hint, for forms not yet brewed.
- Reactions: the counter reads "of 18" from `journalReactions`; the four state rules' formulas now use `state:` tokens (rendered as the state badge with the state name as title) in place of slice 01's plain properties.
- Test: 1 new (45 total). Manual (scratch Playwright, 1280×800 and 1280×600): frozen Mushroom + Echo and crushed Moonflower brewed → both forms recorded, "2 of 18", state badges in the formulas, form rows on exactly those two cards, 中文 rows. Screenshots `test-results/codequest-lab/journal-states-*.png`.
- `sw.js` cache `summer-quest-v156-states-05`.
