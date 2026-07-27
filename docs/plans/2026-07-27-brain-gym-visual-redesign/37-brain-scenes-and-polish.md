# Slice 37 — Remaining brain scenes and platform polish

**Status:** proposed — requires wave-one tablet feedback  
**Depends on:** slices 34–36  
**Ships independently:** yes
**Normative reference:** `implementation-guidelines.md` plus accepted pilot/wave-one review notes

## Goal

Finish the visual set, then harden the shared Brain Gym experience across devices, motion settings, sound settings and offline use.

## Games

- Number Cruncher — Field Scanner
- Time Lapse — Train Station Clock
- Word Memory — Library Desk
- Math Recall — Parcel Relay

## Scope

- Use Canvas 2D only for Number Cruncher's dense field; keep controls and text in DOM.
- Use inline SVG for the station clock and animate its hands without changing the generated answer.
- Freeze all decorative motion during Word Memory study and recall.
- Make Math Recall's “current” and “previous” slots visually unambiguous.
- Audit and deduplicate scene primitives, CSS and SFX.
- Tune asset sizes, animation durations and audio levels on real tablets.
- Add a per-scene capability/failure fallback to the generic renderer.
- Document how to add a future Brain Gym scene.

## Wave-one review gate

Before this slice begins:

1. Papa approves the screenshot set for Change Maker and all wave-one scenes.
2. Shared visual or adapter corrections are incorporated into the normative guidelines.
3. Any one-off CSS workaround is either promoted into a documented primitive or removed.
4. Performance and cleanup tests are green on a real tablet.

Slice 37 is completion and hardening, not a chance to introduce a second visual direction.

## Exact file plan

| File | Action |
|---|---|
| `js/brain-data.js` | add structured scanner, clock, memory-card and recall fields only |
| `js/brain/scenes/index.js` | add `crunch`, `clock`, `wordmem`, `recall` loaders |
| `js/brain/scenes/crunch.js` | create Field Scanner |
| `js/brain/scenes/clock.js` | create Train Station Clock |
| `js/brain/scenes/wordmem.js` | create Library Desk |
| `js/brain/scenes/recall.js` | create Parcel Relay |
| `css/brain-scenes.css` | add four namespaced blocks and final primitive cleanup |
| `assets/brain/scanner-objects.svg` | create six approved animal symbols |
| `assets/brain/memory-symbols.svg` | create the seven approved tot memory symbols not already in shop/scanner sheets |
| `assets/brain/station.svg` | create non-text train/station decoration |
| `assets/brain/library.svg` | create non-text desk/slip decoration |
| `assets/brain/parcel.svg` | create non-text parcel/conveyor decoration |
| `assets/brain/result.svg` | create common result stamp/medal/star symbols |
| audio/tests/check/service worker | extend and increment cache once |
| `README.md` | document local HTTP requirement and Brain scene authoring reference |
| `docs/brain-scene-authoring.md` | create concise future-scene checklist pointing to the normative bible |

No existing file is deleted. Generic fallback remains shipped and cached.

## Scene E — Number Cruncher: Field Scanner

### Identity and composition

- Scene class: `.brain-crunch`.
- Accent: `--brain-crunch`.
- Setting: field-research counting board, not a military radar or sci-fi HUD.
- Required objects: paper target sample card, framed specimen field, answer pad.
- Field frame uses dark-plum outline and a faint square grid.
- A scanner bar MAY sweep once during entrance and MUST stop before input.
- No blinking crosshair, alarm, moving specimens or random post-layout jitter.

Tablet layout:

```text
target sample card | specimen field (largest area)
answer choices/keypad below
```

Compact stacks target above field. Target remains visible during answering.

### Tot symbol set

`scanner-objects.svg` contains exactly:

| id | English | Traditional Chinese |
|---|---|---|
| `dog` | Dog | 狗 |
| `cat` | Cat | 貓 |
| `fish` | Fish | 魚 |
| `bird` | Bird | 鳥 |
| `frog` | Frog | 青蛙 |
| `bee` | Bee | 蜜蜂 |

- Front/side silhouette as appropriate, maximum three flat fills.
- No facial expressions.
- All six have comparable visual weight so one is not easier to spot by size.

### Data contract

Replace presentation-only emoji/digit strings with structured glyphs while keeping fallback text:

