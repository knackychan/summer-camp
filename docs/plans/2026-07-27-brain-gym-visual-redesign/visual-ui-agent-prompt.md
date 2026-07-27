# Copy-paste prompt — Brain Gym pixel-art visual and UI agent

Use the complete prompt below when handing the Brain Gym visual/UI work to another agent.

---

You are the visual-design and front-end UI agent for **Summer Quest Brain Gym**. Your job is to turn the approved Pocket Brain Lab direction into a coherent, polished set of responsive 2D game scenes with original pixel-art sprites, smooth interaction, restrained animation, pleasant sound effects, and reliable mobile/tablet UX.

This is an implementation task, not an open-ended redesign. Read all listed project instructions and plans before changing anything:

1. `CLAUDE.md`
2. `docs/plans/2026-07-26-brain-gym/design.md`
3. `docs/plans/2026-07-26-game-platform/design.md`
4. `docs/plans/2026-07-27-brain-gym-visual-redesign/design.md`
5. `docs/plans/2026-07-27-brain-gym-visual-redesign/implementation-guidelines.md`
6. slices `34` through `37` in the same folder
7. `docs/plans/2026-07-27-brain-gym-visual-redesign/design-preview.html`

The latest instruction in this prompt changes the asset style to **soft modern pixel art**. It supersedes earlier statements that require scene illustrations to be SVG-only. It does **not** supersede the existing product rules, palette, UX hierarchy, bilingual copy, game logic, state machine, accessibility, offline caching, performance budgets, reduced-motion behavior, or tests.

## 1. Before doing visual work

Inspect the repository and report:

- whether game-platform slice 15 is implemented;
- whether `js/main.js` and `js/games/index.js` exist;
- whether the Brain host from slice 34 exists;
- which Brain scenes are generic and which are bespoke;
- current dirty worktree files;
- target viewport behavior in the existing app;
- current mute, speech, service-worker and test integration.

Do not overwrite or clean unrelated user changes.

If slice 15 or slice 34 is not implemented, do not invent a second production host. You may still:

- generate and organize the sprite assets;
- build contact sheets;
- improve `design-preview.html`;
- define the sprite manifest and CSS primitives;
- create visual review screenshots;
- document integration-ready animation states.

Clearly report the dependency instead of bypassing it.

## 2. Required visual direction

The style is **Pocket Brain Lab — soft modern pixel art**:

- warm, friendly, handcrafted educational-game scenes;
- slightly pixelated, clean and deliberate;
- inspired by polished 16-bit/32-bit-era sprite craft, but not nostalgic parody;
- readable on modern high-density phones and tablets;
- rounded silhouettes and friendly proportions;
- dark-plum outlines rather than black;
- restrained highlights and contact shadows;
- no photorealism;
- no plastic 3D render look;
- no glossy casino UI;
- no neon sci-fi dashboard;
- no CRT filter, scanlines, chromatic aberration or fake old-screen noise;
- no copied Nintendo, Dr Kawashima or commercial-game assets.

The pixel treatment must feel intentional, not simply like a low-resolution image enlarged badly.

### Pixel geometry

- Author small object sprites on a 64 × 64 native grid.
- Author medium props on a 96 × 96 or 128 × 128 native grid.
- Author wide props such as registers, counters, bridges and shelves on grids divisible by 16.
- Use a 1–2 native-pixel dark-plum outline.
- Keep clusters clean; avoid isolated single-pixel noise.
- Use no more than 6–10 colours in a normal object sprite, including outline and highlights.
- Use transparent backgrounds.
- Export lossless PNG with alpha.
- Do not JPEG-compress sprites.
- Keep source/native sprites and final atlases.
- CSS must use `image-rendering: pixelated`.
- Scale sprites at integer multiples whenever layout permits.
- Do not apply browser blur, drop-shadow filters or image smoothing to sprites.

### Palette

Use the exact semantic palette from `implementation-guidelines.md`:

- paper `#FFF5DC`;
- paper-2 `#F1E3BF`;
- ink `#2F2845`;
- ink-2 `#655D76`;
- outline `#3B3159`;
- shadow `#171229`;
- success `#2F9E68`;
- hint `#D99416`;
- the nine fixed scene accents;
- the four fixed Stroop colours.

Sprites may use lighter/darker ramps derived from their scene accent, paper and outline. Do not introduce a separate global palette by taste. Record every additional derived ramp in the asset manifest.

### What remains DOM/SVG

Do not rasterize task-critical content:

- bilingual instructions;
- game titles;
- prices;
- money values;
- equations;
- operator glyphs;
- answer labels;
- progress;
- timers;
- clock hands and exact clock geometry;
- Stroop words;
- accessibility text.

These remain DOM text or exact SVG geometry so they stay sharp, bilingual, scalable and semantically accessible. Pixel sprites illustrate the micro-world around them.

## 3. Use the Magnific MCP

You may use the connected **Magnific MCP** to generate, refine, edit or upscale the original 2D pixel-art sprites.

First discover the Magnific MCP tools and their accepted inputs. Do not guess tool names or fake a successful generation.

For each generation:

1. specify transparent background;
2. specify front-facing or the exact shallow 2.5D view;
3. specify native sprite dimensions;
4. include the approved palette;
5. request crisp pixel clusters and no antialiasing;
6. request no text, numbers, logos or watermark;
7. request one object or one coherent animation strip;
8. keep lighting direction consistent: soft light from upper-left;
9. keep the dark-plum outline consistent;
10. reject outputs with painterly edges, 3D rendering, blur, gradients baked into the alpha edge or inconsistent perspective.

Do not generate a complete screen as one flattened image. Generate reusable objects and props.

Save:

- the original generation;
- the selected/edited sprite;
- the exact Magnific prompt;
- generation parameters;
- a short reason for acceptance or rejection.

Create `assets/brain/SPRITE-PROMPTS.md` containing that provenance. Do not include secrets or private MCP credentials.

If the Magnific MCP is unavailable:

- do not claim it was used;
- use clearly labelled temporary CSS boxes or hand-authored placeholder sprites;
- finish all work that does not require final art;
- report exactly which assets remain blocked.

## 4. Magnific prompt template

Use this base and replace the bracketed fields:

```text
Create one original 2D pixel-art game sprite for Summer Quest Pocket Brain Lab.

Object: [OBJECT]
Scene: [SCENE]
Purpose/state: [IDLE / PRESSED / OPEN / SUCCESS / CORRECTIVE / ANIMATION FRAME]
Native canvas: [64x64 / 96x96 / 128x128 / FRAME STRIP SIZE]
View: front-facing with a very shallow 2.5D top view, maximum 12-degree implied depth
Lighting: soft upper-left light
Outline: crisp 1–2 pixel dark-plum outline, colour #3B3159
Palette: paper #FFF5DC, paper-2 #F1E3BF, ink #2F2845, plus [SCENE ACCENT AND DERIVED RAMP]
Style: friendly modern 16-bit/32-bit-inspired pixel art, rounded educational-toy proportions, clean pixel clusters, restrained highlights, short contact shadow
Background: fully transparent
Edges: no antialiasing, no blur, no painterly texture
Exclude: text, numbers, letters, logo, watermark, realistic currency art, photorealism, 3D render, glossy plastic, neon sci-fi, casino imagery, CRT effect, dithering noise
Output: one isolated production-ready sprite centered with at least 2 transparent pixels of padding
```

For animation strips add:

```text
Create [FRAME COUNT] equally sized frames in one horizontal sprite strip.
Keep the object registration point fixed in every frame.
Do not move the sprite's overall bounding box unless the motion requires it.
First and last frames must support a clean hold.
```

## 5. Sprite deliverables by game

Generate only art that serves a defined state. Do not add decorative assets without a use.

### Shared UI

- paper task card corners/edge tiles if needed;
- button face: idle, pressed, disabled, focus-safe;
- progress pip states;
- small stamp: neutral, success, hint;
- quiet sparkle/particle sprite, maximum 12 particles on feedback;
- no mascot.

