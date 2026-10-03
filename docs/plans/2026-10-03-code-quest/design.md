# Code Quest RPG — approved design

**Approved by Papa:** 2026-10-03 (chat)  
**Implementation baseline in this patch:** v0.2.0  
**Game id:** `codequest`  
**Target:** Summer Quest registry game, Android/tablet, offline-first, vanilla ES modules

## Product decision

Code Quest is a turn-based pixel-art RPG in which programming is the player's action system. It is not a worksheet, typing drill, or robot-grid side activity.

The game grows through four abstraction surfaces over **one shared AST and one deterministic interpreter**:

1. **Action cards** — large icon/sprite cards; suitable for early/non-readers.
2. **Logic blocks** — Repeat, IF, sensors and reusable function cards.
3. **Hybrid code** — the visual program and generated JavaScript are shown together.
4. **Restricted written JavaScript** — later slice; parses into the same AST. No `eval()`.

v0.2 implements surfaces 1–2 and a read-only canonical JavaScript **Code Bridge** for surface 3. The typed editor/parser is intentionally deferred; the runtime architecture already supports it without replacing the RPG model.

## Language decision

The eventual written language is **JavaScript**.

Rationale:

- Summer Quest already runs in JavaScript in the browser.
- Object/method syntax maps naturally to RPG concepts (`hero.move()`, `hero.attack()`, `hero.hp`).
- A small safe teaching subset can be parsed into the same AST as visual cards.
- The interpreter can pause after each instruction for Run/Step debugging.
- No extra offline runtime is required.
- The game never executes arbitrary user JavaScript. No `eval`, `Function`, DOM, network, filesystem, or ambient globals are exposed.

## Visual decision — 2.5D pixel dungeon / sprites

Code Quest must look like it belongs next to Pixel Planet and Kitchen Quest.

- The presentation is an **angled side / three-quarter dungeon diorama**, not a top-down board.
- The logical grid is hidden implementation state used for deterministic programming and pathfinding.
- Floor depth, raised walls, foreground cutaways and depth-sorted sprites create the dungeon-crawler view.
- Canvas 2D, integer coordinates, `imageSmoothingEnabled = false`.
- Pixel Planet's existing fixed palette via `js/world/planet-palette.js`.
- No CDN or external sprite files in this slice.
- Character and item art is represented as **named code-defined sprite frames**, not one-off vector drawings.
- Hero animation states: `idle`, `walk-1`, `walk-2`, `attack`, `hurt`, with visual movement interpolation in v0.2.
- Enemy sprites: slime, goblin, golem.
- Interactive sprites: closed/open chest, key, locked/open door, active/disarmed trap, exit rune, potion, ingredients, weapons.
- The render API consumes only model snapshots. Model code never knows sprite dimensions or DOM state.
- Final production sprite sheets can replace frame definitions later without changing combat/program logic.

## Core turn loop

1. Observe the room.
2. Build a short program.
3. Run it or step one instruction at a time.
4. The matching hero sprite action plays while the instruction executes.
5. When the whole program ends, enemies/world get one deterministic turn.
6. Review the result, change the program, and run again.
7. Complete the room objective and collect persistent RPG rewards.

This makes the debugger part of play rather than a separate developer tool.

## Capability ladder

Capability, not age, controls abstraction. Approximate age fit is only a design guide.

| Stage | Approx. fit | Programming concepts | RPG expression |
|---|---:|---|---|
| Explorer | 4–5 | sequence, direction, cause/effect | Move, turn, open, simple attack |
| Builder | 5–7 | repeat, IF, sensors, state | combat loops, chest logic, HP logic |
| Coder | 7–9 | functions, decomposition, reuse | build a Rune routine and call it repeatedly |
| Architect | 9–10+ | variables, collections, algorithms, typed JS | advanced tactics, inventory APIs, generated tower problems |

The visual mode remains a valid way to play even after higher abstractions unlock.

## v0.2 curriculum ladder

