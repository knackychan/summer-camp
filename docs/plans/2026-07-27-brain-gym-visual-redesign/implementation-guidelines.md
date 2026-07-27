# Brain Gym implementation guidelines — normative design and technical bible

**Date:** 2026-07-27  
**Status:** implementation-grade proposal; requires Papa's approval before slice 34 starts  
**Applies to:** slices 34–37 and every later Brain Gym scene  
**Authority:** this file is normative for visual, interaction and runtime decisions. If a slice is less specific, this file wins. The approved Brain Gym and game-platform designs still win for scoring, gating, persistence and outer-host behavior.

**2026-07-27 pixel-art refinement:** `visual-ui-agent-prompt.md` is the authoritative execution brief for scene-asset production. Its soft modern pixel-art PNG/atlas direction supersedes SVG-only illustration-source wording in this file and the slice asset tables. Task-critical text, exact geometry, controls, accessibility content and clock hands remain DOM/SVG. All other rules in this file remain mandatory.

## 1. How to read this document

The key words **MUST**, **MUST NOT**, **SHOULD** and **MAY** are requirements:

- **MUST / MUST NOT:** acceptance criteria. An implementation that disagrees is not done.
- **SHOULD:** follow unless a real tablet test proves it harmful. Record any exception in the relevant slice before shipping.
- **MAY:** optional; omitting it is valid.

An implementer is not authorized to change the art direction, introduce another renderer, change scoring, add a mascot, add a dependency, or improvise kid-facing copy. If this document does not cover a choice that materially affects art, game rules, persistence, accessibility or architecture, stop and ask Papa.

## 2. Locked product boundaries

### 2.1 Preserve

The redesign MUST preserve:

- the nine game ids: `calc`, `signs`, `lowhigh`, `stroop`, `crunch`, `clock`, `change`, `wordmem`, `recall`;
- tier resolution and admin override in `brain-core.js`;
- tier item counts unless a slice explicitly lists a change;
- seeded daily-three selection and skill diversity;
- score totals and item answers;
- count-up clock only on `mid` and `hard`;
- `brain_done`, best-score persistence, the daily star and gate behavior;
- offline play;
- bilingual EN + Traditional Chinese kid-facing copy;
- coach-not-cop feedback and no fail state.

### 2.2 Change

The redesign MAY change:

- prompt item shapes by adding structured presentation fields;
- the input mechanism when the submitted semantic answer remains the same;
- active-time measurement so animation and hidden-tab time do not affect a best;
- visual feedback timing;
- speech timing where needed to avoid overlapping scene transitions.

### 2.3 Explicit non-goals

Slices 34–37 MUST NOT:

- add a Brain Age number;
- add lives, health, streak loss, countdown pressure or a game-over screen;
- add sibling comparison or a leaderboard;
- add microtransactions, loot-box presentation, slot-machine motion or casino sounds;
- copy Nintendo art, Dr Kawashima, Nintendo layouts, handwriting recognition, audio or wording;
- use Three.js for any of the current nine scenes;
- introduce React, Vue, Svelte, Pixi, Phaser, GSAP, Howler or another runtime dependency;
- require network access for art, fonts, audio or play;
- use drag as the only way to answer;
- put task-critical text inside raster art or Canvas.

## 3. Art direction: Pocket Brain Lab

### 3.1 Concept

Each exercise is a **front-facing miniature activity set**: part wooden educational toy, part illustrated summer-camp station. It feels crafted, warm and tactile, not futuristic, clinical or hyperactive.

The scene is 2.5D: flat SVG/DOM shapes with small vertical offsets, layered silhouettes and firm contact shadows. There is no free camera, perspective rotation or photorealism. Task objects face the child and remain geometrically clear.

Three qualities guide every visual:

1. **Readable:** the answer-relevant object wins the hierarchy in under one second.
2. **Tactile:** buttons, tokens, drawers and cards visibly respond to touch.
3. **Calm:** the scene becomes still while the child thinks.

### 3.2 Shape language

