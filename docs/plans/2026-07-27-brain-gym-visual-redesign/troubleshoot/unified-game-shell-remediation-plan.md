# Unified Game Shell Remediation Plan

Date: 2026-07-28
Status: implementation plan
Reference screenshots:

- Good reference: `balloon-pop.png`
- Good reference: `solar-system.png`
- Broken: `bug change maker.png`
- Broken: `bug city drive.png`
- Broken: `bug dig site.png`
- Broken: `bug home row.png`

## Authority And Interpretation Rules

This document is the implementation authority for the game-shell remediation.
Agents must not reinterpret the target visual system from memory, from older
Pocket Brain Lab notes, or from the current broken runtime. When this file and an
older plan disagree about layout, containment, colour dominance, or navigation,
this file wins for the remediation.

Agents must not make art-direction decisions while implementing this plan. If a
choice is not explicitly covered here, apply the decision rule below:

1. If the choice affects shell layout, rail, HUD, stage sizing, navigation,
   palette dominance, or cross-game behavior, stop and ask Papa.
2. If the choice affects a single game's internal decorative art but not task
   readability or shell behavior, choose the smallest change that preserves the
   reference screenshots.
3. If the choice affects gameplay, scoring, timing, persistence, locks, stars,
   or generated questions, do not change it in this remediation.
4. If a bug is found outside visual shell/layout migration, document it in the
   relevant plan or TODO section and leave behavior unchanged unless Papa
   explicitly adds it to scope.

Terms used here are exact:

- "Shell" means the app-owned game view: left rail, back button, game chips,
  mute, settings bar, HUD, stage, and optional keyboard.
- "Stage" means the right-side framed game rectangle, `#stage`.
- "Scene root" means the first child inserted by a game into the stage.
- "Contained" means the game renders inside `#stage`; it does not own the body
  or the app page.
- "Full-stage" means 100% of the stage bounds, not 100vh or document body.
- "Local prop" means a surface inside a game, such as a tray, till, card, board,
  or canvas. Local props may be paper/green/gold; the page/stage may not become
  those colours.

## Files In Scope

Primary files expected to change:

- `index.html`: current shared CSS and inline host shell logic.
- `css/brain-shell.css`: Brain contained shell/token behavior.
- `css/brain-scenes.css`: Brain scene-specific contained visual behavior.
- `js/brain/host.js`: Brain mount/contained behavior.
- `js/brain/scenes/change.js`: Change Maker scene markup.
- `js/brain/scenes/index.js`: Brain scene loader manifest as more scenes ship.
- `js/games/city.js`: City Drive stage/root/canvas sizing.
- `js/games/dig.js`: Dig Site stage/root/layout centering.
- `js/games/home.js`: Home Row stage/root/layout centering.
- `js/games/solar.js`: only compatibility guards/fallback messaging if Papa
  chooses to support Android 8; do not redesign Solar here.
- `js/games/*.js`: later audit for the same shell contract.
- `scripts/check.mjs`: static checks to prevent regression.
- `sw.js`: only when new runtime files/assets are added.

Files not to change for this remediation unless directly required:

- `js/brain-core.js`: scoring/tier/grading logic.
- `js/brain-data.js`: generated item semantics, except later bespoke Brain scene
  data fields already approved elsewhere.
- Supabase files.
- Admin routes.
- Day/lock/persistence logic.

## Forbidden Implementation Moves

Agents must not:

- create a second rail;
- create a second HUD;
- create a second back button inside a game scene;
- create a second mute button inside a game scene;
- open a normal game as a body-level modal;
- use `position:fixed` for normal game content;
- size stage content with `100vh`, `100dvh`, or document body measurements;
- append primary game UI to `document.body`;
- recolour the full stage beige, green, blue, or any game-specific colour;
- move the keyboard inside the stage;
- hide the rail on tablet/desktop game mode;
- change game ordering in the rail;
- change score, best, star, daily gate, or resume behavior;
- change game rules while fixing layout;
- add a framework or dependency;
- add remote assets or network-dependent runtime behavior;
- remove existing files as cleanup;
- use screenshot-specific magic numbers without explaining the responsive rule;
- fix City/Dig/Home by adding margins to match one viewport only;
- fix Change Maker by making the shell beige instead of making the shop a local
  prop inside the purple stage.

Temporary exceptions must be marked in code with:

```js
/* TODO(shell-remediation): exact reason and removal condition. */
```

No permanent exception is allowed without adding it to this plan.

## Goal

Make every game launched from the games view feel like the same product:

- same left game rail;
- same outer HUD behavior;
- same framed self-contained stage;
- same purple/dark-plum shell palette;
- same available screen usage;
- same back/mute/access/navigation behavior;
- same responsive behavior from compact mobile through tablet and desktop;
- no standalone full-page game skins inside the game area.

This plan covers both the already-migrated arcade games (`city`, `dig`, `home`,
`balloon`, `solar`) and the Brain Gym/Change Maker family (`change`, then the
rest of the Brain scenes).

## Current Findings

