# Slice 03: A refused Run names every missing skill

**Status:** Design approved by Papa 2026-10-06 (`design.md` D3). Built 2026-10-06; unit tests and `check-codequest-ui.py` green.
**Goal:** When Run is refused for a missing skill, the kid hears the whole rule and exactly what is still missing — never the wrong skill.
**Depends on:** 01.
**Files:** `js/games/codequest.js`, `js/games/codequest/strings.js`, `scripts/codequest-hints.test.mjs`, `scripts/check-codequest-ui.py`.

## Change

- `beginIfNeeded`, `missing-concept` branch: replace the `repeat ? needRepeat : if ? needIf : needCall` choice with
  `needsAll(skillsFor(level), missingSkills(level, S.program, functions()))` →
  "This quest needs 🪨 Rune + 🔁 Repeat. Still missing: 🔁 Repeat." / "這一關需要 🪨 符文＋🔁 重複。還差：🔁 重複。"
  When everything is missing the second sentence is dropped.
- If the only missing skill is Rune (`call`) and the Rune row has cards, keep today's `runeReady` wording after the sentence ("Put the 🪨 card in the Hero row.").
- `needsAll` lives in `hints.js` (pure, testable); `strings.js` gets `needsAll` / `stillMissing` templates (EN + 中文).
- `needRepeat`, `needIf`, `needCall` stay in `strings.js`.

## DONE WHEN

- Unit test: for every quest with `requires`, an empty program gives a message naming each chip; q25 (requires `let`) names variable 變數 and never Rune; q12 with only the Rune row filled names Repeat as missing.
- `check-codequest-ui.py`: q12, Hero row = Attack, Run → bubble shows "Rune" and "Repeat" in one message.
- `node scripts/check.mjs` green.
