# Slice 34 — Brain presentation runtime

**Status:** implemented 2026-07-28 — all files in the exact file plan below shipped; automated tests and `node scripts/check.mjs` are green. Real-tablet visual/offline/reduced-motion verification (§15.2) and Papa's screenshot review are still outstanding — this is code-complete, not yet the human-approved DONE WHEN.  
**Depends on:** game-platform slice 15 host/ESM decisions; does not depend on Three.js or Solar System  
**Ships independently:** yes; existing generic Brain UI remains the fallback
**Normative reference:** `implementation-guidelines.md`, especially §§4–12 and §§14–16

## Goal

Separate round orchestration from scene presentation so a Brain Gym exercise can have its own animated interaction without reimplementing scoring, timers, speech, finish handling or teardown.

## Scope

- Add a Brain Round host responsible for round state, item progression, timer, grading and finish.
- Define and validate the scene adapter contract.
- Lazy-load a scene by game id; use the generic scene when a bespoke module is absent or fails.
- Add shared scheduler, motion and audio services suitable for both brain and arcade games.
- Inject services; do not introduce new ambient game globals.
- Move current generic prompt/pad rendering behind a generic scene adapter with unchanged behaviour.
- Add reduced-motion and background pause/resume handling.
- Precache every new runtime file and bump the service-worker cache.

## Current baseline and preflight

At the time this plan was written, Brain Gym is opened by `startBrain()` in `index.html`, which calls the global `SQBrain.openRound()` from `js/brain-ui.js`. That file currently mixes:

- overlay creation;
- elapsed-time interval;
- prompt rendering;
- choice, keypad, grid and text inputs;
- Low to High and Word Memory delayed phases;
- wrong-answer feedback;
- round completion.

`brain-core.js` supplies only round creation and final round scoring. `sw.js` precaches the three current brain files. Slice 34 MUST begin with this check:

1. Confirm game-platform slice 15 actually exists in the worktree: `js/main.js`, the game manifest and dynamic import work on a target tablet.
2. If slice 15 is not present, stop. Do not build a second temporary module loader.
3. Run `node scripts/check.mjs` before edits and record the baseline.
4. Exercise one item of all nine generic games before refactoring; Word Memory partial credit and Low to High flash behavior are the highest-risk paths.

## Exact file plan

| File | Action | Responsibility after slice |
|---|---|---|
| `css/brain-shell.css` | create | common full-screen round shell, header, status, progress, clock, accessibility utility and responsive layouts |
| `css/brain-scenes.css` | create | generic-scene styles and shared scene primitives; no bespoke theme yet |
| `js/game-services/scheduler.js` | create | all cancellable timeouts, intervals, frames and Web Animations |
| `js/game-services/motion.js` | create | normative motion tokens and reduced-motion helpers |
| `js/game-services/audio.js` | create | shared audio API, mute bridge and current synthesized cue fallback |
| `js/brain/host.js` | create | state machine, item grading, active clock, scene lifecycle, speech and finish |
| `js/brain/scenes/index.js` | create | frozen scene loader table; empty in slice 34 |
| `js/brain/scenes/generic.js` | create | behavior-equivalent renderer for all current prompt/pad types |
| `js/brain-core.js` | modify | add pure `gradeItem`; make `scoreRound` delegate to it |
| `js/brain-ui.js` | modify | thin compatibility facade exposing `SQBrain.openRound` and `fmtMs`; no game-specific DOM |
| `index.html` | modify | load the two Brain CSS files and inject current mute/kid dependencies into the facade |
| `sw.js` | modify | precache every new runtime/CSS file and increment cache version |
| `scripts/check.mjs` | modify | runtime, bilingual, scene-manifest and service-worker integrity checks |
| `scripts/core.test.mjs` | modify | direct `gradeItem` parity tests |
| `scripts/brain-host.test.mjs` | create | host state machine and cleanup tests |
| `scripts/brain-scenes.test.mjs` | create | static scene contract and generic view-model tests |

No existing project file is deleted.

## Task 1 — common CSS shell

Implement the exact tokens and composition in `implementation-guidelines.md` §§4–7.

Required selectors:

```text
.brain-round
.brain-round__header
.brain-round__quit
.brain-round__identity
.brain-round__mute
.brain-round__status
.brain-progress
.brain-progress__pip
.brain-clock
.brain-scene
.brain-announcer
.brain-loading
.brain-task-card
.brain-answer
.brain-corrective
.sr-only
```