```js
prompt: {
  type: "countfield",
  mode: "symbols",            // tot; "digits" for mid/hard
  glyphs: [
    { id: "cell-0", value: "dog" },
    // ...
  ],
  target: "dog",
  en: "How many dogs?",
  zh: "有幾隻狗？"
}
```

Mid/hard `value` is a digit string. Stable ids follow final shuffled order.

### Deterministic layout

Export a pure `layoutField(count, width, height, seed)` helper:

- uses only the visual RNG/seed; never question RNG;
- applies a regular jittered grid, not unconstrained random placement;
- minimum center distance is 34 px at 320 px reference width;
- glyph bounding boxes do not overlap;
- 8 tot symbols use 4 × 2;
- 30 digits use 6 × 5;
- 60 digits use 10 × 6;
- positions remain fixed from present through feedback;
- Canvas draw order follows array order.

The helper returns normalized `x`, `y`, `rotation` and `scale`. Rotation is:

- symbols: −6° to +6°;
- digits: exactly 0°.

### Rendering

- Tot renders symbols as SVG `<use>` elements because count is small.
- Mid/hard MUST use one Canvas 2D field for performance.
- Canvas CSS size follows its container; backing size uses `min(devicePixelRatio, 2)`.
- Digits use Fredoka/system fallback, 22–28 px reference size, `--brain-ink`.
- Target digits may occur multiple times; distractor digits are uniform in weight/colour.
- Canvas is redrawn only on present, resize and feedback; no loop.
- A `ResizeObserver` triggers redraw on Canvas size changes and MUST be disconnected in destroy.

### Interaction

- Tot uses four numeric answer buttons.
- Mid/hard use shared numeric keypad.
- No tapping individual specimens.
- Input starts after one 320 ms scanner entrance; scanner becomes a static header line.
- No time limit or countdown.

### Feedback

Correct:

- target occurrences receive success rings in one Canvas redraw;
- scanner produces one `scanner-tick`, then shared success;
- rings remain static for 480 ms.

Corrective:

- target occurrences receive hint rings;
- a small ordinal `1, 2, …` appears beside each target for 700 ms;
- correct count appears in common corrective panel;
- do not dim distractors so severely that the answer becomes a flashing effect.

### Accessibility/tests

- Canvas is `aria-hidden`.
- DOM summary says only the task target, never the hidden count before submission.
- After feedback the announcer may state the correct count.
- Tests verify generated target count equals answer for 1000 seeds.
- Layout tests verify normalized bounds, stable output, zero digit rotation and no overlap at reference sizes.
- Destroy test verifies observer disconnect and no live frame.

## Scene F — Time Lapse: Train Station Clock

### Identity and composition

- Scene class: `.brain-clock`.
- Accent: `--brain-clock`.
- Setting: quiet railway platform with one large analog station clock.
- Required objects: clock, bilingual question board, four departure-time answer tickets.
- A small train silhouette sits outside the scene edge until correct feedback.
- No timetable clutter, second hand, blinking colon, crowd or countdown.

### Clock geometry

Use one inline SVG:

- viewBox `0 0 200 200`;
- outer circle radius 92, 4 px outline;
- twelve tick marks plus SVG numerals at 12, 3, 6 and 9;
- hour hand length 48, width 8, rounded;
- minute hand length 68, width 5, rounded and scene accent;
- center pin radius 7;
- no second hand;
- hand rotation uses SVG transform around `100 100`;
- displayed time is derived from numeric `h` and `m`, never parsed from formatted text.

`clockSvg()` logic currently inside `brain-ui.js` moves to one pure exported clock model. Both bespoke and generic scenes call that model; neither keeps a second angle calculation.

### Data contract

Add explicit fields:

```js
prompt: {
  type: "clockface",
  h,
  m,
  addMinutes: 40,
  answerH,
  answerM,
  en: "What time in 40 minutes?",
  zh: "40 分鐘後是幾點？"
}
```

- `addMinutes` is 0 for read-time items.
- `answerH/answerM` are normalized display values.
- `answer` remains the current `h:mm` string.
- Choices remain four unique formatted strings.
- Pure tests pin rollover across 12 and minute overflow.

### Interaction by tier

**Tot**

- Shows o'clock only.
- First item instruction may label hour hand once.
- Four answer tickets.
- No clock.

**Mid**

- Reads to five minutes.
- Four answer tickets.
- Count-up active-time clock appears in common shell.

**Hard**