### Good Reference Behavior

`balloon-pop.png` and `solar-system.png` establish the target:

- The left rail remains visible and fills the viewport height.
- The rail uses the same dark purple container, thin outline, stacked chips,
  active pink chip, and bottom sound control.
- The HUD is centered in the top content area, separate from the game canvas.
- The stage fills the remaining right-side space.
- The stage has the same rounded border, dark purple background, and no extra
  page surface inside it unless the game truly needs an internal panel.
- Game controls and overlays stay inside the stage bounds.
- Canvas/scene content is sized from the stage, not from the viewport or legacy
  hard-coded heights.

### Broken Change Maker

Observed from `bug change maker.png`:

- It is visually a standalone beige shop page, not a game inside the shared
  purple arcade shell.
- The left rail is missing.
- The shared top HUD shape is missing.
- It owns the full page header (`Later`, title, mute, progress, timer) instead
  of using the same outer game-mode layout as Balloon Pop and Solar System.
- Its beige paper fills the visual hierarchy too strongly, making it look like a
  different application.
- It has a nested large card with another internal border and shop UI. This
  breaks the self-contained game-area pattern used by the good references.

Likely causes:

- `SQBrain.openRound()` supports contained mode, but this screenshot appears to
  show the non-contained/full-round path or an outdated preview path.
- `brain-change` was designed as a Brain full-screen scene first, then adapted
  to contained mode. The contained CSS still preserves too much standalone
  beige card identity.
- Change Maker's scene-specific palette is compliant with the old Pocket Brain
  Lab document, but not with the current requested unified game-shell art.

### Broken City Drive

Observed from `bug city drive.png`:

- The shared rail and HUD are present.
- The city canvas only fills the upper slice of the stage.
- The lower part of the stage is empty purple.
- The driving viewport does not use the full available game area.

Likely causes:

- `.stage.arena` is full height in game mode, but `.cd-wrap` still sets
  `height:min(52vh,430px)`.
- `city.js` measures `wrap.clientWidth` and `wrap.clientHeight` once at init.
  There is no resize observer or redraw resize path.
- The game writes directly to `document.getElementById("stage")` rather than
  using only `ctx.stage`/`ctx.mount`, so it keeps legacy assumptions.

### Broken Dig Site

Observed from `bug dig site.png`:

- The shared rail and HUD are present.
- The stage fills the screen, but the actual dig board sits too high and is not
  vertically centered as a complete game surface.
- Cue, board, controls, and help message are separate loose elements rather than
  one centered scene composition.
- The bottom area is mostly empty.

Likely causes:

- `.stage` is a centered flex container only before `.arena`; `.stage.arena`
  switches to `display:block`.
- Dig writes loose children directly into `#stage`.
- `.dg-grid` uses margin-based placement rather than a stage-level layout grid.
- The controls and message are not wrapped into a fixed self-contained play
  layout.

### Broken Home Row

Observed from `bug home row.png`:

- The shared rail and HUD are present.
- The word prompt is pinned near the top-left of the stage.
- The stage content is not centered.
- The keyboard area is outside the screenshot lower area, so the game lacks a
  clear internal centered focus area.

Likely causes:

- Home Row rewrites `#stage.innerHTML` directly on every key.
- It depends on `.stage` default flex centering, but `.stage.arena` disables that
  with `display:block`.
- There is no Home Row internal wrapper that fills the stage and centers the
  prompt.

## Root Cause Summary

The migration created two different layout contracts:

1. Good games treat the app's `#game` layout as the owner of rail, HUD, stage,
   keyboard, mute/back behavior, and game switching.
2. Several migrated games still treat `#stage` as an old standalone or fixed
   height canvas and place their internal content with legacy CSS.

The fix is not to tune each screenshot independently. The fix is to define one
strict shell contract, then make every game implement that contract.

## Reference Geometry

Use the good screenshots as the geometry target. These values describe the
current good shell; they are not arbitrary new design.

Desktop/tablet landscape, width >= 600:

- Page enters `body.game-mode`.
- `.wrap` fills the viewport with 10px top/bottom and 12px side padding.
- `#game` is a two-column grid:
  - column 1: left rail, `clamp(142px, 16vw, 210px)`;
  - column 2: content, `minmax(0, 1fr)`.
- Rows:
  - settings bar, if present;
  - HUD;
  - stage, `minmax(0, 1fr)`;
  - keyboard row, when enabled.
- The rail spans all rows.
- The stage fills row 3 completely.
- Stage border radius is 18px in game mode.
- Stage has a 2px purple outline.

Compact/mobile:

- The rail may collapse to the existing top chip layout if the current app shell
  does so; do not invent a new mobile rail.
- Stage content still uses a scene root that fills `#stage`.
- Horizontal scrolling is never acceptable.
- Vertical scrolling is allowed only when the viewport cannot fit all controls
  at minimum tap sizes.

## Exact Visual Tokens

Use these existing tokens as the shared visual family:

```css
:root {
  --bg: #201A40;
  --bg2: #2A2350;
  --panel: #332B66;
  --panel2: #3D3475;
  --ink: #F3F0FF;
  --muted: #A79FD6;
  --line: #4A4090;
  --gold: #FFC93C;
  --ok: #4ADE80;
  --bad: #FF6B6B;
}
```

Brain tokens must visually map to the same family:

```css
--brain-backdrop: #17132f;
--brain-shell: #27214f;
--brain-shell-2: #332b66;
--brain-outline: #3b3159;
```

Rules:

- Purple/dark-plum is the dominant shell and stage colour.
- Pink is the selected rail chip colour for Lili/current active chip, matching
  the good screenshots.
- Gold is for active target/current highlight.
- Green is for positive/give/register affordances, not page background.
- Paper/beige is only for local task props.
- Red is only for transient corrective/error signals outside Brain; Brain
  corrective still uses hint styling.
- No new dominant palette is allowed.

## Non-Negotiable Shared Contract

Every game in the game view must follow this contract:

1. The game host owns the page-level frame:
   - left rail;
   - back button;
   - active game chip;
   - mute control;
   - top settings bar when applicable;
   - top HUD;
   - stage bounds;
   - optional keyboard row.

2. Game modules own only the inside of `ctx.stage` or `ctx.mount`.

3. No game module may append primary game UI to `document.body`.
   - Completion modals should route through a shared host overlay helper or
     render inside the stage.
   - Exceptions require an explicit documented reason.

4. No game module should call `document.getElementById("stage")` directly.
   - Use `ctx.stage`.
   - Legacy reads can be temporarily tolerated only during migration.

5. Every stage child uses a game-specific root wrapper:
   - `.game-scene`;
   - `.game-scene--city`;
   - `.game-scene--dig`;
   - `.game-scene--home`;
   - `.game-scene--change`;
   - etc.

6. The root wrapper must fill the stage:

```css
.game-scene {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
```

7. Internal game layout must be based on the root wrapper, not viewport units.
   - Avoid `vh` inside stage children.
   - Avoid fixed pixel heights except for stable controls.
   - Use `height:100%`, grid, flex, `aspect-ratio`, and `minmax(0, 1fr)`.

8. Stage content must not create a second full-page visual shell.
   - No standalone headers.
   - No full-page beige app background.
   - No hidden duplicate back/mute/progress controls.

9. Stage visual language uses the good reference palette:
   - dark backdrop: `#17132f` / `--brain-backdrop`;
   - panel: `#27214f` / `--brain-shell`;
   - panel 2: `#332b66` / `--brain-shell-2`;
   - outlines: purple line tokens;
   - active controls: pink kid/game accent as used by the rail;
   - gold only for highlights/current targets.

10. Brain scene art can keep task props, but those props must live inside the
    shared purple framed stage and must not recolor the entire page.

## Required DOM Contracts

### Host-Owned Game View

The app must keep this ownership:

```html
<section id="game">
  <div class="topbar">
    <button id="back"></button>
    <div id="levelChips"></div>
    <button id="mute"></button>
  </div>
  <div id="setbar"></div>
  <div id="hud"></div>
  <div id="stage"></div>
  <div class="kbwrap">
    <div id="legend"></div>
    <div id="kb"></div>
  </div>
</section>
```

Games must not replace or duplicate any of those nodes.

### Game-Owned Scene Root

Every migrated game must mount exactly one root wrapper as the first game child:

```html
<div class="game-scene game-scene--GAME_ID">
  ...
</div>
```

Allowed examples:

```html
<div class="game-scene game-scene--city">...</div>
<div class="game-scene game-scene--dig">...</div>
<div class="game-scene game-scene--home">...</div>
<div class="game-scene game-scene--brain game-scene--change">...</div>
```

Disallowed:

```html
<canvas id="cityCv"></canvas>
<div class="cue"></div>
<div class="brain-change"></div>
```

The disallowed examples are loose direct children with no scene root.

### Brain Contained DOM

Normal game-launch Brain rounds must render:

```html
<div class="brain-round brain-round--change brain-round--contained">
  <main class="brain-scene">
    <div class="game-scene game-scene--brain game-scene--change">
      ...
    </div>
  </main>
</div>
```

In contained mode:

- `.brain-round__header` is `display:none`;
- `.brain-round__status` is `display:none`;
- `.brain-scene` fills the stage;
- app `#hud` receives `onHud(...)` output.

Normal game launcher must never produce:

```html
<body>
  <div class="brain-round">...</div>
</body>
```

That full-screen fallback is allowed only for isolated tests or explicitly
approved standalone previews.

## CSS Architecture Plan

### Phase 1: Create Shared Arcade Scene Primitives

Add a small shared block in `index.html` or preferably a new stylesheet later:

- `.game-scene`
- `.game-scene__center`
- `.game-scene__canvas`
- `.game-scene__prompt`
- `.game-scene__controls`
- `.game-scene__message`
- `.game-action`

Acceptance:

- These primitives use existing CSS variables.
- No new dominant palette is introduced.
- They do not depend on specific games.
- They preserve the current Balloon Pop and Solar System screenshots.

