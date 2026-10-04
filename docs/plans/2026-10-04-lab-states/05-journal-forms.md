# Slice 05 — Journal shows forms

**Status:** Pending Papa's OK of `design.md`.
**Goal:** The Journal's Ingredients page shows the forms a kid has found; Reactions counts 18.
**Depends on:** 02, 03.
**Files:** `js/games/codequest/lab/lab-screen.js`, `js/games/codequest/strings.js`, `css/codequest.css`, `sw.js` cache bump.

## Change

- Ingredients card: under the fresh points, one small row per discovered form (state icon + its points). Undiscovered forms are not hinted at.
- Reactions: 18 pages, counter "Your Journal has N of 18 reactions."; new families and formulas render like Phase 1's.

## DONE WHEN

- Manual: brew a frozen and a crushed form → both rows show on their cards; 18-page count; 中文.
- `node scripts/check.mjs` green.
