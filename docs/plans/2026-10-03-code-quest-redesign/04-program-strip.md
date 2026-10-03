# Slice 04 — Program strip editor + path preview (D4, D7)

**Goal:** Programs are built as a left-to-right card sentence; the youngest stage sees where the hero will walk.
**Depends on:** 03.
**Files:** `js/games/codequest.js`, `css/codequest.css`, new `js/games/codequest/preview.js`, `sw.js` APP_SHELL + cache bump, `scripts/codequest.test.mjs`.

## Change

- Program strip: numbered card slots; dashed empty slots up to `level.maxBlocks`; Repeat / IF as coloured brackets around their cards (nesting allowed, same wrap-selected model as today, AST unchanged).
- Tap a card ⇒ inline toolbar ◀ ▶ ✕ Wrap (Wrap lists the room's available logic). ↶ Undo at the strip end. The executing card glows (existing UID highlight).
- Command library: one row of big icon cards, one word each, colour by category (move blue, turn purple, attack red, interact gold, wait green, logic violet, companion teal). Overflow scrolls horizontally inside the dock.
- `ƒ Rune` strip appears under the main strip only when the room offers `callRune`; tapping a strip makes it the edit target.
- `preview.js`: `previewPath(level, snapshot, program, functions)` → `[{x, y, dir}]`, by running a throw-away `CodeQuestModel` through the interpreter to completion (existing budgets). Shown as dashed floor arrows only when `modeFor(profile) === 'explorer'`; hidden while executing.

## DONE WHEN

- Unit tests: `previewPath` for q01's reference returns exactly the tiles a real run visits; a wall bump stops the path; the live model is never mutated.
- Browser: q01's reference built by tapping cards only, Run wins; a Builder-stage profile shows no preview.
- `node scripts/check.mjs` and `node scripts/codequest.test.mjs` green.
