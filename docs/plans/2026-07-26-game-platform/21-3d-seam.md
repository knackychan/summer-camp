# Slice 21 — 3D seam + Three.js (D7-simplified)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the registry contract can host a 3D game — vendored Three.js, host-side WebGL context-loss handling, and a spinning-cube proof behind a dev flag — so the Solar System (slices 31+) and any future 3D game build on a seam that is proven **on a real tablet**, not on paper.

**Architecture:** Three.js is vendored into `js/vendor/` (never a CDN — offline-first), precached, and loaded by dynamic `import()` only when a 3D game starts. The host gains `webglcontextlost`/`webglcontextrestored` handling so a kid who backgrounds the tablet never returns to a black screen. The proof is one throwaway game, `cube.js`, exercised through the *same* `startRegistered`/`stopArena` contract as any migrated game.

**Tech Stack:** latest stable Three.js (design D7 — no version archaeology), ES modules, `node:test`, `scripts/check.mjs`.

**Design:** `docs/plans/2026-07-26-game-platform/design.md` §4, §6 — **as amended by `docs/plans/2026-07-27-solar-system/design.md` D7** (the Android 8 / Chrome < 80 baseline is retired: take the **latest stable** Three.js, assume WebGL2, no banned-operator guard on the vendor file, no pre-r167 fallback hunt).

**Depends on:** slice 15 (registry + host + `ctx.mount` + `startRegistered`). Slice 16 recommended (ships the same era).

**DONE WHEN:**
- WebGL2 confirmed **on a kid's tablet** and recorded.
- `js/vendor/three.module.min.js` + `OrbitControls.js` vendored, documented, precached; `OrbitControls.js` carries no bare `"three"` import.
- Host context-loss path: background → return shows the game recovered (or a gentle bilingual recovery), never a black screen.
- `#devcube` on the tablet: the cube **registers, renders, survives a tab switch, tears down cleanly** through the standard contract.
- `node scripts/check.mjs` passes.

---

## Constraints you must not violate

1. **Offline-first:** vendor files join `APP_SHELL` + `CACHE_NAME` bump in the same commit. Never a CDN/runtime fetch.
2. **D7:** do NOT re-litigate the Three.js version (no "does it parse on Android 8" analysis, no banned-operator scan on the vendor file). The only device question left is WebGL2, and Task 1 answers it.
3. **`js/vendor/` is third-party:** it stays OUT of `runtimeFiles` (the legacy-syntax scan applies to our code, not pinned vendor code).
4. **The proof is behind a dev flag** and never appears in the games grid, the manifest, or `check.mjs`'s manifest guard.
5. **Coach, not cop:** the recovery overlay invites — no error theatre, no red.

---

## File Structure

| File | Change | Responsibility after this slice |
|---|---|---|
| `js/vendor/three.module.min.js` | Create (vendored) | Three.js, latest stable |
| `js/vendor/OrbitControls.js` | Create (vendored, patched) | Camera controls; bare `"three"` specifier rewritten to `"./three.module.min.js"` |
| `js/vendor/README.md` | Create | Version, date, source URLs, the specifier patch note — and *why* (D7) |
| `js/games/cube.js` | Create | Dev-flag spinning-cube proof game |
| `js/main.js` | Modify | `#devcube` path: register cube + start it through `startRegistered` |
| `index.html` | Modify | Host `webglcontextlost`/`webglcontextrestored` handling near `stopArena` |
| `sw.js` | Modify | `APP_SHELL` gains the two vendor files; `CACHE_NAME` bumped |
| `scripts/check.mjs` | Modify | Vendor-existence + bare-specifier guard block |

---

## Task 1: Confirm WebGL2 on the tablet — GATE

D7 retired every question except this one.

- [ ] **Step 1: Probe page** (temporary, never committed):

```html
<!doctype html><meta charset="utf-8"><body style="font:20px system-ui;padding:2em">
<div id="o">checking…</div><script>
const gl = document.createElement("canvas").getContext("webgl2");
document.getElementById("o").textContent = gl
  ? "PASS: WebGL2 (" + gl.getParameter(gl.VERSION) + ")"
  : "FAIL: no WebGL2";
</script></body>
```

- [ ] **Step 2:** Serve (`npx serve .`), open on a kid's tablet. **PASS** → record the result + Chrome version in `js/vendor/README.md`, continue. **FAIL** → stop and report to Papa; the fallback decision (WebGL1-era Three.js r166) is a design conversation, not an agent choice.
- [ ] **Step 3:** Delete the probe file.

## Task 2: Vendor Three.js

