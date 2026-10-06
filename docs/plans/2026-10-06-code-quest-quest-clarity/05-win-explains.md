# Slice 05: The win card explains the skill

**Status:** Design approved by Papa 2026-10-06 (`design.md` D8). Built 2026-10-06; unit tests and `check-codequest-ui.py` green (checked on the q11 win, which every run of the harness reaches; q12 has the same code path).
**Goal:** After a win the kid hears which skill they used, why it matters, and what the next quest brings.
**Depends on:** 01.
**Files:** `js/games/codequest.js`, `js/games/codequest/hints.js`, `js/games/codequest/strings.js`, `css/codequest.css`, `scripts/codequest-hints.test.mjs`, `scripts/check-codequest-ui.py`.

## Change

- `hints.js`: `winLines(level, nextLevel)` → `{ used:[en,zh], why:[[en,zh]…], next:[en,zh]|null }`:
  - `used`: "You used 🪨 Rune + 🔁 Repeat." / "你用了 🪨 符文＋🔁 重複。"; teach-only: "You practised: ➡ Sequence." / "你練習了：➡ 順序。"; no chips: `null` line.
  - `why`: each chip's `why`.
  - `next`: "Next: Key Crypt — 🔁 Repeat." / "下一關：鑰匙地窖——🔁 重複。" from the next quest in `LEVELS` order; `null` after q72.
- `completeQuest`: insert the lines between `MESSAGES.won` and the program-size line. Not for `level.endless` / `level.expedition`.
- No change to rewards, best-blocks, stars or `ctx.finish`.

## DONE WHEN

- Unit test: `winLines(q12, q13)` names Rune and Repeat, has two why lines, next names "Key Crypt" / "鑰匙地窖"; `winLines(q72, undefined).next === null`; every quest gives non-empty EN + 中文 for every present line.
- `check-codequest-ui.py`: winning q12 with its reference shows the used line and the next line; the dialog fits 1280×600.
- `node scripts/check.mjs` green.
