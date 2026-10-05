# Slice 03: Running Rune is visible

**Status:** Approved by Papa 2026-10-05 (`design.md` D4, D5, D6 call brackets).
**Goal:** While a Rune call runs, the kid sees which call card is running and which Rune card is running.
**Depends on:** 01
**Files:** `js/games/codequest/interpreter.js`, `js/games/codequest.js`, `js/games/codequest/strings.js`, `css/codequest.css`, `scripts/codequest.test.mjs`, `scripts/check-codequest-ui.py`.

## Change

- **`interpreter.js`**
  - The `function` frame pushed for a `call` gets `uid: node.uid`.
  - Add `activeCalls()`, which returns `this.stack.filter(f => f.kind === 'function').map(f => f.uid || null)`.
  - Nothing else changes.
- **`codequest.js`**
  - `S.activeCalls` is set after each `S.model.step()` from `S.model.runner && S.model.runner.activeCalls()`, or `[]` when there is no runner.
  - `running(node)` is true for `node.uid === S.activeUid` or for `S.activeCalls.includes(node.uid)`.
  - Run start remembers `S.editorBeforeRun`.
  - While executing, `S.editor` is `'rune'` if a Rune call is open, otherwise `'main'`. Notify `MESSAGES.runeRunning` when entering Rune and `MESSAGES.runeDone` when leaving, unless the step's own event message replaces it.
  - `restoreEditor()` runs when the run stops (won, resting, programming, program-error), on Reset and in `startLevel`.
- **Call card as a bracket.** `stripCard` and `miniCards` render a `call` node named `rune` as a `cq-bracket cat-func` whose body is `miniCards(S.runeProgram, lit)`. Inner mini cards light only when that call is open (`lit`).
- **`strings.js`**: add `MESSAGES.runeRunning` and `runeDone`.

## DONE WHEN

- Unit test: `runner.activeCalls()` returns `[]` at the top level, `[callUid]` inside a call, the inner and outer uids for nested calls, and `[]` after return. Existing interpreter tests are unchanged.
- Harness, q10 with Main = Rune, Right, Rune and Rune = Move, Move, by Step:
  - steps 1–2: `editor === 'rune'` and exactly one `.executing` card in the strip;
  - step 3 (Right): `editor === 'main'` and the Right card is lit;
  - after the run (won or reset), `editor` equals what it was before Run.
- `node scripts/check.mjs` and `python scripts/check-codequest-ui.py` are green.
