# Slice 04: Rune icon, two tabs, q01 title

**Status:** Approved by Papa 2026-10-05 (`design.md` D6 tabs, D7, D8).
**Goal:** Both programs are always visible as tabs, the Rune has a picture a kid can read, and "Rune" no longer names the sequence lesson.
**Depends on:** 03
**Files:** `js/games/codequest.js`, `js/games/codequest/levels.js` (q01 title only), `css/codequest.css`, `scripts/check-codequest-ui.py`.

## Change

- **`GLYPHS.call`** becomes a rune-stone: a rounded tablet with a carved zigzag mark (even-odd fill), 24×24 viewBox.
- **`stripTabsHTML()`** renders two buttons in `.cq-strip-tabs-slot`:
  - `strip:main`: ▶ glyph + Main / 主程式;
  - `strip:rune`: rune glyph + Rune / 符文 + `.cq-tab-dots`, which is up to 4 filled dots or 1 hollow dot.
  - The active tab has `aria-pressed="true"` and class `on`.
  - Tapping the active tab does nothing new; it just stays.
- **CSS:**
  - Tabs sit side by side at ≥ 48×48 CSS px, in `cat-func` colours.
  - The `on` tab is filled with a gold edge; the other is dark with a coloured outline.
  - The old `.cq-strip-toggle` rules go.
  - The 1280×600 compact sizes follow the card sizes.
- **`levels.js` q01** `title` becomes `['First Steps', '第一步']`.

## DONE WHEN

- Harness, q10 at 1280×800 and 1280×600:
  - both tabs are visible and ≥ 48×48;
  - neither covers the strip's first card or the Run button;
  - tapping each tab switches `editor`;
  - the dot count follows `runeProgram.length` (capped at 4).
- The existing card-menu and bubble geometry checks stay green.
- The q01 title shows "First Steps" in EN and 「第一步」 in 中文.
- `node scripts/check.mjs` and `python scripts/check-codequest-ui.py` are green.
- The screenshots are reviewed.
