# Slice 31 — The living scene (merged Explore+Orbit)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Solar System tile appears in the games grid and launches a real 3D scene — Sun, eight orbiting planets at real period ratios, orbit camera, and a **persistent time-warp band** with the day/year counter. One scene, always alive; there is no Orbit "mode" to switch into (design D8).

**Architecture:** `js/games/solar.js` is the game module (default export `{id, meta, keyboard, bestKey, settings, init, stop}`). It ignores `ctx.stage`, appends its own WebGL canvas to `ctx.mount`, and owns every resource it creates. Three.js arrives via lazy `import()` of the vendor files. Sim math lives in the pure module `js/games/solar-sim.js` (no Three.js, node-testable). All text is DOM overlay per `tech-spec.md` §8; every visual value comes from `art-direction.md` — both binding.

**Tech Stack:** Vendored Three.js (latest stable, design D7), ES modules, `node:test`, `scripts/check.mjs`.

**Design:** `design.md` §2, §4, §5, D4, D8 · **Binding:** `art-direction.md` §3–§5, §6.1, §6.3 · `tech-spec.md` §1–§8, §11, §14

**Depends on:** slice 30 (data); game-platform slice **15** (registry + host); game-platform slice **21** as amended by D7 (vendored `three.module.min.js` + `OrbitControls.js`, both precached, `ctx.mount`, host GL context-loss handling).

**DONE WHEN:**
- On a kid's tablet, **offline**: tile launches; planets orbit (Mercury visibly fastest); drag/pinch/double-tap camera works; the time band warps time (pause freezes everything; counter at Day 365 reads Earth 1, Mercury 4); chosen default speed persists; tap pulses a planet (focus zoom arrives in slice 32).
- `node scripts/check.mjs`, `node --test scripts/solar-sim.test.mjs`, `node --test scripts/solar-explore.test.mjs` all pass.

---

## Constraints you must not violate

1. **Legacy-syntax compatible** first-party code (design D7) — no `?.`/`??`/`.flatMap(`; new files join `runtimeFiles`.
2. **Bilingual invariant:** every kid-facing string EN + 繁體中文. Strings come from `solar-data.js` / `solar-sim.js` — never hardcoded in the game module.
3. **Offline-first:** new files join `APP_SHELL` + `CACHE_NAME` bump in the same commit. The manifest guard enforces this (`legacy:false`).
4. **Coarse-pointer:** inflated hit spheres (`tech-spec.md` §7). No hover-dependent anything.
5. **The host must not know this game is 3D.** No edits to `startRegistered`/`stopArena`.
6. **Art-direction is binding:** no value, colour, motion or component that those docs don't specify. No camera moves the kid didn't request (drag/pinch/double-tap only — the tap-to-zoom rig is slice 32).

---

## File Structure

| File | Change | Responsibility after this slice |
|---|---|---|
| `js/games/solar.js` | Create | The 3D game module: scene, camera rig, raycast+pulse, time band UI, `init`/`stop` |
| `js/games/solar-sim.js` | Create | Pure sim math: `SPEEDS`, `daysPerSec`, `advance`, `orbitCount` |
| `js/games/index.js` | Modify | Manifest gains the `solar` entry (design.md §2) |
| `index.html` | Modify | **Host grid wiring for registry-native games.** The home games grid and arena game-switcher iterated `Object.keys(LEVELS)` and `Object.entries(LEVELS)` only, which left a `legacy:false` registry-native game like solar with a manifest entry but no tile. Add `gameMeta(id)` + `allGameIds()` helpers (LEVELS if present, else `window.SQManifest`), then route the grid render, `levelChips`, `startGame`'s brain check and the `noKb` derivation through them. The manifest's `keyboard` flag now drives keyboard visibility — solar's `keyboard:false` hides the on-screen keyboard without further allowlist edits. |
| `sw.js` | Modify | `APP_SHELL` gains both files; `CACHE_NAME` bumped |
| `scripts/check.mjs` | Modify | `runtimeFiles` gains both files |
| `scripts/solar-sim.test.mjs` | Create | Sim math tests |
| `scripts/solar-explore.test.mjs` | Create | Pure-helper tests (`hitRadius`, `angleAt`, module shape) |

