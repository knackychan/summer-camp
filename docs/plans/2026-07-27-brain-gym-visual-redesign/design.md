# Proposed design — Brain Gym animated micro-worlds

**Date:** 2026-07-27  
**Status:** detailed proposal for Papa's review — not approved; implementation MUST NOT start until approved  
**Extends:** `docs/plans/2026-07-26-brain-gym/design.md` and `docs/plans/2026-07-26-game-platform/design.md`  
**Slices if approved:** `34-brain-presentation-runtime.md` through `37-brain-scenes-and-polish.md`
**Normative implementation bible:** `implementation-guidelines.md`
**Interactive visual reference:** `design-preview.html`
**Visual/UI agent execution prompt:** `visual-ui-agent-prompt.md`
**Pixel motion amendment (pending approval):** `pixel-motion-amendment.md` — fixes sprite scale, snap rules, three motion-service helpers and the juice allow/denylist

> Implementers: this document establishes product direction. `implementation-guidelines.md` fixes the visual tokens, component geometry, motion, audio, accessibility, scene API, state machine, failure behavior, offline rules and test budgets. A slice may narrow those rules but MUST NOT contradict them. Do not fill a missing art or architecture decision by taste; ask Papa.

`design-preview.html` is the visual companion: it shows the exact common shell and Change Maker composition, interactive money controls, forced feedback states, responsive/reduced-motion switches, the approved palette and identity thumbnails for all nine stations. It is reference code only. Production MUST follow the modules, services, asset provenance, accessibility and test requirements in the normative plans rather than copying the prototype into `index.html`.

`visual-ui-agent-prompt.md` is the copy-paste handoff for the specialist visual/UI agent. Its dated soft pixel-art sprite direction supersedes earlier SVG-only asset-production wording while retaining every product, UX, accessibility, architecture, offline and performance rule.

## Context

The nine Brain Gym exercises work, but they currently share one generic card, one generic set of answer pads, and a small collection of prompt renderers in `js/brain-ui.js`. The underlying system is stronger than the current presentation:

- `brain-data.js` owns the tiered questions.
- `brain-core.js` owns seeded rounds, scoring, difficulty and the daily three.
- `brain-ui.js` currently owns almost every visual and interaction.
- progress, best scores, gating and Supabase are already generic.

The redesign should preserve the first two layers and replace the monolithic visual layer with themed, animated scenes. This is not a database rewrite and it is not a Three.js project by default.

## Inspiration, not imitation

The useful lessons from Nintendo's Brain Training games are structural:

- one instantly understandable action per screen;
- touch-first input with almost no instructions after the first item;
- short, repeatable rounds;
- immediate feedback and visible rhythm;
- different interaction styles for processing speed, attention and working memory;
- difficulty that stays near the player's current ability;
- a calm daily-training ritual rather than a conventional game-over loop.

Summer Quest should not copy Dr Kawashima's character, interface, handwriting look, sounds, names, layouts or assets. Our direction is **Kawashima-like clarity with Summer Quest micro-worlds**.

Research references:

- Nintendo describes the Switch exercises as short touch/finger activities spanning processing speed, short-term memory and self-control: <https://www.nintendo.com/sg/switch/as3m/index.html>
- The original DS manual documents Calculations ×20, Stroop and Word Memory as quick, distinct input modes rather than one quiz template: <https://www.nintendo.com/eu/media/downloads/games_8/emanuals/nintendo_ds_21/Manual_NintendoDS_DrKawashimasBrainTraining_EN.pdf>
- Nintendo's developer interview stresses repeated exercise near the same difficulty and relaxing activities that help daily return: <https://iwataasks.nintendo.com/interviews/3ds/brain-age/1/3/>

## Proposed decisions — fixed defaults for approval

