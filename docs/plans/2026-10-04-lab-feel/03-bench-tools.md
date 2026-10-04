# Slice 03 — Bigger tools and their names

**Status:** Approved by Papa 2026-10-04 (`design.md` D2, D3).
**Goal:** Mortar, spoon and frost plate are 1.5× bigger and sit on the bench beside the cauldron. Every tool shows its action name below it.
**Depends on:** 01, and 02 (the tools are drawn with 02's shading helpers).
**Files:** `js/games/codequest/lab/lab-art.js`, `js/games/codequest/lab/lab-view.js`, `js/games/codequest/lab/lab-screen.js`, `js/games/codequest/strings.js`, `css/codequest.css`, `scripts/codequest-lab-view.test.mjs`, `scripts/codequest-lab.test.mjs`, `sw.js` cache bump.

## Change

- **Art:**
  - Mortar, spoon (a ladle in a stand) and frost plate are redrawn at about 39×39 logical px, shaded with 02's helpers.
  - The tool-use animations (`drawToolUse`) are rescaled to the new shapes.
  - The burner front dial becomes 24×12.
- **Layout** (centre group, core coordinates; tuned in the slice against the overlap test):
  - Mortar left of the burner on the bench (≈ x 84–123, y 108–147).
  - Spoon and frost plate right of it (≈ x 197–236 and 240–279, y 108–147).
  - A 12 px plate band below each tool.
  - The heat hit covers the flames and the dial.
  - Bag and scroll stay on the bottom row. Journal and owl are unchanged.
  - Hits are padded into free space. Each tool's hit includes its plate band.
- **Plates (D3):**
  - A DOM layer `.cq-lab-plates` inside the scene, with one `<span class="cq-lab-plate">` per tool.
  - Each plate shows an icon plus `ALCHEMY_LABELS[step]` in the kid's language: 🔨 Grind 研磨, 🔥 Heat 加熱, 🥄 Stir 攪拌, ❄️ Cool 冷卻.
  - Plates are centred under the tool's art, use `pointer-events: none` and have text of at least 14 px.
  - Plates are re-placed from the hits on every draw, but only touched when they move.
  - The cauldron plate, ⬇ Drop in 放進去 (`LAB.dropIn`), shows only while something is lifted.
- `snapshot()` gains `plates: [{ id, text, x, y, w, h }]`.

## DONE WHEN

- Tests:
  - new tool hits are at least 1.5× the old area and ≥ 48 CSS px at every room size
  - no hit overlaps another at any size
  - plate text exists in both languages
  - the cauldron plate appears only while `held`
- Manual check at 1280×800 and 1024×600, in EN and 中文:
  - plates are legible and sit under their tools
  - plates never cover a jar, the bag or the cauldron
  - tapping a plate does the tool's action
- `node scripts/check.mjs` green (bilingual completeness).

## Implementation notes (2026-10-04)

- **Layout (core px, centre group):** mortar `prop:grind` 84,104 40×48; spoon crock `prop:stir` 196,104 40×48; ice slab `prop:cool` 240,104 40×48 (art in the top 39 px, plate band below); burner `prop:heat` 136,129 48×37 (flames, dial, plate). Touching but never overlapping the bag (y 152) and the scroll (y 152) at every room size (matrix test).
- **Art:** mortar = half-sphere stone bowl lit per pixel + herbs + pestle; spoon = clay crock lit as a cylinder with a blue band and a big wooden spoon standing in it; frost = an ice slab drawn as a box (receding top face, front face, etched snowflake, icicles, mist). Each casts a dithered contact shadow. Burner dial 24×12. Tool-use animations moved to the new shapes (pestle pounds into the bowl, mist off the slab, swirl at the crock).
- **Plates:** `PLATES` in `lab-screen.js` (exported for the test): 🔨 Grind 研磨, 🔥 Heat 加熱, 🥄 Stir 攪拌, ❄️ Cool 冷卻 from `ALCHEMY_LABELS`, and ⬇ Drop in 放進去 (`LAB.dropIn`, gold) on the cauldron's belly only while something is lifted — under the cauldron is the burner, so its plate sits on the pot itself. Each layout hit carries `plate: [dx, dy]`; `drawLab` returns it in CSS px. Plates are re-placed only when a position or the lift changes; `render()` rebuilds them on a language switch. `snapshot().lab.plates` lists the visible ones.
- **Tests:** the core-layout test now checks the Phase 1 rects that did not move plus each tool ≥ 1.5× its Phase 1 area with its plate inside; a new test checks all 5 plates ship EN + 中文 and sit inside their hit at every stage. 18 view tests; lab harness green at 4 sizes.
- **Screenshots:** `test-results/codequest-lab/feel-tools-{open,lifted,drag}-1280x800.png`, `feel-tools-zh-*-1024x600.png`.
- `sw.js` cache `summer-quest-v161-lab-feel-03`.
