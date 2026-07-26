# Design — Game platform (arcade registry, ESM, 3D seam)

**Date:** 2026-07-26
**Status:** approved by Papa (brainstorm session, Claude Code)
**Extends:** `docs/SPEC.md`, `docs/plans/2026-07-26-brain-gym/design.md`, `docs/plans/2026-07-26-machine-games/design.md`. Where this document disagrees with any of them on *how a game is wired into the app*, this document wins; gameplay, tone and lock rules from those documents stand unchanged.
**Slices:** `15-registry-host.md` … `22-3d-game.md` (numbering continues the global sequence; 01–08 in homework-lock-drills-outing, 09–11 in brain-gym, 12–14 in admin-layout).

## Context

Papa asked whether the architecture scales to more 2D games, and whether a simple 3D game could be added later. The audit found two architectures living side by side.

**Brain Gym scales.** Adding a brain game means one entry in `js/brain-data.js` — `buildRound` and `scoreRound` are generic, `eligibleGames` reads the registry, and `sync.js` recognises `brain_*` by prefix. Nothing else is edited.

**The arcade layer does not.** All nine arcade games live inline in `index.html` (211 KB, ~3000-line script, shared global `state`). Adding one game today edits **seven** places:

| # | Location | What |
|---|---|---|
| 1 | `index.html:590` | `LEVELS` entry |
| 2 | `index.html:1180` | if/else chain in `startGame` |
| 3 | `index.html:1176` | `noKb` hardcoded `(lvl==="city"\|\|lvl==="dig")` |
| 4 | `index.html:1101` | `renderSetbar` per-game branch |
| 5 | `index.html:927` | `newProg().best` hardcoded keys |
| 6 | `js/sync.js:9` | `isBestStat` six-name whitelist |
| 7 | `sw.js:2` | `APP_SHELL` entry — miss it and offline breaks |

Supabase is the *most* scalable layer: `game_stats` is `(kid_id, stat, value)`, so no new game — 2D or 3D — needs a migration, now or ever. `stars_ledger` is generic deltas. `brain_done` is Brain-Gym-only and untouched here. **This design requires zero schema change.**

The goal: make adding an arcade game cost what adding a brain game costs — one file.

## 1. Papa's decisions

| # | Decision |
|---|---|
| D1 | **Full migration.** All nine arcade games move out of `index.html` into `js/games/*.js`. This explicitly authorises touching working gameplay, which CLAUDE.md otherwise forbids. |
| D2 | **ES modules with lazy `import()`**, replacing the IIFE-plus-`<script>`-tag idiom for game files. |
| D3 | **Three.js, vendored and lazy-loaded.** Papa chose Three.js. It is vendored into `js/vendor/` (never a CDN, per offline-first), added to `APP_SHELL`, and loaded by dynamic `import()` only when a 3D game starts — so it costs nothing on the tablets and sessions that never open one. The **version is pinned to a build that parses on the Android 8 tablets** and verified there before any game is written; see §6. |
| D4 | Behaviour preservation is the acceptance bar **for the migration slices (17–20)**, and only for them. Papa has confirmed gameplay itself will change afterwards; this bar exists so those changes arrive as their own small reviewable diffs, not smuggled inside 3000 lines of code movement. A migration slice that "improves" a game while moving it is not done — it is two changes wearing one hat. |
| D5 | Gameplay changes are expected after slice 20 and are **out of scope for this design**. Each gets its own brainstorm and slice against the new registry. |

## 2. The registry

New file `js/games/registry.js` (`SQGames`). Every game — existing, future, 2D or 3D — is one object:

```js
export default {
  id: "dig",
  meta: { icon:"⛏️", title:"Dig Site", tz:"挖土工地", blurb:"Dig the right rocks" },
  keyboard: false,        // replaces the hardcoded noKb list
  bestKey: "dig",         // null when the game has no high score
  settings(bar, ctx) {},  // replaces this game's renderSetbar branch; omit when none
  init(ctx) {},           // see §3
  stop() {}               // owns its own teardown
};
```

