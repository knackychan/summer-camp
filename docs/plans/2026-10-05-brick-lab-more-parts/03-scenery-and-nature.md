# Slice 03 — Scenery category, rock and mushroom

**Decisions:** D2 (7 parts + Scenery), D3 (round tops in use), D4, D8. **Depends on:** 01 (`top`, `CATALOG_ID`). Independent of 02.

## Changes
- `js/brick-lab/brick-catalog.js`
  - Category `{ id: "scenery", label: ["Scenery", "景物"], icon: "🪵" }`, after `nature`.
  - Nature: `rock` (`shape: "rock"`, 2×2, 1.0 tall, `top: "round"`), `mushroom` (`shape: "mushroom"`, 1×1, 1.2 tall, `top: "round"`).
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
  - `SNAP_GUIDES.round` = ["Sits on top. Nothing stacks on it.", "可以放在上面，但上面不能再疊。"]; the guide picker returns it for rock and mushroom (`top === "round"` and not a wheel).
  - Rock and mushroom go through the normal `landing()` path (they can sit on a brick); trees and flowers keep their ground-only path.
- `css/brick-lab.css` — CSS fallback icons for the seven shapes.
- `sw.js` — bump `CACHE_NAME`.

## Tests
- `scripts/check-brick-lab-ui.py`
  - `NEW_PARTS` gains the 7 ids (arm and build < 50 ms, real-part icon); the category loop in the part search covers `scenery` and `nature`.
  - Switching through all 9 categories never resizes the view.
  - A mushroom dropped on a 2×4 brick sits on the brick; a brick then dropped on that mushroom lands on the 2×4 brick, not on the mushroom. Same for a rock on the plate.
  - A crate dropped on a log stacks on the log; a barrel on a crate stacks on the crate.
  - Rock, mushroom and log icons don't change with the picked colour; crate and barrel do.
  - The rock's geometry is identical across two loads (same vertex count and bounding box).
- Screenshot for Papa: a little camp scene — log cabin, crates and barrels, a fence line, rocks and mushrooms (`.tmp/brick-lab-ui/scenery-camp.png`).

**DONE WHEN:** `node scripts/check.mjs` green; `check-brick-lab-ui.py` passes; 46 parts across 9 categories; Papa has seen the camp screenshot.
