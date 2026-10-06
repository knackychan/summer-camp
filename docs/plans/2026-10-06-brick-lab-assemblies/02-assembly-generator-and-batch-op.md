# Slice 02 — Assembly generator and the `batch` op

**Requested by Papa, 2026-10-06.** Implements design.md A3 (maths) and A6 (op). Pure code; nothing in `brick-lab.js` uses it yet.

**Depends on:** nothing.

## Changes
- `js/brick-lab/brick-assembly.js` (new). Pure: no DOM, no Three.
  - `ASSEMBLY_MAX = 64`, `ASSEMBLY_PATTERNS = ["wall","floor","tower","bridge"]`, `ASSEMBLY_DEFAULTS` (A3).
  - `assemblyParts(part)` — true when a part may be tiled (Bricks / Plates / Tiles boxes).
  - `buildAssembly({ pattern, part, along, across, up, rotation })` → `{ blocks: [{ dx, dz, layer }], count, studs: { w, d }, layers, clamped }`. Offsets are in blocks of the armed part's footprint from the assembly's anchor corner; `rotation` (0 / 90 / 180 / 270) turns the whole shape about the anchor. Sizes are clamped to ≥ 1, `count` ≤ `ASSEMBLY_MAX`, and the footprint inside the island (`half`); `clamped` says whether anything was cut.
  - `stepSize(settings, key, delta, part)` — the stepper rule: returns the new settings, or the same object when the change would pass the cap or the island.
  - `placeAssembly(blocks, anchor, part, rotation, colorId, idFor)` → `add` ops, one per block, y = anchor y + layer × part height (the caller resolves the base height with `landing()`).
- `js/brick-lab/brick-share.js`
  - `PROTO` 5 → 6 (comment: `6: batch op (brick-lab-assemblies)`).
  - `checkOp`: `batch` — `ops` is an array of 1–`BATCH_MAX` (64), all `add` or all `remove`, no duplicate ids; each member passes `checkOp` against the world; the first failure's reason is returned. `applyOp`: applies each member in order and returns one `batch` of the inverses (reversed) so Undo is one step.
  - `createSequencer.submit`: the `by` owner is stamped on each `add` member.
- `scripts/brick-assembly.test.mjs` (new) — node test: each pattern's count and shape for a 2×4 brick, a 2×2 plate and a tile; defaults ≤ 64; cap clamp and `clamped`; island clamp; stepper refuses past the cap; rotation turns offsets; `placeAssembly` y spacing for a brick and a plate; bridge pillars of up − 1 layers under a deck.
- `scripts/brick-share.test.mjs` (existing, extended) — batch of adds applies all; one bad member rejects the whole batch and leaves the world unchanged; duplicate id inside a batch rejected; inverse batch removes all and its `expect`s hold; a changed member makes the undo fail as a whole; a 65-op batch rejected; mixed add/remove rejected; `PROTO` is 6.
- `sw.js` — `brick-assembly.js` precached; cache bumped.

**DONE WHEN:** `node scripts/check.mjs` green and runs both test files.
