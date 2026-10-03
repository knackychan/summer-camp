# Slice 05 — Edges, clouds, rim (pending)

**Goal:** Less clutter at the planet's edge and a smooth atmosphere.
**Depends on:** none.
- Draw toys only at `z>0.25`; landmarks keep `z>0.08`.
- Solid, outlined clouds instead of dithered ones, or clouds that skip pixels over sprites.
- Replace the dotted teal rim with a CSS radial-gradient glow behind the canvas, sized from the planet radius.

**DONE WHEN:** `node scripts/check.mjs` is green; the world UI harness passes; the screenshots show no half-dark toys at the edge.