- Primary containers MUST use 18–28 px rounded corners.
- Small cards and tokens MUST use 10–16 px rounded corners.
- Illustrated SVG objects MUST use a 3 px outline at a 320 px reference width, scaling with the SVG.
- Outlines MUST be dark plum, never pure black.
- Corners MUST be rounded; sharp points are reserved for arrows, clock hands and operator symbols.
- Contact shadows MUST be short, opaque offsets, not large blurred floating shadows.
- Brain activity surfaces and full-screen backdrop use flat fills. The common shell header uses exactly `linear-gradient(180deg, var(--brain-shell-2), var(--brain-shell))`; no other Brain surface uses a gradient.
- Highlights MUST be one simple edge or patch; do not add glass gloss, lens flare, noise textures or bevel filters.
- Decorative detail MUST be removed if it competes with a number, word, colour or target.

### 3.3 Scene perspective

- Default view is straight-on with a slightly raised view of horizontal trays and desks.
- The maximum simulated depth angle is approximately 12 degrees.
- Task objects MUST NOT use CSS 3D rotations that distort digits or words.
- Coins, notes, cards and operator tiles MUST remain readable at every animation frame.
- Backgrounds MUST have at most three depth layers: wall/sky, fixture, foreground work surface.

### 3.4 Illustration source policy

- Scene graphics MUST be original SVG, HTML/CSS shapes or programmatic Canvas primitives created for Summer Quest.
- Emoji MAY remain in the outer game-grid icon because that is existing product language. Emoji MUST NOT be the primary art inside a redesigned scene; platform-dependent rendering would break visual consistency.
- Photographs, stock illustration packs and copied currency art MUST NOT be used.
- Taiwan money MUST be represented as stylized learning tokens: denomination, `NT$`, broad coin/note form and distinct colour. It MUST NOT reproduce real banknote portraits, serial numbers or security design.
- SVGs MUST have a documented `viewBox`, human-readable ids/classes, and no embedded base64 bitmap.
- SVG text MUST NOT carry bilingual copy. Numbers that are part of the interactive object SHOULD be DOM text over the SVG when practical.

### 3.5 Mascot and character rule

There is **no recurring Brain Buddy or face character in v1**. Feedback comes from the activity set itself: a stamp, lamp, drawer, train, bridge or shelf. Change Maker uses one simple bust silhouette on tablet/wide layouts exactly as its slice specifies; it MUST NOT display disappointment, anger or impatience.

## 4. Colour system

### 4.1 CSS tokens

Add the following semantic tokens to `css/brain-shell.css`. Scenes MUST consume tokens; they MUST NOT scatter colour literals through scene JavaScript.

```css
:root {
  --brain-backdrop: #17132f;
  --brain-shell: #27214f;
  --brain-shell-2: #332b66;
  --brain-paper: #fff5dc;
  --brain-paper-2: #f1e3bf;
  --brain-ink: #2f2845;
  --brain-ink-2: #655d76;
  --brain-outline: #3b3159;
  --brain-shadow: #171229;
  --brain-white: #fffdf7;
  --brain-success: #2f9e68;
  --brain-success-soft: #dff4e8;
  --brain-hint: #d99416;
  --brain-hint-soft: #fff0c7;
  --brain-focus: #68c8ff;
  --brain-disabled: #aaa3b6;

  --brain-calc: #ee7b54;
  --brain-signs: #dda62b;
  --brain-lowhigh: #3f9fc8;
  --brain-stroop: #8b63b8;
  --brain-crunch: #319f91;
  --brain-clock: #5e6fc4;
  --brain-change: #2f9e68;
  --brain-wordmem: #8255a4;
  --brain-recall: #d9783d;

  --brain-red: #cf3f4a;
  --brain-blue: #2775bd;
  --brain-green: #24845a;
  --brain-yellow: #c28a08;
}
```

These literals are the approved v1 palette. Changing them is an art-direction change, not routine implementation.

### 4.2 Usage

- The full-screen overlay uses `--brain-backdrop`.
- The common header/footer uses `--brain-shell` and `--brain-shell-2`.
- The activity stage uses `--brain-paper`; task text uses `--brain-ink`.
- Each scene sets `--brain-scene-accent` to its game token.
- The active kid colour appears only as a 4 px top rail on the common shell. It MUST NOT recolour progress, answer objects or Stroop ink.
- `--brain-success` is for correct/completed feedback only.
- `--brain-hint` is for instruction, current target and corrective explanation.
- The app's `--bad` red MUST NOT be used in Brain Gym feedback.
- Stroop answer colours MUST use only the four `--brain-red/blue/green/yellow` tokens. Scene accents MUST NOT tint them.

### 4.3 Contrast