- Shows starting clock and explicit `+ 40 min`-style question board.
- Four answer tickets show result times.
- Clock hands remain at starting time while active; do not animate toward the answer.

Answer tickets use fixed 2 × 2 positions but choice values may shuffle each item.

### Motion/feedback

Present:

- question board and clock crossfade 180 ms;
- clock hands appear directly at the generated starting time;
- no ticking.

Correct:

- read-time item: hands remain still; train enters 48 px over 480 ms;
- add-time item: hands animate via the shortest forward time path to `answerH/answerM` over 480 ms, then train enters in the final 160 ms;
- cue `train-arrive`, then shared success once.

Corrective:

- correct ticket gets hint outline;
- hands animate or snap to answer as above;
- no late train, red timetable or alarm.

Reduced motion snaps hands and fades train.

### Accessibility/tests

- SVG clock gets one hidden task description, not verbose tick markup.
- Before answer, a pure `clockA11yDescription(h, m)` describes hand positions without naming the resulting time: for example, “The minute hand points to 4. The hour hand is between 3 and 4. / 分針指向 4，時針在 3 和 4 之間。” This is the required v1 non-visual equivalent and MUST be tested for all five-minute positions.
- Answer ticket labels are bilingual-neutral time strings.
- Tests verify hand angles, rollover, choice uniqueness and formatted answer.
- Visual screenshot must include hard starting and feedback times.

## Scene G — Word Memory: Library Desk

### Identity and composition

- Scene class: `.brain-wordmem`.
- Accent: `--brain-wordmem`.
- Setting: calm library study desk.
- Required objects: desk mat, memory cards, one library cover slip, recall/typing area.
- Background shelf uses monochrome book silhouettes and is hidden on compact.
- Nothing moves, pulses or changes colour during the study interval.

### Tot memory symbols

The tot pool is exactly the following. Reuse the listed approved symbols; `memory-symbols.svg` contains only `water`, `house`, `book`, `tree`, `star`, `car` and `balloon`. Do not duplicate the other five paths.

| id | English | Traditional Chinese | SVG source |
|---|---|---|---|
| `cat` | Cat | 貓 | `scanner-objects.svg` |
| `dog` | Dog | 狗 | `scanner-objects.svg` |
| `fish` | Fish | 魚 | `scanner-objects.svg` |
| `bird` | Bird | 鳥 | `scanner-objects.svg` |
| `apple` | Apple | 蘋果 | `shop-products.svg` |
| `water` | Water | 水 | `memory-symbols.svg` |
| `house` | House | 房子 | `memory-symbols.svg` |
| `book` | Book | 書 | `memory-symbols.svg` |
| `tree` | Tree | 樹 | `memory-symbols.svg` |
| `star` | Star | 星星 | `memory-symbols.svg` |
| `car` | Car | 汽車 | `memory-symbols.svg` |
| `balloon` | Balloon | 氣球 | `memory-symbols.svg` |

The source column above is fixed for v1. Do not move symbols into a new combined sprite during this slice; that would create asset churn unrelated to gameplay.

### Data contract

Tot:

```js
prompt: {
  type: "wordlist",
  mode: "symbol-missing",
  symbols: ["cat", "book", "car", "apple"],
  studyMs: 4000,
  en: "Which one disappeared?",
  zh: "哪一個不見了？"
}
answer: "book"
choices: ["cat", "book", "car", "apple"]
```

Mid/hard:

```js
prompt: {
  type: "wordlist",
  mode: "word-recall",
  words: [...],
  studyMs,
  en: "Remember these words",
  zh: "記住這些單字"
}
```

Fallback representation may retain existing emoji/word arrays until generic is updated for ids.

### Tot phases

```text
deal       four cards enter within 320 ms
study      four cards completely still for 4000 ms
cover      one cover slip passes over cards for 180 ms
active     three original cards + one “?” slot shown;
           four symbol answer buttons become visible now, not earlier
feedback   missing card returns or correct card receives hint outline
```

- Choices MUST be hidden and non-focusable during study.
- Study begins when all four cards are fully visible.
- Active-time clock is absent.
- Symbol arrangement during active preserves original card order with the missing slot, while answer buttons use a fixed 2 × 2 layout below.

### Mid/hard phases

```text
deal       all word cards fade in as one 180 ms group
study      cards still for generated 45s/60s
cover      library slip covers list over 180 ms
active     list is removed from accessibility tree;
           textarea + Done appear
feedback   recalled count shown; correct words are not all replayed automatically
```