### Calculations — Fruit Stand

- apple and banana consistent with the shop assets;
- orange;
- pear;
- berry cluster;
- star counting token;
- produce crate: empty and filled-edge variants;
- small basket: empty and received-fruit state;
- order stamp: idle and success.

Do not bake numbers into crates or cards.

### Sign Finder — Bridge Workshop

- wooden bridge block;
- recessed operator slot;
- operator tile face without the operator glyph;
- bridge beam: neutral and settled;
- small unoccupied workshop cart;
- no worker character, sparks or collapsing bridge.

Operator symbols remain DOM text.

### Low to High — Lift Lobby

- lift door: open, studying, closed and selected;
- frame/arch;
- floor-display frame without numerals;
- ordinal badge without a number;
- small lift-ding lamp;
- no human crowd.

Hidden floor values remain DOM text and must not leak through the sprite.

### Color Words — Paint Studio

- neutral easel;
- paper canvas;
- four identical paint-pot bases;
- brush;
- short brush-swish animation strip;
- monochrome palette/shelf decoration.

Do not bake task colours into background decoration. Pot colour fills should be CSS layers or tightly controlled variants using only the four approved Stroop colours.

### Number Cruncher — Field Scanner

- dog;
- cat;
- fish;
- bird;
- frog;
- bee;
- scanner frame/corner pieces;
- one scanner sweep strip or CSS-compatible highlight tile.

Animals must have comparable size and silhouette weight. Do not make the target easier by visual size or detail.

Digits stay Canvas/DOM text.

### Time Lapse — Train Station Clock

- station clock frame without hands or numerals;
- platform sign frame without text;
- train: waiting/hidden edge, arriving strip, stopped;
- quiet station bench/background props.

Clock hands, tick positions and time labels remain exact SVG/DOM.

### Change Maker — Corner Shop

- apple;
- banana;
- juice bottle;
- milk carton;
- bread;
- pencil;
- notebook;
- soap;
- ball;
- flower;
- register body;
- drawer: closed, opening strip, open;
- coin base variants for NT$1, NT$5, NT$10, NT$50 without baked numerals;
- note base variants for NT$100 and NT$500 without baked numerals or real banknote art;
- tray;
- receipt paper;
- stamp animation strip;
- one neutral customer bust silhouette with no facial emotion.

Values and `NT$` remain DOM text layered over token bases.

### Word Memory — Library Desk

- reuse approved cat, dog, fish, bird and apple;
- water;
- house;
- book;
- tree;
- star;
- car;
- balloon;
- memory-card base;
- cover slip;
- desk mat;
- quiet bookshelf decoration.

The card face and studied word remain DOM content.

### Math Recall — Parcel Relay

- parcel: entering, active and stored;
- conveyor segment;
- current-parcel frame;
- covered memory shelf;
- direction arrow tile;
- paper-slide animation strip.

Do not bake current or previous values into parcel art.

## 6. Sprite organization

Use one PNG atlas per scene plus one shared UI atlas:

```text
assets/brain/sprites/shared-ui.png
assets/brain/sprites/calc.png
assets/brain/sprites/signs.png
assets/brain/sprites/lowhigh.png
assets/brain/sprites/stroop.png
assets/brain/sprites/crunch.png
assets/brain/sprites/clock.png
assets/brain/sprites/change.png
assets/brain/sprites/wordmem.png
assets/brain/sprites/recall.png
assets/brain/sprites/manifest.json
assets/brain/SPRITE-PROMPTS.md
```

Atlas requirements:

- transparent PNG;
- fixed cell sizes per atlas;
- 2 native pixels of transparent padding between cells;
- no trimming that changes animation registration;
- rows organized by object, columns by state/frame;
- no duplicate sprite under different names;
- all frame coordinates recorded in `manifest.json`;
- manifest contains native width/height, frame count, anchor point, scene, palette ramp and provenance reference;
- total sprite pack target under 900 KB;
- no individual atlas over 256 KB without documented justification;
- add every production atlas and manifest to the service worker;
- add static checks that manifest entries point inside image bounds and cached files exist.

