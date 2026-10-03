# Code Quest v0.4 — Abstraction Ladder + Safe Written Code

## Goal

Make the same dungeon-programming system usable from pre-reader play through genuine written programming without creating separate engines.

The authoritative execution path remains:

`picture cards → blocks → hybrid → restricted JavaScript parser → AST → deterministic interpreter → dungeon model`

The renderer, combat, inventory, loot and alchemy systems never execute source text directly.

## Abstraction ladder

### Explorer / picture cards

Default for the earliest progression. Actions are large sprite/glyph cards with sequence order as the primary concept. Logic controls are intentionally hidden in this presentation.

### Builder / blocks

The existing visual AST editor. Repeat and IF wrap selected adjacent blocks. Rune remains the first reusable-function surface.

### Coder / hybrid

The visual builder remains editable while a live read-only JavaScript mirror shows the exact equivalent source. This teaches correspondence before requiring typing.

### Architect / written code

Unlocked after 20 authored quests. A textarea accepts an intentionally small JavaScript subset and compiles it back to the same AST used by the visual modes.

## Accepted written subset

Actions:

```js
hero.move();
hero.turnLeft();
hero.turnRight();
hero.attack();
hero.heavyAttack();
hero.guard();
hero.open();
hero.disarm();
hero.usePotion();
hero.useAntidote();
hero.useWard();
hero.wait();
```

Sensors / state:

```js
hero.seesEnemyAhead()
hero.seesArmoredEnemyAhead()
hero.seesWeakEnemyAhead()
hero.seesIncomingDanger()
hero.isPoisoned()
hero.seesChestAhead()
hero.seesDoorAhead()
hero.seesTrapAhead()
hero.isBlockedAhead()
hero.isOnExit()
hero.keys > 0
hero.hp <= hero.maxHp / 2
```

Control structures:

```js
if (hero.seesEnemyAhead()) {
  hero.attack();
} else {
  hero.move();
}

repeat(3, () => {
  hero.move();
});

function strike() {
  repeat(2, () => {
    hero.attack();
  });
}

strike();
```

Functions are zero-argument in this milestone. Parameters/variables are intentionally reserved for a later curriculum expansion rather than being simulated badly.

## Safety model

There is no `eval`, `Function`, browser JavaScript execution, DOM access, network access or global-object access.

`parser.js` tokenizes and parses only the syntax listed above. Unknown symbols, methods, conditions, argument passing, assignment, arbitrary loops, computed properties and unknown functions are rejected with bounded line/column errors.

Existing AST bounds still apply after parsing:

- max nodes
- max AST depth
- repeat cap
- function cap
- interpreter instruction budget
- call-depth/recursion guard

## New authored region — Rune Scriptorium

- q21 **Read the Spell** — hybrid correspondence and a named `strike()` function.
- q22 **IF / ELSE Gate** — one reactive turn rule: attack if blocked by an enemy, otherwise move.
- q23 **Two Runes** — compose two named functions in one dungeon script.
- q24 **Dungeon Script** — functions + IF/ELSE + Repeat in a mixed armor/trap/chest room.

These quests remain representable as AST reference solutions so deterministic solver validation still covers the curriculum.

## Round-trip invariant

For every authored reference and every tested Infinite Tower floor:

1. Serialize AST with `toJavaScript()`.
2. Parse source with `parseJavaScript()`.
3. Serialize parsed AST again.
4. Require the source representation to remain semantically identical.
5. Solve the dungeon using only the parsed AST/functions.

The v0.4 automated suite applies this invariant to all 24 authored quests and Infinite Tower floors 1–320.

## Deferred intentionally

- function parameters
- user variables
- arrays/collections
- arithmetic beyond the fixed HP sensor
- `for` / `while`
- object creation/classes
- free-form JavaScript expressions
- user-defined methods

Those should be introduced only when the AST, static validation, debugger and child-facing curriculum are ready for them.
