# Slice 31 — Explore mode (the 3D game)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Solar System tile appears in the games grid and launches a real 3D scene — Sun, eight orbiting planets, touch camera, tap-a-planet bilingual fact card with speech — built entirely on the game platform's registry contract and 3D seam.

**Architecture:** `js/games/solar.js` is the game module (default export: `{id, meta, keyboard, bestKey, init, stop}`). It ignores `ctx.stage`, appends its own WebGL canvas to `ctx.mount`, and owns every resource it creates. Three.js arrives via lazy `import()` of the vendor files — nothing parses until a kid opens the game. All text is **DOM overlay**, never canvas-drawn (design.md §4 — the 繁體中文 font stack keeps working).

**Tech Stack:** Vendored Three.js (latest stable, per design D7), ES modules, `node:test`, `scripts/check.mjs`.

**Design:** `docs/plans/2026-07-27-solar-system/design.md` §2, §4, §5

**Depends on:** slice 30 (data); game-platform slice **15** (registry + host + `startRegistered`); game-platform slice **21** as amended by D7 — `js/vendor/three.module.min.js` + `js/vendor/OrbitControls.js` (bare `"three"` specifier rewritten to `./three.module.min.js`), both precached, `ctx.mount` live, host GL context-loss handling.

**DONE WHEN:**
- On a kid's tablet: the 🪐 tile renders in the grid; the game launches **with wifi off**; planets orbit; tapping Mars opens a bilingual fact card and speaks it; backing out leaves no rAF or GL context behind; launching it a second time works.
- `node scripts/check.mjs` passes.
- `node --test scripts/solar-explore.test.mjs` passes (pure helpers only — the scene itself is verified on-device, per platform §7).

---

## Constraints you must not violate

1. **Legacy-syntax compatible** first-party code (design D7) — no `?.`/`??`/`.flatMap(` in `js/games/solar.js`; it joins `runtimeFiles`.
2. **Bilingual invariant:** every kid-facing string EN + 繁體中文. Fact content comes from `solar-data.js` — never hardcode a fact string in the game module.
3. **Offline-first:** `solar.js` joins `APP_SHELL` in the same commit it is created; `CACHE_NAME` bumped. The manifest guard (platform slice 15) fails the build otherwise, because this entry is `legacy:false`.
4. **Coarse-pointer:** raycast against inflated invisible hit-spheres (design §5). No hover-dependent anything.
5. **The host must not know this game is 3D.** No edits to `startRegistered`/`stopArena`; everything 3D lives behind `init`/`stop`.
6. **Coach, not cop:** the fact card invites; nothing shames, nothing is locked.

---

## File Structure

| File | Change | Responsibility after this slice |
|---|---|---|
| `js/games/solar.js` | Create | The 3D game module: scene, camera, raycast, fact card, `init`/`stop` |
| `js/games/index.js` | Modify | Manifest gains the `solar` entry (after the arcade games, before the brain block) |
| `sw.js` | Modify | `APP_SHELL` gains `./js/games/solar.js`; `CACHE_NAME` bumped |
| `scripts/check.mjs` | Modify | `runtimeFiles` gains `js/games/solar.js` |
| `scripts/solar-explore.test.mjs` | Create | Node tests for the pure helpers exported by `solar.js` |

---

## Task 1: Manifest entry

**Files:**
- Modify: `js/games/index.js`

- [ ] **Step 1: Add the entry**

Between `vocab` and the brain block, exactly as specified in design.md §2:

```js
{ id: "solar", brain: false, keyboard: false, bestKey: null, legacy: false,
  meta: { icon: "🪐", title: "Solar System", tz: "太陽系", blurb: "Explore the planets" } },
```

`legacy:false` is what routes `SQLoadGame` to `js/games/solar.js` instead of the old if/else chain — and what arms the check.mjs `APP_SHELL` guard.

- [ ] **Step 2: Verify the manifest tests still pass**

Run: `node --test scripts/registry.test.mjs`
Expected: PASS (counts update if any test asserts a fixed length — update the assertion, not the data).

---

## Task 2: The game module

**Files:**
- Create: `js/games/solar.js`

- [ ] **Step 1: Write the module**

Skeleton below — fill in, don't redesign. Pure helpers are exported at the bottom so node can test them without importing Three.js (the test stubs the dynamic import away by only importing the named exports — keep the top of the file free of a static three import; the two vendor imports happen **only** inside `init` via dynamic `import()`).

