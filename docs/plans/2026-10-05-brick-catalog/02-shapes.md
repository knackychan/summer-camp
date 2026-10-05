# Slice 02 — Shape parts: build anything

**Requested by Papa, 2026-10-05** ("all the kind of shape, lever, cone etc."). Implements design.md C4 for the building categories.

**Depends on:** 01.

## Parts (all EN + 中文, ids stable)
- **Bricks** (+7): 1×6, 1×8, 2×8, tall 1×1×3, corner brick, log brick 1×4 (cabins, palisades), stone wall brick 1×4 (castles).
- **Plates** (+15): plates 1×1, 1×6, 2×3, 2×8, 4×4, 4×6, 6×6, 8×8, 8×16; smooth tiles 1×1, 1×2, 1×4, 2×2, 2×4; road plate 8×8.
- **Slopes** (+7): slope 1×2, wide slope 4×2, roof peak 4×2, steep slope 1×2×3, upside-down slope 2×2, curved slope 2×2, triangle plate 4×4.
- **Round & Cones 圓形 · 圓錐** (new, 13): round bricks 1×1 / 2×2 / 4×4, round tower 2×2×3, round plates 1×1 / 2×2 / 4×4, round tile 2×2, cones 1×1 / 2×2, tower roof 4×4, domes 2×2 / 4×4.
- **Structure** (+9): column 2×2×6, arches 1×4×2 and 1×6×3, bridge 2×8, stairs, ladder, fence, wall panels 1×2×2 and 1×4×3.
- **Doors & Windows 門窗** (new, 6): door 1×4×6 (a minifig fits), castle door, windows 1×2×2 and 1×4×3, window with shutters, garage door.
- **Wheels** (+2): big wheel, wagon wheel.
- **Vehicle Parts 車輛零件** (new, 14): steering wheel, seat (a minifig sits), windscreen, wheel arch, boat hull 4×12 (deck holds a mast and a crew), rowboat, wing 8×4 (turn it to make the other side), tail fin, propeller, helicopter rotor, jet engine, headlight brick, cockpit canopy, exhaust pipes.
- **Connectors** (+7): hinge, lever, turntable, beam 1×6, bar, gears (big and small). Shapes only (C8).

**DONE WHEN:** as slice 01, and every part above reviewed in a rendered contact sheet.

**Verified 2026-10-05:** `check.mjs` green (after `npm run build:mobile` and `npm run build:android-web`, which a fresh container lacks); `check-brick-lab-ui.py` 95/95 on source (Chromium 141 headless, SwiftShader) with the slice-14 "slow standard tablet steps down" check skipped — it fails the same way on the untouched code in this container (SwiftShader frame timing); the reduced tier still draws 88 calls / 31,490 triangles, the same as before. Every category reviewed in rendered contact sheets and a seeded scene. Not yet run: `check-android8-ui.py` with Chrome 138 (no Chrome 138 binary in the container), and real touch on a tablet.
