# Brick Lab — More Parts (26 → 46)

**Status:** approved by Papa, 2026-10-05 (chat: pasted "Brick Lab: Expand Part Catalog (26 → X Parts)" brief → "Static parts now" for every part that promises motion or light → "By shape" for how scenery stacks → "ok cool" on the design).

**Amends:** `docs/plans/2026-10-03-brick-lab/design.md` D16 (26 parts) — the catalog grows to 46, ids still stable. `docs/plans/2026-10-04-brick-lab-multiplayer/` D9 (protocol version in `hello`) — see D6 below.

**Supersedes, from the pasted brief:** hinges (2- and 4-stud), ball socket, pin/peg, propeller/fan, tracked platform, light brick, and the "Movement 動力零件" category. The brief's stud size ("0.6 mm Ø") and its 1-unit = 8 mm table are not used; the catalog's own `BRICK_HEIGHT` / `PLATE_HEIGHT` on a 1-unit pitch (brick-lab D10) stay the truth. The brief is not kept in the repo; this file is the record.

## What it is
Twenty more parts in the left-rail browser, all static: smaller and bigger plates, a round plate, small and corner slopes, an eave and a ridge cap, a large wheel, a lattice frame, a support bracket, a window with a see-through pane, a rock and a mushroom, and a new **Scenery 🪵 景物** category with a log, a crate, a barrel, a fence post and a railing. They snap, turn, recolour, undo, save and share exactly like today's parts.