---

## Task 1: Manifest entry + host grid wiring

- [ ] **Step 1:** Add to `js/games/index.js`, between `vocab` and the brain block, exactly:

```js
{ id: "solar", brain: false, keyboard: false, bestKey: null, legacy: false,
  meta: { icon: "🪐", title: "Solar System", tz: "太陽系", blurb: "Explore the planets" } },
```

- [ ] **Step 2:** `node --test scripts/registry.test.mjs` passes (update length assertions, never the data).

- [ ] **Step 3: Wire the home grid and arena game-switcher to the manifest.** Without this, the manifest entry exists but no tile renders — `renderHub` iterated `Object.keys(LEVELS)` only, and `startGame` accessed `LEVELS[lvl].brain` directly. Solar is `legacy:false` (registry-native) and never had a LEVELS entry, so the manifest was the only source of its UI metadata and the grid never showed it. Add to `index.html` (near `const LEVELS = {...}`):

```js
function gameMeta(id){
  const L=LEVELS[id];
  if(L) return L;
  const M=(window.SQManifest||[]).find(e=>e.id===id);
  if(M) return {icon:M.meta.icon, title:M.meta.title, tz:M.meta.tz, blurb:M.meta.blurb, brain:!!M.brain};
  return null;
}
function allGameIds(){
  if(window.SQManifest && window.SQManifest.length)
    return window.SQManifest.map(e=>e.id);
  return Object.keys(LEVELS);
}
```

Then route the three consumers through them:
1. `renderHub` games row: build `order` from `allGameIds()` instead of `Object.keys(LEVELS)`; render each tile from `gameMeta(l)`; filter out any id with no `gameMeta` (so a half-loaded manifest never throws on `undefined.icon`).
2. `startGame` `levelChips`: same — iterate `allGameIds()`, render each chip from `gameMeta(k)`.
3. `startGame` brain + keyboard: replace `LEVELS[lvl].brain` with `gameMeta(lvl) && gameMeta(lvl).brain`; replace `const noKb=(lvl==="city"||lvl==="dig")` with a lookup of the manifest's `keyboard` flag (fall back to the city/dig allowlist only when the manifest hasn't published yet — main.js loads deferred).

The host still doesn't know solar is 3D; it knows the manifest carries registry-native tiles, which it didn't before. Behaviour preservation: inline games' tiles render from `LEVELS` exactly as before — `gameMeta` returns the LEVELS entry unchanged when present.

- [ ] **Step 4:** `node scripts/check.mjs` PASS. On a kid's hub (served, not file://): the Solar System tile appears between Word Wizard and Calculations, in manifest grid order; tapping it routes through `SQLoadGame("solar")` → `startRegistered(game)`; tapping a different chip mid-game switches games through the same path; the on-screen keyboard is hidden for solar.

---

## Task 2: The sim module, test-first

**Files:** `scripts/solar-sim.test.mjs`, `js/games/solar-sim.js`