Rules:

- CSS classes use `brain-` prefixes; scene ids use `brain-round--<id>`.
- Do not reuse `.card`, `.btn`, `.stage` or `.overlay` internally; their existing rules are too broad.
- Existing `--accent` is used only for the required 4 px kid-colour rail at the top of the common shell.
- `brain-scenes.css` contains reusable token, tray, tile, shelf, stamp and feedback primitives. Do not pre-design later scenes in this slice.
- Add the two stylesheet links after the current inline style so namespaced Brain rules win without `!important`.
- `!important` is forbidden. Reduced motion is handled by the shared motion service plus namespaced media rules.

## Task 2 — scheduler service

Implement the exact API in the bible §12.8.

Required behavior:

- every scheduled resource is registered before its callback can run;
- every callback removes itself when complete;
- callbacks scheduled after cancellation are rejected/no-op;
- `pause()` preserves remaining duration for `after`;
- `every()` does not replay missed ticks on resume;
- `frame()` stops asking for frames while paused;
- `animate()` cancels the underlying `Animation` on `cancelAll`;
- exceptions inside a callback are rethrown asynchronously after resource bookkeeping is cleaned;
- `activeCount` counts all live resources in tests.

No global singleton. One scheduler is created per Brain round and is disposed with it.

## Task 3 — motion service

- Read reduced-motion once from `matchMedia("(prefers-reduced-motion: reduce)")`.
- Subscribe to media-query change while the service is alive; unsubscribe on dispose.
- Export the approved timing/easing tokens. Scenes MUST NOT hardcode alternate timing.
- All helpers delegate to the supplied scheduler.
- In reduced mode, use the substitutions in bible §8.3.
- Unit-test the generated keyframes/options as pure values; browser visual behavior remains a manual test.

## Task 4 — audio service seam

Slice 34 builds the service, not the final audio pack.

- Wrap one lazy `AudioContext`.
- Bridge to the current global mute boolean through injected `isMuted()`/`setMuted()` callbacks. Do not create a second persisted mute setting.
- Support buffer cues and a synthesized fallback cue table so generic games retain audible good/complete feedback before slice 35 assets land.
- `unlock()` MUST be called from the first pointer/keyboard activation inside the round.
- `play()` before unlock or while muted returns a harmless stopped handle.
- `stopAll()` stops every active source and speech is separately canceled by the host.
- Cap concurrent sources at four, oldest non-speech effect stopped first.
- Do not fetch or decode any audio during app boot.

## Task 5 — pure item grading

Add `gradeItem(item, given)` to `brain-core.js` using exactly the current `scoreRound` rules:

1. `worth` defaults to 1.
2. `given` becomes a trimmed string.
3. Custom `item.grade` returns partial `got`, clamped to `0..worth`.
4. Otherwise exact trimmed string equality determines full credit.
5. `correct` is true only for full credit on a positive-worth item.

Refactor `scoreRound` to sum `gradeItem` outputs. Pin parity with tests for:

- normal correct/incorrect string answers;
- numeric answers passed as number or string;
- first Math Recall item with `worth: 0`;
- Word Memory partial, full and excessive custom grades;
- missing answers;
- elapsed time retained only for clocked rounds.

## Task 6 — generic scene adapter

Move current prompt/pad behavior behind the exact scene contract; do not import globals.

Generic adapter MUST support:

```text
prompt: emoji, swatch, colorword, countfield, clockface,
        money, gridflash, wordlist, default text
pad: choice, grid, type, keypad
```

Behavior parity:

- choice labels remain bilingual where currently available;
- keypad allows maximum four entry characters and supports delete/submit;
- grid flash uses the generated `flashMs`;
- Word Memory uses the generated `studyMs`;
- Word Memory typing stays disabled during study;
- first zero-worth recall item advances through host grading without false corrective language;
- scene sends raw semantic answers to `ctx.submit`;
- it does not decide correctness locally;
- all delayed reveals use `ctx.scheduler`.

The generic scene uses the new common shell and paper styling, but it MUST preserve gameplay. Bespoke world art begins only in slice 35.

## Task 7 — host state machine

Implement the exact state machine in bible §12.5.

Additional requirements:

- `openRound(opts)` validates `gameId`, tier and callbacks before adding DOM.
- Only one Brain round may exist. Opening another destroys the previous one first.
- Build the round once with a question RNG. Derive a separate visual RNG from `dseed("brain-visual" + gameId + tier + Date.now())`; never consume the question RNG for decoration.
- The host owns `answers`; the scene cannot mutate previous values.
- `announce` writes paired copy into the common live region once per state change.
- Tot bilingual speech starts after `present`; input becomes active immediately and remains usable while speech plays, matching current behavior.
- The active-time accumulator updates the visible clock at 250 ms internally but displays only whole seconds.
- Hidden document pauses active time and services. On resume, it returns to the same item and state without replaying feedback.
- `showFeedback` is awaited but hard-capped at 1200 ms.
- Correct feedback uses the shared success cue; corrective feedback has no negative cue.
- Finishing destroys the scene/round overlay before invoking outer `onFinish`, preventing two overlays from stacking.

## Task 8 — compatibility facade and integration

`js/brain-ui.js` remains the only global API current `index.html` knows:

```js
window.SQBrain.openRound(opts)
window.SQBrain.fmtMs(ms)
window.SQBrain.closeActive()
```

The facade always uses one cached dynamic import:

```js
let hostPromise;
function host() {
  if (!hostPromise) hostPromise = import("./brain/host.js");
  return hostPromise;
}
```

`openRound`, `fmtMs` and `closeActive` delegate through that Promise. `js/main.js` is not modified by slice 34. `audio.js` exposes a module-level `getSharedAudio(deps)` singleton so future arcade modules importing the same service reuse the AudioContext; scheduler and motion remain per-round. The facade MUST NOT contain prompt rendering.

`startBrain()` remains responsible for:

- selecting tier;
- injecting kid id;
- bilingual speech adapter;
- forwarding completed results to `finishBrain`.

`finishBrain()` and `showBrainResult()` remain unchanged in slice 34 except for any necessary Promise-safe launch handling. Persistence is explicitly outside the host.

`stopArena()` and `goHome()` MUST call `SQBrain.closeActive()` so the round is destroyed even when navigation originates outside its own quit control.

## Task 9 — static integrity and offline checks

Extend `check.mjs` to fail when:

- a first-party Brain runtime file is absent from `runtimeFiles`;
- a scene manifest id is unknown to `brain-data.GAMES`;
- a scene module id does not match its manifest key;
- any scene loader target is absent from `APP_SHELL`;
- scene copy pairs are missing English or Chinese;
- scene JavaScript calls forbidden direct APIs: `setTimeout`, `setInterval`, `requestAnimationFrame`, `speechSynthesis`, `new Audio`, `fetch(` or `localStorage`;
- Brain scene CSS contains an unapproved colour literal outside the token declaration block.

Increment `CACHE_NAME` once in this slice. Verify after an online install:

1. open any generic Brain game;
2. disable network;
3. reload;
4. open all four pad types;
5. quit mid-study and reopen.

## Task 10 — test matrix

Automated host tests MUST cover:

- normal correct path;
- corrective path;
- zero-worth item;
- partial-credit item;
- duplicate submit;
- quit from loading, active, feedback and transition;
- scene import rejection;
- scene `create`, `present`, `showFeedback` and `destroy` exceptions;
- generic fallback;
- hidden/resume active-time exclusion;
- feedback/transition time exclusion;
- timeout cap on a never-resolving feedback Promise;
- `onFinish` exactly once;
- no `onFinish` on quit;
- scheduler `activeCount === 0` after every terminal path.

Manual visual checks use the five viewports in the bible §15.2 and both normal/reduced motion.

## Non-goals

- No visual redesign of a specific game.
- No Three.js dependency.
- No scoring, gate, daily-three, tier or database change.
- No removal of the old UI path until fallback parity is proven.

## Verification

- Headless contract tests cover mount, submit, next item, wrong-answer continuation, finish and destroy.
- A scene leaving mid-round has no live timeout, interval, animation frame or speech.
- A deliberately failing scene import opens the generic renderer.
- Reduced-motion mode produces no travel or shake animation.
- Wifi-off reload can open the generic Brain Gym round.
- `node scripts/check.mjs` passes.

## DONE WHEN

Change Maker can be implemented as a standalone scene module that knows nothing about Supabase, daily selection, stars or the outer app, and:

- all nine games complete through `generic.js`;
- their generated questions, scores, item counts and outer result persistence match baseline;
- every terminal host path has zero scheduled resources;
- the active timer excludes hidden/feedback/transition time;
- a failed scene loader falls back without losing the round;
- all new files work after an offline reload;
- the required automated and viewport checks pass;
- `node scripts/check.mjs` is green.
