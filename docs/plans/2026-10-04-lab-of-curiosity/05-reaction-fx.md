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

## Implementation notes (2026-10-04)

- **New file `lab/lab-fx.js`** (not in the slice's file list): the 15 drawers, `fxPose` (shake, owl hop / blink, cat leap, leaning jars) and `drawEffect`. Kept out of `lab-view.js` so the scene file stays the scene; `lab-view.js` reads the pose before drawing and draws the effect last, over the light. `lab-art.js` gains the `blob` bitmap and a `scale` option on `drawLabSprite` (the blob and potion bottle draw at 2×).
- **Clock.** Effects run on `now − effect.start` even under reduced motion (the idle life stays frozen there, as slice 03 tested); `paused` is unused by the Lab.
- **Beats and lingering**, as the table: potion bottle rises with sparkles; pocket-universe spiral; explosion = flash (first 200 ms) + ember ring + smoke + scene shake, then soot on the owl lingers; time rewind sends the last ingredient back to its jar or bag slot with tightening rings; singularity orb pulls sparks in and the jars lean toward it; the blob hops onto the bench and keeps bouncing; duplication pops 2 / 4 / 8 copies of the mix's first living ingredient onto the bench; vines (4 / 6 / 6) climb the wall and shelf posts; fireball arcs out of the top right; frost spikes on the rim; glow brightens the room and rings the moon; steam, bubbles (they pop), smoke rings (1–3); fizzle sparks and the owl blinks. The cat leaps at explosion, fireball and singularity.
- **Reduced motion:** no shake, no flash, no owl hop or cat leap (the cat still wakes), explosion is a grey puff, half the particles, lingering parts hold still.
- **Sound:** `good` for a potion or a newly found rule (`labBrew` now returns `newRule`), else `hit` for explosion, `zap` for fireball / singularity, `pop` for the rest.
- **Tests** in `scripts/codequest-lab-view.test.mjs` (where slice 03 put the Lab renderer tests; `codequest-renderer.test.mjs` untouched), 3 new: every outcome × intensity 1–3 × reduced at t = 0, mid, end and lingering draws palette-only with identical hits; each outcome paints something mid-beat and only the 4 lingering ones remain after; reduced-motion pose is still and draws fewer particles.
- **Screenshots for Papa:** `test-results/codequest-lab/fx-strip-mid.png` (all 15 mid-beat), `fx-strip-linger.png` (after the beat), `fx-strip-reduced.png`.
- `sw.js`: `lab-fx.js` added; cache `summer-quest-v150-lab-05`.