- [ ] **Step 1: Write the failing tests** — five `SPEEDS` steps with pause=0 and bilingual labels; `daysPerSec` falls back to `"10day"` on unknown id; `advance(total, dtMs, perSec)` accumulates; `orbitCount(365, 365)` = Earth exactly 1, Mercury ≈ 4.15, Neptune floors to 0; returned `angle` is derived (`182.5/365` of a turn = π), never stateful. Run: FAIL (module missing).
- [ ] **Step 2: Implement `js/games/solar-sim.js`** per `tech-spec.md` §11 (the `SPEEDS` table with EN+中文 labels is the exact spec — copy it, don't paraphrase). Run: PASS.

---

## Task 3: The game module

**Files:** `js/games/solar.js`

- [ ] **Step 1: Scene** per `tech-spec.md` §3–§6 and `art-direction.md` §4: unlit sun + glow shell; 8 Lambert planets in `solar-data.js` colours/sizes/orbits; Saturn ring + 0.44 rad tilt; Uranus group tilt 1.71; 8 LineLoop orbit rings; 1,500-point starfield; ambient + point light; **no shadows, no textures**.
- [ ] **Step 2: Camera rig** per `tech-spec.md` §4: `OrbitControls` with the exact clamps (pan off, damping 0.08, polar [0.15, 1.45], distance [10, 55], autoRotate off); home view (0, 16, 30)-equivalent framing; double-tap eased reset 0.4 s.
- [ ] **Step 3: Motion** per `art-direction.md` §5: sim days accumulate via `advance`; each planet's angle is `orbitCount(totalDays, yearDays).angle` — derived, never integrated; axial spin per the locked formula; loop pauses on `visibilitychange`.
- [ ] **Step 4: Tap pulse.** Raycast per `tech-spec.md` §7 (drag-vs-tap discrimination, hit spheres `max(2.5× size, 0.9)`). A tap plays `ctx.sfx.pop` + the 0.25 s scale pulse. (Focus zoom + card are slice 32 — do not build them here.)
- [ ] **Step 5: Time band + counter** (DOM, `art-direction.md` §6.3): persistent bottom band; five speed chips from `SPEEDS` (bilingual, active = gold); the two-line counter (`Day N · 第 N 天` + per-planet completed years, gold numbers); `ctx.sfx.pop` on each completed orbit. Speed state lives in module runtime; sim resets in `stop()`.
- [ ] **Step 6: Settings.** `settings(bar, ctx)` renders a default-speed chips row via the host setbar; persists `ctx.settings.speed`, default `"10day"`.
- [ ] **Step 7: Teardown.** `stop()` per the `tech-spec.md` §10 checklist — complete and idempotent.

---

## Task 4: Tests, cache, check, tablet

- [ ] **Step 1:** `scripts/solar-explore.test.mjs` — `hitRadius` floors at 0.9 for Mercury; `angleAt(earth, 365)` = full turn; module default export matches the manifest entry (`id`, `bestKey:null`, `keyboard:false`, meta equal).
- [ ] **Step 2:** `APP_SHELL` + `CACHE_NAME` bump; both files in `runtimeFiles`; `node scripts/check.mjs` PASS. Two guards now in play (tech-spec §16.1): the manifest guard still requires `./js/games/solar.js` itself; the **import-graph precache guard** walks `solar.js` one level deep and requires `./js/games/solar-data.js`, `./js/games/solar-sim.js`, `./js/vendor/three.module.min.js`, `./js/vendor/OrbitControls.js` too — prove it by deleting `solar-sim.js` from `APP_SHELL` and re-running → FAIL naming `offline imports: js/games/solar.js imports ./solar-sim.js → js/games/solar-sim.js missing from sw.js APP_SHELL`; restore → PASS.
- [ ] **Step 3: On the tablet (wifi off):** grid tile → scene; orbits at real ratios; camera clamped, double-tap reset; band warps time and the counter matches reality at Day 365; pop on Mercury laps; tap → pulse only; back → reopen works, no leaked loops; home-button → return recovers (host GL handling).
- [ ] **Step 4: Commit**

```bash
git add js/games/solar.js js/games/solar-sim.js js/games/index.js sw.js scripts/check.mjs scripts/solar-sim.test.mjs scripts/solar-explore.test.mjs
git commit -m "feat(games): add the Solar System living scene with time-warp"
```

---

## DONE WHEN

- Every Task-4 tablet check passes offline.
- Counter ratios provably match `solar-data.js`; speeds persist; teardown idempotent.
- No art-direction value was improvised; no host edits; legacy-syntax compatible; green checks and tests; bumped cache.
