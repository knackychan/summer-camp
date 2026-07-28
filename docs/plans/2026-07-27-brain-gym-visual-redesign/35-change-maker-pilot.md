# Slice 35 — Change Maker corner-shop pilot

**Status:** implemented 2026-07-28 — Change Maker ships as a real scene module (js/brain/scenes/change.js) using the pixel-art atlas already generated for the pilot (assets/brain/sprites/change.png; only "apple" has generated product art today, every other SHOP_PRODUCTS entry uses the documented CSS fallback card). Automated tests and `node scripts/check.mjs` are green. Still outstanding before this is the human-approved DONE WHEN: real-tablet screenshot review (tot/mid/hard active, correct, corrective, compact, short landscape), child/tablet observation, and Papa's sign-off gating slice 36.  
**Depends on:** slice 34  
**Ships independently:** yes; one redesigned Brain Gym game, eight generic games
**Normative reference:** `implementation-guidelines.md`; every visual and runtime rule applies

## Goal

Prove the scene architecture with the richest current exercise: a shop counter with a register, physical denominations, tactile sound and smooth feedback.

## Scope

- Add structured Change Maker item data: `price`, `paid`, `change`, and allowed denominations.
- Preserve the existing `tot`, `mid` and `hard` difficulty intent.
- Build the shop scene with DOM/SVG and CSS/Web Animations.
- Support tap-to-add, undo, clear and submit. Drag is deliberately deferred; do not implement it in this pilot.
- Animate item entry, drawer opening, denomination placement, receipt and next-customer transition.
- Add short offline SFX for register, coins/notes, receipt and success, all through the shared audio service.
- Add reduced-motion equivalents and a silent visual equivalent for every cue.
- Preserve numeric grading, round score, elapsed time and daily-three completion.

## Exact file plan

| File | Action | Purpose |
|---|---|---|
| `js/brain-data.js` | modify | structured money items and fixed bilingual product catalog |
| `js/brain/scenes/index.js` | modify | add the `change` lazy loader |
| `js/brain/scenes/change.js` | create | shop view model, DOM/SVG scene, interaction and feedback |
| `css/brain-scenes.css` | modify | namespaced `.brain-change__*` scene rules |
| `assets/brain/shop-products.svg` | create | original SVG symbol sheet for the ten approved products |
| `assets/audio/brain/*` | create/modify | only the approved Change Maker cues |
| `assets/audio/brain/README.md` | create | source/provenance, author, license and export settings |
| `scripts/core.test.mjs` | modify | money generator invariants |
| `scripts/brain-scenes.test.mjs` | modify | view model, denomination and scene-contract tests |
| `scripts/check.mjs` | modify | structured data, bilingual catalog, assets and cache coverage |
| `sw.js` | modify | precache scene, SVG and audio; increment cache |

No external asset download is accepted without Papa approving its license and repository provenance first.

## Visual specification

### Scene identity

- Scene class: `brain-round--change`.
- Accent: `--brain-change`.
- Stage surface: `--brain-paper`.
- Shop wall: `--brain-paper-2`.
- Counter: warm medium brown derived in CSS with `color-mix` from `--brain-paper-2` and `--brain-outline`; do not introduce another literal.
- Register body: `--brain-change`, outline `--brain-outline`, paper display.
- Cash drawer: dark shell with five or six clearly separated denomination wells.
- Customer: one neutral dark-plum bust silhouette at the right edge on tablet/wide layouts; hidden on compact and short landscape. No face, speech bubble or emotional animation.

### Required composition

The tablet layout uses this hierarchy:

```text
┌──────────────── common Brain header/status ────────────────┐
│  product + price card       register display      payment  │
│                                                            │
│  ┌──────── cash drawer: denomination buttons ───────────┐  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌──────────── change tray + running total ─────────────┐  │
│  └───────────────────────────────────────────────────────┘  │
│        Undo / 上一步   Clear tray / 清空托盤   Give change  │
└────────────────────────────────────────────────────────────┘
```