- Normal text MUST meet WCAG AA 4.5:1 against its actual surface.
- Task numerals at 32 px or larger and 700 weight MUST meet at least 3:1.
- Yellow swatches MUST have a 3 px `--brain-outline` boundary because yellow against paper is insufficient.
- Colour choice controls MUST expose bilingual accessible names and a non-colour cue in focus/selected states. Correct play still tests colour; accessibility chrome must not reveal the answer before selection.

## 5. Typography and iconography

### 5.1 Fonts

- Use existing `Fredoka` for titles, task numerals, operator symbols, controls and totals.
- Use existing `Nunito` for instructions, bilingual support copy and feedback sentences.
- Do not add another font.
- Always include `system-ui, sans-serif` fallbacks.
- Task numerals MUST set `font-variant-numeric: tabular-nums`.
- English and Chinese lines MUST share the same hierarchy; Chinese MUST NOT be rendered as tiny secondary legal text.

### 5.2 Type scale

Use these CSS clamp targets:

```css
--brain-type-title: clamp(22px, 3vw, 32px);
--brain-type-instruction: clamp(16px, 2.2vw, 20px);
--brain-type-task: clamp(38px, 8vw, 72px);
--brain-type-answer: clamp(24px, 4.6vw, 42px);
--brain-type-label: clamp(14px, 1.8vw, 17px);
--brain-type-small: 13px;
```

- Task numbers MUST fit without shrinking below 38 px.
- Instructions are maximum two short lines per language.
- Use `line-height: 1.15` for task text and `1.35` for instructions.
- Do not use all caps. Common HUD and scene labels use sentence case in both languages.

### 5.3 Icons

- Controls use a simple 2–3 px outlined SVG icon plus text.
- Icon-only controls are permitted only for mute and close/back when they retain an `aria-label`.
- Do not mix emoji, filled material icons and outlined custom icons inside a scene.
- Operator symbols are typographic glyphs, not icons.

## 6. Common screen composition

### 6.1 DOM skeleton

Every redesigned round MUST render this common structure:

```html
<div class="brain-round brain-round--GAME" role="dialog" aria-modal="true">
  <header class="brain-round__header">
    <button class="brain-round__quit">Later / 待會再玩</button>
    <div class="brain-round__identity">…title…</div>
    <button class="brain-round__mute">…</button>
  </header>
  <div class="brain-round__status">
    <div class="brain-progress">…pips…</div>
    <output class="brain-clock">…</output>
  </div>
  <main class="brain-scene" aria-live="off"></main>
  <div class="brain-announcer sr-only" aria-live="polite"></div>
</div>
```

The scene module owns only `.brain-scene`. It MUST NOT replace the header, progress, clock, quit or mute controls.

### 6.2 Viewport behavior

- Round shell uses `position: fixed; inset: 0; z-index: 40`.
- Height uses `100vh` plus `100dvh` when supported.
- Padding includes `env(safe-area-inset-*)`.
- Round shell MUST be usable from 320 × 568 through 1366 × 1024.
- Primary design target is landscape or portrait tablet between 600 and 1100 CSS px.
- Scene content caps at 1000 px wide.
- The outer round sets `overflow-y: auto`; it scrolls only when content exceeds the short/zoomed viewport, and answer controls remain reachable.
- No horizontal scrolling.

### 6.3 Responsive layouts

**Compact: width < 600 px**

- Header is 52–60 px high.
- The compact header omits the blurb and retains the EN + 中文 game name.
- Scene uses one vertical column.
- Answer controls sit after the task object, not side-by-side.
- Dense choice grids use two columns.

**Tablet: 600–1100 px**

- Header is 64 px high.
- Scene uses a 12-column grid with 20 px gutters.
- Task/world occupies 7–8 columns; controls occupy 4–5 where side-by-side improves clarity.
- Change Maker uses register/price on the upper or left zone and drawer/tray on the lower or right zone.

**Wide: > 1100 px**

- Content remains capped at 1000 px.
- Do not increase task density; add outer breathing room.

**Short landscape: height < 650 px**

- Header and status combine into one row.
- Decorative background layers are hidden.
- Vertical gaps reduce by one spacing step.
- Task and controls remain at full touch size.

### 6.4 Spacing

Use an 8 px base grid:

```css
--brain-space-1: 4px;
--brain-space-2: 8px;
--brain-space-3: 12px;
--brain-space-4: 16px;
--brain-space-5: 24px;
--brain-space-6: 32px;
--brain-space-7: 48px;
```

Arbitrary 17/19/23 px layout gaps MUST NOT be introduced.

## 7. Component specifications

### 7.1 Task card

- Paper surface, 2 px outline, 18 px radius.
- Maximum 720 px wide.
- Price, equation or instruction belongs inside the world whenever spatial association matters.
- Do not duplicate the same prompt in a floating HUD and the scene.

### 7.2 Answer button

- Minimum 56 × 56 CSS px; preferred tablet height 64 px.
- Minimum 12 px gap between targets.
- Uses 3 px outline and a 4 px downward contact shadow.
- Press state translates down 3 px and removes 3 px of shadow.
- Disabled state changes opacity and cursor but keeps label readable.
- Focus-visible uses a 4 px `--brain-focus` outline with 3 px offset.
- Never rely on hover.

### 7.3 Token

- Coins: minimum 58 px visual diameter and 64 px hit area.
- Notes: minimum 96 × 52 px visual and 108 × 64 px hit area.
- Cards/operator tiles: minimum 64 × 64 px.
- Each token has a stable home slot and a unique semantic value.
- Tokens placed in an answer tray retain their denomination.

### 7.4 Progress

- One pip per generated item.
- Pip states: future outline, current accent with focus ring, answered neutral paper, correct success check, corrective hint dot.
- Do not expose correctness totals during the round.
- Screen reader label: “Question 3 of 10 / 第 3 題，共 10 題”.

### 7.5 Clock

- Count-up only; never countdown.
- Format `m:ss`; use tabular numerals.
- Label includes visually hidden “Time / 時間”.
- Clock does not pulse or change colour.
- Tot tier does not render the clock node at all.

### 7.6 Corrective panel

- Uses hint-soft background, hint outline, paper/ink text.
- Shows the correct semantic answer for 600–900 ms.
- For constructed answers, briefly groups/highlights the correct value; it MUST NOT automatically replay a long solution.
- No red, X icon, buzzer or word “wrong”.

## 8. Motion system

### 8.1 Tokens

```css
:root {
  --brain-motion-press: 120ms;
  --brain-motion-snap: 180ms;
  --brain-motion-move: 320ms;
  --brain-motion-reveal: 480ms;
  --brain-motion-celebrate: 640ms;
  --brain-ease-out: cubic-bezier(.2,.8,.2,1);
  --brain-ease-settle: cubic-bezier(.34,1.35,.64,1);
  --brain-ease-standard: cubic-bezier(.4,0,.2,1);
}
```

### 8.2 Rules

- Animate `transform` and `opacity`; avoid layout-affecting animation.
- One focal animation at a time.
- Ambient animation stops within 300 ms after the scene becomes answerable.
- The prompt, equation, Stroop word and recall target MUST remain still while input is enabled.
- Do not run infinite bounce, shimmer, pulse or particle loops.
- Decorative particles are capped at 12 and live no longer than 640 ms.
- Question transition is exit 180 ms, content swap, entrance 320 ms.
- Correct feedback lasts 420–640 ms.
- Corrective feedback lasts 900 ms total unless the child needs to dismiss a readable explanation.
- Input locks on the first accepted submit and unlocks only when the next item is active.
- Rapid taps during transitions are ignored, not queued.

### 8.3 Reduced motion

When `prefers-reduced-motion: reduce`:

- travel distance becomes 0;
- rotation becomes 0;
- scale change is limited to 0.98–1;
- shake/nudge is replaced by a 160 ms outline emphasis;
- particles are removed;
- transitions use opacity for no more than 120 ms;
- timers, study durations and input behavior do not change.

The motion service MUST expose `reduced` and scenes MUST use it rather than querying media independently.

## 9. Audio direction

### 9.1 Style

Audio is a small wooden-toy percussion palette: soft clicks, paper, wood, coins, bell and a short marimba-like success motif. It MUST NOT sound like an arcade casino, cash reward system or harsh error buzzer.

### 9.2 Asset policy and budget

