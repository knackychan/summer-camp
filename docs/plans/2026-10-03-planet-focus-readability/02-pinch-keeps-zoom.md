# Slice 02 — Pinch keeps its zoom (D2)

**Goal:** When the child lifts their fingers, the zoom stays exactly where the pinch left it.
**Depends on:** none.
**Change:** pinch zoom is `clamp(pinch.zoom*ratio, MIN_ZOOM, MAX_ZOOM)`. Remove `rubber()`. `settleZoom` stays as a guard for saved or out-of-range values.

**DONE WHEN:**
- `node scripts/check.mjs` is green.
- Browser check with simulated touch: pinch out past 2×, then release, and zoom is still 2 at release and 1.5 s later. A mid-range pinch (≈1.6) also stays put after release.
