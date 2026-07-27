# Design — Solar System explorer (3D planets, learn space)

**Date:** 2026-07-27
**Status:** approved by Papa (brainstorm session, OpenCode)
**Extends:** `docs/plans/2026-07-26-game-platform/design.md`. This design fills that plan's **slice-22 slot — "real 3D game, on the proven seam"**. Where the two disagree on *how a game is wired into the app*, the game-platform design wins.
**Slices:** `30-solar-data.md` … `33-quiz-missions.md`. Numbering continues the global sequence — admin-ops-redesign took 19–29, so the game platform's outstanding slice numbers (its own 19–22) are superseded in practice; this plan takes 30–33 and delivers the platform's "22 — real 3D game".

## Context

Papa wants the kids to learn about space, the universe and our planets. A solar-system explorer is the natural first 3D game: it is exactly the "register, render, survive a tab switch, tear down cleanly" test the game platform's 3D seam (its slice 21) was built to prove, and orbit mechanics carry real educational value (inner planets lap outer ones — that ratio *is* the lesson).

Three decisions from the brainstorm: **full 3D** on the vendored Three.js; **three modes** — explore, orbit simulation, quiz missions; **start small** — Sun + 8 planets, one fact card each, one quiz mode.

## 1. Papa's decisions

| # | Decision |
|---|---|
| D1 | **Full 3D.** Built on the game platform's slice-21 seam: pinned vendored Three.js, `ctx.mount`, GL context-loss handling by the host. This game does not ship before that seam is proven on a real tablet. |
| D2 | **Three modes:** Explore (tap a planet → bilingual fact card + speech), Orbit simulation (real relative speeds + time-warp), Quiz missions (stars via the ledger). |
| D3 | **Start small.** Sun + 8 planets, one fact card each, one quiz mode. Dwarf planets, the asteroid belt, the Moon, constellations and textures are explicitly *later*, each its own brainstorm. |
| D4 | **Pretty, not precise.** Sizes and distances are compressed so all 8 planets fit a tablet screen; orbit speeds use *real period ratios* (Mercury laps Neptune ~165:1 — that ratio is the lesson). Fact cards carry the real numbers. |
| D5 | **No high score.** `bestKey: null`. Quiz stars are `stars_ledger` deltas reported through `ctx.finish()`, never a stored counter (project non-negotiable). |
| D6 | **Data separate from code.** `js/games/solar-data.js` holds every name and fact EN + 繁體中文, so `check.mjs` validates bilingual completeness the same way it does for brain data. Quiz questions are *computed from the data*, never hand-written, so a fact can never disagree with its quiz answer. |
| D7 | **Modern browser baseline.** The Android 8 / Chrome < 80 tablet constraint is **retired** (Papa, 2026-07-27). Current stable Three.js (WebGL2) is permitted, and the game-platform §6 version-pinning exercise ("a build that parses on Android 8", pre-r167 WebGL1 fallback, banned-operator guard on the vendor file) is superseded: slice 21 simply vendors the latest stable release and confirms WebGL2 on a real tablet. First-party solar files still avoid `?.`/`??`/`.flatMap` — not because any device needs it, but so the existing `check.mjs` legacy-syntax scan passes unchanged while it remains in place project-wide. |

## 2. The registry entry

One line in `js/games/index.js` (position: after the nine arcade games, before the brain block — grid order decision, matching favourite-first then manifest order):

```js
{ id: "solar", brain: false, keyboard: false, bestKey: null, legacy: false,
  meta: { icon: "🪐", title: "Solar System", tz: "太陽系", blurb: "Explore the planets" } },
```

