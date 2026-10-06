# Slice 03: Picker on the right with tabs

**Status:** Design approved by Papa 2026-10-05 (`design.md` D7). Built 2026-10-06; browser checks green at both sizes. Screenshots: `.tmp/codequest-ui/picker-q01-*.png`, `picker-q11-*.png`, `picker-q15-*.png`.
**Goal:** Finding a card is one tab tap plus a short list; the bottom of the screen holds only the program.
**Depends on:** 02
**Files:** `js/games/codequest.js`, `js/games/codequest/strings.js`, `css/codequest.css`, `scripts/check-codequest-ui.py`.

## Change

- **Layout.** `.cq-library` and `.cq-runbox` move out of `.cq-dock` into a right column of `.cq-play` (`.cq-picker`), about 25% of the width; the scene takes the rest. Run / Step / Reset at the column's foot. `.cq-dock` keeps the program row(s) and Undo / Clear. The 1280×600 media rules are redone for the new grid; the card menu, coach and speech bubble keep clear of the column (existing placement code clamps to `.cq-play`; re-check it against the column).
- **Groups.** Walk = `move` + `turn`, Fight = `attack`, Use = `use`, Care = `care`, Friend = `ally` (all from `opCategory`), Stickers = repeat + if stickers. A tab appears only if its group is non-empty.
- **Tabs only when needed.** Total cards + stickers ≤ 8 → one list, no tabs. Otherwise a row of icon tabs with a short word under each, ≥ 48 px, `aria-pressed`. `S.pickerTab` per room, reset to the first non-empty group on a new room.
- **Rune card pinned** above the tabs when the room offers `callRune`.
- **`strings.js`**: tab names Walk 走路, Fight 戰鬥, Use 使用, Care 照顧, Friend 夥伴, Stickers 貼紙.

## DONE WHEN

- Harness, 1280×800 and 1280×600:
  - q01 (3 cards): no tabs, all cards visible.
  - q15 (64 offered): tabs visible; Fight tab shows only attack-group cards; Stickers tab shows only stickers; every button ≥ 48 px, on screen and hit-testable; no page scroll; the picker list scrolls inside itself.
  - Run, Step, Reset tappable in every room checked; the scene canvas is not covered by the column.
  - q05 and q16 builds from slice 02 still pass, tapping through tabs.
- `node scripts/check.mjs` and `python scripts/check-codequest-ui.py` green.
- Screenshots of q01, q11 and q15 at both sizes for Papa.