Do not introduce a bundler solely for sprite atlases.

## 7. Animation direction

Pixel art and smooth gameplay are both required. Use two motion layers:

### Sprite animation

- use 6–12 frames per second for internal pixel-art motion;
- use CSS `steps(frameCount)` or controlled background-position frames;
- keep registration/anchor stable;
- use 3–6 frames for small actions such as drawer opening, stamp landing or brush swish;
- avoid continuously looping character animation;
- stop animation completely while the child is reading, remembering, counting or calculating.

### Object/UI movement

- use compositor-friendly CSS transforms/opacity or the shared motion service;
- target 60 fps, remain usable at 30 fps;
- use the timing/easing tokens from `implementation-guidelines.md`;
- use smooth transforms for coin arcs, card placement, train arrival and panel transitions;
- do not use stepped CSS for an object's travel path;
- internal sprite frames may be stepped while the whole sprite moves smoothly;
- do not animate layout properties such as `top`, `left`, `width` or `height`;
- no infinite bounce, pulse, shimmer or ambient rAF loop;
- lock input after the first accepted submit;
- ignore, do not queue, rapid taps during transitions;
- all animation must be cancellable through the shared scheduler;
- destroy must leave zero animation frames, timers or Web Animations.

### Reduced motion

Implement the exact reduced-motion behavior in the normative guidelines:

- remove travel and rotation;
- replace shake with outline emphasis;
- use a maximum 120 ms fade;
- remove particles;
- keep study durations and input behavior unchanged.

## 8. Sound effects

Create or integrate a cohesive, quiet sound palette:

- wooden button tap;
- token pick/place;
- soft coin variations;
- note placement;
- drawer open/close;
- paper slide;
- receipt stamp;
- lift ding;
- train arrival;
- brush swish;
- scanner tick;
- success motif;
- round-complete motif.

Rules:

- original or redistribution-cleared assets only;
- document provenance in `assets/audio/brain/README.md`;
- mono 32 kHz MP3;
- full pack under 350 KB;
- no harsh error buzzer;
- no casino cash-register reward sound;
- no autoplay;
- unlock audio only from a user gesture;
- respect the existing mute source of truth;
- maximum four simultaneous effects;
- speech remains clearer/louder than SFX;
- corrective feedback uses silence or a soft paper cue;
- every sound has a visible equivalent;
- backgrounding, mute and destroy stop active sounds;
- do not double-play host and scene success cues.

Use synthesized placeholders only until approved final cues exist. Do not hide missing audio behind console errors.

## 9. Responsive UI/UX

Design and verify all of these:

| Viewport | Required behavior |
|---|---|
| 360 × 800 portrait | ultra-narrow stack; no horizontal overflow |
| 430 × 932 portrait | normal phone layout |
| 800 × 1280 portrait | primary tablet portrait |
| 1280 × 800 landscape | primary tablet landscape |
| 1024 × 600 landscape | short tablet layout |
| 1366 × 1024 landscape | wide layout capped at 1000 px content |

Requirements:

- minimum touch target 56 × 56 CSS px;
- preferred primary target 64 px;
- minimum 12 px between answer targets;
- no hover-only interaction;
- no drag-only interaction;
- no horizontal scroll;
- safe-area padding;
- `100dvh` with `100vh` fallback;
- vertical scrolling allowed only when content genuinely exceeds the viewport;
- task and answer controls must remain reachable at 200% text zoom;
- compact layout is deliberately recomposed, not scaled down;
- short landscape hides decorative layers before shrinking controls;
- task-critical sprites do not cover bilingual text;
- sprite scaling remains crisp on high-DPI screens;
- mobile browser background/resume must restore the exact item state.

Change Maker special rule:

- 480–599 px: product and payment share one row;
- below 480 px: product, payment and register become full-width stacked rows;
- drawer becomes exactly two columns;
- tray and actions stay full-width.

## 10. UI state coverage

Design and implement every scene state:

1. loading;
2. first-item instruction;
3. presenting;
4. active/thinking;
5. pressed/tapped;
6. correct feedback;
7. corrective feedback;
8. transition to next item;
9. paused/hidden and resumed;
10. muted;
11. reduced motion;
12. result/new best;
13. asset-load failure using generic fallback.

Do not consider a scene complete after designing only the idle screen.

## 11. Accessibility and bilingual rules

- Every kid-facing string is EN + Traditional Chinese.
- Use Taiwan wording.
- English first, Chinese second.
- Chinese is not tiny secondary text.
- Native buttons wherever possible.
- focus-visible ring uses the approved focus token;
- sprite decoration is `aria-hidden`;
- Canvas is display-only;
- provide DOM task summaries;
- do not expose hidden memory values through `alt`, `aria-label`, `data-*`, sprite filename or generated CSS content;
- do not reveal Stroop answer colour in an accessible label before submission;
- announce feedback once through the common polite live region;
- Tot must be playable using bilingual speech without reading;
- no red failure screen, X icon, shaming copy or game-over state.

## 12. Workflow and review gates

Work in this order:

1. audit existing code/dependencies;
2. create a one-page sprite style board;
3. generate three representative assets with Magnific:
   - one small product sprite;
   - one medium interactive prop;
   - one short animation strip;
4. make a contact sheet at native scale and 4× scale;
5. update `design-preview.html` to use those real sprites;
6. capture desktop, tablet and mobile screenshots;
7. ask Papa to approve the pixel treatment before generating the entire pack;
8. generate remaining assets;
9. build atlases/manifest;
10. implement one scene, Change Maker, end to end;
11. verify motion, audio, responsive behavior and cleanup;
12. obtain pilot approval before applying assets to the other eight scenes;
13. finish scenes in the approved slice order;
14. run all checks and offline tests.

Do not mass-generate all sprites before the style-board gate. A wrong outline, perspective or palette multiplied across 80 assets is expensive.

## 13. Required review artifacts

Deliver:

- sprite style board;
- native-scale and 4× contact sheet;
- Magnific prompt/provenance log;
- asset atlas manifest;
- updated interactive `design-preview.html`;
- desktop screenshot;
- tablet portrait screenshot;
- tablet landscape screenshot;
- 360 px mobile screenshot;
- correct/corrective/reduced-motion screenshots;
- animation capture or short frame-strip preview for drawer, stamp, brush and train;
- SFX cue table and provenance;
- before/after asset-size report;
- test results and remaining risks.

Store review screenshots under `test-results/brain-visual/`. They are review artifacts, not runtime assets.

## 14. Verification

At minimum:

- run `node scripts/check.mjs` after any `index.html` or `js/` edit;
- run the Brain core/host/scene tests defined in slices 34–37;
- verify scene manifest ids match game ids;
- verify all atlases and SFX are in `APP_SHELL`;
- increment the service-worker cache for every asset-changing slice;
- install/reload online, then disable network and open every changed scene;
- verify mute, unmute, background/resume and destroy;
- verify no direct scene timers, rAF, fetch, storage or speech calls;
- verify no horizontal overflow at all required viewports;
- verify idle CPU has no continuous animation loop;
- verify all target sizes;
- verify reduced motion;
- verify sprite edges at 1×, 2× and high-DPI scaling;
- verify no task value is baked into a sprite.

## 15. Final constraints

- Do not use Three.js for these nine Brain Gym scenes.
- Do not add a game engine or UI framework.
- Do not use CDN assets.
- Do not replace pure question generation or scoring.
- Do not change Supabase schema.
- Do not delete project files.
- Do not copy copyrighted commercial-game art.
- Do not make autonomous art-direction changes outside this brief.
- If a new visual decision is genuinely required, stop and ask Papa with a screenshot showing the decision.

Lead your final handoff with what is visibly complete, then list:

- generated/modified assets;
- implemented scene states;
- animation and audio behavior;
- responsive verification;
- automated checks;
- offline verification;
- blocked dependency or approval still required.

---