`legacy: false` from birth — this is a new game written directly in registry form (the platform design's rewrite-instead-of-migrate rule, §8). That flag also arms the slice-15 `check.mjs` guard that fails the build if `js/games/solar.js` is missing from `sw.js` `APP_SHELL` — the offline non-negotiable is enforced, not remembered.

The game uses the §3 contract unchanged: ignores `ctx.stage`, appends its own WebGL canvas to `ctx.mount`, runs its own loop, releases everything in `stop()`. The host must not know this game is 3D.

## 3. Data model — `js/games/solar-data.js`

Pure data, no DOM, node-importable (same shape as `brain-data.js`). Structured fields exist so quiz questions and fact cards are *derived*:

```js
{ id:"mars", name:"Mars", tz:"火星", color:0xc1440e,
  diameterKm:6779, au:1.52, yearDays:687, dayHours:24.6, moons:2,
  flags:{ red:true },                       // computable quiz hooks
  facts:[ {en:"…", tz:"…"}, … ] }          // 3 per planet
```

`flags` carries superlatives a quiz can ask about: `biggest`, `hottest`, `coldest`, `mostMoons`, `red`, `rings`. Numeric superlatives (closest/farthest/biggest/most moons) are computed from `au`/`diameterKm`/`moons` at runtime — never duplicated as booleans, so the two sources cannot drift.

## 4. The three modes

**Explore** (default): free camera — one-finger drag rotates, pinch zooms (coarse-pointer tablet-first, no hover anywhere). Tap a planet → fact card: a DOM overlay (never canvas-drawn text — keeps 繁體中文 fonts metrically sane, same reasoning as admin-ops A6) showing name EN+中文, the real numbers, and its facts, spoken via `ctx.sayPair(en, tz)`.

**Orbit simulation:** planets already orbit in Explore at real period ratios. This slice adds the *controls*: pause/play and a time-warp slider (1 s = 1 day → 1 s = 1 year), plus a readout — "Day 365 · Earth: 1 year · Mercury: 4 years" — turning elapsed time into the discovery that inner planets lap outer ones.

**Quiz missions:** 8 rounds, questions computed from `solar-data.js`, answered by **tapping planets in the 3D scene** (reuses the Explore raycast — one mechanic, no buttons to localise twice). Two question families: identify-by-name ("Tap 火星 / Mars") and identify-by-superlative ("Which planet is the biggest?"). 1 star per correct answer, `ctx.finish({score, stars})` at the end; the host writes the ledger and syncs. `bestKey: null` (D5) — nothing touches `game_stats`.

## 5. Three.js usage

Current **stable** Three.js, vendored into `js/vendor/` by the platform's slice 21 (offline-first: never a CDN), lazy-loaded by dynamic `import()` only when the game starts. D7 supersedes the platform §6 pinning archaeology: no legacy-syntax build hunt, no WebGL1 fallback, no banned-operator guard on the vendor file. Slice 21's remaining job: vendor `three.module.min.js` + `OrbitControls.js` (bare `"three"` specifier rewritten to the relative path — documented in `js/vendor/README.md`), precache both, `ctx.mount`, host GL context-loss handling, and the spinning-cube proof on a real tablet.

Scene budget (modern tablets, still not a gaming PC): `devicePixelRatio` capped at 2, ≤32-segment spheres, MeshLambert/Standard materials, **no textures in v1** (flat colours; textures mean asset weight and licensing — later slice), emissive sun, Saturn's ring as one flat geometry, render loop pauses on `visibilitychange`.

**Tap targets:** planets are small on screen and the pointer is a finger. Raycast against invisible inflated hit-spheres (~2.5× visual radius, with a minimum world-size floor) — the coarse-pointer non-negotiable applies in 3D too. Camera is orbit-around-Sun only (`OrbitControls`: pan disabled, zoom clamped, double-tap resets view) — one mental model.

## 6. Dependencies and sequencing

| This plan needs | From where |
|---|---|
| Registry + ESM host (`SQGames`, `SQLoadGame`, `startRegistered`) | game-platform slice **15** — hard dep |
| Generic persistence (clean `finish()` path) | game-platform slice **16** — recommended, tiny |
| **3D seam** (tablet probe, vendored pinned Three.js, `ctx.mount`, host GL context-loss handling) | game-platform slice **21** — hard dep |
| Migration slices 17–20 | **not required** — solar is registry-native from birth |

Then: **30 → 31 → 32 → 33**, each ships independently and leaves the app working. Slice 30 (data) can start any time — it is pure data with tests.

## 7. Verification

- **Headless:** `solar-data.js` and every pure function (orbit position from elapsed days, quiz question generation and grading) are node-testable with no DOM — same bar as brain-core. The Three.js scene itself is verified **on the tablet**, noted here rather than skipped silently (platform §7).
- **`check.mjs`:** new files join `runtimeFiles`; first-party code stays legacy-syntax compatible per D7, so the existing scan passes unchanged. A solar-data block validates bilingual completeness of every name and fact; the existing manifest guard covers the `sw.js` precache via `legacy:false`.
- **Per-slice DONE WHEN** includes `node scripts/check.mjs` green, wifi-off play, and a clean teardown check (no rAF, GL context released) on stop.
- **`CACHE_NAME` bump** on every file-touching slice.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Slice 21's seam isn't built or WebGL2 is absent on a tablet | This plan's 31–33 do not start. Slice 30 (data + tests) is seam-independent and can land first. With D7 the seam is simple: vendor latest stable, verify WebGL2, done. |
| WebGL performance on the kids' tablets | Scene budget in §5; slice 21's cube proof still gates 31 — if a spinning cube struggles, a 9-sphere scene is reconsidered before 31 starts, not after. |
| Science facts rot (moon counts change) | Counts phrased "at least N" with a verify-against-MPC task in slice 30; superlative quiz answers computed from data, so edits stay single-source. |
| Kids lost in 3D navigation | Camera is orbit-around-Sun only (no free fly), pinch zoom clamped, double-tap resets view. One mental model. |
| Text in WebGL | None. All text is DOM overlay — bilingual fonts and the EN+中文 invariant keep working for free. |
