# Code Quest redesign — implementation plan, slices 01–02

> **For agentic workers:** execute task-by-task (superpowers:executing-plans). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Bigger code-drawn sprites with a 4-facing hero (slice 01) and a high 3/4 top-down room renderer that fits the whole room at integer device-pixel scale (slice 02).

**Architecture:** `pixel-art.js` keeps its API (`drawSprite`, `spriteSize`, `spriteURL`, `CODEQUEST_SPRITE_IDS`) and gets a redrawn atlas plus a Code Quest palette extension. New `room-view.js` is a pure projection of `model.snapshot()`; `codequest.js` swaps `drawDungeonWorld` for `drawRoom` and sizes the canvas to the stage in device pixels. Model, interpreter, levels untouched.

**Tech:** vanilla ES modules, Canvas 2D, Node `assert` tests, Playwright for screenshots.

**Scope notes (Papa, 2026-10-03):** potion / Camp area deferred — item icons (potions, ingredients, weapons, charms) keep their current frames; Camp restyle in slice 06 waits for Papa's new style.

## Palette amendment to D3

The Pixel Planet palette has no neutral blue-grey stone ramp and no skin tone; the reference look needs both. `js/games/codequest/palette.js` re-exports planet indices 0–31 unchanged and appends a small Code Quest ramp (32+). Nothing outside Code Quest sees it. Recorded in design.md D3.

| idx | key | hex | use |
|---|---|---|---|
| 32 | deep | `#14132a` | wall shadow, void |
| 33 | stoneDark | `#23223b` | mortar, floor shade |
| 34 | stone | `#33324f` | floor base |
| 35 | stoneMid | `#46456a` | floor lit, wall face |
| 36 | stoneLit | `#615f88` | wall top, highlights |
| 37 | warmDark | `#3d2c3a` | torch-lit floor shade |
| 38 | warm | `#5b4250` | torch-lit floor |
| 39 | warmLit | `#87605a` | torch-lit highlight |
| 40 | skin | `#f2b88f` | faces, hands |
| 41 | skinShade | `#c7805f` | face shade |

## File map

- Create `js/games/codequest/palette.js` — `CQ_HEX`, `Q` (index keys).
- Create `js/games/codequest/sprites-world.js` — world frames (`WORLD_SPRITES`, `WORLD_CHARS`, helpers `mirror`/`patch`/`stamp`/`recolor`/`bob`).
- Modify `js/games/codequest/pixel-art.js` — merges world frames over legacy ones (items stay legacy), draws from `CQ_HEX`, exports `spriteBitmap`/`spriteChars`.
- Create `js/games/codequest/room-view.js` — `fitRoom()`, `drawRoom()`.
- Modify `js/games/codequest.js` — import swap, canvas sizing, resize observer.
- Modify `css/codequest.css` — scene canvas no longer `object-fit`-scaled.
- Modify `sw.js` — APP_SHELL + cache bump.
- Modify `scripts/codequest-renderer.test.mjs` — new assertions; old `drawDungeonWorld` coverage stays (file kept, D9).

## Task 1 — Palette extension

- [ ] Test (append to `scripts/codequest-renderer.test.mjs`):

```js
import { HEX as PLANET } from '../js/world/planet-palette.js';
import { CQ_HEX, Q } from '../js/games/codequest/palette.js';
PLANET.forEach((hex, i) => assert.equal(CQ_HEX[i], hex, 'planet index ' + i + ' must not move'));
for (const k of ['deep','stoneDark','stone','stoneMid','stoneLit','warmDark','warm','warmLit','skin','skinShade']) assert.ok(/^#[0-9a-f]{6}$/.test(CQ_HEX[Q[k]]), k);
```

- [ ] Run `node scripts/codequest-renderer.test.mjs` → fails (module missing).
- [ ] Create `palette.js` with the table above (`CQ_HEX = Object.freeze([...HEX, ...extras])`, `Q = { ...C, deep:32, … }`).
- [ ] Run → passes.

## Task 2 — Sprite size + palette contract (failing first)

- [ ] Test:

```js
import { CODEQUEST_SPRITE_IDS, spriteSize, spriteBitmap, SPRITE_CHARS } from '../js/games/codequest/pixel-art.js';
const ACTORS = ['hero-s-idle','hero-s-walk-1','hero-s-walk-2','hero-s-attack','hero-s-hurt','hero-n-idle','hero-n-walk-1','hero-n-walk-2','hero-n-attack','hero-n-hurt','hero-e-idle','hero-e-walk-1','hero-e-walk-2','hero-e-attack','hero-e-hurt','goblin-0','goblin-1','archer-0','archer-1','bulwark-0','bulwark-1','emberImp-0','emberImp-1','frostMite-0','frostMite-1','companion','npc','npc-helped'];
const PROPS = ['slime-0','slime-1','viper-0','viper-1','chest-closed','chest-open','key','trap-active','trap-safe','cycle-trap-active','cycle-trap-safe','lever-off','lever-on','plate-off','plate-on','crate','push-block','moving-platform','quest-token','rune-core','exit','stairs','floor-a','floor-b','floor-crack','wall-top','rubble','skull'];
for (const id of ACTORS) assert.deepEqual(spriteSize(id), { width:16, height:24 }, id);
for (const id of PROPS) assert.deepEqual(spriteSize(id), { width:16, height:16 }, id);
for (const id of CODEQUEST_SPRITE_IDS) for (const row of spriteBitmap(id)) for (const ch of row) assert.ok(ch === '.' || ch === 'A' || ch in SPRITE_CHARS, id + ' uses unknown colour ' + ch);
```

  Large enemies (`golem`, `runeWarden`, `circuitGuardian`) are 24×24 frames, `relicHydra` 32×24, door / rune-gate / wall-face 16×24, `torch` 8×16, `pillar` 16×24, `banner` 8×16.
