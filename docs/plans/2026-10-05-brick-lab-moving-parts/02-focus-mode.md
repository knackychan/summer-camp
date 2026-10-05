# Slice 02 — Focus mode: the character editor

**Design:** [design.md](design.md) M5 (Papa's review: "zoom into the model and be able to move the part easier like a character edition mode"). **Depends on:** 01 (`setPose`, `cleanPose`, `posesFor`, `jointAngles`, the jointed mesh, `snapshot().poseAngles`).

**Implemented 2026-10-05.** Built inline, test first for the camera and the pose data. As built, against the text below:
- **Framing:** about **half** the stage high (not 60%). The camera looks a little below the piece's middle (`y − 0.35 × height`), so the figure sits above the pose dock at 1024×600 too.
- **Hidden pieces:** pieces between the lens and the focused piece hide while the camera turns, and come back on leaving. Without it, a neighbour filled the lens at 1024×600 after one turn.
- **The hint** sits beside ✓ Done, left-aligned, so it never covers the figure's head.
- **Thin arms:** an arm facing the camera sits over the body, so a tap often finds the body. Legs and the head are easy to tap on the model; the chips are the sure way to pick an arm. The harness checks a leg tap and the arm chip.
- **Unposed pieces in focus:** a piece in focus is drawn jointed even when unposed, so its limbs can be tapped. It goes back to one mesh on leaving (M2).
- **A CSS fix:** a `hidden` bubble tool stays hidden (`.sqbl-bubble button[hidden]`).

Verified:
- `check.mjs` green: camera tests 9, pose tests 11.
- `check-brick-lab-ui.py` 229/229, no page or console errors, including 14 focus checks at 1280×800 and 1024×600.
- Screenshots `focus-figure.png`, `focus-arm-picked.png` and `focus-1024x600.png` looked at.

Pending: Papa's look on a real tablet.

## What the kid does
1. Tap a minifigure. Its tools bubble shows **Pose 🤸 姿勢** next to Move · Turn · Copy · Remove.
2. Press it. The camera glides in (400 ms) until the figure fills about 60% of the stage, looking at its middle, not at the ground. The rail and the colour grid fold away; a soft dark ring (a CSS vignette) dims the rest of the build.
3. Along the bottom, a strip of pose cards: each card shows the figure itself in that pose, with its name in EN + 中文. Tapping one sets that pose.
4. Tap an arm, a leg or the head on the big figure, or its chip above the cards ("Head 頭 · Left arm 左手 · Right arm 右手 · Left leg 左腳 · Right leg 右腳"). That joint gets a gold outline, and two big **↺ ↻** buttons (64 px) turn it one step each way.
5. One finger turns the camera around the figure. Pinch zooms between close and the framing distance. The existing ↺ ↻ + − camera buttons work around the figure.
6. **✓ Done 完成**, or the host Back, glides back to the exact view from before and unfolds the rail.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| F1 | **The camera looks at a height.** `brick-camera.js` gets `focusOn({ x, y, z, distance, minDistance, maxDistance })` and `unfocus()`. While focused, the view's look-at point is lifted to `y` (the piece's centre). One finger turns (yaw) instead of sliding, and the distance limits are the focus ones (min 3, max = framing distance × 1.5). `unfocus()` restores the saved view and limits exactly. The tilt-follows-distance rule (K4) is unchanged. `cameraPosition` adds the look-at height; the existing node tests still pass with `y` = 0. | The kid camera always looked at the ground; a 4-unit figure framed that way sits at the top of the screen. Turning rather than sliding is what "move around the character" means. |
| F2 | **Dimming is a CSS vignette, not 3D.** A radial gradient over the stage, `pointer-events: none`. No material swaps, no extra draw calls. | Free on Android 8, and the pieces' shared materials stay untouched. |
| F3 | **Pose cards are pictures of the real part in that pose**, rendered like the rail icons (`brick-thumbs.js`, key part + colour + pose, cached). Until a picture is ready, the card shows an Emoji 5.0-safe sign (🙋 👋 🙌 🚶 👉 👈 💺) so Android 8 draws it. | Kids who can't read yet pick by the picture. |
| F4 | **Joint pick:** a tap on the model raycasts to a mesh; its holder's `userData.sqblJoint` names the joint. A tap on the body picks nothing new. Chips do the same for small or hidden limbs. The outline is a `Box3Helper` around the joint's holder, in gold (the selection outline stays the placer's colour). | Tapping the limb itself is the "character editor" feel. Chips keep it possible for a tail hidden behind a body. |
| F5 | **Each ↺ / ↻ press is one `setPose`**, so Undo goes back one step and a building-together tablet sees each step. A preset card resets the tweaks (`t`) to none. | One rule for every change, already checked in slice 01. |
| F6 | **Leaving:** ✓ Done, host Back (`lab.back()` closes focus first), the piece removed by another kid (`afterRemoteOp`), or Play turned on. Focus mode never saves anything of its own. | Back must always be a way out (world-first navigation). |

## Parts
- `js/brick-lab/brick-camera.js`: `focusOn`, `unfocus`, look-at height in `cameraPosition` and `apply`, one-finger turn while focused. Tests in `scripts/brick-camera.test.mjs`.
- `js/brick-lab/brick-lab.js`:
  - the Pose tool shown only for jointed parts (`updateSelectionUI`)
  - `enterFocus(id)` / `leaveFocus()`, with `this.focus = { id, joint, view }`
  - the pose strip, the joint chips, the ↺ ↻ buttons
  - the joint pick in `onTap` while focused, the gold joint outline
  - `back()` and `afterRemoteOp()` handling
  - `snapshot().focus = { id, joint, joints: { name: { screen } } }`
- `js/brick-lab/brick-thumbs.js`: an optional `pose` in the icon key, rendered through slice 01's jointed mesh.
- `css/brick-lab.css`: `.sqbl-app.is-focus` (rail and colours folded), vignette, pose strip, chips, 64 px ↺ ↻, ✓ Done. All targets ≥ 48 px.
- Strings (EN + 中文): Pose 姿勢, Done 完成, joint names, the hint "Tap an arm, a leg or the head. 點一下手、腳或頭。"

## Checks
- `node scripts/check.mjs` green, including the camera tests (focus height, turn, exact restore).
- `check-brick-lab-ui.py`, at 1280×800 and 1024×600 with touch:
  - The Pose tool shows on a minifigure and not on a brick.
  - Focus frames the figure (its screen height ≥ 45% of the stage) and folds the rail.
  - A tap on the right arm's screen point picks `armR`; ↻ changes `poseAngles.armR` by one step; Undo takes that one step back.
  - The Cheer card sets both arms.
  - One finger turns the camera around the figure, and the figure stays in the frame.
  - ✓ Done restores the camera view (x, z, yaw, distance within 1e-3) and the stage width.
  - Back from focus leaves focus, not the world.
  - Every focus control is ≥ 48 px and unobstructed. No page or console errors.
- Screenshots looked at: `focus-figure.png`, `focus-arm-picked.png`, `focus-1024x600.png`.

**DONE WHEN:** the checks above pass, and the screenshots show a big, centred figure with a readable pose strip at both sizes.
