# Brick Lab — Parts from the Lego survey (46 → 81)

**Status:** decisions approved by Papa in chat, 2026-10-05 (pasted "Lego Survey Option A" brief → survey run on Rebrickable data instead of 9 hand-picked sets → "things can stuck on top of everything" / "let them stack thing on top of anything if they want to" → size cap 8: "ok" → 中文 names as listed: "yes ok"). Waiting for Papa to read this file.

**Depends on:** `docs/plans/2026-10-05-brick-lab-more-parts/` slices 01–04 (all of them shipped first). This plan reuses that plan's builders (round plate, inverted slope, window), its catalog gate and its catalog fingerprint.

**Amends:** more-parts D5 (at most 6 studs on a side → at most 8; see D4 here). More-parts D3 and D8 were themselves amended the same day (anything stacks on anything); this plan follows that rule.

**Supersedes, from the pasted brief:** its 9 hand-picked sets (City, Creator, Technic), its part numbers (several pointed at other parts: 3666 is Plate 1×6, 3857 a baseplate, 42003 a Technic connector), Technic as a source (studless beams and pins; Brick Lab has no Technic holes), and its hinges and gears (left for a "moving parts" plan, more-parts D1). The brief is not kept in the repo; this file and `survey.md` are the record.

## What it is
Thirty-five more parts, chosen by how many real Lego sets use them. A new **Tiles ▭ 光面板** category holds the smooth, studless pieces, which were the biggest gap: Tile 1×2 is in 78% of the surveyed sets and Brick Lab had none. The rest are longer plates, a round 1×1 plate and brick, a cone, a pillar, a low slope, a small eave, two curved slopes, a corner plate, a cut-corner plate, an arch, a door, a big window and leaves. All static, all snap, turn, recolour, undo, save and share like today's parts.

## Decisions
| # | Decision | Rationale |
|---|---|---|
| D1 | **Chosen by data.** Rebrickable's public dumps (downloaded 2026-10-05): 664 sets from 2019–2025 with at least 50 pieces — City 251, Friends 238, Creator 3-in-1 101, Creator Expert / Icons 74. A part's score is how many of those sets contain it (spares, printed parts, minifigure, Technic and sticker categories left out). Method, script and the top 60 with what happened to each: `survey.md`, `survey.py`. | Hundreds of sets instead of nine; minutes instead of hours; part names checkable against Lego's own. |
| D2 | **35 parts, 10 categories, ids stable.** New category Tiles ▭ 光面板 (after Plates) +13; Plates +9; Bricks +5; Slopes +4; Structure +3; Nature +1. Full list below. Every label EN + 繁體中文. No existing id, colour id or category id changes. | More to build with, same studs-and-grid rules. Old builds and worlds load unchanged. |
| D3 | **Anything stacks on anything, tiles included.** A tile has no studs, but a brick dropped on it rests on it, as on every other part (more-parts D3, amended). | Papa's choice: "let them stack thing on top of anything if they want to." |
| D4 | **Size cap 8 studs per side** (was 6, more-parts D5); height cap 8 units unchanged. `check.mjs` gate updated. Lets Plate 1×8 (46% of sets), Plate 2×8 (48%) and Tile 1×8 (40%) in. | Papa: "ok". The 8-long pieces are among the most used; nothing in placement depends on the old cap. |
| D5 | **Footprints stay boxes.** Placement and stacking use each part's full rectangle, so the corner plate's empty corner, the space under the arch and the doorway count as filled: nothing goes there. | `landing()` works on box bounds; cell-by-cell footprints would touch every placement path for three parts. Fine for a toy; revisit if kids ask. |
| D6 | **Nothing side-attached, nothing moving, no jumpers.** Brackets (41%), bricks with studs on a side (up to 45%), clips (45%), handles (40%) and bars (28%) need a "studs on the side" or clip system Brick Lab doesn't have — a later plan. Jumper plates (68%, 53%) are left out: pieces snap to whole studs, so a jumper would just be a plate with one odd stud. The door is a closed door; it doesn't open (more-parts D1). | Parts must do what they look like they do. |
| D7 | **Fixed colours:** leaves (green) and the big window's pane (the same see-through light blue `kit.custom("window:pane")` as `window_1x2`). The door and its frame take the picked colour together; its knob is a small fixed dark-grey material. Everything else takes the 13 colours. | Leaves read as leaves; windows match each other. |
| D8 | **Sharing needs no protocol bump.** The catalog fingerprint in `hello` (more-parts D6) already refuses a tablet with a different catalog, with the existing "Update the app on both tablets · 兩台平板都要更新". | Designed for exactly this. |
| D9 | **中文 names as listed.** "Tile" is 光面板 (smooth-face plate), next to 薄板 for plate. | Papa: "yes ok". He can rename any label at review; ids don't change. |
| D10 | **Geometry procedural in `brick-lab.js`,** same `kit` cache and disposal. Reused builders: `rect` (gains a `studs` flag for tiles), round plate (gains `studs` and a height, for round tiles and round bricks), slope, inverted slope, window. New builders: grille tile, quarter tile, rounded plate, corner plate, cut-corner plate, cone, curved slope, arch, door, leaves. | Smallest change; nothing working moves. |