| Quest | Region | Concept | Required construct | Par blocks |
|---|---|---|---|---:|
| q01 First Rune | Trail of Steps | sequencing | — | 3 |
| q02 Turn the Corner | Trail of Steps | direction | — | 5 |
| q03 Treasure Tap | Trail of Steps | explicit action | — | 3 |
| q04 Slime Scout | Trail of Steps | combat action | — | 2 |
| q05 Echo Hall | Echo Caves | repetition | Repeat | 2 |
| q06 Treasure Rhythm | Echo Caves | loop + action | Repeat | 3 |
| q07 Look Before You Strike | Gatewood | conditional | IF | 4 |
| q08 Goblin Chest | Gatewood | combat loop | Repeat | 4 |
| q09 Potion Logic | Gatewood | condition + state | IF | 4 |
| q10 Function Forge | Function Forge | reusable function | Call Rune | 5 |
| q11 Reusable Strike | Function Forge | decomposition/reuse | Call Rune | 5 |
| q12 Loop Golem | Function Forge | composition | Call + Repeat | 7 |
| q13 Key Crypt | Clockwork Crypt | state + keyed lock | Repeat | 5 |
| q14 Spike Logic | Clockwork Crypt | hazard condition | IF | 5 |
| q15 Dungeon Algorithm | Clockwork Crypt | dungeon composition | Repeat + IF | 14 |

After eight authored clears, the initial **Infinite Tower** becomes available. Its rooms are deterministic generated templates with solver-verified reference programs.

## Program representation

All programming surfaces emit the same AST.

```js
[
  { type: "repeat", times: 2, body: [
    { type: "action", op: "move" }
  ]},
  { type: "if", test: "enemyAhead", then: [
    { type: "action", op: "attack" }
  ], else: [] },
  { type: "call", name: "rune" }
]
```

Supported atomic actions:

- `move`
- `turnLeft`
- `turnRight`
- `attack`
- `open`
- `disarm`
- `usePotion`
- `wait`

Supported conditions:

- `enemyAhead`
- `chestAhead`
- `doorAhead`
- `trapAhead`
- `blockedAhead`
- `hasKey`
- `hpLow`
- `onExit`

Structural nodes:

- `repeat(times, body)`
- `if(test, then, else)`
- `call(name)`

Function definitions are separate AST programs. v0.1 exposes one learner-owned reusable function named `rune`.

## Interpreter safety

`codequest/interpreter.js` is deterministic and DOM-free.

Bounds:

- AST node count
- AST nesting depth
- repeat count
- function count
- call depth
- execution instruction budget

Recursive self-calls halt safely. Unsupported/malformed saved program data is normalized away. The interpreter receives only a `test(condition)` capability from the room model.

## RPG model

The pure `CodeQuestModel` owns:

- rectangular tile room
- walls
- hero position/direction/HP/practice potions
- enemies and HP
- chests/open state
- exit
- turn phase
- deterministic enemy movement/attack
- objective completion
- run statistics

No DOM, host state, localStorage, timers, audio or sprites exist in the model.

### Combat

- Attack targets the tile directly in front of the hero.
- Equipment supplies attack damage.
- Enemies take their world turn only after the child's complete program ends.
- Enemy pathing uses deterministic bounded BFS.
- A hero reaching zero HP enters a friendly `resting` state. Resetting the room is invited; there is no punishment or negative ledger.

### Objectives

Composable objective flags currently support:

- reach exit
- defeat all enemies
- open all chests
- finish above a minimum HP threshold

## Persistent RPG progression

Saved per kid through `ctx.settings.codequest.profiles[kid]` + `ctx.saveSettings()` only.

Profile includes:

- completed authored quests
- best block count per quest
- ingredient inventory
- potion inventory
- owned equipment
- equipped weapon
- discovered potion recipes
- Infinite Tower best floor
- bounded loot count

The game never writes stars. Best score is sent only through `ctx.finish({score})`.

### Equipment v0.1

- Training Blade — 1 damage
- Bronze Blade — 2 damage
- Clockwork Blade — 3 damage

### Potion bench v0.1

Camp contains a real touch-first potion bench.

- Ingredient cards can be **dragged** into the cauldron.
- Every drag interaction also has a **tap-to-place** path.
- Exactly three ingredients form a brew.
- Unknown mixtures do not consume ingredients.
- Authored quest rewards supply ingredients.

Recipes:

- Healing Potion = Sun Herb + Sun Herb + Water Crystal
- Focus Potion = Moon Berry + Sun Herb + Water Crystal