- [ ] **Step 1: Download** the latest stable release: `build/three.module.min.js` and `examples/jsm/controls/OrbitControls.js` (from threejs.org or unpkg `three@latest`). Record the exact version.
- [ ] **Step 2: Patch the bare specifier** — in `OrbitControls.js`, change `from "three"` (and any `from 'three'` / `from "three/..."`) to `from "./three.module.min.js"`. No import maps (they'd break `check.mjs`'s single-inline-script rule).
- [ ] **Step 3: Write `js/vendor/README.md`**: version, date, source URLs, the patch applied, and one line: *"Version policy per solar-system design D7: latest stable; Android 8 baseline retired 2026-07-27."*
- [ ] **Step 4: Precache + bump** — both files into `APP_SHELL`, `CACHE_NAME` bumped.

## Task 3: Host context-loss handling

**Files:** `index.html` (near `stopArena`)

- [ ] **Step 1: Implement**, with capture-phase listeners on the stage mount (`SQHost.mount()`), since `webglcontextlost` fires on the game's canvas:

```js
/* WebGL context-loss safety net (design.md §6). Tablets drop GL contexts on
   background/resume; without this a kid returns to a black screen. */
var glLost=false;
SQHost.mount().addEventListener("webglcontextlost",function(e){
  e.preventDefault(); glLost=true;           // preventDefault = allow restore
  wobbleMsg("One moment… 等一下喔");           // gentle, bilingual — no error theatre
},true);
SQHost.mount().addEventListener("webglcontextrestored",function(){
  if(!glLost)return; glLost=false;
  if(currentGame){ var g=currentGame;
    try{ g.stop(); }catch(e){}
    try{ startRegistered(g); return; }catch(e){ console.error(e); }
  }
  stopArena(); showGames();                   // worst case: back to the grid, never black
},true);
```

(`wobbleMsg`/`showGames`: use the inline script's actual existing helpers — read them first and adapt; the behaviour is what's specified, the helper names are indicative.)
- [ ] **Step 2:** Behaviour check on desktop DevTools (`chrome://gpu` "lose context" or `WEBGL_lose_context` extension): lost → message; restored → game rebuilt or safe grid return.

## Task 4: The spinning-cube proof

**Files:** `js/games/cube.js`, `js/main.js`

- [ ] **Step 1: `cube.js`** — default export `{id:"cube", meta:{icon:"🧊",title:"Cube",tz:"方塊",blurb:"dev probe"}, keyboard:false, bestKey:null, async init(ctx){…}, stop(){…}}`. Inside `init`: dynamic `import("../vendor/three.module.min.js")`, renderer appended to `ctx.mount`, one spinning cube, rAF loop, pause on `visibilitychange`. `stop()`: cancel loop, dispose geometry/material/renderer, remove canvas — complete and idempotent.
- [ ] **Step 2: `#devcube` path in `main.js`** — when `location.hash==="#devcube"`: `import("./games/cube.js")`, `SQGames.register(mod.default)`, then start it through the **same contract as a tile tap**: replicate `startGame`'s arena-setup lines (a kid must be selected first) and call `startRegistered(game)`. The cube is never added to `LEVELS`, the manifest, or the grid.
- [ ] **Step 3: On the tablet, prove the four verbs:** open `index.html#devcube` with a kid selected → cube **registers** (`SQGames.ids()` includes it) and **renders** (spinning) → home-button, wait 30 s, return → **survives** (Task 3's path; no black screen) → leave the arena → **tears down** (no rAF leak: second visit works, console clean).
- [ ] **Step 4: Keep the file.** Project rule: nothing is deleted — `cube.js` stays as the permanent dev-flag seam probe. It ships to no grid and costs nothing (lazy import only under the flag).

## Task 5: Guard + commit

- [ ] **Step 1: `check.mjs` block** (near the vendor policy): assert `js/vendor/three.module.min.js` and `OrbitControls.js` exist, and `OrbitControls.js` contains **no** bare `from "three"` / `from 'three'` import (regex). Vendor files stay out of `runtimeFiles`.
- [ ] **Step 2:** `node scripts/check.mjs` PASS. Deliberately re-introduce `from "three"` → FAIL; restore → PASS.
- [ ] **Step 3: Commit**

```bash
git add js/vendor js/games/cube.js js/main.js index.html sw.js scripts/check.mjs
git commit -m "feat(games): prove the 3D seam with vendored Three.js and a dev cube"
```

---

## DONE WHEN

- Task 1 gate passed on the tablet and recorded; no version archaeology happened (D7).
- Vendor files documented, precached, bare-specifier-free (guard proven both ways).
- Context-loss path demonstrated on device and by forced-loss on desktop.
- Cube: registers, renders, survives, tears down — on the tablet, through the standard contract.
- Green check; bumped cache; nothing in the grid/manifest changed.