## The parts
| id | EN | 中文 | Category | Footprint | Height | Colour | Lego no. | Sets |
|---|---|---|---|---|---|---|---|---|
| `tile_1x1` | Tile 1×1 | 光面板 1×1 | tiles | 1×1 | 0.4 | any | 3070b | 48% |
| `tile_1x2` | Tile 1×2 | 光面板 1×2 | tiles | 1×2 | 0.4 | any | 3069b | 78% |
| `tile_1x3` | Tile 1×3 | 光面板 1×3 | tiles | 1×3 | 0.4 | any | 63864 | 44% |
| `tile_1x4` | Tile 1×4 | 光面板 1×4 | tiles | 1×4 | 0.4 | any | 2431 | 67% |
| `tile_1x6` | Tile 1×6 | 光面板 1×6 | tiles | 1×6 | 0.4 | any | 6636 | 55% |
| `tile_1x8` | Tile 1×8 | 光面板 1×8 | tiles | 1×8 | 0.4 | any | 4162 | 40% |
| `tile_2x2` | Tile 2×2 | 光面板 2×2 | tiles | 2×2 | 0.4 | any | 3068b | 58% |
| `tile_2x3` | Tile 2×3 | 光面板 2×3 | tiles | 2×3 | 0.4 | any | 26603 | 39% |
| `tile_2x4` | Tile 2×4 | 光面板 2×4 | tiles | 2×4 | 0.4 | any | 87079 | 61% |
| `tile_grille_1x2` | Grille | 格柵板 | tiles | 1×2 | 0.4 | any | 2412b | 60% |
| `tile_round_1x1` | Round Tile 1×1 | 圓光面板 1×1 | tiles | 1×1 | 0.4 | any | 98138 | 68% |
| `tile_round_2x2` | Round Tile 2×2 | 圓光面板 2×2 | tiles | 2×2 | 0.4 | any | 14769 | 36% |
| `tile_quarter_1x1` | Quarter Tile | 扇形光面板 | tiles | 1×1 | 0.4 | any | 25269 | 41% |
| `plate_round_1x1` | Round Plate 1×1 | 圓薄板 1×1 | plates | 1×1 | 0.4 | any | 6141 | 73% |
| `plate_1x6` | Plate 1×6 | 薄板 1×6 | plates | 1×6 | 0.4 | any | 3666 | 70% |
| `plate_1x8` | Plate 1×8 | 薄板 1×8 | plates | 1×8 | 0.4 | any | 3460 | 46% |
| `plate_2x3` | Plate 2×3 | 薄板 2×3 | plates | 2×3 | 0.4 | any | 3021 | 68% |
| `plate_2x8` | Plate 2×8 | 薄板 2×8 | plates | 2×8 | 0.4 | any | 3034 | 48% |
| `plate_4x6` | Plate 4×6 | 薄板 4×6 | plates | 4×6 | 0.4 | any | 3032 | 40% |
| `plate_rounded_1x2` | Rounded Plate 1×2 | 圓角薄板 1×2 | plates | 1×2 | 0.4 | any | 35480 | 52% |
| `plate_corner_2x2` | Corner Plate | 轉角薄板 | plates | 2×2 | 0.4 | any | 2420 | 42% |
| `plate_wedge_2x2` | Cut-Corner Plate | 斜角薄板 | plates | 2×2 | 0.4 | any | 26601 | 23% |
| `brick_1x6` | Brick 1×6 | 積木 1×6 | bricks | 1×6 | 1.2 | any | 3009 | 48% |
| `brick_round_1x1` | Round Brick 1×1 | 圓積木 1×1 | bricks | 1×1 | 1.2 | any | 3062b | 59% |
| `brick_round_2x2` | Round Brick 2×2 | 圓積木 2×2 | bricks | 2×2 | 1.2 | any | 3941 | 36% |
| `cone_1x1` | Cone | 圓錐 | bricks | 1×1 | 1.2 | any | 59900 | 42% |
| `pillar_1x1x3` | Pillar | 柱子 | bricks | 1×1 | 3.6 | any | 14716 | 24% |
| `slope_30_1x2` | Low Slope 1×2 | 矮斜坡 1×2 | slopes | 1×2 | 0.8 | any | 85984 | 59% |
| `slope_inv_1x2` | Small Eave | 小屋簷 | slopes | 1×2 | 1.2 | any | 3665 | 30% |
| `slope_curved_2x2` | Curved Slope 2×2 | 弧形斜坡 2×2 | slopes | 2×2 | 0.8 | any | 15068 | 66% |
| `slope_curved_1x2` | Curved Slope 1×2 | 弧形斜坡 1×2 | slopes | 1×2 | 0.8 | any | 11477 | 58% |
| `arch_1x4` | Arch 1×4 | 拱形積木 1×4 | structure | 1×4 | 1.2 | any | 3659 | 14% |
| `door_1x4x6` | Door | 門 | structure | 1×4 | 7.2 | frame + door any, knob fixed | 60596 + 60616b | 23% |
| `window_1x4x3` | Big Window | 大窗戶 | structure | 1×4 | 3.6 | frame any, pane fixed | 60594 | 18% |
| `leaves` | Leaves | 葉子 | nature | 1×1 | 0.8 | fixed green | 32607 | 36% |

Heights are a starting point: a slice may adjust one so the part reads right next to a brick, as long as D4 holds and the slice's *As built* updates this table.

## Not in this plan
Side-attached parts (brackets, studs on a side, headlight brick), clips, bars, handles, hinges, jumpers (D6). Curved 4×1 double bow (93273, 38%) and the other curved bricks past rank 60 — next batch if kids like the curves. Cell-by-cell footprints (D5).

## Slices
- `01-tiles.md` — D2 (Tiles category, 13 parts), D3, D4
- `02-plates.md` — D2 (9 plates)
- `03-bricks-and-slopes.md` — D2 (5 bricks, 4 slopes)
- `04-arch-door-window-leaves.md` — D2 (4 parts), D5, D7
- `05-reference-sheet.md` — all 81 parts in one picture for Papa; Android 8 / Chrome 138 check
