# Slice 06 — Mini-brick diorama scale

**Requested by Papa, 2026-10-04** (with a reference photo of a brick-built island village): "look more like a cute diorama than those big blocks … mini lego block instead of those duplo looking block." Then, same day: "smaller please again, double time smaller" — the scale below is that second pass. Amends design.md with D12; D1–D11 stand.

**Depends on:** 05.

## Decision

| # | Decision | Rationale |
|---|---|---|
| D12 | **Same bricks, bigger world, seen from further away.** Baseplate 64×64 studs (was 18×18, then 32×32; still one instanced draw call, 6-sided studs on reduced-quality devices); home camera about four times as far as slice 05 with a narrower 34° lens; zoom range 4–128 (Explore 160) so a kid can still get close to a piece. The wooden table goes: the plate is an island on a stepped cliff of grey blocks, in a light shallow-water halo, in a deep-blue sea with small white wave dashes that fades into the background (fog). Fresh saves start from a small village in the middle (three houses, a tower, a path, seven trees, flowers, a three-piece rail; 59 pieces) instead of a loose pile. Saved builds keep their positions — the plate only got bigger. | Brick proportions were already right (slice 05); what made them read as Duplo was how big each brick was on screen. Shrinking the camera's view of them, not the bricks, keeps the snap grid, saves and stacking unchanged. The island and sea come from Papa's reference photo. |

Tablet note: at the home view a 1×1 brick is about 10 px wide. Kids pinch in to place fine detail; the tool bubble and tap-again-to-turn work at any zoom.

## Changes
- `js/brick-lab/brick-lab.js` — `BASE_HALF` 32, camera and fog constants, `addIsland()` (instanced cliff blocks and waves, shallow + deep water), starter village, wider shadow camera (2048 map; shadows stay off on reduced-quality devices).
- `css/brick-lab.css` — stage background is sea blue (no flash of the old sky colour before the first frame).
- `scripts/check-brick-lab-ui.py` — 4096 baseplate studs, starter village size, piece counts relative to it.

**DONE WHEN:** `node scripts/check.mjs` green; `check-brick-lab-ui.py` passes; `check-android8-ui.py` with Chrome 138 passes with Brick Lab on the WebGL1 (r162) path.

**Verified 2026-10-04:** `check-brick-lab-ui.py` 37/37; `check-android8-ui.py` Chrome 138 headless shell — all four profiles `ok`, Brick Lab on `webgl2` and `webgl` (r162), no GL errors (about 340 draws on the WebGL1 path with the 59-piece village, shadows included).