### Phase 2: Repair `.stage.arena`

Keep the current good behavior, but make the contract explicit:

```css
.stage.arena {
  display: block;
  padding: 0;
  height: min(52vh, 420px);
  min-height: 320px;
  text-align: left;
}

@media (min-width: 600px) {
  #game > .stage.arena {
    height: 100%;
    min-height: 0;
  }
}
```

Then add:

```css
.stage.arena > .game-scene {
  width: 100%;
  height: 100%;
}
```

Acceptance:

- Existing good Balloon Pop/Solar screenshots remain visually unchanged.
- City, Dig, and Home can opt into centered/fill behavior through their root
  wrapper without changing the host grid.

### Phase 3: Consolidate Palette Tokens

Map the game-shell variables and Brain tokens to the same visual family:

- `--brain-backdrop` should match app game backdrop.
- `--brain-shell` and `--brain-shell-2` should match rail/HUD panels.
- Brain contained scenes should inherit the purple stage unless a local task
  prop needs paper.

Acceptance:

- Change Maker no longer looks beige-page-dominant in contained mode.
- Paper surfaces appear as task props only, not as the whole application.
- No scene introduces an unrelated dominant color family.

## Host Runtime Plan

### Phase 1: Make Start Paths Visibly Identical

Audit these paths:

- `startRegistered(game)`
- `startBrain(gameId)`
- `startLegacy(lvl)`

They must all:

- call `setGameMode(true)`;
- render the rail before the game starts;
- call `renderGameSwitcher(id, lvl)`;
- keep `#hud` visible;
- add `.arena` to `#stage`;
- clear `#stage` before mounting;
- hide/show keyboard based on manifest;
- route mute/back through the outer shell.

Acceptance:

- Starting `change` from the rail shows the left rail, shared HUD, and stage.
- No Brain game can accidentally open as a body-level full-screen modal from the
  normal game launcher.

### Phase 2: Add Development Assertion

In development/check tooling, fail or warn if a game module:

- writes `document.body.appendChild()` for primary game UI;
- calls `document.getElementById("stage")`;
- creates a fixed `vh` stage child;
- uses `position:fixed` for game content;
- uses palette literals outside approved token declaration zones.

Acceptance:

- New migrations cannot silently reintroduce the same split.

### Phase 3: Add Runtime Compatibility Gates

Every registered game module may declare optional capabilities:

```js
capabilities: {
  webgl: false,
  webgl2: false,
  es2022: false,
  resizeObserver: false,
  pointerEvents: false
}
```

If capability metadata is not implemented yet, document the capability in the
module comment and check inside `init`.

For Solar specifically, add a preflight before importing Three:

```js
function solarSupported() {
  return !!window.WebGLRenderingContext &&
    !!window.ResizeObserver &&
    "PointerEvent" in window;
}
```

This preflight is not enough for Android 8 if the browser cannot parse the
module syntax. If supporting Android 8 is a goal, the host must avoid importing
the modern Solar module on that browser and show a fallback instead.

Acceptance:

- Unsupported browsers see a readable in-stage fallback, not a blank stage.
- Modern browsers still load the current Solar module lazily.

## Per-Game Fix Plan

### Balloon Pop

Status: target reference.

Do not redesign. Use it as a regression lock.

Actions:

- Capture baseline screenshots at 1280x800, 1024x600, 430x932.
- Record rail width, HUD y-position, stage bounds, and active chip style.
- Use it as the first visual comparison after every shared CSS change.

Acceptance:

- Balloon positions and stage fill remain stable.

### Solar System

Status: target reference.

Do not redesign. Use it as the richer canvas/reference case.

Actions:

- Capture baseline screenshots at the same viewport matrix.
- Preserve the full stage canvas behavior.
- Preserve internal Solar controls only because they are game-specific controls,
  not a duplicate shell.

Acceptance:

- Solar stays full-frame and does not regress after stage primitive changes.

Compatibility note:

- The current Solar implementation uses modern Three.js `0.185.1`.
- `js/vendor/README.md` explicitly says the Android 8 baseline was retired on
  2026-07-27.
- Android 8 support must be treated as a separate compatibility project, not as
  a bug in the unified shell migration.

### Change Maker

Target: same shell and stage behavior as Balloon Pop/Solar, with shop elements
reskinned as props inside the purple stage.

Actions:

1. Confirm normal launcher always calls `startBrain("change")` with
   `mount:document.getElementById("stage")`.
2. Verify no route, preview, or resume path calls `SQBrain.openRound()` without a
   mount during normal app play.
3. Add a contained Change Maker root class that behaves like an arcade scene:

```html
<div class="game-scene game-scene--change">
  <div class="change-playfield">...</div>
</div>
```

4. In contained mode, remove the standalone full-page shop feel:
   - no beige full-stage background;
   - no large outer beige card taking over the whole stage;
   - paper surfaces become individual product/tray/register panels;
   - surrounding stage remains dark purple.
