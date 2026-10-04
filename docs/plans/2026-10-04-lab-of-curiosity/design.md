# Code Quest — Laboratory of Curiosity

**Status:** approved by Papa, 2026-10-04 (chat: "yes go" on the design; follow-up the same turn: "make the ingredient for free for now" → D5).
**Game id:** `codequest` (the Lab is a view inside it, not a new registry game).
**Source:** `vision.md` in this folder (Papa's full vision doc + painted mock). This file holds the approved decisions; the vision is the long-range reference.
**Supersedes:** the "potion/Camp area deferred by Papa" note in `docs/plans/2026-10-03-code-quest-redesign/design.md` D3, and the Camp dialog's potion-bench section (`js/games/codequest.js` `campHTML`). Everything else in the Code Quest designs stays in force.

## Why

Today's potion bench is a list inside the Camp dialog: pick 3 bag ingredients, tap process steps, Brew. Only 4 exact recipes exist; anything else is "unknown recipe". It is a recipe screen. Papa's vision: a place where there is **always something interesting to try**, the room is the interface, failure is entertaining, and kids learn *rules* (properties combine) rather than memorising recipes — and later automate what they understand with code.

## Scope of this plan

The vision has nine phases (`vision.md` §39). This plan approves the **whole roadmap** at decision level, and slices **Phase 1 only** — the vertical slice of `vision.md` §29 plus moving the existing bench into it. Each later phase gets its own brainstorm and folder.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | **Full-screen view inside Code Quest.** A "Lab 實驗室" button in the Code Quest host bar (beside Map and Camp) swaps the dungeon stage for the lab scene; Back (‹ Dungeon) swaps back. Same `S.profile`, same save path. | Shares the Code Quest profile (ingredients, potions, recipes) with no cross-game coupling. Papa chose this over a separate registry door or a scene inside the Camp dialog. |
| D2 | **The Lab absorbs the bench.** The 4 recipes (`RECIPES` in `progression.js`) are brewed in the Lab and still put Healing / Focus / Antidote / Ward into the dungeon inventory exactly as today. The Camp dialog keeps relics, bag counts, potion stock and equipment; its bench, process, recipe list and potion-code sections move into the Lab. | One potion place, dungeon economy unchanged. Papa chose this over a sandbox beside the bench or a new economy. |
| D3 | **All code-drawn art.** Scene, props, creatures and FX are drawn in code on a canvas, Pixel Planet palette + the Code Quest ramp in `codequest/palette.js` (new indices appended after 41 only if a lab colour is missing — planet and dungeon indices unchanged). No image files. Integer device-pixel scale, same rule as `room-view.js`. | Papa's choice over a painted raster backdrop: consistent with the dungeon and D3 of the redesign; offline with no asset pipeline. Accepts less density than the mock. |
| D4 | **Resolver = rules over summed properties.** Each ingredient carries integer property points (0–3). A brew sums them, applies process modifiers, then walks one ordered data list of rules: authored specials first, systemic rules next (most specific first), fallbacks last. First match wins. Pure, deterministic. | Testable, predictable enough for kids to form hypotheses, and every rule is a Journal page — kids learn the rule. Rejected: float affinity math (opaque, hard to test or explain); pair/triple recipe table (combinatorial, fights "always something to try"). |
| D5 | **Ingredients are free for now** (Papa, 2026-10-04). Every shelf jar and every bag ingredient can be added without limit, and brewing one of the 4 dungeon potions does **not** consume bag ingredients. One switch, `LAB_FREE_INGREDIENTS = true` in `lab/ingredients.js`, controls it. When Papa flips it to `false`, the approved fallback applies: shelf stays free, a dungeon potion costs its bag ingredients as today, and with too little stock the reaction still plays as a *practice brew* and no potion is made. | Curiosity first; zero friction while the Lab is new. Side effect accepted "for now": dungeon potions become unlimited; the dungeon's own per-room consumable cap (9) still applies. |
| D6 | **No stars.** Reactions and Journal pages are the reward. Brewing a dungeon potion behaves as today (no stars there either). | Same as Pixel Planet toys (D8) and Brick Lab; free ingredients would make any star farmable. |
| D7 | **Sequence from day one.** An experiment = 1–4 ingredients in drop order + up to 5 process taps in order, from the 4 existing steps (`ALCHEMY_STEPS`: grind, heat, stir, cool) as workbench props: mortar, burner, spoon, frost plate. In Phase 1 a step applies to the whole mix. Per-ingredient states (crushed mushroom ≠ frozen mushroom) are Phase 2. | Keeps the `brewLab` step model, so the 4 recipes work unchanged; ordering is the first coding idea. |
| D8 | **Coach, not cop.** No "wrong", no red. A recipe mix with the wrong order still makes a real reaction plus an owl hint ("So close — the order matters…"). Unknown mixes always make *something* (smoke, bubbles, fizzle at minimum). Wording follows `vision.md` §34. | Project rule + vision §3.3. |
| D9 | **Engine untouched.** `model.js`, `interpreter.js`, `ast.js`, `parser.js`, `levels.js`, `run.js`, `loot.js` do not change. `progression.js`: `brewLab(raw, tray, steps, options = {})` gains `options.free` (skip the stock check and consumption; default behaviour unchanged) and the profile gains the additive `lab` field (D11). `alchemy-code.js`: `runAlchemyCode` passes the same `options` through. Nothing else in either file changes. | "Don't touch working gameplay"; the only gameplay-adjacent change is what D5 needs. |
| D10 | **Potion script stays.** The existing safe `bench.add(...)` script (unlocked after q26, `alchemy-code.js`) is reached from a scroll prop on the Lab workbench and opens in a sheet, same gating, same language. Under D5 it brews free too. | Existing feature; the Rune Automation Board (Phase 7) is its successor, not a replacement in Phase 1. |
| D11 | **Journal saved per kid** in the Code Quest profile: `lab: { found: [ruleId…], seen: [ingredientId…] }`, bounded (≤ 128 each), unknown ids dropped; saves without it get an empty `lab`. *Amended in slice 02:* the field is additive inside profile **v12**, no bump to v13 — `normalizeProfile` drops any save whose version it does not know, so a tablet still on an older cached build would wipe a v13 save, while it simply ignores an extra field. Potions pages reuse `discoveredRecipes`. Saved through the existing `saveProfile()` (settings), so it follows the kid like the rest of Code Quest progress. | One save path; no new storage key. |
| D12 | **One language at a time** — Code Quest's `settings.codequest.lang[kid]` switch applies in the Lab; every kid-facing string still ships EN + 繁體中文. Icon-first: ingredients, props and reactions are recognisable without reading; the owl's line is one short sentence. | Code Quest redesign D5; bilingual invariant. |
| D13 | **Offline and calm.** No network. Effects respect `prefers-reduced-motion` (no shake, no screen flashes; particles reduced). Sound uses the existing `ctx.sfx` hooks; per-family audio (vision §35) is a later phase. | Offline-first; kid tablets. |
| D14 | **Never delete.** The old Camp bench code paths are removed from the Camp dialog only when slice 04 moves them, and the bench actions stay working through the Lab. No plan, design or file is removed. | Project rule. |

## Ingredients (Phase 1)

Properties (integer points): **life, growth, fire, cold, water, echo, space, time, light, chaos**, plus **calm** (subtracts from chaos when computing instability).

| id | EN / 中文 | Where | life | grow | fire | cold | water | echo | space | time | light | chaos | calm |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `redMushroom` | Red Mushroom 紅蘑菇 | shelf | 1 | 2 | | | | | | | | 1 | |
| `echoCrystal` | Echo Crystal 回音水晶 | shelf | | | | | | 3 | 1 | | | | 1 |
| `emberSeed` | Ember Seed 餘燼種子 | shelf | | 1 | 3 | | | | | | | 1 | |
| `moonflower` | Moonflower 月光花 | shelf | 1 | | | | | | | | 2 | | 1 |
| `voidDust` | Void Dust 虛空塵 | shelf | | | | | | | 3 | 1 | | 2 | |
| `lifeSap` | Life Sap 生命樹液 | shelf | 3 | 1 | | | | | | | | | |
| `frostDew` | Frost Dew 霜露 | shelf | | | | 2 | 2 | | | | | | 1 |
| `starDust` | Star Dust 星塵 | shelf | | | 1 | | | | | 1 | 2 | 1 | |
| `sunHerb` | Sun Herb (existing label) | bag | 2 | | | | | | | | 1 | | |
| `moonBerry` | Moon Berry (existing label) | bag | 1 | | | | | | | | | | 2 |
| `waterCrystal` | Water Crystal (existing label) | bag | | | | | 2 | 1 | | | | | 1 |
| `emberRoot` | Ember Root (existing label) | bag | | 1 | 2 | | | | | | | | |

Process modifiers on the summed mix: each **heat** +1 fire and +1 chaos; each **cool** +1 cold and +1 calm; each **grind** +1 chaos; **stir** ×2 or more +1 calm. Instability = chaos − calm.

Numbers are starting values; slice 01 may tune them, but only together with its reachability test (every rule reachable, specials not shadowed).

## Rules (Phase 1, checked in this order)

| # | id | Family | When | Scene effect (slice 05) |
|---|---|---|---|---|
| — | *recipe* | potion | mix is exactly a `RECIPES` multiset **and** steps equal its process | potion rises and bottles; stock +1 |
| 1 | `pocketUniverse` | reality (special) | mix contains moonflower + echoCrystal + voidDust | tiny galaxy swirls above the cauldron |
| 2 | `explosion` | instability | instability ≥ 5 | harmless BOOM, soot puff on the owl, cat leaps |
| 3 | `temporalRupture` | time | time ≥ 2 | last-dropped ingredient flies back into its jar |
| 4 | `singularity` | space | space ≥ 3 and fire + light ≥ 2 | small dark orb; jars wobble toward it |
| 5 | `monstrosity` | creature | echo ≥ 2, life ≥ 3, growth ≥ 1 | a cute blob hops out and bounces on the bench until Clear |
| 6 | `duplication` | replication | echo ≥ 2 and life + growth ≥ 2 | the organic ingredient pops out as 2 → 4 → 8 copies |
| 7 | `overgrowth` | biological | growth ≥ 3, life ≥ 2, water ≥ 1 | vines climb the shelf |
| 8 | `fireball` | elemental | fire ≥ 4 | fireball arcs across the room |
| 9 | `iceBurst` | elemental | cold ≥ 3 | frost crackles over the cauldron rim |
| 10 | `glow` | light | light ≥ 3 | the room brightens, moon pulses |
| 11 | `steam` | elemental | fire ≥ 1 and water ≥ 1 | big steam cloud |
| 12 | `bubbles` | fallback | water ≥ 1 | bubbles float up and pop |
| 13 | `smoke` | fallback | fire ≥ 1 | smoke ring |
| 14 | `fizzle` | fallback | anything else | fizzle, owl blinks |

A recipe mix whose steps differ runs the rule list as usual and adds the owl's order hint. Intensity (1–3) scales the effect from how far the deciding value passes its threshold (e.g. duplication count, fireball size).

## Screen

```
┌ ‹ Dungeon ───────────────────────── 📖 · EN/中 · ❚❚ ┐  host bar
│ [moon window]          [shelf: 8 jars, 2 rows]       │
│ 🦉 owl on books  ┌─bubble─┐                          │
│ 📖 Journal        [  cauldron on burner  ]   🐈 cat  │  scene (code-drawn)
│ 📜 script   [mortar] [spoon] [frost plate]           │
│ bag: ☀ 🫐 💧 🔥   (counts hidden while D5 is on)     │
├──────────────────────────────────────────────────────┤
│ cauldron: [🍄][💎][ ][ ]   steps: 1 heat 2 stir   ↶ ✕ │ ▶ Brew
└──────────────────────────────────────────────────────┘
```

- **Add:** drag a jar or bag item onto the cauldron, or tap it (it lifts, the cauldron pulses) then tap the cauldron. Tapping the cauldron with nothing selected does nothing harmful.
- **Process:** tap mortar / burner / spoon / frost plate → the step is appended (the prop animates).
- **Strip:** cauldron slots + numbered step trail; tap a slot to take it out; ↶ undoes the last step; ✕ clears the experiment and its scene effects.
- **Live hint while adding:** cauldron liquid tints toward the largest property; it shakes when instability ≥ 3; it hums (brief sparkle) when the mix already satisfies a rule the kid has found before.
- **Brew:** the effect plays in the room (≤ 3 s, the lab stays visible, no modal); the owl says one line; a newly found rule shows a small "New page! 新的一頁！" tag on the Journal book.
- **Journal:** tapping the book opens a half-height page sheet (lab still visible above). Pages: Reactions (found rules as icon formulas + one sentence), Potions (4 recipes, filled as discovered), Ingredients (property icons revealed once an ingredient has been in a reaction), and greyed "???" outlines for unfound rules.
- Tablet-first: targets ≥ 48 px, no hover, no page scroll in landscape.

## Units (`js/games/codequest/lab/`)

| File | Purpose | Depends on |
|---|---|---|
| `ingredients.js` | ingredient data, property list, `LAB_FREE_INGREDIENTS` | — |
| `rules.js` | ordered rule list (data + predicate) | — |
| `resolve.js` | `resolveExperiment({ ingredients, steps, recipes, foundRules })` → `{ kind, ruleId?, potionId?, family, intensity, hint?, sums }`; `mixHint(ingredients, steps)` for the live tint/shake | ingredients, rules |
| `journal.js` | `normalizeLab`, `recordFound`, `recordSeen` (pure profile helpers) | ingredients, rules |
| `lab-art.js` | code-drawn scene, prop and creature sprites | `palette.js` |
| `lab-view.js` | `drawLab(ctx, state)` — scene + active effect, returns hit rects for props/jars/cauldron | lab-art |
| `lab-screen.js` | DOM + input controller: mount/unmount, drag/tap, strip, Journal sheet, brew flow (calls `resolve` then `brewLab(..., { free })`) | everything above, `progression.js`, `strings.js` |

`codequest.js` only adds the Lab button, the view swap and the Camp-dialog trim. `strings.js` gains a `LAB` block (all EN + 中文).

## Roadmap (later phases — each its own brainstorm + folder)

| Phase | Content | Coding idea |
|---|---|---|
| 2 | Per-ingredient states (crushed, frozen, heated) via processing *before* the cauldron | state |
| 3 | Scene ingredients: candle flame, moonlight, feather, drip water dragged from the room | — |
| 4 | Lasting world consequences; creatures kept as collectibles (link to companion) | — |
| 5 | Scale (quantity), crystal resonator, containment jar | variables |
| 6 | Abstract ingredients, space-time phenomena, rare events (vision §15–16) | events |
| 7 | Rune Automation Board: WHEN / IF / REPEAT / UNTIL over lab steps, successor of the potion script | conditions, loops, functions |
| 8 | Camp / Quest integration: found ingredients from the dungeon, crafted exploration tools | — |
| — | Revisit D5 (free ingredients) once Phase 8 gives the bag a purpose again | — |

## Slices (Phase 1)

- `01-resolver.md` — D4, D7, D8 data + pure resolver + tests
- `02-journal-save.md` — D9 (`brewLab` options), D11 journal field
- `03-scene-art.md` — D3 scene, props, idle life
- `04-lab-screen.md` — D1, D2, D5, D10, D12 view swap, input, brew flow, Camp trim
- `05-reaction-fx.md` — every rule's scene effect, D13
- `06-journal-book.md` — Journal sheet
- `07-device-check.md` — browser harness, Android 8 / Chrome 138, polish

## Not in this plan

Per-ingredient states, scene-dragged ingredients, scale/resonator/containment, persistent world changes, collectible creatures, the Rune Automation Board, dungeon-found new ingredients, per-family audio, stars.
