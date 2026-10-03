# Code Quest v0.9 — Algorithmic Expedition

## Goal

Turn the v0.8 connected expedition into a small searchable dungeon system where programming skill and route decisions persist across a run. The player should have a reason to explore, conserve resources and keep multiple reusable programs rather than treating the expedition as a fixed list of rooms.

## Non-goals

- No second combat engine.
- No unrestricted JavaScript.
- No dynamically trusted graph data from saves.
- No hidden background simulation.
- No procedural generation that can make the boss objective impossible.
- No replacement of the pixel-dungeon renderer.

## Deterministic run topology

A bounded seed selects one of three authored graph topologies: `alpha`, `beta`, or `gamma`. Each uses the same 13 canonical room IDs and room positions but varies the middle-layer connections.

The topology is regenerated from the seed rather than accepted as save authority.

Cleared rooms contribute their outgoing edges to a **frontier**. Unvisited branches remain available after the player explores a different branch. This changes the expedition from a single path into a bounded search problem while staying deterministic and easy to validate.

## Compiler sigils

The Root Compiler is sealed until the run has 3 compiler sigils.

Sigils can be obtained from several deterministic sources:

- Sentinel Stack elite
- Stabilizer Core
- Compiler Archive
- Guardian Fork elite
- Key Compiler
- expensive Patch Market purchase

This prevents one mandatory route while still requiring exploration/resource reasoning.

## Run hazards

One hazard is generated from the run seed:

### Memory Miasma
Lose 1 HP after each non-boss combat until stabilized. It cannot directly kill the hero outside combat; the drain bottoms at 1 HP.

### Static Noise
Effective expedition spell power is reduced by 1 until stabilized.

### Rust Protocol
Effective expedition melee power is reduced by 1 until stabilized.

The Stabilizer Core can remove the hazard for 4 run coins or 1 Ward. Stabilizing also awards a compiler sigil, making hazard removal a route/resource tradeoff rather than a free button.

## Elite modifiers

The two elite nodes receive deterministic modifiers from the run seed:

- armored
- venom
- ranged
- elemental

Their rooms are still standard `CodeQuestModel` encounters. The selected modifier only changes the authored encounter composition and objective text.

## Rune loadouts

A run stores three bounded source slots (`A`, `B`, `C`). Each slot contains at most 16,000 characters of restricted Code Quest source.

Saving a slot uses the normal AST → safe-source printer. Loading a slot replaces `activeRun.code`, then the root game reparses it with the normal safe parser. No executable closure or arbitrary JS value is serialized.

Combat code can also read bounded expedition state through `hero.run.sigils`, `hero.run.roomsCleared`, `hero.run.coins`, and `hero.run.hazardActive`. These values are copied from the normalized run into each combat level as read-only scalars; code cannot mutate the route or save.

This gives the dungeon crawler a practical reason to create different algorithms such as:

- general room clear
- armored/elite strategy
- boss/party strategy

without introducing separate scripting systems.

## Profile/run versions

- Code Quest profile: v7
- Connected expedition: run schema v2

Run-v1 migration preserves known v0.8 room IDs, cleared rooms, route history, HP, coins, provisions and boons. New deterministic fields are regenerated from the seed. Legacy sigil progress is inferred conservatively from room progress, with an explicit safeguard for a v0.8 run already standing at the old boss room.

## Acceptance

Pure-suite acceptance covers:

- 42 existing authored quests
- Infinite Tower 1–640
- 13-room graph contract
- seed-stable layout/hazard/modifiers
- frontier preservation
- sigil boss gate
- stabilization cost and hazard clear
- Rune loadout save/activate
- run-v1 migration
- profile v7 migration

Host acceptance additionally needs the actual Summer Quest palette/PWA/browser/Android environment.
