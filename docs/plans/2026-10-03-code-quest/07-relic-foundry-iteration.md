# Code Quest v0.7 — Relic Foundry & Collection Iteration

## Goal
Connect RPG build strategy to real introductory collection programming without abandoning the deterministic AST/interpreter contract.

## Programming progression

v0.6 introduced a bounded active-enemy collection and fixed indexing. v0.7 introduces iteration:

```js
for (const foe of enemies) {
  hero.target(foe);
  hero.cast();
}
```

Each loop item is a sanitized read-only enemy record. Supported fields are bounded to the teaching API (`hp`, `maxHp`, `armor`, `distance`, `element`, `alive`, `weakTo`, `burning`, `frozen`). A record can be passed as a function argument and passed to `hero.target(foe)`; it cannot be mutated or used to access arbitrary data.

## Relic loot architecture

Generated gear is deterministic. The save stores seed+tier identity, while the runtime regenerates and validates base gear, rarity, affixes and bounded stats. Rarity controls affix count. Affixes remain slot-aware and feed the existing combat-stat aggregation rather than adding a parallel combat system.

Profile v5 adds:

- `lootGear` — up to 32 validated generated relics;
- `pendingLoot` — at most three current relic choices;
- loadout IDs may reference either built-in equipment or validated generated relic IDs.

## Relic Foundry curriculum

- q37 Relic Readout — read build properties.
- q38 For Each Foe — first `for...of` enemy loop.
- q39 Inspect Each — branch on per-enemy fields.
- q40 Affix Logic — use rarity/affix metadata as visible program state.
- q41 Party Function — pass a read-only enemy record into a reusable function.
- q42 Relic Hydra — use iteration and per-item state against a boss party.

## Boss design

Relic Hydra is a large pixel-art enemy with escort-linked armor. Its shielding weakens after the escort enemies are removed. This creates a concrete reason to iterate a party and choose target order.

## Endless mode

Endless generation grows from 10 to 12 room families. The new families exercise bounded collection iteration and the Relic Hydra. Every fifth floor can generate a deterministic three-way relic choice.

## Safety invariants

Still forbidden:

- `eval` / `new Function`;
- DOM, network, timers or browser globals;
- array mutation or arbitrary collection methods;
- dynamic object/property access;
- assignment mutation of enemy records;
- unbounded `while`/`for` loops;
- recursion;
- more than four active enemy records in a collection iteration.