| # | Proposal |
|---|---|
| P1 | Keep `brain-data.js`, `brain-core.js`, daily selection, gate rules, stats and Supabase shape. The redesign is presentation-first. |
| P2 | Give each brain game its own scene adapter, lazy-loaded by game id, behind one shared Brain Round host. |
| P3 | Use DOM + CSS + inline SVG for most scenes. Use Canvas 2D for dense moving fields. Use Three.js only when 3D is meaningful to the exercise. |
| P4 | Reuse the game platform's `ctx.mount`, lifecycle, pause/resume, mute and teardown concepts. Add shared motion and audio services that both arcade and brain games can use. |
| P5 | Build Change Maker first. Its shop, till, tap-to-place coins, structured tray and sound palette exercise almost every capability the shared presentation layer needs. Drag is deferred. |
| P6 | Every animation serves orientation, action or feedback. Ambient motion stays subtle; prompts never move while the kid is reading or calculating. |
| P7 | Keep the existing coach-not-cop rules: no fail state, no red penalty screen, no time penalty, no sibling leaderboard. |
| P8 | `prefers-reduced-motion`, mute, background-tab pause, coarse pointer targets and bilingual text are runtime requirements, not cleanup. |
| P9 | The v1 scene art is original DOM/SVG/CSS. Emoji remains acceptable only in the existing outer game tiles, not as primary scene art. |
| P10 | No Brain Buddy, face or recurring mascot in v1. The micro-world itself provides feedback. |
| P11 | Audio uses a shared Web Audio service plus a repository-local pack of short original or redistribution-cleared effects, capped at 350 KB and documented with provenance. |
| P12 | The redesigned clock measures active answer time only; scene transitions, feedback and hidden-tab time do not affect best time. Existing best keys remain unchanged. |
| P13 | Change Maker uses tap-to-construct change. Drag is not implemented in slices 34–37. |
| P14 | The current generic renderer remains a runtime fallback through all four slices. It is not deleted in this plan. |

## Recommended art direction — “Pocket Brain Lab”

Each exercise is a small illustrated place inside the Summer Quest world. The visual language is warm, toy-like and readable:

- soft paper and painted-plastic surfaces;
- large silhouettes and thick outlines;
- one strong game accent plus the active kid's colour;
- restrained shadows and depth, with no glossy casino effects;
- numbers and task-critical objects always above decoration;
- 180–280 ms input reactions, 450–700 ms success moments, and short transitions between questions;
- no recurring mascot or face character; the activity set itself reacts.

The common round shell contains only:

- game title and bilingual first-time instruction;
- progress pips;
- count-up clock rendered only for `mid` and `hard`;
- the scene mount;
- a quiet “Later / 待會再玩” control.

After the first item, instructions collapse so the scene gets nearly the full tablet.

The exact palette, typography, shape grammar, responsive grid, component dimensions, motion curves and audio palette are not left to the scene implementer. They are defined in `implementation-guidelines.md` §§3–10. In particular:

- the redesigned activity surface is warm paper set inside the existing dark-purple Summer Quest shell;
- scenes are front-facing 2.5D educational-toy sets with dark-plum outlines and short contact shadows;
- there are no photorealistic textures, emoji scene art, glass effects, neon sci-fi panels or free 3D cameras;
- all answer-relevant text remains DOM text;
- the scene becomes still when an answer is expected.

## The nine micro-worlds

| Game | Scene | Primary interaction | Animation and feedback |
|---|---|---|---|
| Calculations | **Fruit Stand** | tap/write the answer; tot can move fruit into a basket | fruit drops into groups, basket scale settles, correct answer stamps the order card |
| Sign Finder | **Bridge Workshop** | choose the missing operator tile | operator tiles slide into a gap; the bridge balances when the equation works |
| Low to High | **Lift Lobby** | tap remembered floors in order | floor lights flash, doors close, then the lift travels upward through chosen floors |
| Color Words | **Paint Studio** | tap the ink colour | paint daubs land on a palette; conflict word stays perfectly still; correct colour makes one clean brush sweep |
| Number Cruncher | **Field Scanner** | count the target in a busy field | scanner beam reveals the target sample; dense items use Canvas 2D with stable positions and no distracting drift |
| Time Lapse | **Train Station Clock** | read or advance the clock | minute hand moves to the prompt time; a train arrives only after the answer |
| Change Maker | **Corner Shop** | build change by tapping coins/notes into a tray | item enters checkout, till opens, coins clink into tray, receipt prints, customer receives the change |
| Word Memory | **Library Desk** | study cards, then recall/type | word cards are placed on a desk, covered by library slips, then recalled; no moving background during study |
| Math Recall | **Parcel Relay** | answer the previous parcel's value | the current parcel moves to a memory shelf while the previous slot becomes the answer target |

