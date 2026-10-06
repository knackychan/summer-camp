# Slice 04: Hint ladder on stuck signals

**Status:** Design approved by Papa 2026-10-06 (`design.md` D6, D7). Not started.
**Goal:** A kid who is stuck gets a stronger hint each time, without asking and without being told off.
**Depends on:** 01, 02.
**Files:** `js/games/codequest.js`, `js/games/codequest/strings.js`, `css/codequest.css`, `scripts/check-codequest-ui.py`.

## Change

- State: `S.hintTier` (0–2) and `S.ranSinceReset` (bool). `startLevel` sets both to 0/false unless `preserveProgram` (Reset keeps the tier).
- `stuck()`: `S.hintTier = Math.min(2, S.hintTier + 1)`, then show `hintFor(S.level, S.hintTier)` in the bubble (after any message already queued for that moment). Skipped for `level.endless` / `level.expedition`.
- Stuck signals (exactly these):
  - `executeOne` sees phase become `resting`;
  - Reset room pressed while `S.ranSinceReset` (then it is cleared);
  - `beginIfNeeded` refusal with `missing-concept` or `too-many-blocks` (after slice 03's message).
- `S.ranSinceReset = true` whenever `begin()` succeeds.
- Tier 2 (near): the bubble shows the line, and the goal pop shows the peek: card peeks as small read-only cards with their sticker tags (reuse the strip's card markup, not tappable) + "…" when `more`; when the peek has a 🪨 card and `rune` is set, a second small row "🪨 Rune:" with the Rune's cards; code peeks as a `<pre>` of the lines.
- Goal pop (`goalPopHTML`): 💡 line with the current tier's hint under the chips; the peek under it at tier 2.
- A plain Run ending in `programming` never calls `stuck()`.

## DONE WHEN

- `check-codequest-ui.py` (q12):
  - Run with Hero row = Attack → refusal (slice 03) then the strong hint;
  - a program that makes the hero rest → next tier;
  - Run, then Reset room → next tier; Reset twice without a Run between → only one step;
  - a program that runs and ends without a win, Run pressed again → tier unchanged;
  - at tier 2 the goal pop shows the peek with a 🪨 card and the Rune row's cards;
  - opening another quest → tier back to gentle.
- `node scripts/check.mjs` green.
