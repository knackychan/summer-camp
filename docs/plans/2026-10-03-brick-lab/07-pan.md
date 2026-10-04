# Slice 07 — Pan the view around the island

**Requested by Papa, 2026-10-04:** "make possible the camera to move also around, for now it is locked on the center." Amends design.md with D13.

**Depends on:** 06.

| # | Decision | Rationale |
|---|---|---|
| D13 | **Pan in Build as well as Explore.** Two fingers slide the view (the same gesture pinches to zoom); a mouse uses the right button. Panning moves along the ground, not the screen plane, so the view never tilts or sinks. The view's centre is held within 4 studs of the 64×64 plate's edge, camera moving with it, so the island can't be lost. ⌂ still returns home; Explore → tap still re-centres on the tapped piece. One finger keeps orbiting, and on the selected piece it still drags that piece (D8). | With a 64×64 plate (D12) a kid building in a corner needs to bring that corner to the middle, not only spin around the centre. Two fingers is the standard tablet gesture and doesn't fight one-finger orbit or piece drag. |

No new kid-facing strings.

## Changes
- `js/brick-lab/brick-lab.js` — `enablePan` always on, `screenSpacePanning = false`, `keepViewOnIsland()` in the render loop; `snapshot().target` for the harness.
- `scripts/check-brick-lab-ui.py` — right-drag pans from home view (target moves, height unchanged); a long drag stops over the island.

**DONE WHEN:** `node scripts/check.mjs` green; `check-brick-lab-ui.py` passes.

**Verified 2026-10-04:** `check-brick-lab-ui.py` 39/39.