These are themes, not nine different engines. They share scene primitives: cards, trays, tokens, shelves, progress pips, stamps, particles and transitions.

## Change Maker pilot

### Scene

A friendly corner shop fills the play area:

1. An item rolls or slides onto the checkout mat.
2. A large price label appears.
3. The customer's payment slides beside the register.
4. The cash drawer opens and shows only denominations useful at that tier.
5. The kid taps coins/notes to place them in the change tray.
6. The tray displays the running total.
7. “Give change / 找錢” submits.

Example prompt:

> Juice costs NT$37. You pay NT$50.  
> 果汁 NT$37，你付 NT$50。

The prompt is spatial: `NT$37` belongs to the item, `NT$50` belongs to the customer, and the constructed `NT$13` belongs to the tray. This removes the abstract paragraph currently shown above a keypad.

### Tier behaviour

- `tot`: two large, clearly labelled coin objects; tap the coin worth more. No clock and no decorative motion while choosing.
- `mid`: prices below NT$50; build change from NT$1, NT$5, NT$10 and NT$50 as appropriate.
- `hard`: change from NT$500/NT$1000 using coins and notes. A “fewest pieces” bonus is explicitly outside slices 34–37 and MUST NOT be added during implementation.

For `mid` and `hard`, the generated item should expose `price`, `paid`, `change`, and allowed denominations. Grading remains numeric: the value of the submitted tray must equal `change`. The persistence layer still records the same round score and elapsed time.

### Feedback

- tap a denomination: one coin/note arcs from the drawer to the tray;
- undo: the last piece returns to its slot;
- correct: drawer bell, receipt stamp, coins sweep to the customer, then the next item enters;
- incorrect: tray gives one soft nudge, the correct total is shown with a counting highlight, then the round continues;
- no red flash, buzzer, lost money or customer frustration.

### Sound palette

The existing oscillator beeps are enough for a prototype but not for the final scene. A shared audio service should provide:

- register bell;
- drawer open/close;
- denomination-sensitive coin clinks;
- note/paper slide;
- receipt tear or stamp;
- soft success and round-complete motifs.

Prefer very short licensed/original compressed assets, precached for offline use. Web Audio can add small pitch variation so repeated coin taps do not sound mechanical. Every sound respects the existing mute state, unlocks only after user interaction, and has a visual equivalent.

## Presentation architecture

### Today

```text
brain-data + brain-core
          ↓
    brain-ui.js
  (round + scene + pads
   + timers + feedback)
```

This is why every game looks like the same card.

### Proposed

```text
brain-data + brain-core
          ↓
  Brain Round Host
  - round state / timer
  - answer + scoring
  - progress / finish
  - pause + teardown
          ↓
  scene adapter by game id
  - mount(ctx, item)
  - present(item, view)
  - setInputEnabled(enabled)
  - showFeedback(result)
  - destroy()
          ↓
 DOM/SVG     Canvas 2D     Three.js
 default     dense fields  exceptional
```

Suggested files after the game-platform ESM seam exists:

```text
js/brain/host.js
js/brain/scenes/change.js
js/brain/scenes/calc.js
...
js/game-services/audio.js
js/game-services/motion.js
js/game-services/scheduler.js
css/brain-shell.css
css/brain-scenes.css
assets/audio/brain/...
```

The host passes a constrained context:

```js
{
  mount,
  game,
  tier,
  kid,
  sayPair,
  audio,
  motion,
  scheduler,
  reducedMotion,
  submit(answer),
  quit()
}
```

`scheduler` owns timeouts, intervals and animation frames so leaving a round cancels everything. This is the same lifecycle problem the Three.js host must solve, so the service should be shared.

The short adapter sketch above is conceptual. The exact frozen context, `present`/`setInputEnabled`/`showFeedback`/`destroy` contract, host state machine, `gradeItem` extraction, 1200 ms feedback ceiling and active-time clock are normative in `implementation-guidelines.md` §12.

### Relationship to the game platform

Reuse:

- registry metadata and lazy ESM loading;
- `ctx.mount`;
- lifecycle and resource teardown;
- visibility pause/resume;
- mute/audio service;
- service-worker precache checks;
- reduced-motion and device capability policy.

Do not force:

- brain games into the arcade score/result contract;
- every brain scene onto the shared 2D canvas;
- Three.js into the initial Brain Gym bundle;
- the solar scene graph, camera, raycasting or orbit loop into unrelated exercises.

The solar system and Brain Gym should share a **platform**, not a renderer. Three.js is one renderer plugged into that platform.

## Why Three.js is usually the wrong tool here

Three.js could draw a register and coins, but it adds asset work, camera decisions, lighting, raycasting, GPU context handling and more memory without improving the mathematical interaction. CSS transforms and SVG can deliver convincing depth, coin arcs, drawer motion and tactile buttons with sharper text and lower overhead.

Good future Brain Gym uses for Three.js would be exercises where depth is the rule: rotate a shape to match a silhouette, navigate a spatial path, or remember 3D object positions. None of the current nine requires it.

## Performance and accessibility budget

- target 60 fps; remain usable at 30 fps;
- animate only `transform` and `opacity` where possible;
- no continuous animation when the scene is waiting for an answer;
- cap decorative particles at 12;
- no image asset required to understand a question;
- all answer targets at least 56 CSS px, preferably 64 px;
- no drag-only interaction: tapping a denomination must always work;
- pause all schedulers on `visibilitychange`;
- reduced motion replaces travel/arc animations with fades and immediate placement;
- task-critical text remains DOM text for bilingual fonts, scaling and accessibility;
- scene can fall back to the existing generic renderer if its module fails to load.

## Data and persistence impact

No Supabase migration is required.

Most current generators remain unchanged. Change Maker gains `price`, `paid`, `change` and `denominations`; the later slices list the only other allowed structured additions. An implementer MUST NOT add unspecified presentation data or change question generation while styling a scene. Generation and grading stay pure and node-testable.

Best scores, `brain_done`, daily-three selection and the one-star daily reward do not change.

## Delivery order

1. Build the shared presentation runtime and audio/motion services after the registry host contract is stable.
2. Build Change Maker as the pilot and test it on all three kids' tablets.
3. Adjust the adapter contract based on the pilot before starting a second scene.
4. Ship the remaining scenes in two small waves.
5. Keep the generic renderer as fallback until all nine scenes have passed tablet use.

The redesign does **not** need to wait for the Solar System game or the full arcade migration. It should depend only on the game-platform host/lifecycle decisions that it reuses. The Three.js vendor/probe slice can proceed independently.

## Approval gate

The plan now supplies fixed recommended answers so an implementation agent is not asked to choose. Papa should approve the complete set or name a change before implementation:

1. **Pocket Brain Lab** micro-world art direction, using the exact v1 design tokens.
2. Change Maker constructs the answer from stylized NT$ coins/notes.
3. Change Maker ships and receives tablet review before the other eight scenes.
4. Hybrid audio: shared Web Audio playback plus a maximum 350 KB offline effects pack.
5. No recurring mascot in v1.
6. Active-answer timing replaces wall-clock round timing for redesigned scenes without a stat migration.
7. No Three.js in the current nine Brain Gym scenes; only the platform seam is shared.