- Product/price, payment and tray total are the three strongest numbers.
- Product price is attached to the product card, not repeated in prose below.
- Payment is attached to the customer's note/coin group and labelled `Paid / 已付`.
- Tray total is labelled `Your change / 你找的錢`.
- Register display shows the subtraction `NT$50 − NT$37` on mid/hard; tot shows `Which is worth more? / 哪個比較多錢？`.
- The full prose prompt is available to screen readers and speech but is not repeated as a paragraph in the visual scene.

### Responsive rearrangement

**Compact**

1. product/price and paid token share one two-column summary row;
2. register display follows;
3. drawer uses two or three columns;
4. tray follows drawer;
5. three controls use a two-row grid: Undo + Clear, then full-width Give change.

**Ultra-narrow: width < 480 px**

1. product/price, paid token and register become three full-width rows in that order;
2. product art reduces to 42 × 58 px but task numerals stay at least 26 px;
3. drawer uses exactly two columns;
4. tray and controls remain full-width;
5. the common header hides only the blurb, never the bilingual game name or mute control.

**Tablet/wide**

- Summary area is a 12-column grid: product 4, register 4, payment/customer 4.
- Drawer spans 12 columns.
- Tray spans 8 columns and controls span 4 columns.

**Short landscape**

- Hide customer silhouette and awning/background shelf.
- Summary and drawer share the upper row.
- Tray and controls share the lower row.
- Keep 64 px denomination targets; reduce only gaps/decorative padding.

### Product art

The sprite contains exactly these ten original, outline-style symbols and data entries:

| id | English | Traditional Chinese |
|---|---|---|
| `apple` | Apple | 蘋果 |
| `banana` | Banana | 香蕉 |
| `juice` | Juice | 果汁 |
| `milk` | Milk | 牛奶 |
| `bread` | Bread | 麵包 |
| `pencil` | Pencil | 鉛筆 |
| `notebook` | Notebook | 筆記本 |
| `soap` | Soap | 肥皂 |
| `ball` | Ball | 球 |
| `flower` | Flower | 花 |

Art constraints:

- 64 × 64 reference symbols in one external SVG symbol sheet;
- 3 px plum outline, rounded joins/caps;
- maximum three flat fills per product;
- no text inside symbols;
- no faces on food or objects;
- product selection is visual-only and uses the item RNG supplied by the generator, not `Math.random`.

## Money token design

Use stylized educational tokens, not real currency reproductions.

| Value | Form | Base appearance | Required label |
|---|---|---|---|
| NT$1 | coin | small warm silver circle | `1` and `NT$` |
| NT$5 | coin | medium silver circle | `5` and `NT$` |
| NT$10 | coin | medium brass circle | `10` and `NT$` |
| NT$50 | coin | large brass circle with inner ring | `50` and `NT$` |
| NT$100 | note | green paper rectangle | `100` and `NT$` |
| NT$500 | note | violet paper rectangle | `500` and `NT$` |

- Values are DOM text layered over CSS/SVG shapes.
- Coin visual size varies slightly by denomination, but every hit target is 64 px.
- Value is never communicated by size/colour alone.
- Notes use an abstract star/leaf watermark only; no real portrait or seal.
- Drawer order is descending left-to-right on tablet and descending top-to-bottom by row on compact.
- Every denomination button announces “Add NT$10 / 加十元硬幣” or the correct coin/note wording.

## Structured data contract

### Product catalog

Add one frozen data table to `brain-data.js`:

```js
const SHOP_PRODUCTS = [
  { id: "apple", name: ["Apple", "蘋果"] },
  // exact remaining rows from the approved table above
];
```

Expose it through `SQBrainData` for checks/tests. Do not put scene colours or SVG paths in `brain-data.js`.

### Tot item

```js
{
  prompt: {
    type: "money",
    mode: "compare",
    coins: [1, 10],
    en: "Which is worth more?",
    zh: "哪個比較多錢？"
  },
  say: ["Which is worth more?", "哪個比較多錢？"],
  answer: "10",
  choices: ["1", "10"]
}
```

Rules:

- choose two distinct values from `[1, 5, 10, 50]`;
- shuffle visual order with the question RNG;
- larger numeric denomination is always the answer;
- do not ask about physical coin size.

### Mid/hard item

