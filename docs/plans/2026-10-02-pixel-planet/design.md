# Pixel Planet — world home redesign

**Date:** 2026-10-02
**Status:** Approved by Papa (brainstorm 2026-10-02; toys + mini-games addendum approved the same day)
**Supersedes:** the low-poly floating-island look of `js/world/world-explorer.js` (Three.js). The approved world *behaviour* from `docs/plans/2026-09-23-learning-runtime-planet-home/design.md` — explorable home, tap a place, GO opens real content, Classic menu always available — stays in force. Only the rendering, the art and the touch model change.
**Slices:** 60–64 in this folder. A reference implementation of every module was built and exercised in a scratch browser harness while planning; the slices carry that code verbatim.

## Why

Today's world is a flat disc island built from Three.js primitives. Papa's verdict: "so different from what I imagine and it looks very cheap". The reference he gave is a round pixel-art planet: dense, saturated biomes, landmarks wrapped around the surface. He asked for "a whole planet, rotatable, with actual interactable points of interest", and suggested pixel art with fake 3D depth.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | **All pixel art is drawn in code.** The planet surface and every sprite are drawn procedurally in JS. No image assets. | Fully offline, nothing to precache beyond JS. A new place is one small draw function. One palette keeps the style consistent. |
| D2 | **The planet spins freely like a globe.** Drag in any direction. Places on the far side are hidden until spun round. | "Whole planet rotatable." |
| D3 | **Each section gets its own biome district.** | Pre-readers learn "go to the volcano" without reading (planet-home §2.2 exploratory mode). |
| D4 | **v1 includes the ambient extras:** space backdrop, drifting clouds, the kid's hero on the planet, and living biomes. | Papa picked all four. |
| D5 | **A software pixel globe on a 2D canvas, not WebGL.** Every frame, each pixel of a low-res buffer is mapped back to a lat/long on the surface map, then shaded. | Authentic pixel art with full per-pixel control (banded light, dither, rim). WebGL failure modes go away. Cheap: ~40k lookups per frame. |
| D6 | **Rewrite in place behind the same public contract.** | `index.html`, the registry and the harnesses keep working. The old version stays in git history. |
| D7 | **Adibou-style toys.** 27 small tappables on the surface plus three sky toys (moon, clouds, starfield). Each plays an instant reaction: animation, a short synth sound through the app's own muted-aware `beep`, and a haptic tap. | Papa: "a lot of things interactable that do some cute animation or quick game like in Adibou." Exploration rewards curiosity, which suits pre-readers (planet-home §2.2). |
| D8 | **Four in-place mini-games, no stars.** Star Catch 接星星 (moon), Bubble Pop 戳泡泡 (whale), Mole Hop 打地鼠 (molehill), Crystal Echo 水晶回音 (echo stone). 20–30 s each, with no fail state. A wrong note in Crystal Echo just replays the song. | Pure play. The stars ledger, admin and offline queue are untouched, so the reward economy is out of scope. |
| D9 | **Toys are data, not code.** `planet-toys.js` declares each toy's site, sprite, reaction, particle effect and sound. One generic reaction + particle engine runs all of them. | Adding a toy is one line plus a sprite. |

## Architecture

There are four units in `js/world/`. Each has one job and can be tested on its own.

| File | Job | Depends on |
|---|---|---|
| `planet-palette.js` | The fixed 32-colour palette, as both RGBA `Uint32` values and CSS strings. | nothing |
| `planet-map.js` | `buildPlanetMap(seed)` returns an equirectangular surface (256×128 palette indices, plus a parallel biome-id grid) and the list of landmark sites (`{id, lat, lon, biome}`). Contents: ocean, 8 biome regions with noisy borders, two polar caps, and pixel paths from each biome to the home village. Deterministic. Pure. | palette |
| `planet-globe.js` | Projection math and the pixel fill. `project(lat, lon, view)` returns `{x, y, z}`. `unproject(x, y, view)` returns `{lat, lon}` or `null`. `drawGlobe(imageData, map, clouds, view, light)` fills only pixels inside the disc. Pure apart from the buffer it is given. | map output, palette |
| `planet-sprites.js` | Pixel art as text rows (one char per pixel, keyed to the palette) for every landmark, toy, the hero, the moon, particles and mini-game pieces. Each sprite has 1–2 frames (an explicit `alt`, or a char `remap`), plus `dark` and `sleep` variants. Pure `spritePixels()`; `buildAtlas()` rasterises everything to canvases once at start. | palette |
| `planet-toys.js` | Toy sites/reactions/sounds (`TOYS`), sky toys (`SKY`), mini-game titles (`GAMES`, bilingual) and synth note patterns (`SOUNDS`). Pure data. | nothing |
| `planet-minigames.js` | `createMinigame(kind, env)` returns a game with `{step, draw, pointer, timeLeft, score, finished}`. All logic is in buffer pixels and runs on the world canvas. | toys (titles), sprites (via the atlas) |
| `world-explorer.js` | Lifecycle, input, selection card, saved view and `snapshot()`. Composes the units above. | the units above, registry |

