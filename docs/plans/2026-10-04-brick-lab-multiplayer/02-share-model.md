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