## Decisions
| # | Decision | Rationale |
|---|---|---|
| D1 | **Static parts only.** Every new part is a still shape. Hinges, ball socket, propeller, tank tread and the glowing light brick are left for a later "moving parts" plan. The glass pane is in: a tinted see-through pane doesn't move or glow. The pin/peg is out: there are no Technic holes, so it would do nothing. | Papa's choice. Pieces only turn in 90° steps and there is no joint or animation system; a hinge that never bends promises what it can't do (the same reason slice 09 refused "Arch"). A spinning part would force continuous frames, which brick-lab D25 (render only on demand) removed. |
| D2 | **46 parts, 9 categories, ids stable.** Plates +4 (`plate_1x1`, `plate_1x3`, `plate_4x4`, `plate_round_2x2`); Slopes +5 (`slope_1x1`, `slope_1x2`, `slope_corner_2x2`, `slope_inv_2x2`, `peak_1x2`); Wheels +1 (`wheel_large`); Structure +3 (`frame_2x4`, `brace_1x2`, `window_1x2`); Nature +2 (`rock`, `mushroom`); new Scenery 🪵 景物 +5 (`log_2x4`, `crate_2x2`, `barrel`, `fence_post`, `railing_1x2`). Every label EN + 繁體中文. No existing id, colour id or category id changes. Full list with sizes in the table below. | More to build with, same studs-and-grid rules. Old builds and old worlds load unchanged. |
| D3 | **How a part's top behaves is catalog data: `top: "flat"` (default) or `"round"`.** `landing()` skips any part whose top is round when it looks for what a new piece rests on, so nothing stacks on a rock or a mushroom — but a rock or mushroom can itself sit on a brick. Wheels, the tree and the flower get `top: "round"` too and the shape list in `landing()` (`wheel`/`tree`/`flower`) becomes that one flag check: same behaviour as today. Trees and flowers stay ground-only. Log, crate, barrel, fence post, railing, frame, bracket and window are flat: they stack and can be built on. | Papa's choice ("by shape"). A crate on a roof, a barrel on a boat, a log cabin of stacked logs all work; a brick floating on a rock's highest point doesn't. One rule in data instead of a growing list of shape names. |
| D4 | **Fixed colours:** rock (grey), mushroom (red cap, white dots, cream stem), log (brown bark, tan ends), and the window's pane (see-through light blue). Every other new part takes the 13 colours, the window's frame included. Done through `FIXED_COLOR_SHAPES`; the window's pane material is a separate fixed material, so recolouring a window changes its frame only. | Nature reads as nature; a pink rock would just look broken. Building parts stay the kid's choice. |
| D5 | **Size limits, checked.** Footprint is whole studs, at most 6 on a side (today's largest is 2×6); height at most 8 units. Every new part is at most 4×4 and the tallest is the fence post at 4.8 units (4 bricks). `check.mjs` enforces both for every part, old and new. | The brief's limits, made a gate so a later part can't break them. |
| D6 | **Mismatched catalogs can't share a world.** `hello` carries a short catalog fingerprint (a hash of every part id and colour id, in order) next to `proto`. The host refuses a guest whose fingerprint differs, with the existing wording "Update the app on both tablets · 兩台平板都要更新". `PROTO` goes 2 → 3 once, for adding the field; after that, any catalog change is caught without another bump. | Today a guest on an older app would draw a new part as a 1×1 brick (`getPart` falls back to `PARTS[0]`), silently. Several slices each add parts, so one bump per slice would be easy to forget. |
| D7 | **Geometry stays procedural, built in `brick-lab.js`** next to the existing builders, with the same `kit` cache (one geometry per part, one material per colour) and disposed with the lab. About half the new parts reuse existing builders (`rect`, slope, peak, wheel); the slope builder learns to honour `studs: false` (no change for `slope_2x2`). New builders: round plate, corner slope, inverted slope, frame, bracket, window, rock, mushroom, log, crate, barrel, fence post, railing. The rock is a fixed low-poly shape (seeded, the same on every tablet), not noise at runtime. Only the window pane is transparent. | Smallest change; nothing working moves. A seeded rock keeps icons, saves and shared worlds identical everywhere. One transparent material keeps sorting cost negligible. |
| D8 | **Snap guide for round-topped scenery:** "Sits on top. Nothing stacks on it. · 可以放在上面，但上面不能再疊。" shown in the info card for rock and mushroom. Flat scenery uses the existing studs guide. | Tells a kid why the brick won't go on the mushroom before they try (coach, not cop). |

## The parts
| id | EN | 中文 | Category | Footprint | Height | Top | Colour |
|---|---|---|---|---|---|---|---|
| `plate_1x1` | Plate 1×1 | 薄板 1×1 | plates | 1×1 | 0.4 | flat | any |
| `plate_1x3` | Plate 1×3 | 薄板 1×3 | plates | 1×3 | 0.4 | flat | any |
| `plate_4x4` | Plate 4×4 | 薄板 4×4 | plates | 4×4 | 0.4 | flat | any |
| `plate_round_2x2` | Round Plate 2×2 | 圓薄板 2×2 | plates | 2×2 | 0.4 | flat | any |
| `slope_1x1` | Slope 1×1 | 斜坡 1×1 | slopes | 1×1 | 0.8 | flat | any |
| `slope_1x2` | Slope 1×2 | 斜坡 1×2 | slopes | 1×2 | 1.2 | flat | any |
| `slope_corner_2x2` | Corner Slope | 轉角斜坡 | slopes | 2×2 | 1.2 | flat | any |
| `slope_inv_2x2` | Eave | 屋簷 | slopes | 2×2 | 1.2 | flat | any |
| `peak_1x2` | Ridge Cap | 小屋脊 | slopes | 1×2 | 1.2 | flat | any |
| `wheel_large` | Large Wheel | 大輪子 | wheels | 1×2 | 1.6 | round | any |
| `frame_2x4` | Lattice Frame | 格子框架 | structure | 2×4 | 1.2 | flat | any |
| `brace_1x2` | Support Bracket | 支架 | structure | 1×2 | 1.2 | flat | any |
| `window_1x2` | Window | 窗戶 | structure | 1×2 | 2.4 | flat | frame any, pane fixed |
| `rock` | Rock | 石頭 | nature | 2×2 | 1.0 | round | fixed |
| `mushroom` | Mushroom | 蘑菇 | nature | 1×1 | 1.2 | round | fixed |
| `log_2x4` | Log | 木頭 | scenery | 2×4 | 1.2 | flat | fixed |
| `crate_2x2` | Crate | 木箱 | scenery | 2×2 | 1.2 | flat | any |
| `barrel` | Barrel | 木桶 | scenery | 1×1 | 1.2 | flat | any |
| `fence_post` | Fence Post | 柵欄柱 | scenery | 1×1 | 4.8 | flat | any |
| `railing_1x2` | Railing | 欄杆 | scenery | 1×2 | 1.2 | flat | any |

Sizes are a starting point: the slice may adjust a height or a scale so the part reads right next to a brick, as long as D5 holds and the table here is updated in the slice's *As built*.

## Not in this plan
Hinges, ball socket, pin/peg, propeller, tank tread, light brick (D1). Redo (Brick Lab has Undo only; the brief's "undo/redo works" is checked as Undo). Any change to Undo, worlds, saves, rails or the share op shapes.

## Slices
- `01-plates-slopes-wheel.md` — D2 (8 parts that mostly reuse builders), D3, D5, D6
- `02-roof-and-structure.md` — D2 (5 parts), D4 (window pane), D7
- `03-scenery-and-nature.md` — D2 (7 parts + Scenery category), D3 (round tops in use), D4, D8
- `04-reference-sheet.md` — all 46 parts in one picture for Papa; Android 8 / Chrome 138 check