`view` is `{rotation: quaternion [x, y, z, w], radius}`. `radius` is in art pixels.

### Public contract (unchanged)

- **Exports:** `start(options)`, `pause()`, `resume()`, `destroy()`, `snapshot()`, plus a new `back()`. `back()` returns `true` when it ended a running mini-game, and `index.html`'s `summerQuestBack` calls it before leaving the world. `start` returns `{pause, resume, resize, destroy, showSelection, snapshot, back}`.
- **`options`:** `mount, registry, kid, kidId, selectionEl, titleEl, subtitleEl, iconEl, goEl, haptic, onStatus`, plus a new optional `beep(freq, dur, type, vol)`. `index.html` passes its existing `beep`, which already respects Sound off.
- **Launch:** GO calls `registry.open(id, {origin:"world"})`, with the same error copy as today.
- **Visibility:** a landmark is drawn only if `registry.get(id)` returns an entry. `entry.available === false` shows the sleeping sprite and disables GO.
- **DOM:** the ids in `index.html` (`worldMount`, `worldSelection*`, `worldGo`, `worldStatus`, `worldHint`) are unchanged. The Classic menu and Heroes buttons are untouched.
- **`snapshot()`:**
  - Keeps `running, frames, contextLost (always false), error, selected, landmarks[{id, x, y, visible, available}]`, and adds `minigame` (kind or null) and `toys[{id, x, y, visible}]`.
  - `camera` keeps `position`: a virtual eye point in planet space, which changes with rotation and zoom.
  - `camera` keeps `target: [0,0,0]`, plus `distance`, `minDistance` and `maxDistance`, mapped from zoom.
  - `camera` adds `rotation` and `zoom`.
  - Existing drag, pinch-clamp and reload-restore checks keep their meaning.
- **Saved view:** the key `sq:world-view:<kidId>` is unchanged, kept in localStorage plus the in-memory map. The new shape is `{rotation:[4 finite numbers, normalised], zoom: number in [1, 2], selected?: id}`.
  - Old-format or corrupt values fail validation, and the default view is used.
  - There is no migration: it is only a camera pose.

## Look

- **Pixel scale.** 4 screen pixels per art pixel; 3 when the shorter viewport side is under 600 CSS px. The buffer is the mount size divided by that scale. At zoom 1 the planet radius is about 30% of the shorter buffer side. Zoom goes from 1× to 2×. Zoom changes the radius, never the pixel size.
- **Palette.** One fixed 32-colour set, bright and saturated in the spirit of the reference:
  - deep purple-blue ocean
  - lime and jungle greens
  - lava orange and red-brown rock
  - candy pink and magenta
  - ice blue and white
  - sand and wood browns
  - night indigos for space
  - a 2-step grey ramp for sleeping sprites

  Nothing else is ever drawn.
- **Fake 3D depth:**
  - **Light.** Light comes from the upper left. Each surface colour has a 3-band ramp (lit, base, shadow) within the palette. Bands blend through a Bayer 4×4 ordered dither.
  - **Night edge.** A soft dithered terminator on the far right. It dims the surface but never goes black.
  - **Disc edge.** A 2-pixel cyan atmosphere rim and a 1-pixel dark outline.
  - **Clouds.** A second equirectangular layer with transparency, drifting about 15% faster than the surface. Each cloud casts a 1-pixel offset shadow.
  - **Sprites near the edge.** A sprite switches to its darker variant when `z < 0.3`, and is not drawn when `z ≤ 0.08`. *(Amended while planning: the original "shrink one step" would break the 1:1 pixel grid. Sprites stay pixel-locked.)*