```js
/* Solar System — Explore mode (design.md §4). Registry-native 3D game:
   ignores ctx.stage, appends its own canvas to ctx.mount, owns its loop.
   All text is DOM overlay — nothing is drawn into the GL canvas. */
import { SOLAR, PLANETS, SCENE } from "./solar-data.js";

let R = null; // module-scope runtime: { renderer, scene, camera, controls, raf, ... }

export default {
  id: "solar",
  meta: { icon: "🪐", title: "Solar System", tz: "太陽系", blurb: "Explore the planets" },
  keyboard: false,
  bestKey: null,

  async init(ctx) {
    const THREE = await import("../vendor/three.module.min.js");
    const { OrbitControls } = await import("../vendor/OrbitControls.js");
    R = buildScene(THREE, OrbitControls, ctx);
    R.raf = requestAnimationFrame(function tick(t) { R.tick(t); R.raf = requestAnimationFrame(tick); });
  },

  stop() {
    if (!R) return;
    cancelAnimationFrame(R.raf);
    R.dispose();          // controls.dispose(), geometries/materials, renderer.dispose(), canvas + overlay removed
    R = null;
  },
};
```

Scene construction requirements:

- **Sun:** emissive sphere, radius `SCENE.sunRadius`. **Planets:** one sphere each at `SCENE.orbits[id]`, size `SCENE.sizes[id]`, colour from data; Saturn gets one flat `RingGeometry`. Orbit rings: one thin `LineLoop` circle per planet. Background: a `THREE.Points` starfield.
- **Motion:** each planet's angle advances by `2π / yearDays` per simulated day; v1 runs at a fixed 10 sim-days per real second (slice 32 adds the controls). Axial spin for looks.
- **Camera:** `OrbitControls`, `enablePan=false`, `minDistance`/`maxDistance` clamped, double-tap resets to the home view (design §5). `devicePixelRatio` capped at 2.
- **Hit spheres:** per planet, an invisible sphere of radius `Math.max(2.5 * SCENE.sizes[id], 0.9)`; `pointerdown` raycasts against those, not the visual meshes.
- **Fact card** (DOM overlay appended to `ctx.mount`): planet name EN + 中文 large, one stats line (diameter km · AU · year days · moons), the three facts as a list, and a ✕ close button ≥ 44 px. On open: `ctx.sayPair(facts[0].en, facts[0].tz)`. Tapping any other fact speaks that one. Same treatment for the Sun.
- **Visibility:** pause the loop on `visibilitychange` hidden, resume on visible (design §5).
- **`stop()`** releases everything the module created; GL context-loss recovery itself is the host's job (platform slice 21) — the game's part is a complete, idempotent teardown.

- [ ] **Step 2: Extract the pure helpers and export them**

At minimum `hitRadius(id)` and `angleAt(planet, simDays)` as named exports — these are the pieces node can test without WebGL.

---

## Task 3: Tests for the pure helpers

**Files:**
- Create: `scripts/solar-explore.test.mjs`

- [ ] **Step 1: Write and run the tests**

Cover: `hitRadius` returns ≥2.5× visual size and never below the 0.9 floor (Mercury, the smallest, must hit the floor); `angleAt` puts Earth through a full turn per 365 sim-days and Mercury through ~4.15 turns; module default export carries `id:"solar"`, `bestKey:null`, `keyboard:false`, and meta matching the manifest entry.

Run: `node --test scripts/solar-explore.test.mjs` — expected PASS.

---

## Task 4: Cache, check, tablet

**Files:**
- Modify: `sw.js`, `scripts/check.mjs`

- [ ] **Step 1: Precache and bump** — add `"./js/games/solar.js"` to `APP_SHELL`; bump `CACHE_NAME`. Confirm the two vendor files are already there from platform slice 21; if `OrbitControls.js` is missing, add it now.
- [ ] **Step 2: `runtimeFiles`** — add `"js/games/solar.js"` to `scripts/check.mjs:20`.
- [ ] **Step 3: Run the gate** — `node scripts/check.mjs` → PASS. The manifest guard must see `solar` in `APP_SHELL` (its `legacy:false` makes the guard mandatory).
- [ ] **Step 4: On the tablet** — serve the app, load once online, then verify with wifi off:
  1. Games grid shows 🪐 Solar System / 太陽系 in manifest order.
  2. Launch: sun, 8 planets, orbit rings, starfield; planets visibly move; Mercury fastest.
  3. Drag rotates, pinch zooms (clamped), double-tap resets.
  4. Tap Mars → card reads "Mars 火星", real numbers, 3 facts; speech plays EN then 中文. Tap Sun → its card. ✕ closes.
  5. Back to hub, reopen the game — works; no duplicate loops, no console errors.
  6. Home-button the tablet mid-game and return — scene recovers (host GL handling).
- [ ] **Step 5: Commit**

```bash
git add js/games/solar.js js/games/index.js sw.js scripts/check.mjs scripts/solar-explore.test.mjs
git commit -m "feat(games): add Solar System explore mode on the 3D seam"
```

---

## DONE WHEN

- Every Task-4 tablet check passes, offline included.
- Fact cards are bilingual and spoken; no fact string exists outside `solar-data.js`.
- `stop()` teardown is complete and idempotent (double-stop safe).
- `node scripts/check.mjs` and `node --test scripts/solar-explore.test.mjs` green; `CACHE_NAME` bumped.
- No host edits; no `?.`/`??`/`.flatMap` in `js/games/solar.js`.