- [ ] Run → fails.

## Task 3 — Atlas: hero (3 facings × 5 states)

- [ ] In `pixel-art.js`: char map `P` points at `CQ_HEX` indices; add `E` skin, `e` skinShade, `s` stone keys. `drawBitmap` reads `CQ_HEX`.
- [ ] Draw `hero-s-*`, `hero-n-*`, `hero-e-*` (16×24): brown hair, skin face, accent (`A`) tunic + cape, steel shield, dark boots. Walk frames alternate legs; attack extends a blade on the facing side; hurt = recoil 1 px + `W` flash eyes.
- [ ] Aliases: `hero-idle` → `hero-s-idle`, `hero-walk-1/2`, `hero-attack`, `hero-hurt` likewise (so old callers and `spriteURL` keep working).

## Task 4 — Atlas: enemies, companion, NPC

- [ ] Two idle frames per enemy (`<id>-0/1`, 1 px bob or blink). Bare id aliases `-0`.
- [ ] Companion: owl-wizard look (purple hat, lilac body) — reference's helper character.

## Task 5 — Atlas: props + environment

- [ ] Redraw every world prop at the sizes in Task 2. Decor: `banner`, `rubble`, `skull`, `torch` (2 flames: `torch`, `torch-1`). Floor slabs and wall blocks are drawn procedurally by `room-view.js` (more variation than fixed frames).
- [ ] New modules go in `sw.js` APP_SHELL; rebuild `dist/android-web` (`node scripts/build-android-web.mjs`) before `check.mjs` — its payload test compares the bundle to source.
- [ ] Run renderer test → Task 2 assertions pass.
- [ ] `node scripts/check.mjs` green. Commit `feat(codequest): 16px sprite atlas with 4-facing hero`.

## Task 6 — `fitRoom` (pure, TDD)

- [ ] Test:

```js
import { fitRoom, TILE, FACE } from '../js/games/codequest/room-view.js';
for (const dpr of [1, 1.5, 2, 2.625]) {
  const fit = fitRoom({ width:9, height:7 }, 1240, 500, dpr);
  assert.ok(Math.abs(fit.scale * dpr - Math.round(fit.scale * dpr)) < 1e-9, 'whole device pixels at dpr ' + dpr);
  assert.ok(fit.scale * TILE >= 48, '9×7 room tiles ≥ 48 CSS px at dpr ' + dpr);
}
const small = fitRoom({ width:9, height:7 }, 300, 200, 1);
assert.ok(small.scale >= 1);
```

- [ ] Implement: `bufW = width*TILE + 2*MARGIN`, `bufH = height*TILE + FACE + 2*MARGIN`; `device = max(1, floor(min(cssW/bufW, cssH/bufH)*dpr))`; `scale = device/dpr`; origin centres the buffer in the canvas (device px).

## Task 7 — `drawRoom`

- [ ] Signature `drawRoom(canvas, snapshot, options) → { anchors, scale, origin }`. Canvas backing size = `round(cssWidth*dpr) × round(cssHeight*dpr)`. Draw in device pixels with `ctx.setTransform(device,0,0,device,ox,oy)` so one logical pixel = `device` device pixels.
- [ ] Layers: masonry backdrop (whole canvas) → floor tiles (variant from `(x*7+y*13)%5`, warm variants within 2.5 tiles of a torch) → markings → verticals sorted by `y*100+x+bias` → FX (ported from `dungeon-view.js`) → light/vignette. Wall tile: `wall-top` at `(x*T, y*T - FACE)`, `wall-face` below it when the tile south is not a wall. Torches on back-wall faces every 3–4 columns (deterministic).
- [ ] Hero facing: `S`→`hero-s-*`, `N`→`hero-n-*`, `E`→`hero-e-*`, `W`→`hero-e-*` flipped.
- [ ] Reduced motion option `reducedMotion` disables flicker/shake.
- [ ] Test: paint q01, q20, q42 and the expedition boss on `FakeCanvas` (add `setTransform`, `drawImage` no-ops); assert ops > 200 and `anchors.has('hero')`.

## Task 8 — Wire into the game

- [ ] `codequest.js`: import `drawRoom`; `draw()` passes `cssWidth/cssHeight/dpr` from `S.canvas.getBoundingClientRect()` and `devicePixelRatio`; `ResizeObserver` on `.cq-scene` triggers `draw()`; anchors kept in `S.anchors`.
- [ ] CSS: `.cq-scene canvas{object-fit:fill}` (canvas backing size already matches its box).
- [ ] `sw.js`: add `./js/games/codequest/palette.js`, `./js/games/codequest/room-view.js`; bump `CACHE_NAME`.
- [ ] `node scripts/check.mjs`, `node scripts/codequest.test.mjs`, `node scripts/codequest-renderer.test.mjs` green.
- [ ] Screenshot q01, q13, q20, q42 at 1280×800 + 1280×600 (`scratchpad/shot_cq.py`), review, iterate art.
- [ ] Commit `feat(codequest): high 3/4 top-down room renderer`.
