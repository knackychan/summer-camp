# Brick Lab — walk a minifig and build from inside

**Status:** approved by Papa, 2026-10-06 (chat: pasted "Brick Lab: First-Person/Third-Person Pawn Mode (Minecraft-Style Building)" → scope "Walk + build" → pawn "Step into a placed minifig" → camera "Behind + eyes toggle" → controls "Crosshair (Minecraft PE)" → physics "Solid + step + jump" → together "Live walking" → "Approve, write it").

**Reverses, by Papa's choice:** `docs/plans/2026-10-05-brick-lab-moving-parts/` *Not in this plan* "Walking or roaming (Papa chose in place)", and `docs/plans/2026-10-05-brick-lab-kid-camera/` *Not in this plan* "Walking a minifigure around … follow-cam". Moving-parts' removed Play mode stays removed: walking is entered from one minifig's tools bubble, not a lab-wide switch, and every tap rule in Build is unchanged.

**Amends:** `docs/plans/2026-10-04-brick-lab-multiplayer/` "anyone can change any brick" — one exception, W14. `brick-lab` D25 (render on demand) — frames run while the walker moves, W9.

## What it is
A kid taps one of their standing minifigs on the island and presses 🚶 Walk. The camera drops in behind it; a joystick walks it across the island, up steps, onto builds, and a jump button gets it higher. A crosshair in the middle of the view aims: ＋ Place puts the part picked in the rail where the ghost shows, － Remove takes away the piece under the crosshair. 👀 switches to the minifig's own eyes. Back (or 🔨) leaves; the minifig stays where it walked to. In a shared world the other tablets watch it walk live.

## How the pasted brief was adapted
| Brief said | Here | Why |
|---|---|---|
| A new spawned pawn, 1.7 units tall | The kid's own placed minifig (~4.0 units, `FIG_TOP`) | 1 stud = 1 unit and a brick is 1.2 here; a minifig already exists with joints and a Walk pose. No second body. |
| Phase 1 desktop only, touch in phase 2 | Touch in the first walking slice; keyboard is an extra | Tablet-first is a project non-negotiable. |
| Supabase Realtime pawn sync | The home-wifi host tablet (multiplayer D-series), `PROTO` 5 | Brick Lab sharing never touches Supabase. |
| Own raycast + grid snap + overlap check | The crosshair aims the existing `landing()` | One placement rule for Build and Walk: same snap, stacking and no overlap. |
| 6 modules + a CSS file | `brick-walk.js` (pure, node-tested) + `brick-walk-view.js` (wiring); styles in `css/brick-lab.css` | The `brick-camera.js` pattern; keeps `brick-lab.js` (4 047 lines) from growing. |
| 100–120° third-person FOV | 60° behind, 75° eyes | Very wide angles warp on a tablet screen. |
| Blocks-in-hand count, FPS counter, LOD, gamepad | Dropped | No inventory in Brick Lab; Three already skips off-screen pieces; gamepad out of scope. |