- Audio assets MUST be original or carry repository-documented redistribution permission.
- Put provenance in `assets/audio/brain/README.md`.
- Export effects at mono 32 kHz.
- Export every repository audio effect as mono MP3 for the existing modern-browser baseline. Do not mix runtime formats in v1.
- Individual effects SHOULD be under 35 KB.
- Entire Brain Gym audio pack MUST remain under 350 KB.
- No CDN and no runtime fetch outside same-origin cached assets.
- Spoken instructions remain Web Speech; do not ship recorded voice lines.

### 9.3 Approved cues

```text
ui-tap
token-pick
token-place
paper-slide
drawer-open
drawer-close
coin-1
coin-5
coin-10
coin-50
note-place
stamp
lift-ding
train-arrive
brush-swish
scanner-tick
success
round-complete
```

Scenes MUST reuse these cues before requesting a new one.

### 9.4 Runtime rules

- Shared audio service owns one `AudioContext`.
- It resumes only in a user-gesture path.
- Existing global mute state is the source of truth.
- Switching mute off stops active effects and speech immediately.
- Maximum simultaneous effects: 4.
- Repeating token cues use deterministic pitch variation within ±3%; do not make question generation nondeterministic.
- Correct cue target loudness is lower than speech.
- Corrective feedback uses `paper-slide` or silence, never a negative buzz.
- Every audio-only event has a visible state change.

## 10. Input and accessibility

- Pointer and keyboard activation MUST work for every control.
- Primary tablet path is tap.
- Drag MUST NOT be implemented in slices 34–37. Every v1 interaction is tap/button based.
- V1 answer controls use native button `click`/keyboard activation. Scene modules do not implement custom drag or pointer-capture handlers.
- Prevent duplicate submission with host state, not a debounce timer.
- Scene answer controls use native `button` elements where possible.
- Canvas is display-only for Number Cruncher; answer controls remain DOM.
- The main task receives an accessible summary in DOM.
- Dynamic feedback is announced once through the common polite live region.
- Decorative SVG is `aria-hidden="true"`.
- Do not speak timer ticks, ambient motion or every coin animation.
- Tot instructions MUST be playable from spoken bilingual prompts without reading.
- Text zoom to 200% MUST preserve access to the task and answer controls.

## 11. Bilingual copy rules

- Every kid-facing string MUST have English and Traditional Chinese.
- Use Taiwan terminology: `公車`, `起司`, `腳踏車`, `找錢`, `硬幣`, `鈔票`.
- For every v1 paired instruction, English appears first and Chinese second.
- Numbers, mathematical symbols and `NT$` need not be duplicated.
- Buttons use `English 中文` on one line when short; use two lines only when the English exceeds 12 characters.
- Do not improvise encouragement. Approved round phrases:

| Purpose | English | Traditional Chinese |
|---|---|---|
| quit | Later | 待會再玩 |
| submit money | Give change | 找錢 |
| undo | Undo | 上一步 |
| clear | Clear tray | 清空托盤 |
| done typing | Done | 完成 |
| correct | Nice! | 很好！ |
| corrective lead | Count | 數一數 |
| result best | New best! | 新紀錄！ |
| result normal | Nice work! | 做得好！ |
| replay | Again | 再一次 |
| finish | Done | 完成 |

New copy requires adding it to scene data or a shared copy table so `check.mjs` can validate it.

## 12. Runtime architecture

### 12.1 Required files

After slice 34:

```text
css/brain-shell.css
css/brain-scenes.css
js/brain/host.js
js/brain/scenes/index.js
js/brain/scenes/generic.js
js/game-services/audio.js
js/game-services/motion.js
js/game-services/scheduler.js
scripts/brain-host.test.mjs
scripts/brain-scenes.test.mjs
```

Later slices add:

```text
js/brain/scenes/change.js
js/brain/scenes/calc.js
js/brain/scenes/signs.js
js/brain/scenes/lowhigh.js
js/brain/scenes/stroop.js
js/brain/scenes/crunch.js
js/brain/scenes/clock.js
js/brain/scenes/wordmem.js
js/brain/scenes/recall.js
assets/audio/brain/...
```

Do not create one CSS file per scene. Scene-specific selectors belong under a namespaced block in `brain-scenes.css`.

### 12.2 Ownership