- **Backdrop.** Night-indigo space with two parallax star layers. Some stars twinkle on a 2-frame cycle. A small moon orbits once every 40 s, passing behind and in front of the planet.

### Biome districts

| Landmark id | District biome | Featured items inside |
|---|---|---|
| `section:quests` | Home village: huts, quest board. Faces the camera in the default view. | — |
| `section:games` | Neon arcade town with blinking signs | `game:monster-truck`, `game:paint` |
| `section:acts` | Volcano workshop with smoke puffs | — |
| `section:learn` | Snowy-peak observatory | `game:solar` |
| `section:books` | Library forest with a giant tree | `book:space` |
| `section:music` | Crystal and mushroom grove with floating notes | — |
| `section:day` | Clock-tower meadow | — |
| `section:rewards` | Treasure-cove beach with a sparkling chest | — |

- **Layout.** Districts are spread so that 3–4 are visible from any angle. Ocean fills the gaps. Polar caps (ice at the north, rock at the south) mean free spin never reveals an empty stretch.
- **Sprites.** Section landmarks are 12–16 art pixels tall, featured items 8–13 and toys up to 12. All have a 1-pixel dark outline (drawn by hand or added by the `outline` flag) and a ground shadow. *(Amended while planning: the original 16–28 crowded the 116-pixel planet.)*
- **Unavailable places** show a calm grey "sleeping" variant with 💤. No red, in keeping with coach-not-cop.
- **Hero.** The kid's colour sprite (`kid.color`, snapped to the nearest palette colour) stands in the home village. When a place is selected, the hero hops and faces it.

### Toys (D7)

| Where | Toys (reaction · effect) |
|---|---|
| Village | apple tree (shake · apples), chicken (hop · egg), windmill (spin), sleepy cat (squash · hearts) |
| Arcade | robot (hop · notes), gumball machine (shake · gumballs) |
| Volcano | lava vent (squash · lava blobs), rock buddy (yawn frame · smoke) |
| Snow | snowman (hop · snow), penguin (slide · snow) |
| Forest | owl (blink frame · note), bush (shake · bunny) |
| Grove | bouncy mushroom (squash), three singing crystals C/E/G (glow · sparkles: a tiny xylophone), frog (jump), **echo stone ✨ → Crystal Echo** |
| Meadow | sunflower (grow), cow (shake · hearts), beehive (shake · bees), **molehill ✨ → Mole Hop** |
| Beach | crab (slide), palm (shake · coconut) |
| Ocean | **whale ✨ → Bubble Pop** (spout), fish (jump · splash), boat (bob · toot) |
| Sky | **moon ✨ → Star Catch** (wink); tapping a cloud makes rain; tapping empty space sends a shooting star |

- Toys sit at least 6° from every landmark and 4.5° from each other, and stand on their declared biome (ocean toys on ocean). A unit test checks all three.
- A tap on a plain toy never opens a card and never moves the planet.
- A tap on a game toy plays its reaction **and** opens the selection card with the game's bilingual title. **GO** starts the game.

### Mini-games (D8)

- A running game draws on the same canvas over a dimmed planet. Planet input and motion are frozen.
- The selection card becomes the game bar: icon, `Title · 中文`, and `⏱ 18 · 🫧 × 7`. The **Done 完成** button can be pressed at any time.
- When time is up: confetti, `Yay! 好棒！ 🫧 × N`, a success haptic, and the button becomes **OK 好**.
- Native Back ends a running game first, via `back()`.
- Play areas avoid the HUD (top 84 CSS px) and the card (measured from `selectionEl`).

## Interaction

- **Drag.** Rotates the globe trackball-style: the surface follows the finger. After release, an up-vector correction slowly eases the north pole back toward upright, so the planet never stays upside-down.
- **Flick.** Momentum with exponential friction, coming to rest in about 1.2 s.
- **Pinch or wheel.** Zooms 1×–2× around the planet centre, clamped, with a small spring at the limits.
- **Tap.** A tap means less than 11 px of movement in less than 700 ms (same thresholds as today).
  - The hit goes to the front-most sprite whose rect contains the point and whose `z > 0.15`.
  - On a coarse pointer, hit rects grow to at least 44 CSS px.
  - Tapping empty space or ocean deselects.
