# Slice 05 — Re-shape rooms, keep lessons (D6)

**Goal:** Every room is a room (≤ 9×7, 3–5 walkable rows), not a corridor — same lesson, same cards, same par.
**Depends on:** 02 (to eyeball rooms). Can run in parallel with 03–04.
**Files:** `js/games/codequest/levels.js` (maps, `heroDir`, references only where geometry demands, `generateEndless` templates), `js/games/codequest/run.js` (encounter maps), `scripts/codequest.test.mjs`.

## Change

- First, freeze a snapshot of every level's `available`, `requires`, `parBlocks`, `maxBlocks`, `objective` and entity counts into the test.
- Redraw each of the 72 authored maps inside 9×7 (outer walls included) with 3–5 walkable rows; decor walls / pillars shape the room and steer toward the intended solution.
- `reference` changes only if the new geometry needs it; its block count must still equal `parBlocks`.
- Same treatment for Tower templates and expedition encounter maps.
- Work region by region (Trail of Steps first) so each batch is reviewable in screenshots.

## DONE WHEN

- `node scripts/codequest.test.mjs` green: every authored reference solves, par matches exactly, Tower floors and expedition encounters verify.
- New assertion: every authored, Tower and expedition map is ≤ 9 wide × 7 tall with ≥ 3 walkable rows.
- New assertion: the frozen per-level snapshot is unchanged.
- `node scripts/check.mjs` green.

## Amendment (Papa, 2026-10-03): new par

Analysis before starting: 37 of 72 quests were solved by walking one straight 8–13-tile line (most used a single row), so "≤ 9×7 with par unchanged" was impossible. Papa chose **real 2D rooms with recomputed par**:

- Unchanged per quest: `concept`, `objective`, `objectiveText`, `available`, `requires`, `reward`, region, title, entity kinds.
- Re-authored: `map`, `heroDir`, `reference`; `parBlocks` = block count of the new reference; `maxBlocks` = new par + the quest's old slack (`maxBlocks − parBlocks`).
- The frozen-snapshot assertion covers the unchanged fields only. Every room must need at least one turn unless its lesson is a single action.
