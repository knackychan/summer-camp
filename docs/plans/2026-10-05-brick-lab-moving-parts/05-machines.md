# Slice 05 — Machines: posable, spinning, glowing, swinging

**Design:** [design.md](design.md) M8 (and M5 for posing them in focus mode). **Depends on:** 04 ([04-alive-on-tap.md](04-alive-on-tap.md)).

> **Amended 2026-10-05 (Play removed).** Wherever this file says "in Play", read "for 2 s when a tap selects the piece" (04-alive-on-tap T1–T3):
> - A spinner spins for 2 s, then settles at its pose.
> - A swing part swings open and back.
> - A light shows its glow, flicker or cycle for 2 s.
>
> X5 (local swing state) and "leaving Play" no longer apply. The saved pose is the only state. The checks change to match.

The detailed task list is written when this slice starts. Each machine part's moving shapes are read from its own primitives then.

## What changes

| Kind | Parts | In focus mode (saved pose) | In Play |
|---|---|---|---|
| **Spin, fast** | `propeller`, `rotor` | blade angle (30° steps) | spins ~2 turns/s |
| **Spin, geared** | `gear`, `gear_small` | turned (30° steps) | spins; a gear on an odd `(x + z)` stud square turns the other way, so neighbours look meshed |
| **Spin, slow** | `turntable`, `radar_dish`, `satellite` | turned (45° steps) | ~1 turn per 8 s |
| **Spin, wheels** | `wheel_wagon`, `steering_wheel`, `ship_wheel` (model parts); `wheel_small`, `wheel_med`, `wheel_large` (hand-built wheel shape) | the model ones turn (45° steps); the hand-built wheels are not posable | roll at a steady speed; the hand-built wheels spin as one whole mesh about their axle |
| **Swing** | `door_1x4x6`, `door_round`, `garage_door`, `hinge`, `lever`, `treasure_chest` (lid), `portcullis` (slides up: a `y` move, not a turn), `pirate_flag` | Rest 休息 · Open 打開, then ↺ ↻ | a tap swings it open / shut over 300 ms, with `pop`; leaving Play returns it to its saved pose |
| **Glow** | `floor_lamp`, `street_lamp`, `headlight`, `torch`, `traffic_light` | nothing to pose | the light slots glow (emissive up); the torch flickers; the traffic light cycles red → amber → green, 3 s each |

## Decisions

| # | Decision | Rationale |
|---|---|---|
| X1 | **Machines use the same joints (M1).** A spinner's turning shapes are tagged `j: "spin"`. A swing part's moving shapes are tagged `j: "swing"`. Its joint declares `open: <deg>`, a stop. The machine pose list is `machine: [Rest 休息, Open 打開 { swing: "open" }]`, where the string `"open"` means "this joint's own `open` stop". `jointAngles` resolves it, and `check.mjs` checks `open` is a stop. Spin-only parts have the one preset Rest plus ↺ ↻. | One system for figures, animals and machines. Each door opens its own way without a preset per part. |
| X2 | **Slides are joints too.** A joint may declare `slide: true`: its holder moves along `axis` by the angle value read as units ÷ 45 (so 45 = one unit). Only the portcullis uses it. | One portcullis doesn't justify a second mechanism. |
| X3 | **Glow is shared and in step.** Glowing is done on the shared finish materials (`amberLight`, `redLight`, `greenLight`, the lamp's light finish). In Play their emissive intensity rises, and every torch flickers together. On leaving Play the materials go back. No real lights. | Cheap, no per-piece materials, and Android 8 safe. A street of torches flickering together is acceptable for a first version. |
| X4 | **The hand-built wheels** (shape `wheel`, not model parts) get no joints. In Play, their whole object turns about its axle. They are counted among the 40 machines (M7). | No rebuilding the legacy builders for a spin. |
| X5 | **Swing state in Play is local** (M7). A tap toggles between the saved pose and its other end (Open when saved shut, shut when saved open). | A kid opening the castle door in Play doesn't change the build. |

## Parts
- `js/brick-lab/brick-parts.js` / `brick-catalog.js`: `j` tags, `joints` and `body: "machine"` on the parts above (the catalog ones live in `brick-catalog.js`).
- `js/brick-lab/brick-pose.js`: the `machine` presets, `"open"` resolution, `slide` (+ tests).
- `js/brick-lab/brick-lab.js`:
  - spin in the Play loop, the gear direction rule
  - wheel spin for the hand-built wheel shape
  - swing taps in Play, with the 300 ms ease
  - glow on / off
- `scripts/check.mjs`: `open` is a stop; every part in the table above has its joint.

## Checks
- `node scripts/check.mjs` green.
- `check-brick-lab-ui.py`:
  - A propeller's `spin` angle changes during Play.
  - Two neighbouring gears turn opposite ways.
  - A door tapped in Play opens (`swing` = its `open`) and shuts on a second tap.
  - Leaving Play returns the door to its saved pose.
  - A door posed half open in focus mode is saved half open.
  - A torch's light material is brighter in Play than in Build and the same again after.
  - The traffic light shows a different lit colour 3 s apart.
- `machines.png`: every machine part at rest and posed open, looked at.

**DONE WHEN:** the checks pass and the machine sheet has been looked at.
