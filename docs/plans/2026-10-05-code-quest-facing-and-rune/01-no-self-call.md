# Slice 01: Rune can't call itself

**Status:** Approved by Papa 2026-10-05 (`design.md` D9).
**Implemented:** 2026-10-05. check.mjs and check-codequest-ui.py green.
**Goal:** While a kid edits Rune, nothing they can tap puts a Rune call inside Rune.
**Depends on:** none
**Files:** `js/games/codequest.js`, `js/games/codequest/strings.js`, `scripts/check-codequest-ui.py`.

## Change

- `libraryHTML()` leaves out `callRune` while `S.editor === 'rune'`.
- The `logic:callRune` handler checks `S.editor === 'rune'` first. If so, it notifies `MESSAGES.noSelfCall` and adds nothing.
- Add `MESSAGES.noSelfCall` and reword `MESSAGES.missingFunction` (EN + 繁中, design D9).

## DONE WHEN

- Harness, q10:
  - Switching to Rune hides `[data-action="logic:callRune"]` in the library.
  - Dispatching `logic:callRune` while editing Rune leaves `runeProgram` unchanged.
  - Back on Main, the card is there again.
- `node scripts/check.mjs` and `python scripts/check-codequest-ui.py` are green.