```js
{
  prompt: {
    type: "money",
    mode: "make-change",
    productId: "juice",
    productName: ["Juice", "果汁"],
    price: 37,
    paid: 50,
    change: 13,
    denominations: [50, 10, 5, 1],
    en: "Juice costs NT$37. You pay NT$50.",
    zh: "果汁 NT$37，你付 NT$50。"
  },
  say: [
    "Juice costs 37 dollars. You pay 50 dollars. Make the change.",
    "果汁三十七元，你付五十元，請找錢。"
  ],
  answer: "13"
}
```

Tier rules:

- `mid`: price 3–45; paid 50 or 100 and greater than price; drawer `[50, 10, 5, 1]`.
- `hard`: price 20–480; paid 500 or 1000 and greater than price; drawer `[500, 100, 50, 10, 5, 1]`.
- `prompt.denominations` contains the full tier drawer, not only the greedy solution.
- Generator retries if the greedy representation exceeds 14 pieces.
- `change === paid - price` is invariant.
- Every generated change is constructible from displayed denominations.
- Product names are generated from `SHOP_PRODUCTS` and always carry both languages.
- `moneyArt()` remains for the generic fallback until all clients use the structured scene; it is not removed.

## Scene-local model

Keep interaction data in a pure model helper exported for tests:

```js
createMoneyTray(denominations)
  .add(value)
  .undo()
  .clear()
  .total()
  .groups()
  .serialize()
```

Rules:

- invalid denomination additions are ignored;
- `undo` removes exactly the most recent accepted piece;
- `clear` empties history;
- `serialize()` returns the decimal total as a string for `ctx.submit`;
- groups are returned in drawer order with `count` and `subtotal`;
- no floating-point values;
- scene DOM is rendered from model state, never treated as the source of truth.

## Exact interaction

### Tot

1. Host presents two coin buttons centered with a minimum 24 px gap.
2. Bilingual prompt is spoken.
3. Coins remain still while active.
4. First accepted coin tap submits its string value.
5. Both coins disable immediately.
6. Correct coin lifts 6 px and gains success outline; corrective path outlines the correct coin in hint colour.
7. Next pair enters after host feedback.

Tot has no drawer, tray, running total, undo, clear, submit button, customer or clock.

### Mid/hard

1. Product card and payment slide/fade in during `present`.
2. Register display updates.
3. Drawer opens.
4. Scene becomes active; all ambient motion stops.
5. Denomination tap calls model `add` and animates a cloned token to its tray group.
6. Undo removes the most recent model piece and animates/fades one matching token out.
7. Clear empties all groups with one 180 ms fade; do not animate every piece home.
8. Give change submits `model.serialize()`.
9. Give change is disabled while tray is empty or input is locked.
10. Pressing Enter while focus is outside a denomination activates Give change; Space follows native focused-button behavior.

Do not auto-submit when the running total reaches the answer. The child explicitly gives the change.

### Tray rendering

- One group per used denomination.
- Show at most three overlapping physical token shapes per group.
- Counts above three display a `×N` badge.
- Group label shows subtotal only to screen readers; visual scene shows denomination and count.
- Running total updates instantly, with tabular numerals.
- No score, target-answer hint or “remaining amount” is visible while active.

## Animation timeline

All animation uses shared motion tokens.

### Present

```text
0 ms       old content cleared
0–180      product card fades/moves 12 px into place
80–260     payment fades/moves 12 px into place
140–460    drawer opens (scaleY/translateY; transform origin top)
460        input enabled; all scene motion stops
```

Reduced motion: product/payment 100 ms fade, drawer appears with no movement, active by 120 ms.

### Token placement

```text
0–120      source button press
0–320      cloned token follows one shallow arc using translate keyframes
240        model/tray group is already updated; clone merges visually
320        clone removed
```

Never animate the actual source button out of the drawer.

### Correct feedback

```text
0          input locked; success cue
0–180      tray outline becomes success
120–360    receipt rises 20 px from register
300–540    stamp lands once
420–640    tray tokens move/fade 18 px toward customer
640        feedback Promise resolves
```

### Corrective feedback

