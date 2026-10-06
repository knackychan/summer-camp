# Slice 03 — Assembly tile, menu card, ghost and placement

**Requested by Papa, 2026-10-06.** Implements design.md A2, A4, A5, A7 and the Undo / together side of A6.

**Depends on:** 01 (virtual category plumbing in the rail), 02 (generator, `batch` op), brick-lab slice 15 (drag from the rail, `ghostAt`).

## Changes
- `js/brick-lab/brick-lab.js`
  - First tile of Bricks, Plates and Tiles: the Assembly tile (A2). Tapping it sets `assembly` state (pattern, sizes, armed part from the category) and opens the menu card. Not shown in Favourites or search.
  - Menu card overlay (A4): pattern icons, −/+ steppers via `stepSize`, ↻, armed-block tile (tap swaps among tiling parts), count and stud size. Pre-reader mode: icons only. Closing the card keeps the assembly armed; picking any ordinary part disarms it. Settings per pattern saved in prefs `assembly`.
  - Ghost (A7): one merged preview built per (pattern, sizes, part, rotation) and moved with the finger; reduced tier draws the outline box. Frames drawn on demand only.
  - `ghostAt()` takes an assembly shape: the base height is the highest landing under any bottom-layer block; any block off the plate or overlapping a piece ⇒ no ghost, nothing placed, no message.
  - Placement sends **one** `batch` of `add`s: solo — one history snapshot; together — one op through `brick-together.js`, one inverse pushed on `createUndo()`. A rejected batch (changed plate) shows the usual quiet "try again" and leaves nothing behind. `rememberRecent` is called for the armed part once.
  - `bindTrayDrag()` also starts a drag from the card's preview (slice 15 rules: 10 px, sideways, `pointercapture`).
  - `snapshot().assembly` = `{ open, pattern, along, across, up, count, partId, rotation, ghost }` for the check script.
- `js/brick-lab/brick-together.js` — send / receive / apply the `batch` op like any op; host rejection path unchanged.
- `css/brick-lab.css` — card (overlay, bottom-left, ≥ 56 px targets), Assembly tile, pattern icons.
- `scripts/check-brick-lab-ui.py` — Assembly tile is first in Bricks, Plates, Tiles and absent from Doors, Favourites, search; steppers change the count and clamp at 64; ghost follows a drag; letting go places the count of blocks as ordinary pieces; one Undo removes them all; a spot over an existing brick or off the plate places nothing; the card never resizes the canvas or the rail; settings survive a reload; bilingual strings present; on a pretend-wifi together world a guest sees the whole wall and one Undo on the host removes it from both.
- `sw.js` — cache bumped.

**DONE WHEN:** `node scripts/check.mjs` green; `scripts/check-brick-lab-ui.py` passes (solo and pretend-wifi together); `scripts/check-android8-ui.py` with Chrome 138 passes in all four modes; a 64-block ghost drag holds frame rate on the slow standard-tier tablet; tried with a finger on a real tablet.
