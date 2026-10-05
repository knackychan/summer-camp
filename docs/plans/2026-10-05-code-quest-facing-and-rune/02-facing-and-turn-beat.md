# Slice 02: Facing chevron, turn beat, turn words

**Status:** Approved by Papa 2026-10-05 (`design.md` D1–D3).
**Implemented:** 2026-10-05. The chevron grew to a 9-wide arrowhead after a screenshot review (7 wide read too small at 3×). The beat runs 560 ms: the arc is drawn in the first half and the hand holds for the second, because at 320 ms the hand was on screen for only ~120 ms. In Run the next step cuts it short, which is fine. check.mjs and check-codequest-ui.py green.
**Goal:** A kid can always see which way the hero faces, can see each turn happen, and learns that Left means the hero's own left hand.
**Depends on:** none
**Files:** `js/games/codequest/room-view.js`, `js/games/codequest.js`, `js/games/codequest/strings.js`, `scripts/codequest-renderer.test.mjs`, `scripts/check-codequest-ui.py`.

## Change

- **`room-view.js`**
  - New pure helper `facingMarker(snapshot, options)`. It returns `{ x, y, dir, dim }` in logical px, or `null` when the marker is hidden:
    - hidden while `heroMotion` is still running, while `fx.kind === 'turn'` is running for the hero, or when `phase === 'won'`;
    - `dim` is true when the tile ahead is a wall or outside the room.
  - It is exported for tests.
  - `drawFacing(ctx, marker)` draws a 7×4 chevron (cyan core, outline) after the upright sprites and before FX.
- **`turn` FX in `drawFx`**
  - `fx = { kind: 'turn', target, from, to, side }`.
  - Duration: 560 ms (see Implemented).
  - Draw a quarter arc of 2×2 pixels at radius ~13 around the target anchor, from the `from` point to the `to` point, revealed by `t`. With reduced motion, `state.reducedMotion` shows it all at once.
  - Draw a 4×4 skin mitten with outline at the `to` end.
  - `drawRoom` passes `reducedMotion` and `phase` through to these helpers.
- **`codequest.js` `executeOne`**
  - For `turnLeft`/`turnRight`/`companionTurnLeft`/`companionTurnRight`, set the `turn` FX from `event.before.dir` / `event.after.dir`. For the companion, use the companion's old and new dir from the snapshot.
  - Play `sfx.pop`.
  - Announce `Facing …` (screen reader, D3).
  - When `!auto`, notify `MESSAGES.turnLeftStep` / `turnRightStep`.
- **`strings.js`**: add `MESSAGES.turnLeftStep`, `turnRightStep` and `FACING` (up / down / left / right), EN + 繁中.

## DONE WHEN

- Renderer test:
  - `facingMarker` gives the tile ahead for all four facings.
  - It is `dim` against a wall.
  - It is `null` mid-move, mid-turn and when won.
  - `drawRoom` with a `turn` FX and with the marker throws nothing at three scales.
- Harness, q02 Step with Right ×4:
  - each step changes `hero.dir`, sets `fx.kind === 'turn'` and shows the turn bubble;
  - a screenshot of each facing shows the chevron in the right place (reviewed).
- `node scripts/check.mjs` and `python scripts/check-codequest-ui.py` are green.