```text
0          input locked; no error sound
0–160      tray receives hint outline/emphasis
160–760    register shows “Count NT$13 / 數一數 NT$13”
160–760    correct total is represented by highlighted denomination groups
900        feedback Promise resolves
```

Do not show an angry customer, red total, lost coin or negative cash sound.

## Audio mapping

| Event | Cue | Rule |
|---|---|---|
| drawer presentation | `drawer-open` | once per mid/hard item |
| coin tap | denomination cue | rate variation from visual RNG, ±3% |
| note tap | `note-place` | one cue for both note values |
| undo/clear | `token-pick` | once, not per cleared piece |
| correct | host `success`, then scene `stamp` at 300 ms | exactly one shared success motif and one quiet stamp |
| round transition | `paper-slide` | low volume |

The host always owns the one shared `success` cue. Change Maker's `showFeedback` plays only `stamp` at 300 ms. Do not add a “success handled” adapter option.

## Accessibility behavior

- Hidden prompt summary contains product, price, paid amount and action in both languages.
- Running total is an `output`; announce it only after a 250 ms quiet period so rapid coin tapping does not flood speech.
- Denomination buttons remain labelled when disabled.
- Tray groups are a semantic list.
- Corrective announcement uses the approved “Count NT$X / 數一數 NT$X”.
- Focus remains on the last denomination after adding. After clear, focus moves to the first denomination. After present, focus is not forced away from a child already touching the screen.
- Tot speech does not depend on product vocabulary.

## Scene failure behavior

- Missing product SVG symbol falls back to a CSS product card with bilingual product name; play continues.
- Missing audio is silent.
- Invalid structured prompt delegates that item to `generic.js`; do not guess missing price/payment.
- Scene `destroy` releases pointer capture, cancels total-announcement delay and clears the tray model reference.

## Kid-facing copy

Every visible instruction and feedback string must ship EN + Traditional Chinese using Taiwan wording, including:

- “Give change / 找錢”
- “Undo / 上一步”
- “Clear tray / 清空托盤”
- “Count NT$13 / 數一數 NT$13”

## Verification

- Pure generator tests verify `paid > price`, `change === paid - price`, and allowed denominations can construct every generated answer.
- Tot never receives a clock or a reading-dependent instruction.
- Mid and hard can complete every item without keyboard input.
- Rapid tapping cannot duplicate or lose a submitted denomination.
- Quitting during every animation phase tears down cleanly.
- Scene works after an offline reload.
- Test on coarse pointer at the three target tablet sizes.
- `node scripts/check.mjs` passes.

Additional automated tests:

- product ids and names are unique and bilingual;
- every product id exists in the SVG symbol sheet;
- generated tot choices are distinct and answer is the larger value;
- 500 seeded mid and 500 seeded hard items satisfy all invariants;
- greedy piece count is at most 14;
- money-tray add/undo/clear/group/serialize operations;
- invalid denomination rejection;
- duplicate Give change submit ignored;
- host correct/corrective results do not mutate the item;
- only one success motif is played;
- destroyed scene leaves no scheduled total announcement or animation.

Required manual screenshot review:

- tot active pair;
- mid active with three denominations in the tray;
- hard active with grouped notes/coins;
- correct receipt/stamp state;
- corrective counting state;
- compact portrait and short landscape.

Required child/tablet observation:

- child identifies price, payment and their change without a verbal explanation from Papa;
- child discovers tap-to-add and Give change;
- no child expects to drag because the tokens visually behave as buttons;
- repeated coin sounds remain pleasant through a ten-item round;
- no accidental double-add occurs under rapid tapping.

Record observations in this slice before marking it done; do not redesign the adapter silently while implementing.

## DONE WHEN

Each child can understand the shop metaphor without a spoken explanation, complete a round using coins/notes, and return to the game later without leaked audio or animation, and:

- the exact art tokens, product catalog, token shapes and layouts above are used;
- tot/mid/hard follow their distinct interaction specifications;
- all seeded generator/model/host tests pass;
- all required screenshot states are reviewed;
- real-tablet offline, mute, background/resume and reduced-motion checks pass;
- Papa approves the implemented scene and adapter contract before slice 36 begins.
