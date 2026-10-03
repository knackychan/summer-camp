# Slice 06 — Code / Map / Camp sheets + UI harness

**Goal:** Secondary screens match the new look; a browser harness guards the layout.
**Depends on:** 03, 04.
**Files:** `js/games/codequest.js`, `css/codequest.css`, new `scripts/check-codequest-ui.py`.

## Change

- `</>` Code: full-height sheet holding the representation switch (picture / blocks / hybrid / code, as unlocked), canonical JS view, written-code editor, Rune Library and event debugger. Content and behaviour unchanged; layout re-flowed for the sheet; one language.
- Map and Camp dialogs: new palette, stone/parchment panels, one language, ≥ 48 px targets. No content change.
- Win dialog: result line, rewards, Replay / Continue.
- `check-codequest-ui.py` (Playwright, same fixture approach as `check-kitchen-counter-ui.py`) at 1280×800 and 1280×600: opens Code Quest from the hub; asserts no page scroll, scene ≥ 55 % of viewport height, every `.cq` button ≥ 48 px and hit-testable; builds q01 by taps and wins; EN/中 switch persists; Code / Map / Camp sheets open and close; saves screenshots for Papa.

## DONE WHEN

- `python scripts/check-codequest-ui.py` passes at both sizes with no page or console errors.
- `node scripts/check.mjs` and `node scripts/codequest.test.mjs` green.
- Papa signs off the screenshots.
