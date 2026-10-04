# Slice 02 — Change requests (pure logic)

**Decisions:** D5, D6, D10. **Depends on:** 01.

## What this is, in plain words
Today Brick Lab changes a brick by calling `addPiece` / `removePiece` / recolour directly. For building together, every change first becomes a small message ("add this brick here", "move brick X there"…). The host tablet's code applies those messages one after another, automatically — the host kid never confirms anything. This slice builds that message format and the logic that applies it, still with nobody connected. Solo play must look and feel exactly as today.

## Changes
- `js/brick-lab/brick-share.js` (new, no DOM, no Three):
  - Op schema: `add {piece}`, `move {id,x,y,z,rotation}`, `remove {id}`, `recolor {id,colorId}`; pieces gain `by` (kid id).
  - `check(op, world)` — catalog part / colour, inside the plate, rail rules from `brick-rails.js`, size ≤ 64 KB.
  - `apply(op, world)` → new world + the inverse op (with `expect`).
  - `createSequencer(world)` — host: `submit(kid, req)` → `{apply, seq}` or `{reject}`, one at a time.
  - `createClient()` — guest: pending requests, `onApply(seq, op)`, drops anything out of order and asks for a fresh copy.
  - Per-kid undo stack of inverse ops; an inverse whose `expect` no longer matches is rejected.
- `js/brick-lab/brick-lab.js` — the place / move / rotate / recolour / delete paths build an op and send it through a local sequencer (solo = in-process). Solo undo keeps the existing snapshot `history`.

## Tests
- `scripts/brick-share.test.mjs` — each op applies and inverts; bad part / colour / out-of-plate / overlapping rail rejected; two kids moving the same brick: second wins, in order; undo after a sibling's change is rejected; oversized message rejected.
- `scripts/check-brick-lab-ui.py` unchanged and still green (solo behaviour identical).

**DONE WHEN:** `node scripts/check.mjs` green; both tests pass; solo play on a tablet feels unchanged.

## As built (2026-10-04)
- `brick-share.js`: `checkOp`, `applyOp` (returns the inverse with `expect`), `createSequencer`, `createClient`, `createUndo`, `encode` / `decode` (one JSON line, 64 KB cap), `PROTO = 1`. A rejected request takes no `seq`. A new piece belongs to the asker (`by`); an undone delete keeps its first owner. Position checks: centre on the plate (|x|, |z| ≤ 32), 0 < y ≤ 200, rotation 0/90/180/270; the stacking height itself is the lab's job.
- `brick-lab.js`: one sequencer per open world over `this.pieces`; `commit(op)` submits and `showOp()` brings the 3D scene in line; `change(op)` adds the solo undo snapshot and drops it again if the op is refused. Place, copy, drop-after-Move, drag, turn, recolour and remove all go through it. `addObject()` was split out of `addPiece()`, which still loads worlds and solo undo.
- `sw.js` precaches `brick-share.js` (cache `summer-quest-v167-brick-share`).

**Verified 2026-10-04:** `check.mjs` green (includes `scripts/brick-share.test.mjs`, 11 tests); `check-brick-lab-ui.py` 105/105 twice (every older check unchanged, plus "a placed piece remembers who placed it"). The "back to red" icon check now proves nothing was redrawn instead of racing a 150 ms timer.
