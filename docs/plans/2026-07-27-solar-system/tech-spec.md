# Tech Spec — Solar System (binding)

**Status:** approved by Papa (2026-07-27). **This document is binding.** If a value, structure or behaviour is specified here, the implementing agent conforms or stops — it never improvises. Unspecified-and-small ⇒ choose the simpler option (art-direction.md §9). Unspecified-and-big ⇒ flag Papa.
**Applies to:** slices 31–33. Read alongside `art-direction.md` (visual) and `design.md` (decisions, incl. D7/D8).

---

## 1. Module inventory & import graph

```
js/games/solar.js        scene + camera + input + DOM UI + focus rig + quiz runner
js/games/solar-data.js   pure data: SOLAR, PLANETS, SCENE (names, numbers, flags, type, desc, photo, facts)
js/games/solar-sim.js    pure sim math: SPEEDS, daysPerSec, advance, orbitCount
js/games/solar-quiz.js   pure quiz engine: buildMission, grade
js/vendor/three.module.min.js, js/vendor/OrbitControls.js   (platform slice 21)
assets/solar/<id>.jpg    9 vendored NASA/PD photos + README.md (sources/credits)
```

Rules: `solar.js` → may import data/sim/quiz + dynamic-`import()` the vendor files (inside `init` only — never a static three import, so node tests can import the module's named exports). `solar-data/sim/quiz` → import **nothing**; no DOM, no Three.js. Violating the purity rule breaks the test suite by design.

## 2. Registry contract

Default export of `solar.js`, exactly:

```js
{ id:"solar",
  meta:{ icon:"🪐", title:"Solar System", tz:"太陽系", blurb:"Explore the planets" }, // === manifest
  keyboard:false, bestKey:null,
  settings(bar, ctx){ /* slice 31: default-speed chips row */ },
  async init(ctx){}, stop(){} }
```

`ctx` fields used: `mount`, `say`, `sayPair`, `sfx.{good,bad,pop,win}`, `fx.burst`, `settings`, `finish`, `kid`. **Unused:** `stage`, `keys`, `hud` (mode bar/time band are the game's own DOM). Quiz stars flow through `finish({score, stars})` only.

## 3. Scene graph & coordinates

Ecliptic = XZ plane, +Y up, angles CCW from +X. Units = `SCENE` scene units (sun radius 2, Neptune orbit 20).

```
solarRoot (Group)
├─ sun (Mesh, SphereGeometry(SCENE.sunRadius, 32, 24), MeshBasicMaterial 0xFDB813)
├─ sunGlow (Mesh, SphereGeometry(2.7, 32, 24), MeshBasicMaterial #FFC93C,
│           transparent .18, blending Additive, side BackSide, depthWrite false)
├─ stars (Points, 1500, shell r 60–90, y flattened ×0.6)
├─ orbit:<id> (LineLoop ×8, 128 pts, LineBasicMaterial #4A4090, transparent .5)
└─ body:<id> (Group ×8, positioned at (cos θ·orbit, 0, sin θ·orbit))
   ├─ mesh (SphereGeometry(SCENE.sizes[id], 24, 18), MeshLambertMaterial data color)
   ├─ hit:<id> (SphereGeometry(max(2.5×size, 0.9), 12, 8), MeshBasicMaterial {visible:false})
   └─ ring (Saturn only: RingGeometry(1.35r, 2.05r, 64), MeshBasicMaterial #E8D9B0,
            transparent .85, side DoubleSide; group tilt 0.44 rad)
```

Uranus group: `rotation.z = 1.71`. Lights: `AmbientLight(#A79FD6, 0.55)` + `PointLight(#FFF4D6, 1.1, 0)` at origin. **No shadow maps anywhere.**

## 4. Renderer, camera, controls, focus rig

- **Renderer:** `WebGLRenderer({antialias:true})`; `setPixelRatio(min(devicePixelRatio, 2))`; `setClearColor(#191340)`; sized to `mount.clientWidth/Height`; `ResizeObserver` on mount.
- **Camera:** `PerspectiveCamera(45, aspect, 0.1, 200)`. Home view: spherical `az 0.85, pol 1.02, dist 36` around origin (≈ (0,16,30) look-at-origin framing).
- **Controls:** `OrbitControls` — `enablePan:false`, `enableDamping:true`, `dampingFactor:0.08`, `rotateSpeed:0.6`, `zoomSpeed:0.8`, `minDistance:10`, `maxDistance:55`, `minPolarAngle:0.15`, `maxPolarAngle:1.45`, `autoRotate:false`. Double-tap → tween home, 0.4 s ease-out-cubic.
- **Focus rig (D8):** `focus` = body or null. Each frame: focused ⇒ `controls.target.lerp(bodyPos, 0.15)`; unfocused ⇒ lerp to origin 0.08. Focus distance `max(40, size×10)`, tweened 0.5 s; polar re-clamped [0.5, 1.2]. While focused: `minDistance = size×4`; non-focused bodies render at `material.opacity 0.35` (set `transparent:true` at build so this is cheap). Unfocus: card ✕, double-tap, or tap another body (refocus). Quiz mode forces unfocus.

## 5. Construction extras

Axial spin per art-direction §5: `0.5 × (24 / dayHours)` rad/s, clamped [0.05, 0.8]. Stars: `BufferGeometry` + `PointsMaterial({size:1.6, sizeAttenuation:true, vertexColors:true, transparent:true, opacity:0.9, depthWrite:false})`; tints white/warm/cool at 70/20/10 (`#FFFFFF`/`#FFE9C8`/`#C9D6FF`).

## 6. Loop & timing

One `requestAnimationFrame` loop, `THREE.Clock`, `dt = min(delta, 0.1)`. `totalDays = advance(totalDays, dtMs, daysPerSec(speedId))`; each body angle = `orbitCount(totalDays, yearDays).angle` — **derived from accumulated sim-days, never frame-integrated**. `visibilitychange` hidden ⇒ cancel loop; visible ⇒ restart (clock fresh). No `setInterval` except the 100 ms counter refresh; no per-frame allocations (module-scope `Vector3`/`Raycaster`/arrays reused).

## 7. Input & raycast

Pointer events on the renderer canvas. Tap = `pointerup` with `Σ|dx|+|dy| < 10 px` and duration `< 350 ms` (else it's a drag — OrbitControls owns those). Pinch = two-pointer distance ratio on `controls` (built-in). On tap: NDC from event coords, `raycaster.setFromCamera`, `intersectObjects(hitMeshes, false)`; nearest hit ⇒ body. Explore: focus rig + card (§4, §9). Quiz: `grade()` path. Hit spheres use `{visible:false}` **materials** (mesh stays visible) — the version-proof raycastable-invisible pattern.

## 8. DOM overlay architecture

One root `div.solar-ui` (`position:absolute; inset:0; pointer-events:none`) inside `ctx.mount` (module sets `mount.style.position="relative"` if unset). Children use `pointer-events:auto`. Styles travel with the module: one injected `<style id="solar-style">`, **removed in `stop()`**. Reuse app classes (`.btn`, `.chip`) + scoped `.solar-*` classes; colours/fonts only from app tokens (art-direction §3.2). Components: mode bar (Explore 探索 | Quiz 測驗 chips), time band (persistent), info card, quiz banner, end card.

## 9. Info card — data flow

`openCard(body)`: photo `assets/solar/<id>.jpg` (`onerror` → container gets the body's shaded gradient, image hidden); classification `type.en + " · " + type.tz`; name; `desc.en` + `desc.tz`; `shuffleFact()` — random index `≠` current (pool > 1) — renders + `sayPair(fact)`; stats grid. Planet cells: `DIAMETER · 直徑` km, `FROM SUN · 距日` AU, `1 YEAR · 一年` days, `1 DAY · 一天` hrs, `MOONS · 衛星`, `TYPE · 類型`. Sun cells: diameter, `TYPE · 類型` = STAR 恆星, `PLANETS · 行星` = 8, `CENTRE · 中心`. 🔊 button speaks `desc` via `sayPair`. `closeCard()` = unfocus (§4). Card open ⇒ sim keeps running (the scene stays alive behind the glass).

## 10. Module state & `stop()`

Module-scope `R`: `{renderer, scene, camera, controls, clock, raf, bodies[{id,group,mesh,hit,ring}], stars, raycaster, totalDays, speedId, focus, ui:{root, style, modeBar, band, card, banner}, listeners[{el,type,fn}], ro(ResizeObserver)}`. `stop()` checklist — every item, in any order, **idempotent** (`if(!R)return`): cancel rAF · remove every registered listener · `ro.disconnect()` · `controls.dispose()` · traverse scene disposing geometries/materials · `renderer.dispose()` + `renderer.forceContextLoss()` · remove canvas, `.solar-ui`, style node · `R=null`. GL context *recovery* is the host's job (platform 21); the game's job is this complete teardown.

## 11. Sim spec (`solar-sim.js`)

```js
SPEEDS = [ {id:"pause",en:"Pause", tz:"暫停",  daysPerSec:0},
           {id:"day",  en:"1 day", tz:"1 天",  daysPerSec:1},
           {id:"10day",en:"10 days",tz:"10 天", daysPerSec:10},   // default
           {id:"month",en:"1 month",tz:"1 個月",daysPerSec:30},
           {id:"year", en:"1 year", tz:"1 年",  daysPerSec:365} ]
daysPerSec(id)             → step or the "10day" fallback
advance(total, dtMs, perSec) → total + dtMs/1000*perSec
orbitCount(total, yearDays)  → { count: floor(total/yearDays), angle: (total/yearDays % 1) * 2π }
```

Counter strings (exact): `Day 730 · 第 730 天`; per-planet `{name} {count}` joined ` · `. `ctx.settings.speed` persists the default speed id; unset ⇒ `"10day"`. Completed-orbit tick ⇒ `ctx.sfx.pop`.

## 12. Quiz spec (`solar-quiz.js` + runner)

`buildMission(planets, rng)` → 8 questions, unique targets, exactly 4 `name` + 4 `superlative` shuffled. Superlatives: `biggest`/`closest`/`farthest`/`mostMoons` computed from data + `hottest`/`coldest`/`red` from flags — never hand-written. `grade(q, tappedId, attempts)` → `{correct, star}`; `star` only when `attempts===0`. Runner: banner (round `n / 8`, bilingual prompt, ★ count, 🔊); correct ⇒ `sfx.good` + `fx.burst`; wrong ⇒ `sfx.bad` + shake + "Try again! 再試一次!" (retry free, unrecorded). Mission end ⇒ end card + **one** `finish({score:stars, stars})`. Mid-mission `stop()` ⇒ no `finish`. Entering quiz ⇒ unfocus + hide card + sim keeps running.

## 13. Assets

`assets/solar/{sun,mercury,venus,earth,mars,jupiter,saturn,uranus,neptune}.jpg` — NASA public domain, ≤ 640 px wide, ~80 quality; `README.md` records source URL + credit per file. `assets/solar/tex/<id>.png` — 8 pixel-art maps (D9, slice 34; no Sun map), 128×64 PNG-8, ≤ 40 KB each; `tex/README.md` records tool/route/date. All of the above in `APP_SHELL` (offline-first; runtime never fetches a remote image).

## 14. Performance budget

Draw calls ≤ 40 (nominal ≈ 20) · triangles < 50 k · `pixelRatio ≤ 2` · no post-processing · target 60 fps on the kids' tablets, 30 floor. Measure on device in slice 31's tablet task; if the floor breaks, reduce star count to 800 before touching anything else.

## 15. Bilingual & accessibility

Every kid-facing string EN + 繁體中文, sourced from data/sim/quiz modules (grep-able: zero prose literals in `solar.js`). Tap targets ≥ 44 px; icon buttons carry `aria-label`; buttons keep `:focus-visible` outlines; text ≥ 14 px (counter line 2 excepted at 12 px minimum).

## 16. Testing contract

Node (headless): `solar-data` schema/anchors, `solar-sim` math, `solar-quiz` generation+grading, `solar.js` **named-export pure helpers** (`hitRadius`, `angleAt`, `statCells`, `factPool`) — the module must import in node without touching the vendor files (§1's dynamic-import rule exists for this). On-device (per-slice tablet tasks): scene, camera, focus rig, card, quiz, teardown, offline. `check.mjs` gates: `runtimeFiles`, bilingual blocks, manifest/sw guard, **import-graph precache guard** (see §16.1).

### 16.1 Import-graph precache guard

The manifest guard only proves a shipped game's *entry* module (`js/games/<id>.js`) lives in `APP_SHELL`. It says nothing about what that module then imports — so before this guard existed, `solar.js` statically pulled `./solar-data.js` / `./solar-sim.js` / `./solar-quiz.js` and dynamically pulled `../vendor/three.module.min.js` / `../vendor/OrbitControls.js`, and all five were precached by hand; nobody checked.

`check.mjs` now walks **one level of relative imports** from every registered (`legacy:false`, non-brain) game module and asserts each resolved target also appears in `sw.js` `APP_SHELL`:

- Regex captures specifiers from both `import … from "…"` and `import("…")`, anchored on `./` or `../` and ending `.js`/`.mjs` so interpolated loaders (`import("./games/" + id + ".js")` in `main.js`) and bare specifiers (`"three"`) are skipped by construction.
- Path resolution is plain string `dir + spec` with `.` and `..` collapsed — no `URL` round-trip (Windows-safe, no root confusion).
- Scope is the manifest's registered games, not every `runtimeFiles` entry. The `cube.js` `#devcube` probe is *not* a registered game (slice 21 constraint 4 — never in the grid/manifest) and stays out of `APP_SHELL` as designed; this guard does not touch it.
- Failure category: `offline imports`, message `js/games/<id>.js imports <spec> → <resolved> missing from sw.js APP_SHELL`.

Implication for new slices: the moment a new `js/games/<id>.js` statically or dynamically imports a new relative module, that module **must** land in `APP_SHELL` in the same commit or the build fails. Hand-precaching is still required for the entry, but forgetting a sibling no longer survives a green check.

## 17. Textures (D9, slice 34)

Per planet, at scene build: `new THREE.TextureLoader().load("assets/solar/tex/" + id + ".png", onOk, undefined, onErr)`. `onOk`: `tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.colorSpace = THREE.SRGBColorSpace;` assign as the existing Lambert material's `map` (colour multiplies — maps are albedo over the data colour, so a slightly-off map still reads as the right planet). `onErr` or missing file ⇒ keep flat colour; never an error state, never a retry loop. The Sun and Saturn's ring load nothing. All textures are disposed in `stop()` (§10 checklist gains "textures" under materials). Budget addition: ≤ 8 textures × (128×64×4 B) ≈ 256 KB VRAM — negligible; draw calls unchanged.
