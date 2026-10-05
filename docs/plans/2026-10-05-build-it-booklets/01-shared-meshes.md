# Slice 01 — Shared part shapes

Implements design.md B9.

**Depends on:** nothing.

## Changes
- New `js/brick-lab/brick-meshes.js`: the part-drawing helpers and every `make*Piece` function from `js/brick-lab/brick-lab.js`, moved unchanged, plus one export `makePiece(THREE, part, colorHex, kit)` that picks the right maker (the same choice `brick-lab.js` makes today).
- `js/brick-lab/brick-lab.js` imports them instead of defining them. No other line changes.
- `sw.js` lists the new file.

**DONE WHEN:** `node scripts/check.mjs` is green; `check-brick-lab-ui.py` passes as before, including the parts sheet (`--sheet`, and `--sheet --graphics webgl1`), with pictures identical to before the move.