| Layer | Owns | MUST NOT own |
|---|---|---|
| `brain-data` | question content, structured prompt fields, tier config | DOM, timers, audio |
| `brain-core` | seeded round creation, pure grading, tier logic | DOM, persistence, animation |
| Brain host | state machine, active timer, progress, speech coordination, scene loading, finish | scene markup, Supabase |
| Scene | task-specific markup, local interaction, presentation feedback | scoring policy, daily progress, persistence |
| Services | cancellable scheduling, motion, audio | game rules |
| Outer app | selected kid, stats persistence, daily completion, result overlay | scene internals |

### 12.3 Scene manifest

`js/brain/scenes/index.js` MUST be a static map. Do not build an arbitrary import path from unsanitized input.

```js
export const SCENE_LOADERS = Object.freeze({
  change: () => import("./change.js"),
  calc: () => import("./calc.js")
});
```

During slice 34 the map may be empty. Missing ids intentionally use `generic.js`. Failed imports log once and use generic for that round.

### 12.4 Scene module contract

Every scene module default export:

```js
export default {
  id: "change",
  renderer: "dom",
  create(ctx) {
    return {
      present(item, view) {},
      setInputEnabled(enabled) {},
      showFeedback(feedback) {},
      destroy() {}
    };
  }
};
```

`ctx` is frozen and contains:

```js
{
  mount,             // empty .brain-scene owned by this instance
  gameId,
  tier,
  kid,
  submit(answer),    // returns true only for the first accepted submit
  announce(pair),
  sayPair(pair),
  audio,
  motion,
  scheduler,
  reducedMotion,
  random             // visual-only seeded RNG; never question RNG
}
```

`view` is frozen and contains:

```js
{
  index,             // zero-based
  count,
  isFirst,
  clocked
}
```

`feedback` is frozen and contains:

```js
{
  correct,           // full-credit boolean
  got,
  worth,
  given,
  answer
}
```

Rules:

- `create` runs once per round.
- `present` runs once per item after the previous feedback has finished.
- `showFeedback` MAY return a Promise; the host awaits it with a hard maximum of 1200 ms.
- Scene calls `ctx.submit`; it does not advance itself.
- Scene MUST treat `submit(false)` as ignored duplicate input.
- `destroy` is idempotent and synchronous. Async cleanup is not permitted.
- Scene MUST remove its DOM and listeners or make them collectible by clearing `mount`.
- Scene MUST NOT call `setTimeout`, `setInterval`, `requestAnimationFrame`, `speechSynthesis`, `Audio`, `fetch` or `localStorage` directly.

### 12.5 Host state machine

Exact states:

```text
loading → presenting → active → evaluating
       → feedback-correct | feedback-corrective
       → transitioning → presenting
       → completing → destroyed
```

`quit` is legal from every state except `destroyed`; it transitions directly to `destroyed` and does not call `onFinish`.

The host MUST:

- ignore submit outside `active`;
- disable scene input before grading;
- grade with one pure `brain-core.gradeItem` function;
- store exactly one answer per item;
- wait for feedback or 1200 ms, whichever comes first;
- destroy the scene before removing the overlay;
- call `onFinish` exactly once after a completed round;
- cancel speech and services on quit/destroy;
- guard all outer callbacks against a destroyed round.

### 12.6 Grading helper

Slice 34 MUST extract `gradeItem(item, given)` into `brain-core.js` and make `scoreRound` call it. This is a behavior-preserving refactor.

```js
{
  got,       // clamped 0..worth
  worth,
  correct    // got === worth && worth > 0
}
```

The host MUST NOT duplicate string comparison. This matters for Word Memory's custom partial-credit grader.

### 12.7 Active-time clock

For redesigned scenes, elapsed best time is **active answer time**:

- starts when the first scene enters `active`;
- accumulates only while state is `active`;
- stops during feedback, transitions, speech-only intro, loading and document hidden;
- resumes on the next `active` state;
- renders from the same accumulator used in the result.

Existing stored bests remain. No migration or key version is introduced. The first improved active-time result may replace an older best; that is accepted.

Generic fallback uses the same host clock once migrated into the host.

### 12.8 Scheduler contract

One scheduler instance per round:

```js
after(ms, fn)
every(ms, fn)
frame(fn)
animate(element, keyframes, options)
pause()
resume()
cancelAll()
get activeCount()
```

- `after/every/frame` return cancel functions.
- `animate` returns a Promise that resolves on finish or cancellation.
- `pause` stops callbacks from advancing; resume uses remaining time, not a burst of missed callbacks.
- `cancelAll` is idempotent.
- Tests assert `activeCount === 0` after destroy.

