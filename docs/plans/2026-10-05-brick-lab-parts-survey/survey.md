# Survey — which Lego parts real sets use most (2026-10-05)

**Data:** Rebrickable's public CSV dumps (`sets`, `inventories`, `inventory_parts`, `parts`, `part_categories`, `themes`), downloaded 2026-10-05 from `https://cdn.rebrickable.com/media/downloads/`. Not kept in the repo (≈140 MB); `survey.py` re-runs the count.

**Sets:** 664 — every set from 2019–2025 with at least 50 pieces in City (251), Friends (238), Creator 3-in-1 (101), Creator Expert / Icons (74). First inventory version of each set.

**Score:** number of those sets that contain the part (any colour, not counting spares). "Sets" below is that number as a share of 664. Left out before counting: printed and patterned parts, and the Technic, minifigure, sticker, Duplo, electronics and similar categories.

**Status:** *have* = in Brick Lab today · *more-parts* = in `2026-10-05-brick-lab-more-parts` · an id = in this plan · *later* = needs a system Brick Lab doesn't have (design D6) · *skip* = left out, with why.

## Top 60
| # | Lego no. | Part | Sets | Status |
|---|---|---|---|---|
| 1 | 3023 | Plate 1×2 | 90% | have |
| 2 | 3710 | Plate 1×4 | 82% | have |
| 3 | 3020 | Plate 2×4 | 82% | have |
| 4 | 3069b | Tile 1×2 | 78% | `tile_1x2` |
| 5 | 3022 | Plate 2×2 | 77% | have |
| 6 | 6141 | Plate Round 1×1 | 73% | `plate_round_1x1` |
| 7 | 3004 | Brick 1×2 | 72% | have |
| 8 | 3666 | Plate 1×6 | 70% | `plate_1x6` |
| 9 | 98138 | Tile Round 1×1 | 68% | `tile_round_1x1` |
| 10 | 3021 | Plate 2×3 | 68% | `plate_2x3` |
| 11 | 3795 | Plate 2×6 | 68% | have |
| 12 | 15573 | Jumper Plate 1×2 | 68% | skip: whole-stud grid makes it a plate with an odd stud |
| 13 | 2431 | Tile 1×4 | 67% | `tile_1x4` |
| 14 | 15068 | Curved Slope 2×2×⅔ | 66% | `slope_curved_2x2` |
| 15 | 3024 | Plate 1×1 | 63% | more-parts |
| 16 | 3010 | Brick 1×4 | 62% | have |
| 17 | 87079 | Tile 2×4 | 61% | `tile_2x4` |
| 18 | 3005 | Brick 1×1 | 61% | have |
| 19 | 2412b | Grille Tile 1×2 | 60% | `tile_grille_1x2` |
| 20 | 54200 | Cheese Slope 1×1 | 59% | more-parts |
| 21 | 85984 | Slope 30° 1×2×⅔ | 59% | `slope_30_1x2` |
| 22 | 3062b | Round Brick 1×1 | 59% | `brick_round_1x1` |
| 23 | 3068b | Tile 2×2 | 58% | `tile_2x2` |
| 24 | 11477 | Curved Slope 2×1 | 58% | `slope_curved_1x2` |
| 25 | 6636 | Tile 1×6 | 55% | `tile_1x6` |
| 26 | 3001 | Brick 2×4 | 53% | have |
| 27 | 87580 | Jumper Plate 2×2 | 53% | skip: as #12 |
| 28 | 3623 | Plate 1×3 | 52% | more-parts |
| 29 | 35480 | Rounded Plate 1×2 | 52% | `plate_rounded_1x2` |
| 30 | 3003 | Brick 2×2 | 52% | have |
| 31 | 4032a | Plate Round 2×2 | 51% | more-parts |
| 32 | 20482 | Round Tile 1×1 with Bar | 49% | later: bars |
| 33 | 3070b | Tile 1×1 | 48% | `tile_1x1` |
| 34 | 3034 | Plate 2×8 | 48% | `plate_2x8` |
| 35 | 3009 | Brick 1×6 | 48% | `brick_1x6` |
| 36 | 3460 | Plate 1×8 | 46% | `plate_1x8` |
| 37 | 85861 | Plate Round 1×1, open stud | 45% | `plate_round_1x1` (same look as #6) |
| 38 | 11211 | Brick 1×2, 2 studs on side | 45% | later: side studs |
| 39 | 15712 | Tile 1×1 with clip | 45% | later: clips |
| 40 | 18674 | Round Jumper 2×2 | 44% | skip: as #12 |
| 41 | 63864 | Tile 1×3 | 44% | `tile_1x3` |
| 42 | 41740 | Plate 1×4 with 2 studs | 42% | skip: jumper, as #12 |
| 43 | 2420 | Corner Plate 2×2 | 42% | `plate_corner_2x2` |
| 44 | 59900 | Cone 1×1 | 42% | `cone_1x1` |
| 45 | 25269 | Quarter Round Tile 1×1 | 41% | `tile_quarter_1x1` |
| 46 | 99780 | Bracket 1×2 – 1×2 inverted | 41% | later: side studs |
| 47 | 24866 | Flower plate 1×1 | 40% | have (`flower`) |
| 48 | 4162 | Tile 1×8 | 40% | `tile_1x8` |
| 49 | 3032 | Plate 4×6 | 40% | `plate_4x6` |
| 50 | 48336 | Plate 1×2 with side handle | 40% | later: clips/handles |
| 51 | 26603 | Tile 2×3 | 39% | `tile_2x3` |
| 52 | 87087 | Brick 1×1, stud on side | 39% | later: side studs |
| 53 | 99207 | Bracket 1×2 – 2×2 inverted | 39% | later: side studs |
| 54 | 3622 | Brick 1×3 | 38% | have |
| 55 | 93273 | Curved 4×1 double bow | 38% | skip: next batch |
| 56 | 60897 | Plate 1×1 with clip | 38% | later: clips |
| 57 | 3031 | Plate 4×4 | 37% | more-parts |
| 58 | 30414 | Brick 1×4, 4 studs on side | 36% | later: side studs |
| 59 | 3941 | Round Brick 2×2 | 36% | `brick_round_2x2` |
| 60 | 14769 | Round Tile 2×2 | 36% | `tile_round_2x2` |

## Picked from further down
| # | Lego no. | Part | Sets | Id |
|---|---|---|---|---|
| 61 | 32607 | Leaves plate 1×1 | 36% | `leaves` |
| 79 | 3665 | Inverted Slope 2×1 | 30% | `slope_inv_1x2` |
| 109 | 14716 | Brick 1×1×3 | 24% | `pillar_1x1x3` |
| 114 | 60596 | Door Frame 1×4×6 | 23% | `door_1x4x6` (with door 60616b, 14%) |
| 117 | 26601 | Wedge Plate 2×2 Cut Corner | 23% | `plate_wedge_2x2` |
| 153 | 60594 | Window 1×4×3 | 18% | `window_1x4x3` |
| 194 | 3659 | Arch 1×4 | 14% | `arch_1x4` |

The door, window and arch rank lower but add things a kid can't make from other parts (a house with a door, a big window, a bridge).