5. Replace `.brain-round--contained .brain-change` sizing with a fill contract:
   - `height:100%`;
   - `max-width:none` unless needed for very wide readability;
   - no auto-scroll in normal tablet landscape;
   - internal scroll only on compact/short viewports when unavoidable.
6. Rework the contained layout:
   - top summary strip inside the stage;
   - register and paid panels aligned with the HUD/stage geometry;
   - till, tray, and actions organized in one responsive grid;
   - controls stay visible without page scroll at 1280x800.
7. Tone the paper palette down:
   - paper cards are local surfaces;
   - stage background uses the shared purple;
   - outlines match the rail/stage line color;
   - action highlight uses green only for the register/give-change affordance,
     not as a dominant page color.
8. Move result/finish behavior through the shared Brain result overlay, not a
   standalone scene page.

Acceptance:

- Screenshot shows left rail, shared HUD, and one purple framed stage.
- Change Maker no longer looks like a separate beige application.
- At 1280x800, the shop fills the same available area as Solar/Balloon.
- At 1024x600, no critical control is clipped.
- At 430x932, content scrolls only inside the game stage if required.

Exact Change Maker contained composition:

```text
shared rail | shared HUD
            | purple stage
            |   dark local playfield
            |   top row: product price | register equation | paid
            |   main row: till/drawer   | tray + actions
            |   bottom/help line only if it fits
```

Required hierarchy:

1. Product price, paid amount, register equation, and tray total are the most
   important text.
2. Denomination controls are the next most important tap targets.
3. Undo/Clear/Give are grouped with the tray, not floating elsewhere.
4. The till graphic is a prop. It must not force the whole scene to use a beige
   shop-page background.
5. The awning/customer silhouette are optional decoration. Hide them before
   shrinking controls or breaking layout.

Exact contained colour allocation:

- Stage/root background: purple/dark-plum.
- Playfield surface: `--panel2`/Brain shell purple, not beige.
- Product/payment/tray cards: paper/cream local cards.
- Register body/give button: green.
- Current target/focus: gold.
- Outlines: purple line/brain outline.

Do not use:

- beige as the full scene background;
- large nested beige frame with another dark border;
- standalone top title/header;
- standalone progress pips inside stage when the app HUD is present.

### City Drive

Target: full stage usage.

Actions:

1. Change City mount from direct `document.getElementById("stage")` to
   `C.stage`/`C.mount`.
2. Wrap content:

```html
<div class="game-scene game-scene--city">
  <canvas class="game-scene__canvas" id="cityCv"></canvas>
  ...
</div>
```

3. Replace `.cd-wrap height:min(52vh,430px)` with:

```css
.game-scene--city .cd-wrap {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
```

4. Size the canvas from the wrapper on init and on resize.
5. Add a `ResizeObserver` or host resize hook:
   - update `S.vw`;
   - update `S.vh`;
   - resize backing canvas with DPR;
   - reset canvas transform before scaling;
   - redraw once.
6. Keep prompt and touch controls inside the canvas wrapper.
7. Preserve gameplay physics and map constants.
8. Ensure the gas/left/right controls do not overlap the HUD or rail.

Acceptance:

- City canvas fills the entire stage height.
- No purple empty lower half.
- Resize/orientation change keeps the canvas crisp and correctly scaled.
- Stop releases the observer/listeners.

### Dig Site

Target: centered complete play area.

Actions:

1. Change Dig mount from direct `document.getElementById("stage")` to `C.stage`.
2. Wrap content:

```html
<div class="game-scene game-scene--dig">
  <div class="dig-layout">
    <div class="cue" id="dgCue"></div>
    <div class="dg-grid" id="dgGrid"></div>
    <div class="dg-ctl">...</div>
    <div class="msg" id="msg">...</div>
  </div>
</div>
```

3. Define `.dig-layout` as a centered stage grid:
   - `height:100%`;
   - rows: prompt, board, controls, message;
   - `justify-items:center`;
   - `align-content:center`;
   - responsive gap using existing spacing values.
4. Size `.dg-grid` by the stage:
   - `width:min(72vmin, 520px)` is not ideal because vmin ignores the stage;
   - prefer `width:min(100%, 520px)`;
   - constrain via parent grid and available height.
5. Keep the board square cells stable with `aspect-ratio:1`.
6. Ensure the board plus controls fit in 1024x600 without clipping.
7. If vertical space is short, reduce gaps first, then cell size, never button
   hit area below 44px.

Acceptance:

- Board/controls/message read as one centered unit.
- HUD remains centered above.
- No large unintentional empty bottom area.
- Dig remains fully playable by pointer.

### Home Row

Target: centered typing focus area inside the stage.

Actions:

1. Stop rewriting the whole `#stage` with loose children.
2. Mount a stable root wrapper once in `init`.
3. Update only the word subnodes in `drawWord`.
4. Use:

```html
<div class="game-scene game-scene--home">
  <div class="home-focus">
    <div class="cue">Type the word</div>
    <div class="word-em"></div>
    <div class="word"></div>
    <div class="msg" id="msg"></div>
  </div>
</div>
```

