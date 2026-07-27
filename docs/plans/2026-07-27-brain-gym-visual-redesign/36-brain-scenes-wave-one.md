# Slice 36 — Brain scenes wave one

**Status:** proposed — requires approved pilot review  
**Depends on:** slices 34–35  
**Ships independently:** yes
**Normative reference:** `implementation-guidelines.md` and the adapter decisions accepted after slice 35

## Goal

Apply the proven scene contract to four exercises with different interaction needs.

## Games

- Calculations — Fruit Stand
- Sign Finder — Bridge Workshop
- Low to High — Lift Lobby
- Color Words — Paint Studio

## Scope

- Add one lazy-loaded scene adapter per game.
- Reuse scene primitives rather than copy animation code.
- Keep prompt generation and scoring in the pure data/core layers.
- Collapse first-item instructions after the interaction is learned.
- Preserve tot speech, no-clock behaviour and 56 px minimum targets.
- Add only the SFX needed by these scenes through the shared audio service.
- Keep the generic renderer available per game behind a development/fallback flag.

## Pilot review gate

Before editing a wave-one game:

1. Papa approves Change Maker's art direction, scene density, audio level and adapter behavior.
2. Any approved adapter adjustment is written into `implementation-guidelines.md`; do not keep it as an undocumented exception in `change.js`.
3. Run all slice-34/35 automated tests and `node scripts/check.mjs`.
4. Capture the approved Change Maker screenshots as the visual reference. Wave-one scenes must look like different stations made by the same illustrator.

If the pilot has not passed this gate, slice 36 does not start.

## Exact file plan

| File | Action |
|---|---|
| `js/brain-data.js` | add only structured presentation fields required below |
| `js/brain/scenes/index.js` | add `calc`, `signs`, `lowhigh`, `stroop` loaders |
| `js/brain/scenes/calc.js` | create Fruit Stand |
| `js/brain/scenes/signs.js` | create Bridge Workshop |
| `js/brain/scenes/lowhigh.js` | create Lift Lobby |
| `js/brain/scenes/stroop.js` | create Paint Studio |
| `css/brain-scenes.css` | add four namespaced scene blocks |
| `assets/brain/fruit-stand.svg` | create the four approved fruit/counting symbols not already in the shop sheet |
| `assets/brain/workshop.svg` | create non-text bridge/cart decorative symbols |
| `assets/brain/lift.svg` | create non-text lift decorative symbols |
| `assets/brain/paint-studio.svg` | create non-text palette/brush decorative symbols |
| `assets/audio/brain/*` | add only missing approved cues |
| tests/check/service worker | extend for four scenes and all assets; increment cache once |

Task-critical numerals, equations, operators and colour words remain DOM text. SVG sheets contain decoration and object silhouettes only.

## Shared wave-one rules

- Each scene sets its approved game accent; no per-question random palette.
- All four use the same common answer-button geometry and paper/outline/shadow language.
- No scene creates a continuous rAF loop.
- Intro art moves only before input is enabled.
- The host's active-time clock begins after entrance/study phases as specified per game.
- Correct feedback uses the shared success cue once plus one scene cue at most.
- Corrective feedback reveals the correct semantic answer without red or a negative sound.
- Scene-local mutable input state is reset in `present`, not recreated as ambient module state.
- Every scene must delegate malformed structured items to `generic.js`.

## Scene A — Calculations: Fruit Stand

### Identity and composition

- Scene class: `.brain-calc`.
- Accent: `--brain-calc`.
- Setting: a front-facing wooden fruit stand on a warm paper background.
- Required objects: striped canopy edge, two shallow produce crates, one central order card, answer area.
- Canopy is decorative and hidden on compact/short layouts.
- Order card carries the equation/task and is always the strongest object.
- No vendor character.

Tablet layout:

```text
fruit/group visualization (tot only) | order card/equation
answer choices or keypad across lower half
small empty basket at lower-right for success feedback
```

Mid/hard omit produce-group visualization and center the equation card. Do not render dozens of decorative fruit for two-digit arithmetic.

### Approved fruit set

