# Slice 05: Rune coach

**Status:** Approved by Papa 2026-10-05 (`design.md` D10).
**Goal:** The first time a kid meets the Rune, three short steps explain it: your own card, build it once, use it again and again.
**Depends on:** 04
**Files:** `js/games/codequest.js`, `js/games/codequest/progression.js`, `js/games/codequest/strings.js`, `css/codequest.css`, `scripts/codequest.test.mjs`, `scripts/check-codequest-ui.py`.

## Change

- **`progression.js`**
  - `normalizeProfile` keeps `coach`, a frozen list of ids matching `/^(rune)$/`, with no duplicates. It is additive in v12, and an absent field gives `[]`.
  - Add `markCoachSeen(profile, id)`.
- **`codequest.js`**
  - `startLevel` sets `S.coach = 0` (step 1) when all of these hold:
    - the room offers `callRune`;
    - it is not an expedition, endless or code room;
    - `!profile.coach.includes('rune')`.
  - Otherwise `S.coach = -1`.
  - `.cq-coach` sits in `.cq-play`, positioned like the card menu: above its target, clamped, with a `--tail` pointer. It is shown while `S.coach >= 0`, with no dialog open and not paused.
    - Step 0 targets `.cq-strip-tabs-slot [data-action="strip:rune"]`.
    - Step 1 sets `S.editor = 'rune'` and targets `.cq-strip`.
    - Step 2 sets `S.editor = 'main'` and targets `.cq-library [data-action="logic:callRune"]`.
  - Buttons: `coach:next` and `coach:done`. `coach:done` saves `markCoachSeen(profile, 'rune')` and hides the card.
  - The card isn't modal: everything else keeps working.
- **`strings.js`**: `COACH.rune1–3`, `COACH.next` (Next › / 下一步 ›) and `COACH.done` (Got it / 知道了).

## DONE WHEN

- Unit test: `normalizeProfile` keeps `coach` and drops junk; `markCoachSeen` is idempotent; an old profile without `coach` normalizes to `[]`.
- Harness, q10 with a fresh `coach`:
  - the coach shows step 1 pointing at the Rune tab;
  - Next flips the strip to Rune, and Next again flips it back to Main;
  - Got it hides the card and saves `coach` (it survives reopening q10);
  - every coach button is ≥ 48×48, on screen and hit-testable at both sizes;
  - q05 shows no coach.
- `node scripts/check.mjs` and `python scripts/check-codequest-ui.py` are green.
- The screenshots are reviewed.
