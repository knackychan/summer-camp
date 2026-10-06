# Slice 08: Hint text — code rooms q44, q47–q72

**Status:** Design approved by Papa 2026-10-06 (`design.md` D6). Built 2026-10-06; wording approved by Papa the same day (`review-07-08-code-rooms.md`).
**Goal:** The remaining typed-code quests (mechanisms, logic, companions, signals, state machines) have their own hints in EN + 繁體中文.
**Depends on:** 01.
**Files:** `js/games/codequest/hints.js`, `scripts/codequest-hints.test.mjs`.
**Quests:** q44, q47–q72 (27 quests; regions mechanism, logicworks, coop, signalworks, protocol).

## Change

- Same method and rules as slice 07.
- Signal / event / state rooms: the gentle hint names *who* talks to *whom* and *when* ("The companion should move only after the hero says READY."), the strong hint names the construct (`on("signal", relay)`, `hero.signal("ready")`, `hero.state = "attack"`), the near hint leads into the peek.
- Papa reads the lines before commit.

## DONE WHEN

- Test: q44 and q47–q72 have hand-written entries for all three tiers; **the fallback is now allowed for no quest** (all 72 strict); all D6 rules pass.
- Papa approved the wording in chat.
- `node scripts/check.mjs` green.