The Fruit Stand uses this exact set. Reuse `apple` and `banana` from the approved `shop-products.svg`; `fruit-stand.svg` contains only the remaining four symbols. Do not draw alternate apples or bananas.

| id | English | Traditional Chinese | SVG source |
|---|---|---|---|
| `apple` | Apple | 蘋果 | `shop-products.svg` |
| `banana` | Banana | 香蕉 | `shop-products.svg` |
| `orange` | Orange | 柳橙 | `fruit-stand.svg` |
| `pear` | Pear | 梨子 | `fruit-stand.svg` |
| `berry` | Berry | 莓果 | `fruit-stand.svg` |
| `star-token` | Star | 星星 | `fruit-stand.svg` |

The `star-token` is a counting object, not a reward star; it uses calc accent, not ledger gold.

### Data changes

Tot calculation prompt adds:

```js
{
  type: "groups",
  objectId: "apple",
  groups: [3, 2],
  operator: "+",
  en: "3 + 2 = ?",
  zh: "3 + 2 = ?"
}
```

Keep `say`, `answer` and four numeric choices. The generic fallback may continue receiving a derived emoji/text representation until retired; do not remove fallback fields in this slice.

Mid/hard prompts gain the same explicit structure:

```js
{
  type: "equation",
  operands: [37, 18],
  operator: "+",
  en: "37 + 18 = ?",
  zh: "37 + 18 = ?"
}
```

The scene reads `operands` and `operator`; it MUST NOT parse localized prose.

### Interaction by tier

**Tot**

- Show two crates separated by a large `+`.
- Place `groups[0]` objects in the first crate and `groups[1]` in the second.
- Maximum five visible objects under current generator; no grouping badge.
- Four answer crates are native buttons in a 2 × 2 layout.
- Tapping an answer submits immediately.

**Mid/hard**

- Equation card uses 56–72 px tabular numerals.
- Use the shared numeric keypad layout `1 2 3 / 4 5 6 / 7 8 9 / delete 0 submit`.
- Current entry appears on the order card after `=`.
- Maximum entry length remains four characters.
- Do not add fruit manipulation, handwriting or operator entry.

### Motion/feedback

Present tot:

- crates fade in 180 ms;
- objects drop no more than 12 px with 40 ms stagger, total entrance under 320 ms;
- all fruit becomes still before input.

Correct:

- order card receives one `stamp` cue/animation;
- up to three representative fruit move 12 px into the basket over 320 ms;
- do not animate every object when groups grow in future.

Corrective:

- correct answer appears after `=` in hint colour;
- matching answer crate gets hint outline for 600 ms;
- fruit stays still.

### Accessibility/tests

- Hidden summary: “Three apples plus two apples / 三個蘋果加兩個蘋果”.
- Fruit is decorative to screen readers; equation is authoritative.
- Test group counts match generated operands.
- Test all four numeric choices are unique and include the answer.
- Test mid/hard input sends the exact typed string.

## Scene B — Sign Finder: Bridge Workshop

### Identity and composition

- Scene class: `.brain-signs`.
- Accent: `--brain-signs`.
- Setting: wooden bridge-building bench, front-facing.
- Equation sits on three structural blocks: left operand, operator gap, right operand; result appears on a destination sign.
- A perfectly horizontal bridge beam sits behind/below the equation.
- Operator choices are loose wooden tiles in one row (two choices) or 2 × 2 grid (three/four choices).
- A small unoccupied workshop cart is the only feedback prop.
- No construction worker character, tools moving in idle, sparks or hazard stripes.

### Data

Current prompt already exposes `a`, `b`, `r` and choices. Add:

```js
prompt: {
  type: "missing-sign",
  a,
  b,
  result: r,
  en: "...",
  zh: "..."
}
```

Do not parse `prompt.en`. Preserve old fields required by generic fallback.

### Interaction

- Operator gap is a 72 × 72 px recessed slot.
- Choice tiles use exact glyphs `+`, `−`, `×`, `÷`.
- First accepted tile tap submits the glyph.
- Do not allow drag in v1.
- Input locks immediately.
- Equation and bridge remain still while choosing.

### Motion/feedback

Present:

