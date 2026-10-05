# Slice 04: Two rows for the Rune; words and coach fixed

**Status:** Design approved by Papa 2026-10-05 (`design.md` D5, D6). Not started.
**Goal:** The Rune and the hero's program are on screen together, and every message names a card the kid can see.
**Depends on:** 02
**Files:** `js/games/codequest.js`, `js/games/codequest/strings.js`, `css/codequest.css`, `scripts/check-codequest-ui.py`.

## Change

- **Two rows.** Rooms offering `callRune`: `.cq-dock` shows a Rune row (🪨 + "Rune / 符文") above the Hero row (▶ + "Hero / 英雄"). Each row has its own strip and its own free-slot count. Other rooms: Hero row only, no row label clutter.
- **Glowing row** = `S.editor` (`'rune'` / `'main'`). Tapping a row label switches it; cards, stickers and the card menu act on the glowing row. Remove `stripTabsHTML` and its CSS.
- **🪨 card.** Pinned picker card; dimmed with "Use it in the Hero row" while the Rune row glows (tap gives `MESSAGES.noSelfCall`). In a row it draws as one card (stone + "Rune"), no mini row — drop the call-bracket branch of `stripCard`/`miniCards` for `rune`. It takes stickers like any card.
- **Running.** Keep reading `activeCalls()` each step; light the running card in whichever row holds it. Remove the strip flip (`followRune`, `S.editorBeforeRun`, `restoreEditor`) and stop showing `runeRunning` / `runeDone` (strings stay).
- **Messages** (D6): `beginIfNeeded` — `empty-program` with a non-empty Rune row → `MESSAGES.runeReady`; `missing-concept` call → reworded `needCall`. The `logic:callRune` path with an empty Rune row glows the Rune row and says `missingFunction` (unchanged text).
- **Coach** (D6): `COACH_STEPS` becomes one step pointing at the Rune row with `COACH.runeRow` and [Got it]. Same `coach: ['rune']` flag.
- **`strings.js`**: `MESSAGES.runeReady`, new `needCall`, `COACH.runeRow`, `UI.heroRow`, `UI.runeRow`, `UI.useInHeroRow`; EN + 中文.

## DONE WHEN

- Harness, both sizes:
  - q11: both rows visible at once; with only Attack ×2 in the Rune row, Run gives `runeReady`; with Hero = 🪨, Move, Right, 🪨 the run wins, and at each Rune step exactly one card is lit and it is in the Rune row; `editor` never changes during the run.
  - q10: the coach shows one card on the Rune row; Got it saves the flag; reopening q10 shows no coach.
  - q05 (no Rune): one row only, no row label tap target.
  - 🪨 card is dimmed while the Rune row glows.
- `node scripts/check.mjs` and `python scripts/check-codequest-ui.py` green.
- Papa plays q10–q12 on a tablet and says whether it is clear.
