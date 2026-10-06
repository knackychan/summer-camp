# Slice 07: Hint text — code rooms q22–q42

**Status:** Design approved by Papa 2026-10-06 (`design.md` D6). Built 2026-10-06; wording approved by Papa the same day (`review-07-08-code-rooms.md`).
**Goal:** Every typed-code quest from the Rune Scriptorium to the Relic Foundry has its own hints in EN + 繁體中文.
**Depends on:** 01.
**Files:** `js/games/codequest/hints.js`, `scripts/codequest-hints.test.mjs`.
**Quests:** q22–q42 (21 quests; regions scriptorium, vault, nexus, relic).

## Change

- Same method and rules as slice 06, with code-room words:
  - **gentle**: what the room asks for in plain words ("You need to know how many enemies there are before you loop.");
  - **strong**: the skill and the keyword the kid types, in `<code>` form inside the string ("Store the count in a variable: `let n = enemies.length;`" — keyword in English, explanation in each language);
  - **near**: lead-in to the code peek.
- Keywords and API names (`let`, `return`, `for (const foe of enemies)`, `hero.target(foe)`) stay in English in both languages; the sentence around them is translated.
- Papa reads the lines before commit.

## DONE WHEN

- Test: q22–q42 have hand-written entries for all three tiers, all D6 rules pass; any `` `code` `` in a hint parses with the existing `parser.js` (or is a bare expression listed in `CODE_API`).
- Papa approved the wording in chat.
- `node scripts/check.mjs` green.

## As built (2026-10-06)

- Code goes in as plain text, not in backticks or `<code>`: hints are inserted as HTML by `pairHTML`, so the test forbids `<`, `>`, `&` and backticks in every hint. Comparisons are said in words ("is above 0", "two checks that must both be true") instead of `>` / `&&`.
- The code-room near lead-in is "Nearly! Your code can start like this:" / "快成功了！程式可以這樣開始：".
- Wording for 07 and 08 is in `review-07-08-code-rooms.md`.
