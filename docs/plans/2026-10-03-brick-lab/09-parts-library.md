# Slice 09 — More parts: 11 new pieces, two new categories

**Requested by Papa, 2026-10-04** (brief "Brick Lab: Expand Parts Library, Rails with Circuits, Enhanced Browser", issue 1). Amends design.md with D16–D17.

**Depends on:** 05 (proportions, cache), 08 (steady dock).

## Decisions

| # | Decision | Rationale |
|---|---|---|
| D16 | **26 parts (was 15): 11 added, ids stable.** Bricks 1×3, 2×5; plates 1×4, 2×6; a 2×2 roof peak (`slope_45`); a medium wheel; an axle; curved, T and cross rails; a 4×4 platform. Two new categories, Connectors 🔩 (axle) and Structure 🏗️ (platform), as the brief's table asks; the category list now scrolls inside the left rail. Every label is EN + 中文. | More to build with, same studs-and-grid rules. Saved builds keep working: no existing id changed. |
| D17 | **Rails are data.** Each rail part carries its centre-line `track` (line / arc / pad segments) and its `connectors` (point on the footprint edge + facing direction). One geometry builder draws every rail from that data, so all four share gauge, sleepers and joints. Rail footprints are even, so every rail end lands on a whole stud. | One look, seamless joins, and the join logic (slice 10) reads the same data the geometry is built from. |

### Where this differs from the brief
- **Curve and T are 4×4, not 2×2 / 3×3.** The track is 2 studs wide; a quarter turn inside 2×2 would have a 0.4-stud inner radius and spill outside its own footprint. A 3×3 (odd) piece centres on half studs, so its ends could never meet a straight rail's ends. At 4×4 the curve's radius is 2 and four curves close a ring.
- **`slope_45` is called "Roof Peak 45° 屋脊 45°", not "Arch".** Its shape is the brief's "angled peak" (two faces meeting at a ridge), and that is what a kid sees; "arch" would promise a curve under it.
- **Medium wheel and axle keep whole-stud footprints** (1×1 and 1×2, axle one plate tall) so they snap to the grid like everything else; the wheel is drawn 1.35× the small one.
- **Axle's 中文 is 車軸** (clearer for kids than 軸 alone).

## Changes
- `js/brick-lab/brick-catalog.js` — new parts, `rail()` helper with track + connectors, `FIXED_COLOR_SHAPES`, `partDims()`, two categories.
- `js/brick-lab/brick-lab.js` — `trackGeometries()` (lines, arcs, pad) used by every rail; `makePeakPiece`, `makeAxlePiece`; wheels scale per part. Geometry stays cached per part and disposed with the lab.
- `css/brick-lab.css` — tray previews for the new shapes; scrolling category list.
- `scripts/check.mjs` — Brick Lab catalog gate: unique ids, bilingual parts/categories/colours, no empty or unknown category, rail ends on whole studs.

**DONE WHEN:** `node scripts/check.mjs` green; `check-brick-lab-ui.py` passes, including every new part arming and building its geometry in < 50 ms and switching through all 8 categories without resizing the view.

**Verified 2026-10-04:** `check.mjs` green (includes `brick-rails.test.mjs`, 8/8); `check-brick-lab-ui.py` 60/60 on source (Chromium 141 headless, SwiftShader), no page or console errors. Not yet run: `check-android8-ui.py` with Chrome 138, because no Chrome 138 binary was available in the build container.
