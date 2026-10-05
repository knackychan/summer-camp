# Slice 03 — Animals by body type

**Design:** [design.md](design.md) M4, M5 (focus mode), M6. **Depends on:** 02.

**Implemented 2026-10-05**, inline, tests first for the pose data. As built, against the text below:
- **Body types:** the turtle joins `quad` (no `turtle` body). Lists: `quad`, `dragon`, `bird`, `jaw`, `fish`, `frog`.
- **Head up and Sniff:** a joint may carry `nod` (a second turn on the same pin), keyed `"head.nod"` with its own chip, Nod 點頭. The holder turns `YXZ`, so the head turns first and nods within that turn.
- **"Tail up" became "Wag tail 搖尾巴"** (the tail turns sideways, 45°). A hanging tail (cow, horse) swings on z; a raised one (dog, cat) on y.
- **Animals keep only the joints they really have:**
  - The pig's face is drawn on its body: no head, so Stand and Wag tail only.
  - The chicken and owl have no wings, so the owl turns its whole face, as owls do.
  - The shark has no jaw; the monkey's arms stay put.
  - Every animal still has at least two poses.
- **Wings** are `mirror: true`: the −x shapes get a second holder at the mirrored pin, turning the mirrored way.
- **A bug found here and fixed:** posing re-landed the piece, so a horse with a rider jumped on top of its rider. A pose now never moves a piece. Sitting down or standing up lands it on what is under it only.
- **The focus hint** is now general: "Tap a part to move it, or pick one below. 點一下要動的部位，或在下面選一個。"

Verified:
- `check.mjs` green: pose tests 14, plus the A3 gate (no animal without joints).
- `check-brick-lab-ui.py` 235/235, including six animal checks:
  - each dog card turns the right joint
  - a rider stays on a posed horse
  - the crocodile's mouth opens
  - all 20 animals have pose pictures
- `animal-poses.png` (every animal in each of its poses) and `animal-dog-focus.png` looked at: nothing comes loose.

Pending: Papa's look.

## What changes
All 20 animals get joints and a `body`, so they pose in focus mode exactly like a minifigure. Their pose cards and joint chips come from their body type.

| Body | Animals | Joints (only those it really has) |
|---|---|---|
| `quad` | dog, cat, cow, pig, sheep, horse, unicorn, rabbit, monkey | `head` (y, ±90°, 45° steps), `tail` (y, ±45°, 22.5°), `legsF`, `legsB` (x, ±45°, 22.5°; both front legs or both back legs as one pair) |
| `dragon` | dragon | quad joints + `wings` (z, −45…+45°, 22.5°: both wings mirror, the right one turned the opposite way) |
| `bird` | chicken, duck, parrot, owl, penguin | `head`, `wings` |
| `jaw` | crocodile, shark | `jaw` (x, 0…30°, 15°), `tail` |
| `fish` | fish | `tail` |
| `turtle` | turtle | `head` |
| `frog` | frog | `legsB` |

Pose lists (EN · 中文), added to `POSES` in `brick-pose.js`:
- **quad:** Stand 站好 · Look left 看左邊 · Look right 看右邊 · Head up 抬頭 · Sniff 低頭聞聞 · Tail up 尾巴翹起來
- **dragon:** the quad list + Wings open 張開翅膀
- **bird:** Stand 站好 · Wings open 張開翅膀 · Look left 看左邊 · Look right 看右邊
- **jaw:** Rest 休息 · Mouth open 張大嘴巴 · Swish 甩尾巴
- **fish:** Rest 休息 · Swim 游泳
- **turtle:** Rest 休息 · Look left 看左邊 · Look right 看右邊
- **frog:** Rest 休息 · Jump 跳

**Head up and Sniff need a head that both turns and nods.** Joints never chain (M1), and a primitive belongs to one joint. So this slice adds a **second axis on the same joint**: a joint may declare `nod: { axis: "x", step, min, max }`. Its holder then sets two rotations, the turn and the nod. The nod's steps are stored under `"<joint>.nod"` in the pose's `t`, and a preset names it the same way (`{ "head.nod": -22.5 }`). `brick-pose.js` (`stopsOf`, `cleanPose`, `jointAngles`) and the slice 01 gate learn the `.nod` key. Focus mode shows it as its own chip, "Nod 點頭". Minifigures don't use it. If this costs more than it gives on screen, Head up and Sniff are dropped from the quad list instead, and the plan records why.

Joint chip names: Head 頭 · Tail 尾巴 · Front legs 前腳 · Back legs 後腳 · Wings 翅膀 · Mouth 嘴巴.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| A1 | Pairs move as one (`legsF`, `legsB`, `wings`). A pair joint's mirrored primitives turn the same way about x; for `wings` the right wing gets the negative angle (its holder is mirrored with `scale.x = −1`, so one angle opens both). | A kid wants "the dog sits up", not four separate legs. |
| A2 | Footprint, height, `top` (the horse's saddle) and `sink` are untouched by any animal pose (M6). | A rider on a posed horse stays on the saddle. |
| A3 | `check.mjs` gate: every part in the `animals` category has `joints` and a `body`. | No animal is left stiff. |

## Checks
- `node scripts/check.mjs` green (the slice 01 gate covers the new joints; A3 is new).
- `scripts/brick-pose.test.mjs`: each body's presets name only stops; every animal's `posesFor` is its body's list, minus presets for joints it lacks.
- `check-brick-lab-ui.py`:
  - A dog in focus mode takes each of its pose cards.
  - A rider on a horse in "Head up" stays at the saddle height.
  - The crocodile's Mouth open changes `poseAngles.jaw` to 30.
- `animal-poses.png`: every animal in each of its poses, in one grid (built like slice 06's sheet). Looked at before the slice is called done: no limb flies off its body, no wing turns inside out.

**DONE WHEN:** the checks pass and the animal sheet has been looked at and fixed where a pose reads wrong.