- equation blocks appear with one 180 ms fade;
- operator tiles move upward 8 px over 180 ms;
- active by 200 ms.

Correct:

- clone selected operator into slot over 180 ms;
- bridge beam settles from 2 degrees to 0 over 320 ms;
- cart rolls only 36 px across the bridge and stops;
- cues: `token-place`, then shared success.

Corrective:

- selected tile returns to normal;
- correct tile gets hint outline and a clone enters the slot;
- bridge settles without cart movement;
- no collapse, crack, falling object or error sound.

Reduced motion uses an immediate operator insertion and outline.

### Accessibility/tests

- Operator buttons announce “Plus / 加”, “Minus / 減”, “Times / 乘”, “Divide / 除”.
- Equation summary says “Which sign makes 2 question-mark 1 equal 3? / 哪個符號讓二問號一等於三？”
- Test each generated operation recomputes to result.
- Test choice glyph exactly matches `answer` encoding from `brain-data.js`; normalize Unicode minus once in data, not per scene.

## Scene C — Low to High: Lift Lobby

### Intentional interaction correction

The current generic renderer hides the original number cells and then shows answer buttons containing those same numbers, reducing the memory task to visible sorting. The redesigned scene MUST instead keep **positions** as the answer controls:

1. floor numbers appear on lift doors during study;
2. numbers disappear;
3. the child taps the closed doors in remembered low-to-high order;
4. the scene appends the hidden numeric value for each tapped position and submits the joined sequence.

The semantic answer remains the current `sorted.join(",")`; scoring/persistence do not change. This interaction correction is part of the proposal Papa approves before implementation.

### Identity and composition

- Scene class: `.brain-lowhigh`.
- Accent: `--brain-lowhigh`.
- Setting: calm lift lobby with one bank of numbered doors.
- Background has one floor directory silhouette and one overhead lamp; both become still before study begins.
- Door cards are identical except for displayed number during study.
- No moving people, alarms or urgency.

Door grid:

- 3 cells: 3 columns;
- 5 cells: 3 columns first row, 2 centered second row;
- 7 cells: 4 columns first row, 3 centered second row;
- compact width: maximum 3 columns;
- each door hit area minimum 72 × 88 px on tablet, 64 × 76 compact.

### Data

Add a stable positional id while generating:

```js
cells: [
  { id: "cell-0", n: 4 },
  { id: "cell-1", n: 1 },
  { id: "cell-2", n: 3 }
]
```

Position is array order; id is explicit for DOM/test clarity. Existing answer remains the ascending numeric sequence.

### Exact phases

```text
entrance     doors visible, numbers not yet counted toward study
study        numbers visible and scene completely still for flashMs
cover        numbers disappear; doors close/fade over 180 ms
active       closed doors show “?” and accept position taps
feedback     host evaluates only after every door is chosen
```

- `flashMs` begins only when every number is fully visible.
- The active-time clock does not include study/cover.
- During active phase, tapping a door adds a small ordinal badge `1`, `2`, …; it MUST NOT reveal the hidden number.
- Used doors disable but remain full opacity except for a subtle pressed inset.
- When all positions are selected, submit hidden values joined with commas.
- No undo: the current game commits each sequence. Adding undo would alter memory strategy and is out of scope.

### Feedback

Correct:

- doors reopen in chosen sequence with 80 ms stagger;
- numbers reappear;
- lift display moves upward through the values as static quick steps;
- one `lift-ding` at the end.

Corrective:

- all doors reopen together;
- show correct ascending order using small `1–N` badges plus original numbers;
- use hint outline, no shake/alarm.

Feedback duration hard cap remains 1200 ms; for seven doors use a total stagger compressed to fit.

### Accessibility/tests

- Study announcement uses only the existing paired instruction “Remember these numbers / 記住這些數字” at every tier. It MUST NOT enumerate the visible values because that changes the memory channel.
- Each closed door announces only “Door 1 / 第一扇門”, not its hidden value.
- After feedback, correct order can be announced.
- Fake-scheduler tests prove exposure equals `flashMs`.
- Test position-tap sequence maps to hidden values and submits the exact current answer format.
- Test no hidden number remains in accessible button labels during active phase.