The bench/progression system is deliberately separate from room combat so later crafting depth (preparation, heat, stirring, catalysts, status effects, programmable brewing) can expand without rewriting the interpreter.

## Infinite Tower v0.2

The tower is not unconstrained random generation. It cycles deterministic room templates keyed by floor number.

Each generated level includes:

- fixed objective
- bounded program budget
- concept requirement where applicable
- reference AST
- exact par block count
- deterministic reward

The unit test verifies floors 1–120. The generator can be expanded with additional templates while retaining the same solver gate.

## Level data format

```js
{
  id: "q08",
  region,
  title: ["Goblin Chest", "哥布林寶箱"],
  concept: ["Combat loop", "戰鬥迴圈"],
  objectiveText: ["...", "..."],
  map: [
    "#######",
    "#HGC..#",
    "#.....#",
    "#######"
  ],
  heroDir: "E",
  heroHp: 5,
  practicePotions: 0,
  objective: { defeatAll: true, openAllChests: true },
  available: {
    actions: ["move", "turnLeft", "turnRight", "attack", "open"],
    logic: ["repeat2", "repeat3", "ifEnemy", "ifChest"]
  },
  requires: ["repeat"],
  maxBlocks: 6,
  parBlocks: 4,
  reward: {
    equipment: "bronzeBlade",
    ingredients: { waterCrystal: 1 },
    lootFound: 3
  },
  reference: {
    main: [/* AST */],
    functions: {}
  }
}
```

Map symbols:

- `#` wall
- `H` hero
- `E` exit
- `S` slime
- `G` goblin
- `O` golem
- `C` chest
- `.` floor

## UI editor decision

The first visual editor avoids fragile nested drag-and-drop.

1. Tap action cards to append them.
2. Tap one or more adjacent cards in the program to select them.
3. Tap Repeat or IF to wrap the selected cards into a structural block.
4. Reorder/remove top-level blocks with explicit touch buttons.
5. Build the Rune function in a separate tab.
6. Call Rune from the main program.
7. Code View renders canonical JavaScript from the same AST.

This is tablet-friendly, accessible without fine motor dragging, and still permits nested structures: build an inner structure first, select it, then wrap it again.

## Architecture / file ownership

```text
js/games/codequest.js              host glue + UI + lifecycle
js/games/codequest/ast.js          safe shared program representation
js/games/codequest/interpreter.js  deterministic step interpreter
js/games/codequest/model.js        pure RPG room/turn model
js/games/codequest/levels.js       authored levels + endless generator
js/games/codequest/progression.js  saved RPG profile + crafting/equipment
js/games/codequest/strings.js      bilingual UI strings
js/games/codequest/pixel-art.js    code-defined pixel sprites + renderer
css/codequest.css                  tablet/pixel UI
scripts/codequest.test.mjs         pure model/solver/progression tests
```

This module does not modify another game's source.

## Host integration

Registry metadata:

```js
{ id: "codequest", brain: false, keyboard: false, bestKey: "codequest", legacy: false,
  meta: { icon: "🧙", title: "Code Quest", tz: "程式冒險", blurb: "Program the hero · 編程闖關" } }
```

Every new runtime file and the CSS must be present in `sw.js` `APP_SHELL`, followed by a cache-name bump.

The supplied installer performs those two edits when their expected host structures are present and refuses unsafe overwrite conflicts unless explicitly forced.

## Deliberately deferred depth

The architecture is intended to continue much further. Future slices can add, without replacing v0.2:

- true nested block editor with branch editing and parameters
- multiple named functions and function arguments
- variables and local state
- programmable equipment/card APIs
- object properties/methods
- arrays/collections and `for...of`
- restricted JavaScript parser/editor
- synchronized block ↔ source highlighting
- richer enemy AI and status effects
- real multi-step alchemy: cut/crush/measure/heat/stir/bottle
- ingredient elemental synergies and reactions
- recipes as executable procedures/functions
- armor, charms, tools and equipment attributes
- randomized loot tables separated from curriculum unlocks
- shops/forge/camp upgrades
- more deterministic Infinite Tower templates + solver coverage
- concept bosses (Loop Golem, Gate Hydra, Function Dragon, Bug King)

The key invariant is unchanged: **every abstraction level controls the same RPG through the same AST/interpreter.**
