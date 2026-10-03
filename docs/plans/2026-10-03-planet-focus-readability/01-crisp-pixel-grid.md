# Slice 01 — Crisp pixel grid (D1)

**Goal:** Every art pixel covers the same whole number of device pixels on every tablet.
**Depends on:** pixel-planet slice 63.
**Change:** `resize()` in `js/world/world-explorer.js` computes `scale=Math.max(1,Math.round(target*dpr))/dpr`, where `target` is 6, or 4.5 under 600 CSS px. The resize early-return also compares the DPR. Hit testing already divides by `scale`.

**DONE WHEN:**
- `node scripts/check.mjs` is green; the scale test in `scripts/world-explorer.test.mjs` asserts the device-pixel rounding.
- At DPR 1, 1.5, 2 and 2.625, `scale*devicePixelRatio` is a whole number (browser check).
