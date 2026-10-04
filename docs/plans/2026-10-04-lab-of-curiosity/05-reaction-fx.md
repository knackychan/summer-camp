# Slice 05 — Reaction effects in the room

**Status:** Approved by Papa 2026-10-04 (`design.md` rules table, D8, D13).
**Goal:** Every outcome is a small, funny, visible event in the lab — the reaction is the reward.
**Depends on:** 03, 04.
**Files:** `js/games/codequest/lab/lab-view.js`, `js/games/codequest/lab/lab-art.js`, `js/games/codequest/lab/lab-screen.js` (effect lifecycle), `scripts/codequest-renderer.test.mjs`, `sw.js` cache bump.

## Change

- `effect = { ruleId | 'potion', intensity, start, potionId?, lastIngredient? }`, drawn by `drawLab` over the scene; one at a time; a new Brew replaces it.
- One effect per outcome, as in the `design.md` table: potion bottling, pocket-universe swirl, explosion (soot on the owl, cat leaps), temporal rewind (last ingredient arcs back into its jar), singularity (jars lean in), monstrosity (blob hops on the bench), duplication (2 → 4 → 8 copies by intensity), overgrowth (vines up the shelf), fireball (arc across the room), ice burst, glow, steam, bubbles, smoke, fizzle.
- Timing: main beat ≤ 3 s. Lingering parts (blob, copies, vines, soot) stay drawn and idle-animate until ✕ Clear or the next Brew. Nothing persists after leaving the Lab (lasting changes are Phase 4).
- Owl and cat react to every effect (owl: surprised / pleased / sooty; cat startles on explosion, fireball, singularity).
- Sound: `ctx.sfx.good` on a potion and on a new rule; other effects use an existing `ctx.sfx` hook where one fits, else silent.
- `prefers-reduced-motion`: no shake, no flash, explosion becomes a puff, half the particles; the effect still shows.

## DONE WHEN

- `codequest-renderer.test.mjs`: for every rule id and `potion`, `drawLab` at t = 0, mid, end and a lingering frame does not throw and returns unchanged hit rects (effects never block taps); same for reduced motion.
- Screenshot strip of all 15 outcomes in `test-results/codequest-lab/`, reviewed by Papa.
- `node scripts/check.mjs` green.
