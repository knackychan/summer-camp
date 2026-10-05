# Slice 04 — Alive on tap (replaces Play)

**Decided by Papa, 2026-10-05**, in chat, after Play was built and before it was committed:
- "please remove this play mode, it is not necessary".
- Asked whether anything should still move by itself: **"Alive only when tapped"**.

This replaces [04-play-alive.md](04-play-alive.md) (kept for the record). It amends design M7 (no Play switch, no Play state) and M10 (alive loops play on a tap, not in a mode). **Depends on:** 03.

## What the kid sees
A tap that **selects** a figure or an animal makes it react for 2 seconds:
- a figure looks around and waves;
- a dog or cat wags and turns its head;
- a bird flaps;
- a fish or shark swishes its tail;
- the frog hops;
- the crocodile snaps.
The motion plays on top of its pose and then settles back exactly into that pose. A second tap on the selected piece still turns it (brick-lab D8). Placing a figure or animal also selects it, so it greets you once.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| T1 | **The trigger is selection.** `selectPiece(id)` starts a 2 s reaction when the selection changes to a jointed piece. No new button, no mode, no state saved or shared. | Tapping is already how a kid "talks" to a piece; no new UI. |
| T2 | **The motion is `aliveAngles` (already committed), faded in and out.** Angle = pose + (alive − pose) × sin(π·t/2), for 0 ≤ t ≤ 2 s, so it starts and ends exactly at the pose. The loop clock is shifted by the piece's seed slot, so the occasional moves (a wave, a flap, a snap, a hop) land inside the 2 s. Reduced motion: half as far. | One motion system, with no jump at the start or end. |
| T3 | **Frames only while something reacts.** While reactions run the lab draws every frame; when the last one ends it returns to drawing on demand (D25). The step-down (D26) measures those frames like any others. | Costs nothing when no one taps. |
| T4 | **During a reaction the piece is drawn jointed; after it, one mesh again** if it has no pose (M2). A piece in focus mode doesn't react (focus is for posing). A removed piece's reaction just stops. | |
| T5 | `nearestIds` and the 40-mover cap are not needed and are removed (with their test). `aliveAngles` and `seedOf` stay. | YAGNI. |

## Parts
- `js/brick-lab/brick-pose.js`: remove `nearestIds`.
- `js/brick-lab/brick-lab.js`:
  - `startAlive(id)`, called from `selectPiece` on a changed jointed selection
  - `this.alive` (id → start time)
  - per-frame update in `startLoop` (T2)
  - draw while alive (T3), rebuild on end (T4)
  - `snapshot().alive` (the reacting ids)
- `scripts/check-brick-lab-ui.py`:
  - Selecting a figure starts a reaction, and its joint angles change.
  - After 2.5 s it is back at its pose and frames stop.
  - Selecting a brick starts nothing.
  - A posed (Cheer) figure ends back in Cheer.

**DONE WHEN:**
- `node scripts/check.mjs` is green.
- `check-brick-lab-ui.py` passes. It needs a quiet machine: the camera checks fail on their timing under heavy CPU load.
- A screenshot taken mid-reaction has been looked at.