## Decisions
| # | Decision | Rationale |
|---|---|---|
| W1 | **Step in from the tools bubble.** A selected *standing* minifig (`body: "minifig"`) gets a 🚶 Walk 走走看 button in its tools bubble. Seated minifigs (`minifigSeated`), animals and every other part do not. Leaving: host Back (the lab's existing `back()` takes it first) or a 🔨 Build 建造 button. | Walking belongs to one figure, not to the lab; no mode switch for the whole lab (Papa removed Play). |
| W2 | **Fractional while walking, on the grid when saved.** While walking the minifig's x, z, height and facing are free numbers. On leaving it snaps to the nearest stud, turns to the nearest 90°, lands through `landing()`, and that lands as one normal `move` op. Its saved pose is untouched. One Undo step undoes the whole walk. | Saved worlds and the op format stay exactly as today. |
| W3 | **Riders come along.** Pieces resting on the minifig (a hat, hair, a brick on its head) move with it while walking and land with it on leaving, as part of the same Undo step. | Hats are separate pieces; leaving one floating where the walk started would look broken. Build does not carry riders today; this is new and only for walking. |
| W4 | **Behind view by default, eyes view on 👀.** Behind: camera about 8 units back and 4 up from the minifig's head, looking slightly down, 60° field of view, pulled in if a piece is in the way. Eyes: at the minifig's eye height, 75° field of view, the minifig and its riders hidden. The 👀 button switches with a 300 ms glide (instant with `prefers-reduced-motion`). | Behind is easier to build from and shows the kid's own figure; eyes is the Minecraft feeling. |
| W5 | **Touch controls.** A joystick at the bottom-left of the 3D view walks (direction and speed, up to 4 studs/s). One finger dragged anywhere else on the view turns and tilts the look (tilt limited to ±60°). A ⤒ Jump button on the right. All buttons ≥ 56 px, `pointerdown`, overlays so the view never resizes (brick-lab D14). The rail stays where it is and keeps picking the part and colour. | Minecraft PE layout, which Papa picked; one finger per job. |
| W6 | **A solid island, plain box maths.** Each piece is its footprint box (`pieceBounds`). The minifig is a 1×1 column. It steps up by itself onto anything up to 1.25 higher (a plate or a brick), Jump lifts it up to 2.5 (two bricks), it drops gently off ledges, higher steps are walls, and it stops at the island edge. No physics library. | Enough to climb a build; pure numbers a node test checks; runs on the WebGL1 fallback tablets too. |
| W7 | **Walking looks like walking.** While moving it plays the existing Walk pose loop (moving-parts M10 maths) and faces where it walks; standing still it stands. | Reuses the jointed minifig; no new animation system. |
| W8 | **Frames only while something moves.** While the walker moves, jumps, falls or the look turns, the lab draws every frame; when everything is still it goes back to on demand (D25). The step-down (D26) keeps measuring, so a slow tablet still loses detail quietly. The reduced tier walks at 30 fps. | Keeps the tablet cool when the kid stops to think. |
| W9 | **Crosshair aims `landing()`.** A ray from the screen centre hits a piece or the ground; the landing spot for the picked part shows as the usual ghost. Reach: 8 studs from the minifig. Out of reach, nothing hit, or a spot that would overlap the minifig itself: no ghost and Place does nothing. Never red, never a warning. | Same snap, stacking and overlap rules as Build; coach, not cop. |
| W10 | **Three build buttons:** ＋ Place 放上去 puts the picked part, in the picked colour, at the ghost; － Remove 拿掉 removes the piece under the crosshair (never the walking minifig or its riders); ⟳ Turn 轉一轉 turns the picked part 90°. They send the same `add` / `remove` ops as Build, so Undo, save and sharing work unchanged. | One way to change a world. |
| W11 | **Desktop extra.** W A S D walk, a left-button drag looks, Space jumps, V switches the view, a left click without dragging places, a right click removes, R turns. No pointer lock, no gamepad. | Cheap, and handy for checks on a computer. |
| W12 | **Live walking in a shared world, `PROTO` 5.** Stepping in sends a `walk` claim to the host; the first claim for a figure wins, in the host's order. While walking the tablet sends the figure's position, facing and view about 6 times a second; the host relays it; other tablets smooth between updates and play the Walk loop. These walk messages are not ops and are never saved. Leaving sends the release and the final `move` ops (W2, W3). If a walker's tablet drops off the wifi, the host releases the claim and the figure stays at its last saved spot. | Kids building together see each other walk; nothing half-walked ever reaches a saved world. |
| W13 | **A walked figure is busy for others.** While one kid walks a minifig, other tablets can't select, move, pose or remove that figure or its riders; tapping it shows "Someone is walking with it 有人正在用它走路" in its bubble. The host refuses ops on a claimed figure from anyone but the walker. | The only exception to "anyone can change any brick", so two kids can't pull the same figure apart. |

## Kid-facing strings (EN + 繁體中文)
- `walk`: ["Walk", "走走看"] · `build`: ["Build", "建造"]
- `viewBehind`: ["Behind view", "從後面看"] · `viewEyes`: ["Eyes view", "用眼睛看"]
- `jump`: ["Jump", "跳"] · `place`: ["Place", "放上去"] · `remove`: ["Remove", "拿掉"] · `turn`: ["Turn", "轉一轉"]
- `walkBusy`: ["Someone is walking with it", "有人正在用它走路"]
- `walkHint`: ["Walk with the circle. Point the ＋ and press Place.", "用圓圈走路。把＋對準，再按「放上去」。"]
- `joystick` (aria-label): ["Walk around", "走來走去"]

Pre-readers (age ≤ 5, brick-lab D5) see the same icons; text labels are hidden for them as elsewhere in the lab.

## Not in this plan
Gamepad. Riding a horse or sitting while walking. Walking an animal. Two walkers on one tablet. Pawn customisation beyond what the minifig already is. Extra culling or LOD. Inventory or block counts. An FPS counter. Pointer lock. Swimming, falling bricks, any damage.

## Slices
- `01-walk-core.md` — W2 (snap maths), W3 (riders), W6, W9 (reach), W4 (camera rig maths): `brick-walk.js` + node test
- `02-step-in-and-walk.md` — W1, W2, W3, W5, W7, W8, behind view; solo
- `03-crosshair-build.md` — W9, W10
- `04-eyes-view.md` — W4 eyes view and the 👀 switch
- `05-together.md` — W12, W13, `PROTO` 5
- `06-keyboard-mouse.md` — W11
- `07-checks.md` — browser checks, Android 8 / Chrome 138 check, real tablets