## Scene D — Color Words: Paint Studio

### Identity and composition

- Scene class: `.brain-stroop`.
- Accent: `--brain-stroop`, used only for studio furniture and outlines.
- Setting: neutral cream easel, paper canvas and four paint pots.
- Task stimulus is centered on a clean white/paper canvas.
- Four paint-pot answer buttons sit below.
- Background palette/brush decoration is monochrome plum/paper so it cannot introduce competing red/blue/green/yellow regions.
- No rainbow background, coloured confetti or animated paint drips while active.

### Colour tokens

Use exactly:

```text
red    --brain-red
blue   --brain-blue
green  --brain-green
yellow --brain-yellow with plum outline
```

Do not use CSS named colours or current `COLORS` literals inside scene JavaScript. Move the bilingual colour labels/keys into one frozen table exported by `brain-data.js`; both generic and bespoke scenes consume it, and `check.mjs` validates the four exact keys.

### Interaction by tier

**Tot**

- Canvas shows one 140–180 px colour swatch with a non-animated irregular painted edge.
- No conflicting word.
- Paint pots display colour patch plus `Red 紅色`, etc.

**Mid**

- Canvas shows English conflict word in generated ink colour.
- Word size 56–72 px, 700 Fredoka.
- Instruction above stimulus: `INK colour / 看顏色`, shown on first item then collapses to a small fixed label.

**Hard**

- Same composition; generated word may be English or Chinese.
- Font size and weight do not change between languages.
- Do not translate or duplicate the conflict word; showing both would create a second stimulus.

First accepted paint-pot tap submits its colour key.

### Motion/feedback

Present:

- easel is already present from scene creation;
- new stimulus crossfades 120 ms with no position movement;
- paint pots never shuffle position between items: fixed order red, blue, green, yellow. Question choices remain shuffled in data for generic fallback, while the bespoke scene uses fixed motor positions to keep the task about inhibition rather than button search.

Correct:

- one brush-swish crosses below the word/swatch, never over it;
- selected paint pot gains success ring;
- no coloured particles.

Corrective:

- correct paint pot gets hint outline;
- a small fixed `INK / 顏色` pointer connects stimulus to correct pot after submission;
- conflict word remains visible in original ink colour;
- no recolouring of the word to match its text meaning.

### Accessibility/tests

- Paint pots have bilingual names.
- Stimulus accessible label for mid/hard says “Word [X], ink colour hidden until answered” only if announcing the ink would reveal the answer; do not expose `aria-label="blue"` on the stimulus before input.
- Tot swatch may announce the task prompt but not the answer colour.
- Test fixed paint-pot order.
- Test generated mid word and ink differ.
- Test hard accepts both language word sets.
- Test no scene decoration uses one of the four task-colour tokens outside answer pots/stimulus/feedback.

## Verification

- Existing deterministic round/core tests remain unchanged and pass.
- Per-scene contract tests cover mount, input, feedback and destroy.
- Low to High hides and reveals on exactly the generated `flashMs`.
- Stroop task-critical colour is never obscured by animation or theme.
- Calculations can be answered without manipulating fruit on tiers where speed is the task.
- All four work offline and with reduced motion.
- `node scripts/check.mjs` passes.

Additional shared verification:

- all four loader ids match module ids and `brain-data.GAMES`;
- no scene calls forbidden scheduling/audio/storage APIs;
- all assets are in `APP_SHELL`;
- fallback generic renderer still handles the new structured prompt shapes;
- quit during every study/present/feedback phase leaves zero resources;
- scene transitions do not add to active answer time;
- normal, mute and reduced-motion paths pass all five viewports;
- screenshots for first/active/correct/corrective/compact states are reviewed per scene.

## DONE WHEN

The four scenes feel distinct while round scoring, bests and daily-three progression remain compatible with the existing brain rules, and:

- each scene exactly follows its identity, layout, input and feedback specification above;
- Low to High's positional-memory interaction is explicitly accepted and tested;
- no implementer-selected palette, mascot, asset style or motion pattern has been introduced;
- all automated, offline, viewport, mute and reduced-motion checks pass;
- Papa approves the screenshot set before slice 37 starts.
