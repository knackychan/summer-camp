# Slice 08 — Floating card menu (U3, U4, U5)

**Status:** Approved by Papa 2026-10-04 (`design-ux-polish.md`).
**Goal:** Every action on a card happens on the card. Repeat counts and IF tests can be changed after wrapping, and a bracket can be unwrapped.
**Depends on:** 04 (shipped). Browser checks extend 06's `scripts/check-codequest-ui.py`.
**Files:** new `js/games/codequest/strip-edit.js`, `js/games/codequest.js`, `js/games/codequest/strings.js`, `css/codequest.css`, `sw.js` APP_SHELL + cache bump, `scripts/codequest.test.mjs`.

## Change

- `strip-edit.js` holds pure list edits over the existing AST nodes, built only with `ast.js` constructors (AST shape unchanged, D8): `insertAfter(list, index, node)`, `unwrap(list, index)` (the bracket's body replaces it; an IF's else branch, which the strip never builds, blocks Unwrap), `setRepeatCount(list, index, n)`, `setCondition(list, index, test)`, and `extendSelection(selection, index)` (contiguous only, otherwise a new selection).
- Card menu: one `.cq-card-menu` element in the dock layer, *outside* the `.cq-scroll` strip so it isn't clipped. It is positioned over the selected span with `getBoundingClientRect`, sits above the strip, and is clamped to the viewport. It follows the strip's scroll.
  - Action card: ◀ ▶ (one card selected) · ✕ · Wrap ▸ → one row of the room's `available.logic` repeat / IF cards. One tap wraps.
  - Repeat head: the ×N chip cycles through the room's available `repeatN` counts · Unwrap · ✕ · ◀ ▶.
  - IF head: test picker (the room's available `if*` only) · Unwrap · ✕ · ◀ ▶.
  - Rune call card: ◀ ▶ ✕.
- Opens on card tap-release, the existing `click` path, so the strip still pans. It closes on tapping outside, Run, Step, Reset, room change or a dialog, and it is hidden while the program runs.
- Tray at the strip end: only ↶ Undo and 🗑 Clear stay. The `nudge:` / `delete` tray actions are kept as menu actions.
- Library tap: inserts after the single selected card, else appends. The selection clears and the new card gets a `.just-added` pulse (600 ms; a static outline under reduced motion) and is scrolled into view. `announce()` only, no bubble.
- Library logic tap with a selection still wraps it, as it does today.
- Strings, EN + 繁體中文: Move left 左移 · Move right 右移 · Remove 移除 · Wrap 包起來 · Unwrap 拆開 · Repeat ×N 重複 ×N · Change test 換條件 · Close 關閉 (wording checked against existing `UI` / `LOGIC` terms).

## DONE WHEN

- Unit tests: each `strip-edit.js` function on nested programs; `unwrap(repeat(3,[a,b]))` gives `[a,b]` with UIDs kept; `setRepeatCount` refuses a count outside the room's list; the input list is never mutated.
- Browser at 1280×600: build a Repeat level's reference by taps only, change ×2→×3 through the menu, Unwrap, Undo back, Run wins. Every menu button ≥ 48 px and hit-testable; the menu never covers the Run button.
- `node scripts/check.mjs` and `node scripts/codequest.test.mjs` green (gameplay unchanged).

## Implementation notes (2026-10-04)

- The menu lives in `.cq-play` (not the dock) so it can rise over the bottom of the scene; it sits above the selected span, its tail points at the cards, and it follows the strip's scroll.
- Menu buttons act on press, like every non-scroller control. The strip and library still act on tap-release so a finger can pan them.
- No Close button: tapping anywhere outside the menu and strip closes it. Tapping the only selected card again deselects it.
- The rune-call card and code-built nodes (`target`, `let`, `forOf`…) get only ◀ ▶ ✕. A `forOf` has no Unwrap because its body uses the loop variable.
- `logic()`'s 31-branch IF chain became the `IF_TESTS` table in `strip-edit.js`. The menu and library share it; the conditions are the same.
- Selecting a card no longer pops the "Selected…" bubble (it's `announce()`-only now); the menu itself is the feedback.
- **Bug found and fixed:** `startLevel()` closed the Map / win dialog with `closeDialog(false)`, which left the scheduler paused. Any room picked from the Map, or reached through Replay / Continue, then hung on Run (auto-steps never fired, the draw loop stopped). `startLevel()` now resumes the scheduler unless the game is paused. The harness's "q05 built with the card menu wins" check covers it, since q05 is opened from the Map.
- Harness (`check-codequest-ui.py`) at 1280×800 and 1280×600, all passing:
  - q05 built with the menu only, then Run wins.
  - Wrap ▸ ×2 wraps in one tap; the ×N chip cycles 2 → 3 → 5.
  - Unwrap, then Undo, restores the bracket.
  - The library inserts after the selected card.
  - Menu buttons are ≥ 48 px and hit-testable; the menu stays on screen and clear of Run.
