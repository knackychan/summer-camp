# Code Quest v0.10 — Physical Dungeon Systems

## Goal

Make Code Quest's angled pixel dungeon feel materially interactive. Programming should manipulate mechanisms in the room rather than only move a hero between combat positions.

The logical model stays deterministic and grid-based internally. The child sees a 2.5D dungeon diorama with animated physical state.

## New physical entities

### Lever

A lever is an adjacent interactable switch. `hero.interact()` activates it once. Activated switches contribute to the room circuit.

### Pressure plate

A plate activates automatically when the hero moves onto it. It remains active for the encounter and contributes to the circuit.

### Rune gate

A closed rune gate blocks hero/enemy movement. When `switchesActive >= switchesRequired`, gates open deterministically and cease blocking pathfinding.

### Breakable crate

An intact crate blocks movement. `hero.smash()` breaks an adjacent crate, after which the tile is traversable.

### Dungeon NPC

An unhelped NPC can intentionally occupy/block a corridor. `hero.interact()` marks the NPC helped and grants one bounded room-defined reward (`key`, `healing`, or `ward`).

### Stairs

Stairs are a second visible exit presentation. They use the normal deterministic exit objective but render distinctly from a portal.

## Safe programming API

```js
hero.interact();
hero.smash();

hero.seesLeverAhead();
hero.seesBreakableAhead();
hero.seesNpcAhead();
hero.seesRuneGateAhead();

hero.world.switchesActive
hero.world.switchesRequired
hero.world.gatesOpen
hero.world.cratesRemaining
hero.world.npcsHelped
```

All properties are read-only. No mutation syntax is added.

## Mechanism Depths curriculum

### q43 — Lever Circuit

First explicit lever. Activate the lever, observe the gate open, continue to the stairs.

### q44 — Pressure State

Introduces automatic pressure plates and comparison of `hero.world.switchesActive` with required circuit state.

### q45 — Break the Path

A crate blocks the corridor. Detect a breakable and smash it before movement can continue.

### q46 — Guide Protocol

Interact with a dungeon NPC to receive a key, then use the inherited door system.

### q47 — Mechanism Function

Build a reusable helper that handles lever/crate obstacles, connecting physical-world interaction with function abstraction.

### q48 — Circuit Guardian

Combined room:

1. activate lever;
2. step onto pressure plate;
3. open rune gate;
4. Circuit Guardian armor drops;
5. defeat boss;
6. reach stairs.

The room reads live switch counts rather than encoding the boss solution as a fixed sequence.

## Circuit Guardian

`Y` maps to the new Circuit Guardian enemy. Its mechanism armor remains while the room circuit is incomplete. `_refreshRuneGates()` also updates mechanism-boss armor, making the mechanism and combat systems one shared state transition.

## Expedition integration

Compiler Catacombs uses the same primitives:

- Gate Hall: lever + rune gate + combat + exit.
- Final sanctum: lever + plate + rune gate + mixed party + Circuit Guardian + exit.

This prevents the physical curriculum from becoming an isolated minigame.

## Rendering

`pixel-art.js` owns replaceable sprite frames for physical entities. `dungeon-view.js` owns projection/depth ordering/state presentation. The game model never depends on pixel coordinates or art assets.

New visual states include lever on/off, plate on/off, rune gate open/closed, crate intact/broken, NPC normal/helped, stairs and Circuit Guardian.

## Safety and bounds

- no `eval()` or `new Function()`;
- no browser/network API exposure;
- switch requirements are bounded room data;
- NPC rewards are from a fixed allowlist;
- physical objects are cloned from authored/generated room definitions;
- code can inspect physical state but cannot mutate object internals directly;
- normal interpreter instruction/call/repeat bounds continue to apply.

## Regression target

v0.10 must keep all previous Code Quest lessons solvable while adding q43–q48 and extending Endless verification to floor 800.
