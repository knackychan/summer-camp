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
