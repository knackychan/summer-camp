# Slice 06: Hint text — the 24 card rooms

**Status:** Design approved by Papa 2026-10-06 (`design.md` D6). Not started.
**Goal:** Every picture-card quest has its own gentle / strong / near hints in EN + 繁體中文.
**Depends on:** 01.
**Files:** `js/games/codequest/hints.js`, `scripts/codequest-hints.test.mjs`.
**Quests:** q01–q21, q43, q45, q46 (`codingView` not `'code'`).

## Change

- For each quest, read its map, `objective`, `requires`, `available` and `reference` in `levels.js`, then write `HINTS[id]` per D6:
  - **gentle**: what to look at in the room (the turn, the chest, the armour, the poison…), no skill name;
  - **strong**: the skill by its card name (D1) and what it does here, using the card UI words kids see: "Rune row", "Hero row", "🪨 card", "sticker", "2 times";
  - **near**: one short lead-in to the peek ("Nearly! Your Hero row can start like this:"). Don't repeat the peek in words.
- No hit counts; distances and turn directions are fine ("walk to the end of the hall"); Left/Right are the hero's own hand (facing-and-rune D3).
- 中文 uses Taiwan usage and the game's existing card words (符文, 重複, 如果, 英雄那一排, 貼紙).
- Papa reads the 24 × 3 lines before commit (paste the table in chat).

## DONE WHEN

- Test: these 24 quests have hand-written entries for all three tiers (fallback not allowed), all D6 rules pass.
- Papa approved the wording in chat.
- `node scripts/check.mjs` green.
