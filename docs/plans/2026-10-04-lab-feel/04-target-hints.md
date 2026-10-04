# Slice 04 — Where can it go: glow, arrows, drag ring

**Status:** Approved by Papa 2026-10-04 (`design.md` D4).
**Goal:**
- With nothing in hand, the tools glow softly.
- With an ingredient lifted, every place it can go glows brighter and gets a bobbing ▼.
- While dragging, the target under the finger lights up, and near misses still count.

**Depends on:** 03.
**Files:** `js/games/codequest/lab/lab-view.js`, `js/games/codequest/lab/lab-screen.js`, `css/codequest.css`, `scripts/codequest-lab-view.test.mjs`, `scripts/codequest-lab.test.mjs`, `sw.js` cache bump.

## Change

- `drawLab` options gain `hint: { lifted: bool, over: hitId|null }`.
- **Idle glow:** a soft palette glow around the cauldron, mortar, burner and frost plate. Alpha 0.3, breathing ±0.1 over 2.4 s; steady under reduced motion.
- **Lifted:**
  - The glow on those four goes up to alpha 0.7.
  - A 5×4 pixel ▼ sits above each, bobbing 2 px on a 600 ms cycle (still under reduced motion).
  - The spoon is not marked.
- **Dragging:**
  - The `over` target gets a 1-px pulsing yellow ring around its art, and its plate gets `.on` (brighter).
  - `hitNear(hits, x, y, slack)` in `lab-view.js` finds the drop target: an exact hit first; otherwise the nearest hit whose rect is within 12 logical px (× device / dpr in CSS px). Only the cauldron and the state tools count.
  - `onUp` uses `hitNear` for drops.
- **Cursor:** on mouse pointermove only, `canvas.style.cursor = hit ? 'pointer' : ''`.

## DONE WHEN

- Tests:
  - `hitNear` prefers exact over near, returns null otherwise, and scales its slack by the fit
  - glow and arrows are drawn only for the matching hint state (fill-op counts differ)
  - the spoon never gets an arrow
  - with reduced motion, arrow frames at two different times are identical
- Manual check at 1280×800:
  - lift a jar → 4 arrows plus the Drop-in plate
  - drag a few px past the mortar and let go → crushed in hand
- `node scripts/check.mjs` green.

## Implementation notes (2026-10-04)

- **Targets:** `DROP_TARGETS` in `lab-view.js` = cauldron, mortar, burner, frost plate (never the spoon). Each has a glow ellipse and an arrow spot in core px (`HINT`).
- **Glow:** a three-ring palette pool behind each target (drawn before the burner and tools): alpha 0.1 ± 0.03 breathing over 2.4 s when idle, 0.2 while something is lifted, a white pool on the target under the finger. Pause and reduced motion hold it steady.
- **Arrows:** an outlined 7×4 ▼ over each target while `hint.lifted`, bobbing 0–2 px on a 600 ms cycle (still under pause / reduced). Drawn after the bag, under the effects.
- **Drag:** `onMove` resolves the target under the ghost with `hitNear` (12 logical px of slack, scaled by the fit); `dragOver` drives a two-ring pulsing ellipse on its art and `.on` on its plate. `onUp` drops with the same `hitNear`, so a near miss on the mortar, burner, frost plate or cauldron lands.
- **Cursor:** a mouse (only) gets `cursor: pointer` over any hit.
- **Tests:** 2 new (`hitNear` exact > near > nothing, no slack → no near miss, spoon never a target; hints add arrows only when lifted and a ring under the finger, never move hits, hold still under reduced motion). 20 view tests; lab harness green at 4 sizes.
- **Screenshots:** `test-results/codequest-lab/feel-hints-{open,lifted,drag}-1280x800.png` (drag = an Echo Crystal held just left of the mortar: ring + lit Grind plate).
- `sw.js` cache `summer-quest-v162-lab-feel-04`.
