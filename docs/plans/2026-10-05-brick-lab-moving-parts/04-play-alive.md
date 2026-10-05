# Slice 04 — ▶ Play: figures and animals come alive in place

**Design:** [design.md](design.md) M7, M10. **Depends on:** 03.

The detailed task list is written when this slice starts.

## What the kid does
A big **▶ Play 玩** button sits over the stage, top right, under the world menu. Pressing it:
- folds the rail and the colours, hides the tools bubble and stops arming and placing; the button becomes **🔨 Build 建造**.
- makes every figure and animal (the 40 nearest the view) play a small loop on top of its own pose: figures look around, sway an arm and now and then wave; four-legged animals wag and turn their head; birds flap; fish and sharks sway; the frog hops in place.
- keeps the camera working as always.

Build puts everything back exactly: same poses, same meshes, nothing saved.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| P1 | **Loops are pure maths.** `brick-pose.js` gets `aliveAngles(part, pose, seconds, seed, scale)`. It returns joint angles = the pose's angles + a loop for the body type, built from sines with periods of 2–6 s. Once every 6–10 s (seeded) a figure waves for 1.5 s. `seed` comes from the piece id, so each piece starts at its own moment. `scale` is 1, or 0.5 with reduced motion. Angles stay inside each joint's `min`…`max`. | Testable in node. The same id gives the same motion on every tablet, without any sync. |
| P2 | **Which pieces move:** when Play starts and after every change, the 40 jointed pieces nearest the camera's look-at point are swapped to jointed meshes (`makeJointedPiece`) and animated. The rest keep their one-mesh rest look. Leaving Play swaps back to `makePieceMesh` for pieces with no pose (M2). | Caps the cost on a big build. Far pieces are small on screen anyway. |
| P3 | **Frames:** while Play is on, the loop draws every animation frame (amends brick-lab D25). On the reduced tier it draws every other frame (~30 fps). The step-down (D26) keeps measuring Play frames, so a slow standard tablet steps down as it already does. Leaving Play goes back to drawing on demand. | Motion needs frames; the existing protections stay in charge. |
| P4 | **Play is local:** never saved, never sent. Remote changes still apply during Play (a re-posed or new piece joins the moving set at the next refresh). Opening focus mode, the world menu or Back leaves Play first. | Papa: Play is per tablet. |
| P5 | **Taps in Play** go to swing parts (slice 05). Anything else does nothing. A slide or pinch moves the camera. | Watching and poking, not building. |

## Parts
- `js/brick-lab/brick-pose.js`: `aliveAngles` (+ node tests: within limits, seeded, the same at the same time, half as far with `scale` 0.5).
- `js/brick-lab/brick-lab.js`:
  - `setPlaying(on)`, the moving set (P2), per-frame joint updates in `startLoop`, the reduced-tier frame skip
  - Play / Build button, `back()` handling
  - `snapshot().play = { on, moving, frames }`
- `css/brick-lab.css`: Play button (56 px), `.sqbl-app.is-play`.
- Strings: Play 玩, Build 建造.

## Checks
- `node scripts/check.mjs` green, including the `aliveAngles` tests.
- `check-brick-lab-ui.py`:
  - Idle with Play off draws no frames (the slice 13 check still holds).
  - Play on: frames climb with no input, and a figure's `poseAngles` change between two readings.
  - No piece's x / y / z changes, and the saved world is byte-for-byte the same as before Play.
  - With 50 figures placed, only 40 move.
  - Play off: frames stop within 600 ms, and unposed figures are one mesh again (`render.calls` back to its Build value).
  - The reduced-tier profile (`deviceMemory` 4) plays at ≤ 31 drawn frames a second.
  - Back from Play returns to Build, not out of the world.
- A short screen recording (`play.webm`) of the starter village with five figures and three animals, looked at for "alive, not frantic".

**DONE WHEN:** the checks pass and the recording has been looked at.
