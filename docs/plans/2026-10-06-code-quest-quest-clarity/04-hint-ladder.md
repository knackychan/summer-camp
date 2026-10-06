# Slice 04: Hint ladder on stuck signals

**Status:** Design approved by Papa 2026-10-06 (`design.md` D6, D7). Built 2026-10-06; `check-codequest-ui.py` green at both sizes.
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

## As built (2026-10-06)

- At the near tier the bubble says "Look at the 🏁 goal card: it shows how to start." / "看看 🏁 目標卡：上面有開始的方法。" instead of the near lead-in (which ends in a colon and only makes sense next to the peek).
- The goal pop puts the 💡 hint (and peek) right under the title, and never runs past the scene: its `max-height` follows the scene bottom and the rest scrolls inside it. At 1280×600 the q12 peek fits without scrolling.
- The Rune coach waits while the goal pop is open, so the two cards never overlap.
- The hero resting clears "ran since Reset", so the Reset that follows a rest is not a second signal.
