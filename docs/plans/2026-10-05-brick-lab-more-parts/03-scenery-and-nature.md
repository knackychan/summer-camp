# Slice 03 — Scenery category, rock and mushroom

**Decisions:** D2 (7 parts + Scenery), D3 (anything stacks, amended 2026-10-05), D4, D8 (amended: no special guide). **Depends on:** 01 (stacking change, `CATALOG_ID`). Independent of 02.

## Changes
- `js/brick-lab/brick-catalog.js`
  - Category `{ id: "scenery", label: ["Scenery", "景物"], icon: "🪵" }`, after `nature`.
  - Nature: `rock` (`shape: "rock"`, 2×2, 1.0 tall), `mushroom` (`shape: "mushroom"`, 1×1, 1.2 tall).
  - Scenery: `log_2x4` (`shape: "log"`), `crate_2x2` (`shape: "crate"`), `barrel` (`shape: "barrel"`, 1×1), `fence_post` (`shape: "fencePost"`, 1×1, 4.8 tall, one stud on top), `railing_1x2` (`shape: "railing"`, studs on its top rail).
  - `FIXED_COLOR_SHAPES` gains `rock`, `mushroom`, `log`.
- `js/brick-lab/brick-lab.js`
  - Builders, all through `kit.geo` / `kit.mat` / `kit.custom`:
    - `makeRockPiece` — a fixed low-poly boulder: an icosahedron, vertices pushed by a seeded pseudo-random (fixed seed, so every tablet and every icon draws the same rock), flattened bottom, fixed grey, flat-shaded.
    - `makeMushroomPiece` — cream stem + red dome cap with white dots, merged into one geometry per material (three fixed materials).
    - `makeLogPiece` — a cylinder lying along the 4-stud axis, brown bark, tan end rings; the bottom sits flush on what's under it.
    - `makeCratePiece` — a box with plank grooves and corner battens (recolourable wood colour; default brown is just the picked colour).
    - `makeBarrelPiece` — a lathe with a bulge and two hoops; flat lid.
    - `makeFencePostPiece` — a 1×1 square post, 4 bricks tall, stud on top.
    - `makeRailingPiece` — two posts and a studded top rail with a lower rail, open between.
  - Rock and mushroom go through the normal `landing()` path (they can sit on a brick, and bricks can sit on them); trees and flowers keep their ground-only path.
- `css/brick-lab.css` — CSS fallback icons for the seven shapes.
- `sw.js` — bump `CACHE_NAME`.

## Tests
- `scripts/check-brick-lab-ui.py`
  - `NEW_PARTS` gains the 7 ids (arm and build < 50 ms, real-part icon); the category loop in the part search covers `scenery` and `nature`.
  - Switching through all 9 categories never resizes the view.
  - A mushroom dropped on a 2×4 brick sits on the brick; a brick then dropped on that mushroom lands on top of the mushroom. Same for a rock on the plate.
  - A crate dropped on a log stacks on the log; a barrel on a crate stacks on the crate.
  - Rock, mushroom and log icons don't change with the picked colour; crate and barrel do.
  - The rock's geometry is identical across two loads (same vertex count and bounding box).
- Screenshot for Papa: a little camp scene — log cabin, crates and barrels, a fence line, rocks and mushrooms (`.tmp/brick-lab-ui/scenery-camp.png`).

**DONE WHEN:** `node scripts/check.mjs` green; `check-brick-lab-ui.py` passes; 46 parts across 9 categories; Papa has seen the camp screenshot.

## As built (2026-10-05)
- Shipped as planned: 46 parts in 9 categories (Nature 4, Scenery 5).
- Rock: `IcosahedronGeometry(1, 1)`, each shared corner pushed by `seeded(20261005)` (mulberry32) to 0.82–1.12 of its radius, bottom flattened, fitted to 1.86 × 1.0 × 1.86; grey `#8f9294` at roughness 0.82.
- Mushroom: cream stem, red dome cap with an underside disc, five flattened white dots turned to the dome's normal; three fixed materials.
- Log: 12-sided trunk along z, radius 0.6 (so it sits in its 2×4 footprint narrower than 2 studs; the box still covers 2×4), tan end faces in a darker ring.
- Crate: inset core, four corner battens, three raised planks a side, a four-board lid; one recolourable material, no studs.
- Barrel: lathe 0.36 → 0.46 → 0.36, flat lid; two dark iron torus hoops (fixed, like the wheel's tyre).
- Fence post: 1×1 footing, 0.56 post, 0.78 cap, one stud; 4.8 tall. Railing: studded top rail, two posts, a lower rail.
- Fixed colours through `FIXED_COLOR_SHAPES` (`rock`, `mushroom`, `log`); their materials use roughnesses no palette colour uses, so a recolour never touches them.
- Short screens: at heights ≤ 760 px the two-column category tiles go from 56 to 50 px tall (still above 44 px) so nine categories fit above the colours at 1024×600 (272 / 272 px). A pre-reader's larger tiles scroll there, with the existing "more below" fade.
- Search: "2x4" also finds the log now (2×4 footprint).
- Tests: `lab_more_parts` covers slices 01–03 (20 parts): fast arm and real icons; counts Plates 9 / Slopes 7 / Wheels 3 / Structure 4 / Nature 4 / Scenery 5; bricks land on top of fence post, railing and rock; a mushroom on a 2×4 brick sits on the brick and a brick then lands on the mushroom; crate on log, barrel on crate; with blue picked, rock / mushroom / log icons have no colour in their key and crate / barrel are `:blue`; the rock's icon is byte-identical in a second kid's session. All nine categories switch without resizing the view and are reachable on a short tablet. 158/158 browser checks.
- Screenshot for Papa: `.tmp/brick-lab-ui/scenery-camp.png` — a log shelter with a plate roof, stacked crates with barrels, a fence of posts and railings, rocks, mushrooms, trees and flowers.
- `sw.js` `CACHE_NAME` → `summer-quest-v172-brick-scenery`.