5. Center `.home-focus`:
   - `height:100%`;
   - flex/grid center;
   - max width around 760px;
   - text centered.
6. Preserve keyboard highlighting in the host keyboard row.
7. Keep error hints in the shared message/hint channel.
8. Make sure word type fits inside stage at 430px width.

Acceptance:

- The word is visually centered in the stage.
- No top-left pinning.
- The keyboard remains outside the stage exactly like the current shell expects.
- Rapid typing does not recreate root DOM or lose focus/keyboard state.

### Other Legacy Arcade Games

Audit and migrate the rest to the same wrapper contract:

- `machines`
- `hunt`
- `race`
- `orc`
- `vocab`
- `cube` if visible in the launcher

Actions:

- No direct `#stage` access.
- No body-level primary overlays.
- Root wrapper fills stage.
- Stage children use shared palette or intentionally game-specific art that does
  not replace the shell.

Acceptance:

- Switching between any rail chip preserves rail/HUD/stage behavior.

## Brain Gym Suite Migration Plan

The current Brain suite is split:

- `change` has a bespoke scene but the wrong contained visual dominance.
- `calc`, `signs`, `lowhigh`, `stroop`, `crunch`, `clock`, `wordmem`, and
  `recall` still rely on generic Brain scene rendering unless later slices are
  implemented.

To make the "Change Maker set" feel like the same game set, migrate the Brain
suite with the arcade shell as the visual authority.

### Shared Brain Contained Rules

For all Brain games in contained mode:

1. The outer `brain-round__header` and `brain-round__status` stay hidden.
2. The app-level rail/HUD remain visible.
3. `.brain-scene` fills the stage and uses the dark purple frame as its root.
4. Paper cards are local task props, not full-scene backgrounds.
5. Every Brain scene sets a `.game-scene game-scene--brain game-scene--ID` root
   or equivalent class.
6. Scene-specific art must look like the same illustrator/system as Balloon Pop,
   Solar, City, Dig, and Home after repair.
7. The app HUD labels should be consistent across games:
   - `Time`;
   - `Tasks` or game-specific equivalent;
   - `Best` or `Stars` where appropriate.
8. The same top HUD card geometry applies to Brain and non-Brain games.

### Brain HUD Normalization

Use the app HUD for Brain games. Do not invent per-scene HUDs.

Default Brain `onHud` labels:

- `Time`: active answer time or `--` for no-clock tiers.
- `Tasks`: current item progress or completed count.
- `Best`: existing best score/time where available.

Scene-specific substitutions are allowed only if the existing good references
already use them:

- Balloon uses `Popped`, `Streak`, `Stars`.
- Home uses `Words`, `Accuracy`, `Stars`.

For Brain scenes, prefer consistent `Time`, `Tasks`, `Best` unless Papa approves
a specific alternate label.

### Change Maker First

Change Maker is the pilot for the unified contained Brain look.

Implementation order:

1. Fix launcher containment.
2. Reskin contained mode.
3. Verify all tiers.
4. Capture screenshots.
5. Only then port the rest of the Brain suite.

### Calculations

Current likely generic visual: paper task card with generic keypad.

Target:

- purple stage root;
- compact fruit/order prop area;
- numeric controls matching shared button geometry;
- no standalone Brain full-screen shell;
- no beige scene dominance.

Acceptance:

- It looks like a sibling of reskinned Change Maker, not like a form.

### Sign Finder

Target:

- purple stage root;
- bridge/workshop prop surface as a local framed area;
- operator tiles use the same tactile button style as Change Maker denominations.

Acceptance:

- Strong centered equation and operator choices.
- No generic white card visual dominance.

### Low to High

Target:

- purple stage root;
- centered lift/lobby board;
- memory positions arranged symmetrically;
- active controls do not reveal hidden values.

Acceptance:

- Uses the full stage and centers the board like fixed Dig/Home.

### Color Words

Target:

- purple stage root;
- centered paint/easel prop;
- answer pots/buttons aligned at the bottom/center;
- task colors only in stimulus/answer controls.

Acceptance:

- Palette does not become rainbow or unrelated to the shell.

### Number Cruncher

Target:

- purple stage root;
- scanner/field board fills the stage proportionally;
- Canvas or SVG field is internally framed but not a second page.

Acceptance:

- No idle rAF loop.
- No visual clutter outside the shared stage.

### Time Lapse

Target:

- purple stage root;
- clock station prop centered and scaled from stage;
- answer tickets use shared button style.

Acceptance:

- Clock is the focus, not a generic card.

### Word Memory

Target:

- purple stage root;
- centered desk/card layout;
- study/recall phases preserve the same stage bounds;
- textarea/input controls follow shared geometry.

Acceptance:

- Study list does not drift top-left or overflow on compact.

### Math Recall

Target:

- purple stage root;
- parcel/current/previous composition centered;
- keypad/choices follow shared geometry;
- hidden current result never leaks.

Acceptance:

- Looks like the same contained game family as Change Maker.

