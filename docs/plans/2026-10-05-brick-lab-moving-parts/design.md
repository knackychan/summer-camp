# Brick Lab — Moving parts: poses, Play, and parts that come alive

**Status:** approved by Papa, 2026-10-05, in chat:
- Motion kind: "Alive + tap".
- Alive level: "Alive in place".
- Pose input: "Pose cards + tweak".
- Order: "All in one go" (one plan, checked on the tablet at the end).
- Each of the three design sections (what kids see, how it's built, limits): "Approve".
- Papa's own addition, the same turn: figures and animals can be posed and made alive.
- **Review of this file, 2026-10-05** (Papa: "yes, ok" plus two changes):
  - Posing happens in a zoomed **focus mode**, like a character editor. It covers figures, animals and machine parts (M5, amended; M8).
  - A standing minifigure can sit (M12).

**Fulfils:** more-parts D1, which left motion for a later moving-parts plan, and the catalog's C8 ("No mechanics yet").
**Amends:** brick-lab D25 (render on demand): while Play is on, the lab draws every frame (M7). Multiplayer `PROTO` goes 3 → 4 (M9).
**Builds on:** the catalog's model parts (C1 primitives, C2 colour slots), `brick-share.js` ops, `brick-thumbs.js` icons.

## What it is
- **Pose.** The tools bubble opens a zoomed **focus mode** on a minifigure, an animal or a machine part, like a character editor:
  - Picture cards set the whole pose.
  - Tapping an arm, leg, head, tail, wing, door or blade on the big model picks it, and ↺ ↻ turn it a step at a time.
  - A minifigure can sit.
- **Play.** A ▶ Play switch turns the build from building into watching and poking:
  - Figures and animals come alive where they stand.
  - Propellers, gears and wheels spin, and lamps glow.
  - A tap swings a door, a lever or a chest lid open and shut.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| M1 | **Joints are tags in the part data.** A primitive in a model part may carry `j: "<joint>"`. A part with joints lists them in `joints: { <name>: { at: [x,y,z], axis: "x"\|"y"\|"z", step: <deg>, min: <deg>, max: <deg> } }`, with the pivot in part units. Untagged primitives belong to the body. The lab builds one merged geometry per (joint, colour slot), cached per part, so the one-geometry-per-slot rule (C1) holds per joint. Every joint hangs off the body; there are no chains (a hand is part of its arm). | Lego limbs are rigid and turn at one pin, so a pivot per limb is the true model. Option 2 (skinned bones) bends soft and costs more on WebGL1. Option 3 (one model per pose) makes ↻ and alive loops impossible. |
| M2 | **Still pieces stay one mesh.** A piece in its rest pose, while Play is off, uses today's merged per-slot geometry: same draw calls, same picking, same icons. Only a posed piece, or any jointed piece while Play is on, is built as a jointed group. Picking still finds the piece from any of its meshes. | A village of 40 standing figures costs nothing extra. |
| M3 | **Minifigure joints, all 16 at once** (the shared `minifig()` builder): `head` turns on y, `armL` / `armR` swing on x, `legL` / `legR` swing on x. A skirt has no leg joints. The peg leg swings with `legR`. The sitting minifigure gets head and arms only. A figure's hat and hair (its `onHead` extras) turn with `head`; whether an extra is held instead is decided per figure in slice 01. | One builder covers every figure. These are a real minifig's own movements. |
| M4 | **Animal joints by body type**, tagged per animal in slice 02:<br>• four-legged (dog, cat, cow, pig, sheep, horse, unicorn, rabbit, monkey, dragon): `head`, `tail`, `legsF`, `legsB`<br>• birds (chicken, duck, parrot, owl, penguin) and the dragon: `wings`, also `head`<br>• crocodile and shark: `jaw`, `tail`<br>• fish: `tail`<br>• turtle: `head`<br>• frog: `legsB`<br>An animal lists only the joints its shapes really have. | Body types share poses and alive loops, so ~20 animals need ~6 behaviours, not 20. |
| M5 | **Focus mode: a character editor** *(amended at Papa's review)*. The tools bubble (Move · Turn · Copy · Remove) gains **Pose 🤸 姿勢** on any jointed part: figure, animal or machine (M8).<br>**Entering:**<br>• The camera glides (400 ms) to frame that piece large, about 60% of the stage, and orbits around it.<br>• The rest of the build dims, and the rail and the colour grid fold away.<br>**In focus mode:**<br>• One finger turns the camera around the model; pinch zooms within limits; the existing ↺ ↻ + − camera buttons work around the model.<br>• A strip of picture poses for its body type runs along the bottom (list below).<br>• Tapping a limb on the model, or its chip on the strip, picks it and outlines it. Big ↺ and ↻ buttons turn that one joint by its `step`, wrapping within `min`…`max`.<br>• "Stand" ("Rest" for animals and machines) resets.<br>**Leaving:** ✓ Done (or Back) glides the camera back to where it was. Every label EN + 中文, every button ≥ 48 px.<br>Focus mode is per tablet. If another kid removes the piece, focus mode closes. | Papa: "zoom into the model and be able to move the part easier like a character edition mode". Fingers are as big as a minifig's arm at the normal view; up close, a limb is an easy target. Pictures read for 5–7 year olds, and the ↺ ↻ steps can't make a broken angle. |
| M6 | **A pose is saved on the piece.** It is an optional field, for example `pose: { p: "wave", t: { armL: 2 } }` (preset id plus extra steps per joint). An absent field means "Stand". A pose names only joints the part has; anything else is dropped when loading. Apart from Sit (M12), it never changes a piece's footprint, height, `top`, `sink` or what stacks on it. Undo takes a pose back like a recolour. Old saves load unchanged. An older app opening a newer save shows the rest pose. | Papa's "make them have a specific pose" means the pose stays. Keeping stacking pose-blind keeps every placement rule as it is. |
| M7 | **▶ Play switch.** A 56 px **▶ Play 玩 / 🔨 Build 建造** button sits over the stage. In Play:<br>• The tools bubble, the rail's arming and placement are off; the camera works as always.<br>• Taps go to the swing parts (M8).<br>• Leaving Play puts every swing part back to how it was.<br>• Play is per tablet: never saved, never shared. Other kids' changes still arrive live while one kid plays.<br>• While Play is on, the lab draws every frame (amends D25). The reduced tier runs Play at 30 fps.<br>• The step-down (D26) keeps measuring, so a slow tablet still loses detail quietly.<br>• At most 40 figures and animals and 40 machines move at once, nearest the view first; the rest stay still. | Building and playing are different moments. A one-tap switch keeps building taps from changing the build by mistake, and keeps the lab free when no one is watching. |
| M8 | **Machines come alive in Play.** No new parts and no new ids.<br>• **Spin:** propeller and rotor (fast); gear and small gear (neighbours on alternating grid squares turn opposite ways); turntable, radar dish and satellite (slow); wheels (small, medium, large, wagon), steering wheel and ship's wheel. Each spinner tags its turning shapes `j: "spin"` with its axis.<br>• **Glow:** lamps (floor, street), headlight and torch glow via emissive colour (no real lights); the torch flickers and the traffic light cycles red → amber → green.<br>• **Tap to swing:** the doors (`door_1x4x6`, `door_round`, `garage_door`), `hinge`, `lever`, `treasure_chest` lid, `portcullis` and `pirate_flag` swing open or shut over 300 ms, with the existing `pop` sound.<br>• **Posable too** *(Papa's review)*: in focus mode (M5) a machine part's `spin` and swing joints are set like a limb: a door left half open, a lever down, a blade angle, a turntable turned. The setting is saved in its `pose` (M6). Play starts from it, and leaving Play returns to it. | The catalog already has these shapes. Making them move is the "Alive + tap" choice. Setting them is Papa's "mechanical part orientation". |
| M9 | **Building together shares poses.** A new op `{ type: "pose", id, pose }` goes through the host's sequencer, with its inverse (the old pose) for Undo, like `recolor`. A Sit or stand-up pose also moves the piece (M12). The host works out the new spot by the same rules as a `move`, so every tablet ends up with the same place. `PROTO` 3 → 4, so a tablet without poses is refused with the existing "Update the app on both tablets · 兩台平板都要更新". | A pose is part of the world, so every tablet must see it. Play stays local (M7). |
| M10 | **Alive loops, in place.** In Play each jointed piece plays a small loop on top of its own pose: figures look around, sway an arm and now and then wave; four-legged animals wag their tail and turn their head; birds flap; fish and sharks sway their tail; the frog hops its legs. Each piece starts at its own moment (seeded by its id) and nothing moves off its spot. With reduced motion turned on, loops move half as far, and spinners still spin. | Papa's "actually alive" choice. In place means nothing gets lost, stuck or out of step between tablets. |
| M11 | **Checks.** `check.mjs`:<br>• every joint referenced by a primitive is declared<br>• every pose preset names only joints its body type has<br>• min ≤ 0 ≤ max for every joint<br>• all strings EN + 中文.<br>Browser harness:<br>• a posed piece lands exactly where its rest pose would, except Sit<br>• Sit lands on a chair's `top` and is refused with no room for the legs<br>• focus mode enters, picks a limb by tapping it on the model, turns it and returns the camera to where it was<br>• a pose survives save → reload and Undo<br>• Play draws while on and stops when off<br>• a door tap swings and leaving Play restores it<br>• two pretend tablets share a pose<br>Then the Android 8 / Chrome 138 check, and Papa's look on a real tablet. | The usual gates, plus the new rule that a pose never moves a piece. |
| M12 | **A standing minifigure can sit** *(Papa's review)*.<br>• **Sit 坐下** is a pose on every standing minifigure. Both legs swing 90° forward at the hips. The figure takes the Sitting Minifigure's numbers: a 2×2 footprint (room for the legs), height `FIG_TOP − 1.25`, `top` lowered by 1.25.<br>• The lab places it again by the same rules as a move. It sits on whatever is under it (a chair, a saddle, a brick edge, the plate), its seat on that part's `top`.<br>• If the legs have no room (something in front), Sit is refused, the figure stays as it was, and the hint says "No room for the legs here. 這裡腳放不下。"<br>• Standing up returns the 2×1 footprint. If the spot above is now taken, it is refused the same way.<br>• A separate hat piece on its head stays where it was (no riding along).<br>• The **Sitting Minifigure** part keeps its id; it is a figure that starts seated. | Papa: "figurine needs to be able to sit". Reusing the sitting part's numbers keeps one meaning for "seated", and checking room keeps the no-overlap rule. |

## Pose cards

| Body type | Poses (EN · 中文) |
|---|---|
| Minifigure | Stand 站好 · Sit 坐下 · Wave 揮手 · Cheer 歡呼 · Walk 走路 · Point 指向 · Look left 看左邊 · Look right 看右邊 |
| Sitting minifigure | Sit 坐好 · Wave 揮手 · Cheer 歡呼 · Look left 看左邊 · Look right 看右邊 |
| Four-legged | Stand 站好 · Look left 看左邊 · Look right 看右邊 · Head up 抬頭 · Sniff 低頭聞聞 · Tail up 尾巴翹起來 |
| Bird | Stand 站好 · Wings open 張開翅膀 · Look left 看左邊 · Look right 看右邊 |
| Dragon | Four-legged poses + Wings open 張開翅膀 |
| Crocodile, shark | Rest 休息 · Mouth open 張大嘴巴 · Swish 甩尾巴 |
| Fish | Rest 休息 · Swim 游泳 |
| Turtle, frog | Rest 休息 · Look left / right (turtle) · Jump 跳 (frog) |
| Machine part | Rest 休息 · Open 打開 (swing parts) · then ↺ ↻ on its door, lid, lever, blade or turntable |

The ↻ step sizes and limits are set per joint in slice 01 / 02 and recorded in their *As built*. Starting values: head ±90° in 45° steps, arms −180°…+45° in 45° steps, legs ±45° in 22.5° steps, tail and wings ±45° in 22.5° steps, jaw 0…30° in 15° steps.

## Not in this plan
- Walking or roaming (Papa chose in place).
- Bricks riding along on a hinge, turntable or door.
- Gears driving each other.
- Physics, falling or wobbling.
- A separate hat piece turning with the head it sits on (the figure's own hat and hair do).
- New parts, including the tank tread, ball socket and light brick from the old brief.
- Sound beyond the existing `pop`.
- Play shared between tablets.

## Units

| File | Change |
|---|---|
| `js/brick-lab/brick-parts.js` | `j` tags and `joints` on `minifig()`, the animals and the machine parts; `POSES` per body type; `bodyType` on jointed parts |
| `js/brick-lab/brick-pose.js` (new, pure) | pose cleaning against a part's joints, preset + steps → joint angles, alive-loop angles at time *t*, spin and swing angles. No DOM, no Three, so `node` tests run it directly. |
| `js/brick-lab/brick-lab.js` | jointed group builder (M2), Pose tool + focus mode (M5), Sit placement (M12), Play switch, loop and frame cap (M7, M8, M10), swing taps, pose op wiring |
| `js/brick-lab/brick-share.js` | `pose` op + inverse; `PROTO` 4 |
| `js/brick-lab/brick-worlds.js` / `brick-storage.js` | keep `pose` through save and load |
| `css/brick-lab.css` | Play button, pose card |
| tests | `scripts/brick-pose.test.mjs` (new), `brick-share` / `brick-together` tests, `scripts/check-brick-lab-ui.py`, `check.mjs` gate |

## Slices

| # | Slice | Depends on |
|---|---|---|
| 01 | Joints, focus mode and poses for minifigures, including Sit (M1–M3, M5, M6, M12, M11 parts) | — |
| 02 | Animals by body type (M4, their pose cards) | 01 |
| 03 | ▶ Play + alive loops (M7, M10) | 02 |
| 04 | Machines: posable in focus mode, spin, glow, tap to swing (M8) | 03 |
| 05 | Building together: `pose` op, `PROTO` 4 (M9) | 01 |
| 06 | Reference sheet of poses, Android 8 / Chrome 138 check, Papa's tablet look | 01–05 |
