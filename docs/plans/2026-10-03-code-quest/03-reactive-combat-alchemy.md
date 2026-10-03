# Code Quest RPG v0.3 — Reactive Combat & Alchemy

## Goal

Make the programming loop behave like a real dungeon crawler instead of a sequence of static coding puzzles. The same learner-authored turn program can now be rerun after the dungeon changes, and live conditions read new enemy intent, armor, poison and hero status.

## Reactive combat model

New enemy families:

- **Bulwark** — armor can fully stop a normal low-damage attack. `Heavy Attack` ignores armor and deals weapon damage + 1.
- **Venom Viper** — melee damage can apply poison. Poison ticks after the dungeon turn until it expires or an antidote clears it.
- **Archer** — at range it first publishes `intent: shot`; on its next dungeon turn it fires. That one-turn telegraph is intentionally visible and queryable by the program.

New actions:

- `hero.heavyAttack()`
- `hero.guard()`
- `hero.useAntidote()`
- `hero.useWard()`

New conditions:

- `hero.seesArmoredEnemyAhead()`
- `hero.seesWeakEnemyAhead()`
- `hero.seesIncomingDanger()`
- `hero.isPoisoned()`

The AST remains bounded and deterministic. There is still no `eval()` or learner-controlled arbitrary JavaScript execution.

## Turn-program pattern

v0.3 reference quests introduce a persistent routine pattern. A child can make:

```js
if (hero.seesIncomingDanger()) {
  hero.guard();
}

if (hero.seesArmoredEnemyAhead()) {
  hero.heavyAttack();
}

if (hero.seesEnemyAhead()) {
  hero.attack();
}

hero.move();
```

The room changes after each dungeon turn, but the same program can be Run again. Because conditions are resolved lazily against live model state, the executed actions can differ each turn.

## Combat mitigation

Incoming damage is deterministic:

1. equipment defense;
2. temporary Guard;
3. active Ward;
4. remaining damage is applied to HP.

Guard expires after the dungeon turn. Ward lasts for bounded turns. Poison is separate damage and is not armor-mitigated.

## Persistent RPG loadout

Profile schema advances from v1 to v2 while reading v1 saves safely.

Slots:

- weapon
- armor
- charm

Initial equipment families now include:

- Training / Bronze / Clockwork blades
- Guard Cape
- Alchemist Apron
- Signal Charm

`combatStatsFor(profile)` is the only bridge from persistent equipment to the pure room model.

## Process-aware alchemy

Potion crafting now has two independent inputs:

1. an exact three-ingredient multiset;
2. an ordered preparation process.

Available lab operations:

- Grind
- Heat
- Stir
- Cool

Examples:

- Healing Potion: Sun Herb + Sun Herb + Water Crystal; **Grind → Stir**
- Antidote: Moon Berry + Moon Berry + Ember Root; **Grind → Heat → Stir**
- Ward Tonic: Ember Root + Water Crystal + Water Crystal; **Heat → Stir → Cool**

Wrong recipes or wrong process order consume nothing.

Practice quest consumables are tracked separately from persistent inventory. Practice stock is spent first. If a real inventory potion is used, the UI persists the decrement immediately. A potion brewed at camp is also made available to the current room immediately.

## Content

New Signal Bastion quests:

- q16 Armor Protocol
- q17 Venom Check
- q18 Read the Signal
- q19 Venom Patrol
- q20 Sentinel Engine

The Infinite Tower expands from five to eight room families and now includes armor, venom and telegraphed ranged danger.

## Rendering

The 2.5D angled dungeon diorama remains the visual contract. v0.3 adds:

- Bulwark, Viper and Archer pixel sprites
- armor badge
- incoming-shot telegraph
- Guard shield state
- poison particles/status state
- Ward ring
- antidote / ward / armor / charm item sprites

No gameplay state is owned by the renderer.

## Validation target

- all 20 authored quest reference programs solve;
- exact par counts match the real AST block counter;
- Infinite Tower floors 1–320 solve deterministically;
- armor/Heavy Attack semantics tested;
- Archer telegraph → Guard response tested across turns;
- Venom → poison tick → antidote tested;
- v1 save migration to profile v2 tested;
- process-aware alchemy consumes nothing on failure;
- renderer covers new enemy/status visual states;
- clean install and untouched v0.2 → v0.3 upgrade both remain idempotent.