## Implementation Sequence

### Step 1: Freeze Good References

- Capture fresh screenshots for Balloon Pop and Solar System.
- Save them under `test-results` with viewport names.
- Treat these as visual regression baselines.

### Step 2: Add Shared Stage Wrapper CSS

- Add `.game-scene` primitives.
- Add stage child fill rule.
- Do not touch per-game visuals yet.
- Verify Balloon/Solar.

### Step 3: Fix City Fill

- Replace fixed `.cd-wrap` height.
- Add resize handling.
- Verify city uses the full stage.

### Step 4: Fix Dig Centering

- Add root wrapper and centered layout.
- Make grid/controls one composition.
- Verify 1280x800 and 1024x600.

### Step 5: Fix Home Row Centering

- Add root wrapper.
- Stop full stage rewrite on every key.
- Center prompt/word/message.
- Verify keyboard integration.

### Step 6: Fix Brain Containment Path

- Confirm `startBrain` always mounts into `#stage` from game launcher.
- Add assertion/logging for accidental body-level Brain open from normal play.
- Verify Change Maker launches with left rail and shared HUD.

### Step 7: Reskin Change Maker Contained Mode

- Make dark purple stage dominant.
- Convert beige shop frame into local props.
- Fit all controls without awkward scroll on tablet.
- Verify tot/mid/hard.

### Step 8: Migrate Remaining Brain Scenes

Recommended order:

1. Calculations
2. Sign Finder
3. Low to High
4. Color Words
5. Number Cruncher
6. Time Lapse
7. Word Memory
8. Math Recall

Rationale:

- First four are simpler DOM scenes and establish button/task composition.
- Last four have study timers, Canvas/SVG complexity, or hidden-value risk.

### Step 9: Audit All Launcher Games

- Check every manifest game against the shell contract.
- Remove legacy layout assumptions gradually.
- Keep behavior-preserving changes separate from gameplay changes.

### Step 10: Add Checks and Visual Matrix

- Add static checks for forbidden direct stage/body usage.
- Add browser screenshot checks for key games.
- Keep a manual screenshot review folder for every migration batch.

## Exact Work Packages

Agents should implement in these small work packages. Do not combine packages
unless Papa explicitly asks for a single large implementation pass.

### Package A: Baselines Only

Outputs:

- screenshots of Balloon Pop and Solar System at the verification viewports;
- no runtime changes.

Done when:

- screenshots are saved;
- plan links or filenames are recorded.

### Package B: Shared Scene Root CSS

Outputs:

- `.game-scene` primitive CSS;
- no per-game layout change except adding harmless fill rules.

Done when:

- Balloon/Solar remain visually unchanged;
- no game becomes worse.

### Package C: City

Outputs:

- City root wrapper;
- full-height canvas;
- resize observer;
- stop cleanup.

Done when:

- City screenshot no longer has the empty lower purple half.

### Package D: Dig

Outputs:

- Dig root wrapper;
- centered dig layout.

Done when:

- board and controls are vertically centered as a complete unit.

### Package E: Home

Outputs:

- Home root wrapper;
- stable subnode updates;
- centered word focus.

Done when:

- word prompt no longer pins top-left.

### Package F: Brain Containment Guard

Outputs:

- assert/log if normal `startBrain` opens body-level;
- confirm `change` rail/HUD/stage path.

Done when:

- Change Maker cannot launch from normal game UI without the rail.

### Package G: Change Maker Reskin

Outputs:

- contained dark-purple scene root;
- local paper props;
- responsive shop layout.

Done when:

- Change Maker screenshot clearly belongs to the same set as Balloon/Solar.

### Package H: Static Regression Checks

Outputs:

- `check.mjs` rules for direct `#stage`, body append, fixed/vh content, and
  palette literals.

Done when:

- checks pass with approved exceptions only.

## Verification Matrix

Run for each fixed game:

- 1366x1024 landscape
- 1280x800 tablet landscape
- 1024x600 short landscape
- 800x1280 tablet portrait
- 430x932 mobile portrait
- 360x800 narrow mobile

For each viewport verify:

- left rail visible where layout supports rail;
- HUD centered and not overlapping;
- stage fills available space;
- game content fills or intentionally centers inside stage;
- no accidental page scroll in desktop/tablet landscape;
- no horizontal scroll;
- touch controls are reachable;
- text does not overlap controls;
- keyboard row appears only for keyboard games;
- switching rail chips tears down prior game cleanly.

For each game state verify:

- initial active state;
- one success/correct state;
- one corrective/error state where applicable;
- finish/result state;
- mute on/off;
- reduced motion;
- background/resume;
- orientation/resize.

## Automated Test Plan

### Existing Commands

Run:

```bash
node scripts/check.mjs
node scripts/registry.test.mjs
node scripts/brain-host.test.mjs
node scripts/brain-scenes.test.mjs
```

Add targeted tests where needed:

- City resize keeps canvas dimensions equal to wrapper dimensions.
- Dig root wrapper exists and grid is centered under a fake stage size.
- Home draw updates subnodes without replacing the root wrapper.
- Brain contained open hides Brain internal header/status and publishes app HUD.
- Change Maker contained mode root uses shared stage classes.

### Static Checks

Extend `scripts/check.mjs` to warn/fail on:

- `document.getElementById("stage")` inside migrated game modules;
- `document.body.appendChild` inside game modules except approved result helpers;
- `position:fixed` inside game scene CSS;
- `height:*vh` inside stage child selectors;
- raw palette literals in Brain scene CSS outside token blocks.

Approved temporary exceptions list:

- Existing legacy code may still call `document.getElementById("stage")` before
  that game is migrated. The check must either:
  - warn only for not-yet-migrated modules; or
  - use an allowlist with a removal package named above.
- Solar may append burst particles to `document.body` until a shell-specific
  burst host is implemented. Mark this as a shell-remediation TODO.

No exception may be silent.

## Visual Acceptance Criteria

A fixed game is done only when:

- it can be recognized as part of the same game set in a one-second glance;
- the rail/HUD/stage relationship matches Balloon Pop and Solar System;
- the game area is either fully used or intentionally centered as one complete
  composition;
- no old standalone full-page UI remains inside the stage;
- the palette reads as dark purple shell plus controlled accents;
- completion/result screens do not break the shell;
- all viewports in the matrix have reviewed screenshots;
- automated checks are green.

## Solar On Android 8

Current status:

- Not weird; expected with the current vendor/runtime choices.
- The vendored Three.js note says: "Android 8 baseline retired 2026-07-27."
- Solar is a modern ESM/WebGL game, not an ES5-compatible arcade module.

Observed code-level blockers:

- `index.html` loads `js/main.js` as `type="module"`.
- `js/main.js` dynamically imports registered games with `import("./games/" + id
  + ".js")`.
- `js/games/solar.js` uses `async init(ctx)` and `await import(...)`.
- `js/games/solar.js` requires `ResizeObserver`.
- `js/games/solar.js` uses pointer events for canvas input.
- `js/games/solar.js` imports Three.js `0.185.1`.
- `js/vendor/three.core.min.js` contains modern syntax such as class static
  initialization blocks (`static{...}`), `class`, `let`, `const`, async
  functions, and other syntax that Android 8-era browsers/WebViews may not
  parse.

Most likely hard blocker:

- JavaScript parsing fails before runtime checks can run because the browser
  cannot parse the modern Three.js module or another modern module feature.

Possible secondary blockers:

- missing/partial dynamic `import()`;
- missing `ResizeObserver`;
- missing/partial Pointer Events;
- old WebGL driver limitations;
- GPU texture/context limitations on old Android devices.

Decision required:

1. If Android 8 support is required:
   - do not load `js/games/solar.js` on Android 8;
   - add a compatibility detector before dynamic import;
   - serve a simpler 2D Solar fallback or a "not supported on this tablet"
     in-stage message;
   - vendor/transpile an older Three.js build compatible with the target browser;
   - replace `ResizeObserver` and pointer-event-only input with fallbacks;
   - test on the actual Android 8 browser/WebView, not desktop emulation.

2. If Android 8 support is not required:
   - keep current Solar;
   - add a clear fallback message instead of a blank stage;
   - document minimum browser/device requirements in the Solar plan and README.

Agents must not silently downgrade Three.js, transpile the whole app, or rewrite
Solar to 2D without Papa choosing option 1.

## Risks

### Risk: Fixing Stage CSS Breaks Good Games

Mitigation:

- Freeze Balloon/Solar screenshots first.
- Add shared primitives without changing their specific selectors.
- Verify after every CSS phase.

### Risk: Change Maker Loses Task Readability

Mitigation:

- Keep product, paid amount, register display, tray total, and denominations as
  strong local paper props.
- Reduce beige dominance only at the scene container level.

### Risk: City Resize Changes Gameplay Feel

Mitigation:

- Preserve world/map units and physics.
- Resize viewport only; do not change map constants or speed.

### Risk: Brain Scene Migration Becomes an Art Redesign Spiral

Mitigation:

- Approve reskinned Change Maker as the reference first.
- Every following Brain scene uses the same stage/root/control primitives.
- Defer gameplay changes unless already required by the scene spec.

### Risk: Legacy Direct DOM Access Remains

Mitigation:

- Add static checks.
- Move games one at a time to `ctx.stage`.
- Keep direct DOM access only for elements inside the game's own root wrapper.

## Definition of Done

The migration is complete when:

- Balloon Pop and Solar System remain unchanged as good references.
- City Drive uses the full stage.
- Dig Site is centered as a complete board/control composition.
- Home Row is centered inside the stage.
- Change Maker launches inside the shared rail/HUD/stage shell and no longer
  looks like a different beige app.
- Every Brain scene has a contained visual matching the same shell/art family.
- All game modules follow the same access/navigation/display behavior.
- Visual matrix screenshots are reviewed for all games.
- Static and automated checks pass.
- No open CSS migration issue remains that can recreate the split.
