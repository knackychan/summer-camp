# Slice 03 — Lab scene art (code-drawn)

**Status:** Approved by Papa 2026-10-04 (`design.md` D3).
**Goal:** A cozy, alive, readable lab scene in the dungeon's pixel style, with every interactive object a clear tap target.
**Depends on:** 01 (ingredient ids for jar contents).
**Files:** new `js/games/codequest/lab/lab-art.js`, new `js/games/codequest/lab/lab-view.js`, `js/games/codequest/palette.js` (append only, if needed), `scripts/codequest-renderer.test.mjs`, `sw.js` APP_SHELL + cache bump.

## Change

- Logical buffer **320 × 180** px (16:9 landscape). Canvas sized to the stage in device pixels; `scale = max(1, floor(min(stageW/320, stageH/180) * dpr)) / dpr`, centred; leftover space is dark wood/stone backdrop, never flat black (same rule as `room-view.js`).
- Composition (vision §4.2, Papa's mock):
  - back wall: stone, arched moon window (moon, night sky, 2-frame star twinkle), hanging plants, lantern;
  - right: two-row shelf with 8 jars (one per shelf ingredient, ingredient visible inside the glass, label plate below);
  - centre: cauldron on a stone burner ring, liquid surface + bubbling (3 frames), fire below (2 frames);
  - left: open Journal book on the bench; owl mentor on a stack of books (blink, head turns toward the cauldron);
  - right bench: cat curled on books (breathing, tail flick);
  - foreground: mortar and pestle, stir spoon on the rim, frost plate, scroll (potion script, D10), bag tray with the 4 bag ingredients.
- `lab-art.js`: drawers in the `pixel-art.js` style (char-grid bitmaps or rect drawing, outline + 2-tone shading). Lab-only ids: `lab-jar-<id>`, `lab-cauldron`, `lab-owl-{idle,blink,talk}`, `lab-cat-{idle,flick}`, `lab-book`, `lab-mortar`, `lab-spoon`, `lab-frost`, `lab-scroll`, and the 8 shelf ingredient icons. Bag icons reuse existing `pixel-art.js` ids.
- `lab-view.js`: `drawLab(ctx, { time, now, mix, selection, effect, paused, reduced })` → `{ hits }`, `hits` = `[{ id, kind: 'jar'|'bag'|'cauldron'|'prop'|'book'|'scroll', rect }]` in CSS px. No DOM, no profile. Idle animation stops when `paused`; flicker and twinkle off when `reduced`.
- Every hit rect ≥ 48 CSS px on its short side at the smallest supported stage (1280×600, dpr 1); small sprites get padded hit rects.
- Palette: existing indices first; new lab tones (candle amber, potion green, void violet) appended after index 41 only if missing, each commented.

## DONE WHEN

- `codequest-renderer.test.mjs` (same stub canvas the renderer tests use): `drawLab` at 1280×800 and 1280×600 returns hits for all 8 jars, 4 bag items, cauldron, mortar, burner, spoon, frost plate, book and scroll; no two hit rects overlap; all ≥ 48 px; `paused` and `reduced` draws do not throw; palette indices 0–41 unchanged.
- Screenshot saved under `test-results/codequest-lab/` and reviewed by Papa against the mock's mood: warm bench light, cool moon window, readable jars.
- `node scripts/check.mjs` green.

## Implementation notes (2026-10-04)

- `drawLab(canvas, options)` takes the canvas (like `room-view.js`'s `drawRoom`), sizes it, and returns `{ hits, fit }`; `fitLab` and `hitAt` are exported for the screen controller. Hits carry `ingredient` (jars, bag) or `step` (tools). An `owl` hit was added (slice 04: tap the owl to hear the last line again).
- Tests live in a new `scripts/codequest-lab-view.test.mjs` (7 tests: fit, every hit present, ≥ 48 CSS px and non-overlapping at 1280×440@1, 1280×640@1, 1280×440@2, 1024×520@1.5, palette-only fills, frozen frames while paused / reduced). `codequest-renderer.test.mjs` is untouched.
- No palette additions: candle amber = `lava`/`yellow`, potion green = `green`, void violet = `purpleDark`/`magenta` already exist.
- Light is stepped ellipse pools at low alpha (no rectangles); the scene is redrawn whole each frame (~1.5k fills). If slice 07 finds it slow on Android 8, cache the static wall/window/shelf/bench layer the way `room-view.js` does.
- Screenshots for Papa: `test-results/codequest-lab/scene-1280x720.png` (Echo + Mushroom in the cauldron, Moon Berry lifted) and `scene-empty.png`.
- `sw.js` entries for `lab-art.js` / `lab-view.js` come with slice 04, when something loads them.

**Reviewed by Papa 2026-10-04** (chat, after the merge of knackychan/summer-camp#2: "im good with that") — screenshots in `test-results/codequest-lab/` accepted as they are.