- **Select a place.**
  - The globe eases (~450 ms) to centre the place, the sprite bounces, the hero hops, and `haptic("tap")` fires.
  - The selection card shows the registry's bilingual title and blurb. GO behaves as today.
- **Idle.** After 6 s with no touch and no selection, the planet spins slowly about its pole (one revolution per 90 s). Any touch stops it.
- **Reduced motion** (`prefers-reduced-motion: reduce`). No idle spin. Clouds are static and stars don't twinkle. Select snaps instead of easing.
- **Hint copy (kid-facing, bilingual).** `☝️ Tap a place 點一個地方 · ↔️ spin the planet 轉動星球 · 🤏 pinch to zoom 雙指縮放`. This also fixes today's English-only hint.

## Lifecycle and performance

- **Frame loop.**
  - `requestAnimationFrame` runs only while the world is active.
  - The globe redraws only when rotation or zoom change, or on a cloud tick (about 15 fps).
  - Sprite frames advance at 8 fps.
  - Stars, the moon and sprites are composited from cached canvases.
  - The upscale is a single `drawImage` with `imageSmoothingEnabled = false`, plus CSS `image-rendering: pixelated`.
  - Target: under 4 ms per frame on the tablet.
- **Pause and resume.**
  - The world pauses on `document.hidden`, `summerquest:native-pause`, `pagehide`, or a hidden mount, and resumes on the reverse.
  - `ResizeObserver` resizes the buffer.
  - `destroy` releases canvases and listeners and clears the mount.
- **Failure.**
  - The WebGL context-loss handling is removed.
  - If `getContext("2d")` fails or a draw throws, the error goes through `onStatus("paused", error)`, and the existing status panel offers the Classic menu.
  - Module import failure keeps using the path `index.html` already has.
- **Assets.** Three.js stays vendored and precached for the Solar game. The world no longer imports it.
- **Ambient life.** Every ~1.2 s, a visible volcano puffs smoke, music floats a note and rewards sparkles. Sleeping places float a `z` instead. Places with two frames blink at 2 fps. All of this is off under reduced motion.

## Testing and compatibility

- **Node unit tests** (auto-run by `check.mjs`): `planet-map`, `planet-globe`, `planet-toys`, `planet-sprites`, `planet-minigames`, `world-explorer`.
- **What they cover:**
  - `planet-map`: output is deterministic; every site is on land, inside its own biome; ocean is present; every biome connects to the village by path.
  - `planet-globe`: `project` and `unproject` round-trip; the far side gives `z < 0`; the disc centre maps to the facing lat/long; fill writes only in-disc pixels.
  - `world-explorer`: the `readView` accept/reject matrix; `registry.open(..., {origin:"world"})` is present; there is no Three.js, iframe or `location` navigation; all 12 landmark ids are present.
- **Rewritten Three.js assertions.**
  - `scripts/world-explorer.test.mjs`: the Three.js assertions become pixel-planet equivalents.
  - `scripts/check-world-explorer-ui.py` (`webgl_canvas`): becomes a canvas-present check.
  - `scripts/check-architecture-recovery.py`: the context-loss step becomes pause, resume and resize redraw steps; the drag, pinch and reload steps keep working through the compatible `camera` fields.
  - The `webgl` failure scenario in `check-architecture-recovery.py` (which `scripts/audit-architecture-runtime.py` runs by default) becomes `canvas`: the 2D context of the `data-sq-world="planet"` canvas is forced to `null`. The world must show the status panel, and the Classic menu must still work. The `--historical` probe in `audit-architecture-runtime.py` is left untouched, since it deliberately reproduces the original audit.
- **Offline.** `sw.js` precaches the new modules, and the cache name is bumped.
- **Gates:**
  - `node scripts/check.mjs`
  - `npm run test:world`
  - the Playwright world UI check
  - `scripts/audit-architecture-runtime.py`
  - an Android web-asset rebuild and verify
- **Not claimed from desktop.** Physical-tablet feel, touch and frame time are recorded as "needs device check" until they are observed on the tablet.

## Out of scope

- Any change to the content registry, games, books, instruments, activities, stars or the ledger.
- Changes to the Classic menu.
- AI-generated or hand-drawn image assets (see D1).
- Day/night tied to the real clock.
- Walking the hero around the planet.
- New destinations beyond today's 12 landmarks.
- Stars, badges or any ledger write from toys or mini-games (D8).
