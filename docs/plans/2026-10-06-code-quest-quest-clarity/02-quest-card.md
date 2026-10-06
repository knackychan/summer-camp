# Slice 02: Quest card at entry

**Status:** Design approved by Papa 2026-10-06 (`design.md` D2, D5). Not started.
**Goal:** Before the first Run, the kid sees what wins the quest, which skills it needs, how hard it is, and a gentle hint.
**Depends on:** 01.
**Files:** `js/games/codequest.js`, `js/games/codequest/strings.js`, `css/codequest.css`, `scripts/check-codequest-ui.py`.

## Change

- **Quest card** — a dialog of kind `'brief'`, opened by `startLevel` when entering a quest from the map (`level:N` action) or at game launch on the first uncleared quest. Not opened by Reset room, Replay (`win:replay`), Tower floors (`level.endless`) or expedition rooms (`level.expedition`). Contents, top to bottom:
  - title (`level.title`) + region · concept;
  - 🎯 "To win 過關條件:" + the existing `objectives()` rows (unticked);
  - "This quest needs 這一關需要:" + chips from `skillsFor` (icon + EN + 中文 name); teach-only quests: "You'll practise 你會練習:";
  - difficulty: pips ●/●●/●●● + Easy 簡單 / Medium 中等 / Hard 困難;
  - 💡 `hintFor(level, 0)`;
  - [Start 開始] (primary, autofocus). Back/close does the same as Start.
- After Start: the Rune coach opens if `runeCoachDue` (unchanged rule), else the intro bubble as today.
- **Goal pop** (`goalPopHTML`): add the chips line and the pips under the concept line. (The current hint line is added in slice 04.)
- **Quest map rows** (`mapHTML`): pips after the concept `<small>`; nothing else changes.
- **Strings** (EN + 中文): `toWin`, `needs`, `practise`, `start`, `easy`, `medium`, `hard`.
- **CSS**: chips as rounded tags in the card palette, pips ≥ 10px, the dialog fits 1280×600 without scroll; Start ≥ 48px.

## DONE WHEN

- `check-codequest-ui.py`, at 1280×600 and 1280×800:
  - opening q12 from the map shows the quest card with "Rune 符文" and "Repeat 重複" chips, ●●● Hard 困難, and the q12 gentle hint; no page scroll;
  - Start closes it; Reset room does not reopen it; Replay after a win does not reopen it;
  - q01 shows "You'll practise" + Sequence; q05 shows ●● Medium;
  - the map row for q12 shows ●●●.
- `node scripts/check.mjs` green.
