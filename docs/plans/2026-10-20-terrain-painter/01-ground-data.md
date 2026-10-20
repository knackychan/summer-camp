# 01: Ground data + pure logic
**Depends on:** nothing.
Add `js/brick-lab/brick-ground.js` (D9): the terrain table with bilingual names, `brushCells`, `applyCells` (returns the new string and an undo list), and validate/decode (a bad or missing string gives a plain plate). Load and save the `ground` field in `brick-worlds.js` / `brick-storage.js`, additive.
**DONE WHEN:** node tests cover brush shapes S/M/L at the edges and corners, apply + undo round-trip, and a missing or bad field giving a plain plate; an old saved world loads unchanged; `node scripts/check.mjs` green (bilingual names).
