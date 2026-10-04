# Slice 10 — Rails join, and closed loops glow

**Requested by Papa, 2026-10-04** (same brief, issue 2). Amends design.md with D18–D20. The design's "Not in this plan" listed curved rails; this slice brings curves and joins in. Trains are still out.

**Depends on:** 09.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| D18 | **Snap to a free rail end.** Placing, moving or dragging a rail: if one of its ends would land within 1.5 studs of a free rail end facing it, the rail jumps onto that join. Orientation must already match. Turn the rail (tap it again) to make a different join. Rail logic lives in `js/brick-lab/brick-rails.js`: pure functions with no Three, tested in Node. | Fingers are imprecise at diorama scale. A magnet radius makes joins easy; requiring matching direction keeps them predictable. |
| D19 | **Rails never overlap.** A rail whose footprint would overlap another rail can't go there. The ghost fades (never red: coach, not cop), the tap or drag doesn't land, and the hint says "Rails can't overlap — try a free spot. 軌道不能疊在一起，換個空位試試。" Turning a rail into a neighbour is refused the same way. **Copy** on a rail continues the track from a free end, turning the copy if it must: three copies of a curve close a ring. | Joins share an edge, never space. Copy-to-extend is the fastest way for a small kid to lay track. |
| D20 | **Circuits.** After every change the rails are traced as a graph (ends bucketed by position, O(n)). The rails on a closed loop are its 2-core: repeatedly remove rails with fewer than two links. Their steel turns gold and gently breathes. The piece that closed the loop gets the toast "Circuit complete! 軌道接成一圈了！"; a plain join gets "Rails connected! 軌道接上了！". A selected rail shows its ends as dots (green = joined, yellow = free). While carrying a rail, every free end shows, and the end it will join shows big and white with a dashed guide through the joint. | Kids see that a loop is special without being told. The 2-core lights only the loop, never a spur hanging off it. Dots and the guide show where a rail will go before the finger lifts. |

New kid-facing strings (all EN + 中文): the three above plus "Glowing dots are rail ends — turn or drag to join them. 發光的點是軌道接頭，轉一轉或拖過去接起來。"

## Changes
- `js/brick-lab/brick-rails.js` (new) — `worldConnectors`, `railLinks`, `traceCircuits`, `snapRail`, `railClash`, `extendSpots`.
- `js/brick-lab/brick-lab.js` — `landing()` (grid + rail snap + overlap) behind every place/move/drag/turn/copy; free-end cache per build change, so a 60 fps drag only scans ends; `syncRails()` glow + toasts; pooled end dots and one dashed guide line from the shared kit (freed on destroy); snapshot exposes links, circuit, free ends.
- `sw.js` — `brick-rails.js` precached, `CACHE_NAME` bumped.
- `scripts/brick-rails.test.mjs` (new) — joins, snapping, overlap, ring of four curves, oval with a spur, 2000-rail trace speed.

**DONE WHEN:** `node scripts/check.mjs` green (runs the rail tests); `check-brick-lab-ui.py` passes the join, overlap and four-curve circuit checks.

**Verified 2026-10-04:** `check.mjs` green (includes `brick-rails.test.mjs`, 8/8); `check-brick-lab-ui.py` 60/60 on source (Chromium 141 headless, SwiftShader), no page or console errors. Not yet run: `check-android8-ui.py` with Chrome 138, because no Chrome 138 binary was available in the build container.
