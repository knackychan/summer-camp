# Brick Lab

**Status:** approved by Papa, 2026-10-03 (chat: "can you plug in the Lego Lab" → picked native game module, Games tab tile, Paint-style creative door; "ok go" on the design).
**Source:** `Summer-Quest-Brick-Lab-v0.1.0-Integration.zip` (SHA-256 `435fee05…82f9b7`, verified), kept outside the repo in `AI TOOLS/summer quest/Lego Lab/`. The kit was written for a "v0.6.1 Miniature 3D World" baseline with a `SQContentRegistry` launcher; this repo plugs 3D games in through `js/games/`, so the kit is adapted, not installed.

## What it is
A tablet-first Lego-style 3D builder: 15 procedural parts (bricks, plates, slope, wheel, rail, tree, flower), 13 colours, grid snap + stacking, select / move / rotate / copy / recolour / delete, Undo, per-kid local save, and two modes — Build and Explore (tap an object in Explore → back to Build with it selected and the camera focused).

## Decisions
| # | Decision | Rationale |
|---|---|---|
| D1 | **Native game module.** Runtime lives in `js/brick-lab/` (`brick-lab.js`, `brick-catalog.js`, `brick-storage.js`) + `css/brick-lab.css`. `js/games/bricklab.js` wraps it on the `ctx` contract: `init(ctx)` mounts into `ctx.mount`, `stop()` destroys it. The kit's `brick-lab-host.js`, `apply-brick-lab.mjs`, SQContentRegistry hook and world descriptor are **not** brought in. | One way in for games: manifest, `SQLoadGame`, host Back, `check.mjs` gates. The kit's host would be a second overlay with its own Back and z-index 999. |
| D2 | **Graphics through `three-runtime.js`.** `loadThree(canvas, true)` / `createRenderer` / `releaseContext`, like `solar.js`. Every piece's geometry and material is disposed on destroy. | WebGL1 tablets get the r162 fallback; lost-context notice; the GL context is released on Back. The kit made its own renderer and leaked geometries. |
| D3 | **Games tab tile**, full screen: `bricklab`, 🧱 "Brick Lab 積木實驗室", `bestKey: null`. The kit's own ← exit button is dropped — the host top row owns Back. Planet landmark is a later slice, not this plan. | Smallest entry; same as Solar System. |
| D4 | **Creative-tool door.** Like Paint, Brick Lab passes the Brain-Gym gate, the redo lock and the Games category lock; only a Papa app pause stops it. The Origami session (same day) had already turned the three `lvl==="paint"` checks in `index.html` into `isCreativeTool(lvl)` over a `CREATIVE_TOOLS` list, so this is one more id in that list. | No stars, no score: it is making, not screen-time reward. Papa chose this. |
| D5 | **Bilingual.** Every kid-facing string (mode toggle, categories, parts, colours, hints, toasts, aria labels) ships EN + 繁體中文. Pre-reader (icon-first) treatment applies to kids aged ≤ 5, read from `ctx.kids[ctx.kid].age` — the kit's `profile.readingLevel` doesn't exist here. | Bilingual invariant. |
| D6 | **No stars; local save only.** Builds save to `localStorage` key `sq:brick-lab:v1:<kid>` and do not sync. | Offline-first; a build is a toy, not ledger data. A build does not follow a kid to another tablet — accepted. |
| D7 | **Touch handlers use `pointerdown`** for buttons (games CLAUDE.md tablet rule). Canvas tap detection keeps pointerdown/up travel test. | Tap latency. |

## Not in this plan
Assemblies / My Blocks, booklets, curved rails and trains, animals, behaviours, Code Quest bridge (the kit's own roadmap). A planet landmark.

## Slices
- `01-module.md` — D1, D2, D3, D6, D7
- `02-bilingual.md` — D5
- `03-creative-door.md` — D4
- `04-device-check.md` — Android 8 / WebGL1 validation