Word card layout:

- mid 8 words: 2 columns × 4 rows on tablet; 1 column compact;
- hard 12 words: 3 × 4 tablet, 2 × 6 compact;
- preserve generated word order;
- Fredoka 22–28 px;
- no accompanying pictures or Chinese translations because task is English word recall.

Textarea:

- native control, minimum 3 rows;
- placeholder exactly `Type the words / 打出單字`;
- input remains in DOM only during active phase;
- Done submits raw text;
- no spellcheck/autocorrect penalty beyond the existing pure grader; set `autocapitalize="none"` but do not block platform input aids.

### Motion/feedback

- The only changing study element is a required 3 px progress line below the cards: `--brain-paper-2` track, scene-accent fill at 40% opacity, linear from 0 to 100%, no numerals, ticks, pulse or sound. It uses the scheduler and pauses while the document is hidden.
- Tot correct: missing card slides/fades into slot, `paper-slide`, shared success.
- Tot corrective: missing card appears with hint outline.
- Mid/hard: show `got / worth` in the common feedback panel; full credit uses success, partial credit uses neutral `paper-slide`, zero uses silence. Do not list missed words during the timed round.

### Accessibility/tests

- During tot study, cards have symbol names; during active, missing slot is labelled “Missing card / 不見的卡片” without answer.
- During mid/hard cover, studied words are removed from both visual and accessibility trees before textarea enables.
- Study timers use scheduler and equal exact generated `studyMs`.
- Hidden document pauses the study timer rather than consuming it.
- Tests verify choices are unavailable during study, answer is one of studied symbols, word grader parity, and no studied word leaks after cover.

## Scene H — Math Recall: Parcel Relay

### Identity and composition

- Scene class: `.brain-recall`.
- Accent: `--brain-recall`.
- Setting: parcel sorting bench with one current conveyor slot and one covered memory shelf.
- Required objects: current parcel card, covered previous shelf, answer area, small direction arrow.
- Conveyor does not run continuously.
- No worker character, speed lines while active or warehouse alarm.

Tablet hierarchy:

```text
memory shelf: “Previous / 上一箱” (covered)
             ↑ subtle relationship arrow
current parcel: visible number/equation to remember
answer area: answer the PREVIOUS parcel
```

The current and previous labels MUST remain in the same positions through the whole round.

### Data contract

Extend each built item:

```js
{
  current: {
    mode: "number",          // or "sum"
    display: "7",            // or "12 + 9"
    value: "7"               // hidden semantic current value
  },
  previousAnswer: "",        // first item; prior current value later
  prompt: { ... },
  answer: "",
  worth: 0
}
```

Rules:

- `current.display` contains what the child may see.
- `current.value` is the value to remember and MUST NOT be exposed when display is an unsolved sum.
- `previousAnswer` equals `answer` and exists for scene clarity.
- Keep current `shown`, prompt and answer fields until generic fallback supports the structured shape.
- Tests assert each item's previous answer equals prior item's current value.

### First item

- Show current parcel and covered/empty previous shelf.
- Show one button: `Remember / 記住了`.
- No answer choices/keypad.
- Button submits empty string; host grades the zero-worth item and advances without corrective feedback.
- Do not auto-advance: the child controls study pace.

### Subsequent items

**Tot**

- Current parcel shows a single number 1–9.
- Answer area shows four numeric choices for the previous parcel.
- Current number remains visible while choosing.

**Mid/hard**

- Current parcel shows the generated sum, without its result.
- Answer area uses numeric keypad to answer the previous parcel's computed value.
- The child must solve/remember the current sum while recalling the prior value; do not show current result.

Exact instruction on first scored item:

- `Answer PREVIOUS / 回答上一箱`

Later items use only fixed shelf labels; do not repeat a large paragraph.

### Motion/feedback

Present:

- new current parcel moves 16 px onto bench over 180 ms;
- previous shelf remains covered;
- motion stops before active.

Correct:

- evaluate previous answer;
- current parcel moves 20 px upward toward shelf and fades under its cover over 320 ms;
- do not reveal current value;
- use `paper-slide`, then shared success.

Corrective:

- show correct **previous** value on the shelf cover in hint styling for 600 ms;
- current parcel display stays visible but its hidden result remains hidden;
- then current parcel moves under cover;
- no animation may expose `current.value`.

Reduced motion crossfades parcel into covered shelf.

