# Art Direction — Solar System (binding)

**Status:** approved by Papa (2026-07-27). **This document is binding.** An implementing agent that deviates from any value, colour, component or rule in this file has introduced a bug — the fix is to conform, not to improvise. Changing anything here requires amending this document first (project rule: supersede by writing, never silently).
**Applies to:** slices 31–33 of this plan. Read alongside `tech-spec.md` (engineering) and `design.md` (decisions). A clickable visual draft lives at `design-preview.html` — it illustrates this spec, but **this document is the binding source**; where the mockup and this text differ, this text wins.

---

## 1. The style in one paragraph

**"Storybook space."** The solar system as a beautiful toy orrery sitting inside Summer Quest's night-purple world: stylized flat-shaded planets, a warm glowing sun, thin orbit lines, a soft starfield. Calm, warm, wondrous — never cold, never clinical, never photorealistic. The 3D scene is the *picture*; the app's existing chunky UI language (squishy buttons, chips, cards) is the *frame*. A kid should feel they opened a magical pop-up book, not a science simulation.

**Three references for intent:** a toy orrery (brass-and-wood calm), a children's picture book (flat colour, clear silhouettes), the existing Summer Quest app (its palette, its buttons, its roundness).

## 2. Hard rules (violation = bug)

1. **Palette lock.** Every colour comes from §3 or the app's CSS tokens (`index.html:18-24`). No new hues. No "close enough" hex values.
2. **No photorealism in the 3D scene.** No photographic image textures, no skybox images, no normal/bump maps, no lens flare, no bloom, no depth-of-field, no post-processing chain. **Two exceptions, each tightly scoped:** (D8) the info card shows a real photograph per body — NASA public-domain, vendored; (D9) planets may wear the **palette-locked pixel-art albedo maps** of §10 once slice 34 lands — flat colour remains the fallback and the Sun is never textured.
3. **No WebGL text.** All text is DOM overlay in the app's fonts (Fredoka display, Nunito body) — this is also what keeps 繁體中文 rendering correct.
4. **UI is the app's UI.** Buttons, chips, cards and panels reuse the app's component patterns and tokens (§6). The game must look like Summer Quest built it, not like a Three.js demo wearing a Summer Quest hat.
5. **Bilingual everywhere, always visible.** EN + 繁體中文 shown together — never one hidden behind a toggle, tooltip or hover.
6. **Tablet-first.** ≥ 44 px touch targets, no hover-dependent interactions, no drag-precision interactions (sliders are chips, not thumb-wrestling).
7. **Calm motion.** Nothing flashes faster than ~4 Hz, nothing pulses aggressively, nothing yanks the camera out of the kid's hands. Motion specs in §5 are exact.
8. **Coach, not cop, visually.** Correct = gold/green celebration. Wrong = a gentle shake and a retry invitation. No red splash, no strike marks, no timers.

## 3. The locked palette

### 3.1 Scene colours (WebGL)

| Use | Value | Notes |
|---|---|---|
| Space background (renderer clear colour) | `#191340` | One step darker than app `--bg`; the canvas reads as "deeper space" without clashing |
| Star points — white (70%) | `#FFFFFF` | opacity 0.9 |
| Star points — warm (20%) | `#FFE9C8` | opacity 0.9 |
| Star points — cool (10%) | `#C9D6FF` | opacity 0.9 |
| Orbit rings | `#4A4090` | = app `--line`; opacity 0.5 |
| Sun body | `0xFDB813` | from `solar-data.js` — data is the source of truth |
| Sun glow shell | `#FFC93C` | = app `--gold`; additive, opacity 0.18 |
| Mercury … Neptune bodies | per `solar-data.js` `color` field | **never** retype or "improve" these hexes in code |
| Saturn's ring | `#E8D9B0` | opacity 0.85 |

### 3.2 UI colours (DOM overlay) — app tokens, used exactly