### 12.9 Motion service

Motion service exposes token durations/easings, `reduced`, and helpers:

```js
press(element)
move(element, keyframes, token)
emphasize(element, kind)
sequence(steps)
```

It delegates scheduling to the round scheduler. It MUST NOT create its own global timers.

### 12.10 Audio service

Audio service API:

```js
unlock()
play(cue, { volume, rate, detune })
stopAll()
setMuted(boolean)
dispose()
```

The game host owns the shared service; a scene receives a scoped facade. Unknown cues fail silently in production and warn once in development.

## 13. Failure and fallback behavior

- Scene loading shows the common shell and a neutral three-dot activity indicator for at most 1500 ms.
- If a scene module fails to load, host logs the game id and error, clears the mount, and starts `generic.js`.
- If `create` or `present` throws, host destroys the partial scene and switches to generic for the current item without losing earlier answers.
- If generic also fails, close the round and show one bilingual recoverable card:
  - “This game needs a fresh start. / 這個遊戲需要重新開始。”
  - “Back / 返回”
- A scene failure MUST NOT mark the brain game done or award a star.
- Audio asset failure never blocks play.
- Reduced motion and muted modes are not fallback/error states.

## 14. Offline and service worker

Every slice that adds a runtime or asset file MUST:

1. add it to `APP_SHELL`;
2. increment `CACHE_NAME`;
3. add first-party JS/CSS to `scripts/check.mjs` runtime validation;
4. add a static check that every `SCENE_LOADERS` entry exists in `APP_SHELL`;
5. install/reload once online, then verify the changed scene after disabling network.

Dynamic import provides lazy parsing, not lazy availability. All scene modules required by the installed build MUST be precached.

## 15. Testing requirements

### 15.1 Automated

- Use Node's built-in test runner; do not add a test dependency.
- Pure data and core logic get direct unit tests.
- Host tests use fake mount/service objects and test state transitions without a browser.
- Scene modules MUST expose pure view-model helpers for node tests.
- DOM animation appearance remains a real-browser/tablet test; do not pretend a stub proves visual correctness.
- Test duplicate submit, quit in every state, hidden/resume, failed import, failed present, scheduler cleanup and onFinish exactly once.
- `check.mjs` validates bilingual scene copy, unique ids, scene-to-manifest alignment and service-worker coverage.

### 15.2 Visual tablet matrix

Required manual passes:

| Viewport | Orientation | Purpose |
|---|---|---|
| 360 × 800 | portrait | narrow fallback |
| 800 × 1280 | portrait | primary tablet portrait |
| 1280 × 800 | landscape | primary tablet landscape |
| 1024 × 600 | landscape | short tablet |
| 1366 × 1024 | landscape | wide cap |

At minimum, use browser emulation for all sizes and one real target tablet for coarse pointer, sound unlock, background/resume and performance.

### 15.3 Screenshot states

Each scene implementation records screenshots for:

- first item/instruction;
- active answer;
- correct feedback;
- corrective feedback;
- compact width;
- reduced motion does not need a separate still unless layout differs.

Screenshots are review artifacts, not runtime assets.

## 16. Performance budgets

- Initial non-Brain app load MUST NOT parse scene modules.
- Common Brain runtime first load SHOULD remain under 90 KB uncompressed first-party JS + CSS.
- Each scene module SHOULD remain under 35 KB uncompressed.
- Audio pack maximum 350 KB.
- No scene may allocate a second full-viewport canvas.
- Number Cruncher Canvas device pixel ratio is capped at 2.
- Canvas object count is capped at 72 including distractors.
- No more than 4 concurrent Web Animations.
- No more than 12 feedback particles.
- Waiting/answering idle CPU should approach zero: no rAF loop.
- `destroy` must leave scheduler active count zero and stop audio within one task.

## 17. Definition of visual completion

A scene is not visually done merely because its controls work. It is done only when:

- hierarchy is obvious in a one-second glance;
- EN + 中文 is readable without covering task objects;
- no emoji or inconsistent stock art appears in the scene;
- all objects use the palette, outline and shadow rules;
- active state is calm;
- tap, correct, corrective and transition states are deliberately designed;
- compact and short landscape layouts are composed, not just shrunk;
- reduced motion is intentionally authored;
- silent play communicates every event;
- Papa has reviewed the required screenshots on the target theme.