### Accessibility/tests

- Current visible display is announced.
- Hidden `current.value` is never present in DOM, aria labels, data attributes or CSS generated content.
- Previous shelf is labelled but does not contain the previous value before submission.
- First item's Remember button is the only focusable answer control.
- Tests scan rendered strings/attributes to ensure hidden current result does not leak.
- Tests pin zero-worth first item, prior/current chain, choice contents and keypad submission.

## Common Brain result redesign

Slice 37 also aligns `showBrainResult()` with Pocket Brain Lab.

Required result composition:

- paper result card within the existing dark Brain backdrop;
- original SVG stamp/medal, not emoji as the primary graphic;
- `score / total` largest;
- active time shown only when `res.ms > 0`;
- one paired phrase: `New best! / 新紀錄！` or `Nice work! / 做得好！`;
- if this result completed today's third brain game, show the existing star award through the outer app's established behavior; do not award from the result component;
- controls: `Again / 再一次` primary and `Done / 完成` secondary;
- no accuracy grade letter, full-screen confetti, brain-age number or comparison; a new best uses only the result stamp and success motif.

The result component remains owned by the outer app because persistence/daily progress is outside the Brain host. It consumes shared Brain CSS tokens.

## Platform hardening

### CSS/asset audit

- Merge duplicate primitives into the shared blocks without changing approved screenshots.
- No colour literal outside the token declaration block.
- No selector deeper than four class levels.
- No scene selector reaches into another scene.
- Remove no project file. Unused legacy inline Brain CSS remains in place with a comment pointing to the new files until Papa authorizes cleanup.
- All SVGs receive a consistent outline audit at reference size.
- All audio receives loudness/repetition review.

### Runtime audit

- One active Brain host maximum.
- One scheduler per round.
- One shared audio context maximum.
- No scene direct timers, frames, fetch, speech or storage.
- No Canvas loop.
- Every ResizeObserver, media listener and pointer capture is released.
- Background/resume does not replay a submit or success sound.
- Double tapping Again cannot create two rounds.

### Authoring documentation

`docs/brain-scene-authoring.md` MUST be a short operational checklist, not a second design bible. It links to the normative guidelines and covers:

1. add structured data without DOM;
2. create scene module with exact contract;
3. add loader;
4. use tokens/primitives;
5. add bilingual copy;
6. add asset provenance;
7. precache and bump service worker;
8. extend tests/check;
9. capture required screenshot states;
10. run tablet/offline/mute/reduced-motion verification.

## Verification

- Canvas pixel ratio is capped and stops drawing while hidden.
- Clock hand animation lands on the exact generated time.
- Word Memory study duration and grading are unchanged.
- Math Recall never asks for the current parcel when the core expects the previous one.
- Full daily-three flow works across a mix of generic and bespoke scenes.
- Mute, reduced motion, quitting, app background/resume and wifi-off reload pass for all nine.
- New kid-facing copy passes bilingual validation.
- `node scripts/check.mjs` passes.

Additional automated verification:

- 1000 seeded Crunch items have correct counts;
- Canvas layout determinism/bounds/no-overlap;
- Clock angle and time-rollover tests;
- Word Memory study/cover/input phase tests;
- Recall previous/current chain and hidden-value leak tests;
- all nine manifest/module ids align;
- all scene assets/audio are precached;
- direct forbidden APIs absent from all scene modules;
- all terminal paths leave zero scheduler/audio/observer resources;
- result Again/Done creates or closes exactly one round.

Final manual matrix:

- five required viewports × nine scenes for active layout;
- first/correct/corrective screenshot set for all scenes;
- compact and short landscape screenshot set for all scenes;
- normal and reduced motion;
- muted and audio-enabled;
- online install then offline reload;
- background/resume during study, active input and feedback;
- real coarse-pointer tablet run of one complete daily three;
- 30-second idle observation per scene confirms no continuous animation/CPU loop.

## DONE WHEN

All nine Brain Gym exercises have a coherent Pocket Brain Lab identity, each retains its specified interaction, all shared resources tear down cleanly, and the generic renderer is retained only as a safety fallback rather than the normal path, with:

- exact compliance with each scene specification and the normative bible;
- complete automated/offline/responsive/accessibility verification;
- approved result-card styling;
- documented asset provenance;
- final screenshot set approved by Papa;
- no open art-direction or technical decision delegated to the implementation agent.