`--bg #201A40` · `--bg2 #2A2350` · `--panel #332B66` · `--panel2 #3D3475` · `--ink #F3F0FF` · `--muted #A79FD6` · `--line #4A4090` · `--gold #FFC93C` · `--ok #4ADE80` · `--bad #FF6B6B` · dark-on-bright text `#1C1436` · sci-fi holo accent `#4EA8FF` (= app `--luis` — **only** for the info card's borders, classification and stat labels).

Rules: panels/cards = `--panel`; the quiz banner = `--panel2`; active chip/button fill = `--gold` with `#1C1436` text; success accents = `--ok`; the only use of `--bad` is the gentle quiz shake — never as a splash of red.

## 4. The 3D scene, object by object

**Overall composition:** sun centre-left of frame at home view, planets spread along their orbit rings, starfield behind everything. Silhouettes must read at arm's length on an 8" tablet.

- **Sun.** Unlit (MeshBasicMaterial — always at full brightness) sphere, `SCENE.sunRadius`. Wrapped in a **glow shell**: a second sphere, radius × 1.35, BackSide, additive blending, `--gold` at 0.18 opacity. No flare sprite, no corona animation in v1.
- **Planets.** MeshLambertMaterial, one flat `solar-data.js` colour each. **No bands on Jupiter, no Great Red Spot, no craters, no rings except Saturn, no axial wobble animation.** v1 distinctiveness comes from colour, size and orbit — nothing else.
- **Saturn's ring.** One flat RingGeometry: inner radius 1.35 × planet radius, outer 2.05 × planet radius, 64 segments, double-sided, `#E8D9B0` at 0.85. Ring group tilted 0.44 rad (≈ 25°) for prettiness.
- **Uranus.** The whole planet group tilted 1.71 rad (98° — its real tipped-over axis). The one factual gesture v1 allows itself.
- **Orbit rings.** One thin LineLoop circle per planet at its `SCENE.orbits` radius, 128 points, `--line` at 0.5. All eight lie flat on the ecliptic.
- **Starfield.** ONE THREE.Points cloud: 1,500 points, shell radius 60–90, size 1.6 with attenuation, the three locked tints, `depthWrite:false`. **No twinkling, no shooting stars, no nebula** in v1.
- **Lighting.** One ambient light (soft, ink-tinted `#A79FD6` ≈ 0.55 intensity) + one point light at the sun's position (`#FFF4D6`, intensity ≈ 1.1, no decay falloff theatrics). No shadows — shadow maps are forbidden in v1 (cost + visual noise).
- **Tap feedback.** Tapped planet pulses scale 1.0 → 1.15 → 1.0 over 0.25 s and `sfx.pop` plays. No selection ring, no persistent highlight — the fact card *is* the feedback.

## 5. Motion spec (exact)

| Element | Spec |
|---|---|
| Orbit motion | From sim only (tech-spec §6); default 10 sim-days/s. Never hand-keyframed |
| Axial spin | Each planet rotates on Y at 0.5 rad/s × (24 / dayHours), clamped to [0.05, 0.8] rad/s — slow, stately |
| Camera | OrbitControls damping on, `dampingFactor 0.08`; `autoRotate` **off**; double-tap resets to home over 0.4 s (ease) |
| Focus zoom (D8) | Tap a body → camera target tracks it (lerp 0.15/frame), distance tweens to `max(40, size×10)` over 0.5 s ease-out; other bodies dim to 0.35 alpha; ✕, double-tap or tapping another body reverses. This is a kid-*requested* camera move — it is allowed and exact |
| Info card entrance | `translateX(24px) → 0` + opacity `0 → 1`, 0.22 s ease-out |
| Fact card entrance | `translateY(16px) → 0` + opacity `0 → 1`, 0.18 s ease-out |
| Button press | The app's squish: `:active{transform:translateY(2px); box-shadow:0 1px 0 rgba(0,0,0,.25)}` |
| Quiz correct | `sfx.good` + `ctx.fx.burst` at the planet + ★ counter ticks up with a 0.2 s scale pop |
| Quiz wrong | Card/banner shake (app's `fbad` keyframes: ±6 px, 0.3 s) + `sfx.bad` + "Try again! 再試一次!" |
| Year tick (Orbit mode) | `sfx.pop` when a planet completes an orbit — the lap moment |
| Anything not listed | **Does not move.** No idle animations, no floating UI, no particle drift |

## 6. UI components (DOM overlay) — exact specs

All components live in one overlay root over the canvas (tech-spec §8). Fonts: `'Fredoka'` for display/numbers, `'Nunito'` for body — already loaded by the app shell; always with `system-ui, sans-serif` fallback; the game never loads a font. Border radii: 14 (buttons), 18 (banner/band), 22 (cards), 999 (chips). Shadow language: `0 4px 0 rgba(0,0,0,.25)` resting, `0 1px 0` pressed.

### 6.1 Mode bar (top centre)
Two chips: **Explore 探索** · **Quiz 測驗** (D8: Orbit is not a mode — the time band is always there). Chip = app `.chip` pattern: Fredoka 600, 16 px, 2 px `--line` border, radius 999, padding 8 px 18 px, `--muted` text. Active chip: `--gold` background, `#1C1436` text, transparent border. Sits 12 px below the stage top, horizontally centred, always visible in every mode.

### 6.2 Info card (D8 — the sci-fi holo panel)
Right-anchored panel: top/right/bottom 12 px margins, width `min(360px, 92vw)`; on screens ≤ 720 px it becomes a bottom sheet (left/right/bottom 12 px, max-height 52 vh). Glass: `rgba(25,19,64,.82)` + `backdrop-filter: blur(10px)`; border 1 px `rgba(78,168,255,.45)`; radius 18 px; outer glow `0 0 32px rgba(78,168,255,.12)`; two **gold corner brackets** (top-left, bottom-right, 18 px L-shapes). Scrolls internally if tall. Entrance per §5.
- **Photo:** full-width square (`aspect-ratio:1`, `object-fit:cover`), radius 14 px, holo border 1 px `rgba(78,168,255,.35)` + glow; `onerror` fallback = the body's flat-shaded colour gradient (never a broken image).
- **Classification:** Nunito 800, 11 px, letter-spacing 2 px, `--holo #4EA8FF` (e.g. `GAS GIANT · 氣態巨行星`).
- **Name:** EN Fredoka 700 28 px + 中文 Fredoka 600 23 px, `--ink`; ✕ close (44 × 44) top-right.
- **Description:** wiki-style, EN Nunito 700 15 px `--ink`, 中文 Nunito 700 14 px `--muted` beneath.
- **"Did you know" box:** 1 px dashed `rgba(255,201,60,.45)` border, radius 12 px; header `✦ DID YOU KNOW · 你知道嗎` (Nunito 800 11 px, letter-spaced, `--gold`) with a 🔀 reshuffle button (34 × 34, gold outline); fact EN 15 px `--ink` + 中文 14 px `--muted`. Reshuffle never repeats the current fact; opening the card shows a random one.
- **Stats grid:** 2-column cells, 1 px `rgba(78,168,255,.25)` border, radius 10 px; label Nunito 800 10 px letter-spaced `--holo`, value Fredoka 700 16 px `--ink`.
- **Listen button:** full-width app `.btn`: `🔊 Listen 聽一聽` — speaks the description.

### 6.3 Time band (persistent, D8)
Bottom band — **always visible in the free scene**, not a mode: `--panel` at 0.82 alpha + blur, radius 18 px, padding 10 px 16 px, bottom-left with 12 px margins (clears the right-side info card): five speed chips (labels from `solar-sim.js` `SPEEDS`, EN + 中文 stacked in the chip) with the active one gold-filled; above the chips, the counter — line 1: `Day 730 · 第 730 天` (Fredoka 700 19 px, `Day/第…天` in `--ink`, number in `--gold`); line 2: all eight planets `Mercury 8 · Venus 3 · Earth 2 · …` (Nunito 800 12 px, names `--muted`, counts `--gold`).

### 6.4 Quiz banner (Quiz mode)
Top centre panel below the mode bar: `--panel2`, 2 px `--line` border, radius 18 px, padding 12 px 18 px. Left: round counter `3 / 8` (Fredoka 700 18 px `--gold`). Centre: prompt EN (Fredoka 600 22 px `--ink`) with 中文 beneath (Nunito 800 18 px `--muted`). Right: ★ counter (Fredoka 700 18 px `--gold`) and 🔊 replay (44 × 44). Feedback motions per §5.

### 6.5 Quiz end card
Centred card, same card style as 6.2: giant `★ 6 / 8` (Fredoka 700 48 px, star `--gold`, text `--ink`), bilingual well-done line (`Well done, space explorer! · 做得好,小小太空人!`), two app `.btn` buttons side by side: **Again 再一次** (primary, `--gold` fill, `#1C1436` text) and **Explore 探索** (default `--panel`).

## 7. Sound & speech

| Moment | Sound |
|---|---|
| Open fact card / tap planet | `sfx.pop` |
| Orbit year tick | `sfx.pop` |
| Quiz correct | `sfx.good` |
| Quiz wrong | `sfx.bad` (soft — it accompanies the retry invitation) |
| Quiz end card | `sfx.win` |
| Every fact / prompt | `sayPair(en, tz)` — English first, then 中文 |

**No background music, no ambient drone, no engine hum** in v1. Sound honours the app's existing sound setting; speech honours the existing speech helpers — the game never invents its own audio path.

## 8. Forbidden list (the agent's "do not" page)

- ❌ Image textures on 3D geometry, skybox images, binary assets **in the scene** (the info card's vendored NASA photos per D8 are the only permitted images)
- ❌ Post-processing (bloom, glow passes, DoF, film grain), shadow maps, lens flare
- ❌ Text or labels rendered in WebGL/canvas — including planet name sprites
- ❌ Any colour not in §3; any font other than Fredoka/Nunito (+ system fallback)
- ❌ Auto-rotating camera, cinematic fly-bys, any camera move the kid didn't request — tap-to-focus (D8) and double-tap reset ARE kid-requested and allowed; everything else is not
- ❌ Timers, countdowns, streaks-shame, red failure states, locked content
- ❌ Hover-only affordances, sub-44 px targets, desktop-style range sliders
- ❌ English-only strings anywhere a kid can see
- ❌ Extra celestial bodies (Moon, Pluto, asteroids, comets, constellations) — D3 says later; this doc, amended, says when
- ❌ Animating anything §5 doesn't list

## 9. If something is unspecified

Then it is deliberately unspecified and small. Choose the option that is **simpler, calmer, and closer to the app's existing components** — in that order. If a decision feels bigger than small (a new colour, a new component, a new motion, a new sound), it is not yours to make: flag it for Papa instead of improvising.

---

## 10. "Pixel Space" — pixel-art texture direction (D9, slice 34)

The look: planets as if lifted from a beloved **SNES/GBA-era educational game** — chunky pixels, limited palettes, joyful and readable at 3 cm on a tablet. It extends "storybook space", it does not replace it: the UI, palette, lighting and calm motion of §1–§8 are untouched. When these maps are absent, the flat-colour spheres of §4 remain the canonical fallback.

### 10.1 Format (locked)

| Property | Value |
|---|---|
| File | `assets/solar/tex/<id>.png`, one per planet (8 — **never** the Sun) |
| Canvas | **128 × 64 px** equirectangular (2:1), PNG-8 indexed |
| Rendering | `NearestFilter` mag+min, mipmaps off — pixels stay crisp, never smoothed |
| Size budget | ≤ 40 KB per map after optimisation |
| Content | **Albedo only** — no baked lighting, shadow, terminator or glow (the scene lights the sphere) |

### 10.2 Palette (locked)

Each map uses **exactly one 5-step ramp** derived from the body's locked `solar-data.js` colour, plus ≤ 2 named accents:

| Step | Derivation from base | Used for |
|---|---|---|
| Highlight | base mixed 42% → white | cloud/streak tops, crater rims |
| Light | base mixed 20% → white | upper bands, raised features |
| Base | the locked data colour, unchanged | dominant surface |
| Shade | base mixed 28% → black | lower bands, crater floors |
| Shadow | base mixed 50% → black | deepest accents only, sparingly |

Permitted accents (only these): `#FFFFFF` (clouds, polar caps), `#7A4A2B` (Jupiter's rust band), `#B03030` (Great Red Spot), `#3E5F3E` (Earth landmass green). **Total ≤ 8 colours per map, ramp + accents included. No other hues.** These derivations match the preview's `shade()` math so texture and flat-fallback read as the same planet.

### 10.3 Pixel craft rules (locked)

1. **No anti-aliasing, no blur, no soft brushes** — hard 1 px edges everywhere.
2. Shading transitions use **50 % checkerboard dither only**; no ordered-dither gradients, no random noise dither.
3. **Uniform texel density** — every map reads at the same pixel size; no planet may look "higher-res" than another.
4. **No limb outlines** — the silhouette comes from the sphere, not a dark edge row.
5. Features are **abstracted, not cartographic**: Earth's continents are invented blobs, never real geography (this is a toy, not an atlas).
6. The set must cohere: same ramp logic, same band language, same speckle density range across all eight — reviewed **together**, never one-by-one (slice 34, Task 3 gate).

### 10.4 Locked feature list per body

Nothing beyond this list may appear in a map:

| Body | Features (all in ramp + permitted accents) |
|---|---|
| Mercury | sparse crater speckle: 1–2 px shade dots, ~1 per 200 px² |
| Venus | 2–3 soft horizontal streaks, light step, low contrast |
| Earth | blue base oceans, abstract `#3E5F3E` land blobs, `#FFFFFF` cloud swirls + polar caps |
| Mars | rust base, 2–3 darker maria patches (shade step), white polar caps, one 2 px Olympus Mons dot |
| Jupiter | 5–7 horizontal bands alternating base / light / `#7A4A2B`; Great Red Spot `#B03030`, ~6×3 px ellipse, southern hemisphere |
| Saturn | 3–4 subtle pale bands only (ring stays the flat geometry of §4 — no ring texture in v1) |
| Uranus | near-solid cyan, 2 faint light bands, nothing else (its calm is the joke) |
| Neptune | deep blue base, 1–2 light streaks, one shadow-step storm dot |

### 10.5 Tooling honesty (D9)

**Magnific is an upscaler, and upscaling is the enemy of pixel art** — it hallucinates smooth detail that destroys crisp limited palettes. Therefore: pixel maps are *generated* by whatever the slice-34 gate finds (a capable MCP image tool, or Papa's generator of choice, or hand-tooling in Piskel/Aseprite), then **palette-locked by hand** to §10.2. Magnific's sanctioned role, if the MCP proves present and capable, is optional enhancement of the card's NASA photos (§6.2) — never the pixel maps.
