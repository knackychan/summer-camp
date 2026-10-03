# Code Quest v0.8 — Connected Dungeon Expedition

## Goal

Turn Code Quest from a sequence of isolated teaching encounters into a real dungeon-crawler run while preserving the single deterministic programming/RPG engine.

The expedition is not a second game. Combat rooms are ordinary `CodeQuestModel` levels and execute the same AST, parser, interpreter, combat rules, sprite renderer and equipment model as authored quests and Infinite Tower.

## Connected run graph

`run.js` owns a bounded deterministic graph:

- Gate Hall — combat
- Rune Fountain — event branch
- Ember Gallery — alternate combat branch
- Sentinel Crossing — elite
- Quiet Camp — rest branch
- Goblin Workshop — shop branch
- Relic Reliquary — treasure/temporary boon
- Compiler Sanctum — multi-stage boss

A successful route visits six rooms. Branches merge, so the child makes route/resource decisions without creating procedurally impossible topology.

## Persistent run state

Profile v6 can hold one validated `activeRun` containing only bounded data:

- deterministic seed
- current room and cleared route
- HP / max HP
- run coins
- run-only healing / antidote / ward / focus provisions
- temporary attack / spell / defense / max-HP boons
- bounded shop purchase flags
- event/treasure flags
- safe Code Quest source representing the current main program and function/Rune library

The saved source is reparsed through the normal safe parser on resume. No arbitrary executable closure or browser state is serialized.

## Program carryover

Starting an expedition clears the current program once. After that, room transitions use `startLevel(..., { preserveProgram:true })`.

On each completed combat room the exact safe source is saved into the run. Reopening Code Quest can therefore reconstruct the same program/functions from the parser and continue the expedition.

## Non-combat rooms

Non-combat rooms use the expedition dialog instead of creating a fake combat model.

### Rune Fountain

- heal 3 HP; or
- trade 1 HP for +1 spell power for the run.

### Quiet Camp

- restore to full HP; or
- prepare one extra run-only healing potion.

### Goblin Workshop

Spend run coins on bounded once-per-run purchases:

- healing potion
- ward tonic
- +1 melee attack forge upgrade

### Relic Reliquary

Choose one run-only boon:

- +1 melee attack
- +1 spell power
- +1 defense

## Combat persistence

Run consumables are injected as practice consumables, so using them never deletes the child's permanent crafted inventory. `completeCombatRoom()` captures the remaining run-only counts and HP after victory and carries them to the next room.

## Boss

Compiler Sanctum uses the existing Relic Hydra behavior as a multi-stage encounter:

1. escort enemies keep the boss armored;
2. after protection falls and HP decreases, the Hydra begins telegraphing ranged attacks;
3. the same carried program can react to changing enemy collection/state over multiple turns.

This reuses the existing party/target/element/iteration curriculum rather than hard-coding a new boss-only scripting system.

## Equipment circuits

v0.8 adds deterministic set IDs to compatible equipment and generated relics.

Two equipped pieces from the same circuit activate a bounded synergy:

- Ember Circuit: +1 spell power
- Frost Circuit: +1 range
- Aegis Circuit: +1 defense

Three matching pieces also grant +1 max HP. `hero.build.synergyCount` is available as a safe readable property.

Generated relic circuits are regenerated from seed+tier along with the rest of their validated stats.

## Save / upgrade

Code Quest profile schema: v6.

v1–v5 saves migrate through `normalizeProfile()`. Existing campaign progress, recipes, gear, relics, loadout and Infinite Tower state remain intact.

The patch installer accepts untouched v0.1–v0.7 Code Quest hashes, adds `run.js` to the offline app shell and bumps host cache naming to `codequest-v08`.

## Validation target

- all 42 authored quest reference programs
- Infinite Tower floors 1–640
- parser/AST round-trip coverage inherited from v0.7
- deterministic connected graph and routing constraints
- event/rest/shop/treasure choices
- run HP/provision/coin persistence
- safe run-code serialization/resume
- boss run solve
- profile v6 migration
- equipment circuit bonuses
- fresh-host installer simulation
- untouched v0.7 → v0.8 upgrade
- local-modification refusal
- renderer smoke with the expedition boss sanctum