`LEVELS` stops being a hand-maintained literal and is derived from registered `meta`. Brain games keep their `brain:true` marker and continue to route to `SQBrain.openRound`; the registry lists them so the games grid and `check.mjs` see one table, but their round logic is not migrated.

**Manifest vs. module — the split that makes lazy loading work.** The games grid renders all games at once, so it must know every game's `meta` without importing any game's code. Therefore:

- `js/games/index.js` is a **static manifest**: an ordered array of `{id, meta, keyboard, bestKey, brain}` for every game, imported eagerly by `main.js`. Small, data-only, no game logic.
- `js/games/<id>.js` holds `init` / `stop` / `settings` and is imported only when that game starts.

The manifest is the single source of truth for `LEVELS`, for grid order (favourite first, then manifest order, preserving today's behaviour at `index.html:2938`), and for `check.mjs`. A game module's own `meta` must match its manifest entry; slice 15's check enforces this so the two cannot drift.

## 3. The `ctx` contract

`init(ctx)` receives everything a game may touch. Nothing is read from ambient globals.

| Field | Purpose |
|---|---|
| `kid` | current kid id |
| `mount` | container element the game may append to (3D games add their own canvas here) |
| `stage` | the existing shared 2D `<canvas>` — 2D games use this and ignore `mount` |
| `hud(items)` | existing HUD renderer |
| `say(text, lang, keep)` / `sayPair(en, fr)` | existing speech helpers |
| `sfx` | `{good, bad, pop, zap, hit, win}` — the existing `beep` wrappers |
| `settings` | this game's slice of the settings object, already persisted by the host |
| `finish(result)` | report score / best; host writes the ledger and syncs |
| `keys` | keyboard helpers (`buildKeyboard`, `highlightTarget`, `pressFx`) for keyboard games |

**Why injection rather than globals:** today a game reaches out to `state`, `kid`, `settings`, `say`, `beep` and `hud` as ambient globals, which is precisely what makes 3000 lines inseparable. With a context object each game file can be read — and tested — without the other eight in scope.

**Why per-game `stop()`:** `stopArena` (`index.html:1231`) assumes every game is exactly one `state.raf` plus one `state.timer`. A WebGL game has a GL context and buffers to release; a game with two loops leaks. Teardown belongs to whoever created the resource. The host calls `stop()` on the outgoing game before starting the next.

**Game-local state.** The shared global `state` object is not passed. Each game keeps its own state in module or closure scope. This is the change that makes the files independently readable, and the one most likely to surface latent cross-game coupling during migration.

## 4. Module strategy

`index.html` loads one `<script type="module" src="js/main.js">`. Games are imported on demand:

```js
const mod = await import(`./games/${id}.js`);
SQGames.register(mod.default);
```

**Offline is preserved by precaching, not by eager parsing.** `sw.js` precaches `APP_SHELL` at install (`sw.js:29`), so every `js/games/*.js` file is on the tablet before a kid ever taps the game; `import()` then resolves from cache with wifi off. The offline-first non-negotiable holds. What lazy loading removes is *parse* cost, not availability: Lucien opening Big Machines no longer parses Orc Attack, Word Wizard and City Drive.

This also keeps the deferred 3D decision cheap. Three.js is roughly 600 KB; lazy `import()` means it parses only when the 3D game starts, on the tablet that started it, instead of taxing every open on every device. Eager loading would have made vendoring it a tax on all three kids.

**Secondary win:** `brain-core.js:4` currently does `typeof window!=="undefined" ? window.SQBrainData : require("./brain-data.js")`, a dual-mode hack existing only so one file can be both a browser global and a node test import. Under ESM that becomes a plain `import`. `scripts/core.test.mjs` is already `.mjs`, so tests get simpler, not harder.

**Cost:** `file://` no longer works for local development — ESM requires http. Production (GitHub Pages / Vercel) is unaffected. Local dev becomes `npx serve .` or `python -m http.server`, documented in README as part of slice 15.

**Non-game modules** (`sync.js`, `day.js`, `lock-core.js`, `drills.js`, `papa-tools.js`, `time-core.js`, `pinpad.js`, and the `admin.html` scripts) keep their current IIFE-plus-global form. Converting them is not required by this design and is out of scope; `main.js` may read their globals as it does today.

## 5. Persistence goes generic

Three hardcoded lists die. Supabase is untouched.

| Now | After |
|---|---|
| `sync.js:9` `isBestStat` — six literal names | `SQGames.isBest(key) \|\| key.startsWith("brain_")` |
| `index.html:927` `newProg().best` — six literal keys | `{}`, filled lazily — `sync.js:69` already tolerates this |
| `index.html:1176` `noKb` | `game.keyboard` |

**Migration safety.** `sync.js:70-75` currently defaults the six best keys to `0` on hydrate. Removing that is safe for reads — `bestOf` (`index.html:929`) already handles a missing key — but kids' existing high scores travel this path, so slice 16 pins the behaviour with a test against a hydrate payload containing real scores before the defaults are removed.

`sync.js` cannot import the registry: it is a plain IIFE global script (§4 keeps it that way) and an ESM `import` is not available to it. Slice 16 injects the predicate instead — `SQSync.setBestStatCheck(fn)`, called from `main.js` at startup, defaulting to the current six-name whitelist when never called. The default matters because it keeps `sync.js` correct on its own, without the registry present.

## 6. The 3D seam

The §2 contract admits a 3D game without modification — that is the test of whether it is right. A 2D game draws on `ctx.stage`; a 3D game ignores it, appends its own canvas to `ctx.mount`, runs its own render loop, and releases its GL context in `stop()`. The host does not know which it is.

Two additions make that real rather than theoretical:

- **`ctx.mount`** — so a game can own its DOM instead of being handed one fixed canvas.
- **WebGL context-loss handling in the host** — tablets drop GL contexts on background/resume. Without a `webglcontextlost` / `webglcontextrestored` path, a kid switching apps returns to a black screen. This is the one requirement 3D has that 2D never did.

### Three.js version pinning — the constraint that picks the build

`scripts/check.mjs:41-43` bans `?.`, `??` and `.flatMap` because the tablets run Android 8 with Chrome older than 80. **Modern Three.js builds use exactly that syntax**, so "latest" is not an option: a current `three.module.js` would parse-error on the tablets and the 3D game would never start. Two constraints therefore fix the version:

1. **Syntax:** the vendored build must not contain `?.` or `??`. Optional chaining reached Chrome 80; a build that uses it excludes the target device.
2. **WebGL1:** Three.js removed the WebGL1 renderer in r167. If the tablets report no WebGL2, the build must predate that.

Slice 21 resolves both empirically — it probes the tablet for its Chrome version and WebGL2 support, then pins the newest Three.js release satisfying what it found, and records the version and the reason in `js/vendor/README.md`. Nothing is guessed. The vendored file is excluded from the `runtimeFiles` syntax scan (it is third-party and pinned deliberately), and a dedicated check asserts it stays free of the two banned operators — which is the same guarantee, applied where it belongs.

**Proof (slice 21):** a throwaway spinning-cube game behind a dev flag, not in the games grid, built on the vendored Three.js. If a cube can register, render, survive a tab switch and tear down cleanly through the same contract as Dig Site — on a real tablet — the seam holds and the engine is proven. Failing here costs one file instead of a whole game.

**Slice 22 builds the real 3D game** on that foundation.

## 7. Verification

Migrating nine working games is a behaviour-preservation problem, not a design problem.

- **`scripts/check.mjs` gains a manifest check** — static, no DOM needed, since `js/games/index.js` is data-only: every entry has bilingual `meta` (the EN + 中文 invariant applies to `title` and `blurb`), a unique `id`, a `bestKey` that is null or unique, and a matching `js/games/<id>.js` on disk.
- **Per-game smoke test** in `scripts/`: the module imports, exposes `init` and `stop`, its `meta` matches its manifest entry, `init()` runs headless against a stub `ctx`, and `stop()` leaves no `rAF` or interval alive. This catches the classic migration bug — the game still plays, teardown silently stopped working, and two loops now fight. Games needing real canvas APIs get a stubbed 2D context; anything that cannot run headless is noted in its slice rather than skipped silently.
- **DONE WHEN for every migration slice:** the game plays identically (same scoring, same settings, same high-score read and write), and `node scripts/check.mjs` is green.
- **`CACHE_NAME` bump** in `sw.js` is on the checklist of every slice that adds or moves a file. Skipping it serves tablets a stale shell.

## 8. Slices

Each ships independently and leaves the app working.

| # | Slice | Ships |
|---|---|---|
| 15 | Registry + ESM host | `registry.js`, `main.js`, module entry, `sw.js` precache, README dev-server note. Legacy if/else still runs all nine through a fallback. |
| 16 | Persistence generic | injected `isBestStat`, `best:{}` lazy, test pinning existing scores |
| 17 | Pilot migration | `dig`, `city` — newest, self-contained, no keyboard |
| 18 | Keyboard games | `hunt`, `home`, `race`, `balloon`, `orc` |
| 19 | Complex two | `vocab`, `machines` — largest settings surface |
| 20 | Delete legacy | if/else chain, `renderSetbar` branches, `noKb`, shared `stopArena`, global `state`. `index.html` → roughly 60 KB |
| 21 | 3D seam + Three.js | tablet capability probe, pinned Three.js vendored into `js/vendor/`, `ctx.mount`, WebGL context-loss handling, spinning-cube proof behind a dev flag |
| 22 | Real 3D game | the game itself, on the proven seam |

Slices 15–20 deliver the scalability win alone. 21–22 are the 3D track and can wait.

**Rewrite-instead-of-migrate (per D5).** Any game with a gameplay rewrite already planned should not be migrated and then rewritten — that is the same file written twice. Such a game is dropped from its migration slice and written directly in registry form as part of its own rewrite slice, which then also carries the migration. Slices 17–19 open by confirming with Papa which games, if any, are in that state; the answer only removes work from those slices, so it never blocks them.

**After slice 20, adding an arcade game costs:** one file in `js/games/`, one line in `js/games/index.js`, one line in `sw.js`. Same shape as adding a brain game.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Migrating gameplay CLAUDE.md says not to touch | Per-slice behaviour-preservation DONE WHEN, smoke tests, one game group per slice so a regression is bisectable. D1 accepts this knowingly. D5 lowers the stakes further — gameplay is changing soon regardless, so a subtle migration regression in a game about to be reworked is cheap. It is still caught, not tolerated: the point of D4 is that nobody has to wonder *which* change broke something. |
| Migrating a game that is about to be rewritten | Wasted work. Before slices 17–19 begin, Papa names any game with a known gameplay rewrite coming; that game skips migration and is written directly in registry form as part of its own rewrite slice. See §8. |
| Latent cross-game coupling via global `state` | Expected to surface in slices 17–19. Each game's state moves to closure scope; anything genuinely shared moves to `ctx`, and if something resists, it is recorded rather than smuggled back into a global. |
| `file://` dev stops working | README dev-server note in slice 15. Only genuine ergonomic loss. |
| Stale service-worker shell | `CACHE_NAME` bump on every file-touching slice's checklist. |
| Slices 18/19 are large | `orc` and `vocab` are the biggest games; either may be split into its own slice without blocking the others. |
| High scores lost during persistence change | Slice 16 lands its hydrate test *before* the defaults are removed. |
