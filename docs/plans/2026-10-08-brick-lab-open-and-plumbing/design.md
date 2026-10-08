# Brick Lab — remove a whole build, doors that open, plumbing bits

**Status:** Papa's request in chat, 2026-10-08 (three fixes, built the same day). Waiting on Papa's tablet look. **P1 dropped the same day** (Papa: don't add the home decoration / furniture bricks): built in c5f319f, reverted in the next commit; the row below stays for the record.
**Amends:** parts-survey D6 ("the door doesn't open") — reversed. moving-parts M8 / slice 05 — the "tap to swing" row is built (spin and glow are not). assemblies A6 — a batch's pieces now carry a group.
**Multiplayer:** `PROTO` 6 → 7 (a piece's `group`).

## Decisions

| # | Decision | Rationale |
|---|---|---|
| G1 | **Every piece an assembly places carries `group`** (the batch's own id, e.g. `wall-…`). It is saved on the piece, carried in the `add` ops of the batch, kept by Undo (the inverse `add` copies it), and dropped by Copy (a copy is a new piece on its own). | One field, no new op. The host checks it like `by`: a short string or absent. |
| G2 | **"Remove whole build 整組拆掉" 🧹 in the tools bubble**, next to Remove, shown only when the selected piece shares its group with at least one other piece. It sends one `batch` of `remove` ops (assemblies A6): all or nothing, one Undo step. No confirm dialog: the hint says how many pieces went and that ↶ brings them back. | Remove one block stays as it was. Undo is the safety net kids already know. |
| G3 | **Pieces placed before groups stay block-by-block.** No guessing a "connected run of the same part". | The simpler choice: a guess could take a wall the kid built by hand. |
| G4 | **`PROTO` 7.** A PROTO 6 tablet would drop `group` when it copies a piece, so the two can't share a world. | Both tablets must match. |
| S1 | **Tap to open and shut (M8).** A tap on a door, window, hinge, lever, chest, portcullis or pirate flag selects it if needed and toggles Shut ↔ Open. ↻ Turn in the tools bubble still turns it (the tap no longer does, for these parts only). | Papa: "tapping a door opens and closes it". The next tap shuts it again. |
| S2 | **The state is the saved pose** (moving-parts M5/M6): body `machine`, one joint `swing` with its own `open` stop; presets Shut 關上 / Open 打開, where Open means "each joint at its `open`". Sent as the existing `pose` op — undoable, shared, no new op. Never changes footprint, height, `top`, `sink` or stacking. | Same system as figures and animals. Amends slice 05 X5 (local state): Play is gone, so the saved pose is the only state. |
| S3 | **300 ms swing, eased, on every tablet** when a machine's pose changes (also an Undo or a sibling's tap). Frames are drawn only during it. Machines get no 2 s alive reaction. | Short and tap-only; no continuous animation. |
| S4 | **Which parts and how.** `door_1x4x6`, `window_1x2`, `window_1x4x3` (hand-built shapes: the leaf or pane hangs on a hinge holder in its builder), `door_round`, `garage_door` (tips up and out on its top edge), `hinge` (+x leaf folds up), `lever` (tips to the other side), `treasure_chest` (lid; it now rests **shut**), `portcullis` (a `slide` joint: rises 4 studs), `pirate_flag` (turns round its pole). `window_shutters` is left as it is (its shutters already stand open). | Papa's list in M8 plus the windows. |
| P1 | ***Dropped 2026-10-08 (reverted).*** **Plumbing bits, not a ready-made shower.** Five plain Home parts in the palette colour: Round Pipe 圓管, Pipe Elbow 彎管, Shower Head 蓮蓬頭, Tap Handle 水龍頭把手, Sink Basin 2×2 洗手台 2×2. Shower = pipes up a wall + head on top; tap = pipe + elbow + handle; sink = basin on a brick. Toilet and bathtub unchanged. | Kids build them; parts are data in `brick-parts.js` (no new geometry code), anything stacks on anything. |

## Checks

- `node scripts/check.mjs`: machines need an `open` stop other than 0; a joint on a hand-built part is only allowed for a door or window's `swing`.
- Node tests: `brick-share` (group rides along, group remove is one batch, Undo restores it, PROTO 7), `brick-pose` (every swing part is Shut / Open, eased swing lands exactly, opening keeps the box).
- `check-brick-lab-ui.py`: `swing_checks` (door, castle door, window, portcullis, chest: a tap opens, the next shuts, Undo reopens, nothing moves, frames stop) and the end of `assembly_checks` (a wall shares one group; Remove takes one; Remove whole build takes all in one Undo step).
- Papa's tablet look: doors and windows open the right way, the chest shut at rest.
