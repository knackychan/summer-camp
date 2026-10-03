# Code Quest v0.12 — Cooperative Algorithms & Safe Callbacks

## Goal

Make the second dungeon character programmable enough to teach coordination, handoff, shared state and event-driven thinking while keeping Code Quest deterministic, step-able, offline and safe.

## Learning progression

### q55 Twin Plates
Two characters move independently onto two simultaneous/live switches. Introduces the idea that one program can coordinate more than one actor.

### q56 Scout Circuit
A companion follows its own small route and interacts with a mechanism while the hero follows a separate route. Reusable companion routines become meaningful.

### q57 Rune Core Carry
The hero takes, carries and throws a physical Rune Core. Carry state and world-object state are visible and inspectable.

### q58 Core Relay
The hero throws a Rune Core to the companion. The companion picks it up, reorients, moves and places it on a live pressure plate. This is a concrete producer/consumer-style handoff without introducing concurrency races.

### q59 Danger Callback
Written code registers `on("danger", react)`. An Archer world turn emits `danger`; the callback executes through the same bounded interpreter before the following player planning turn. Teaches event-driven control after functions and state are already understood.

### q60 Twin Core Compiler
Combines cooperative movement, carrying, simultaneous switches, circuit state, gate traversal and boss combat into one larger algorithm.

## Runtime design

The map parser recognizes `o` as a Rune Core. A core has an id, logical coordinates, `heldBy` state and a bounded throw count. Carrying does not create a second inventory system: the object remains part of deterministic room state and follows its holder's logical position.

`livePlates: true` changes pressure plates from historical latch behavior to occupancy-derived state. Occupancy can come from hero, companion, push block or an on-floor Rune Core. Existing authored levels keep old latch semantics unless they opt in.

The companion gains its own direction and bounded actions. It remains a deterministic actor; no LLM or autonomous planner controls it.

## Safe callback design

The AST adds:

```js
{ type: "on", event: "danger", name: "react" }
```

The parser accepts only top-level:

```js
on("danger", react);
```

Supported events are a fixed allowlist. The handler must be an existing zero-argument function. The main program registers handlers; after a dungeon/world turn, the model derives event names from concrete world events/state and queues matching handlers. Each callback body runs in a fresh bounded `ProgramRunner` using the same tests/properties/actions as normal code. Finishing a callback does not cause another world turn.

This preserves:

- deterministic replay
- Run/Step observability
- instruction/call-depth limits
- no `eval()`
- no arbitrary host API access
- no background agent
- no unbounded callback loop

## Visual contract

Rune Cores use a dedicated pixel sprite. A floor core bobs above a ground rune; a carried core is drawn above the hero or companion sprite. All rendering remains in the angled side/three-quarter dungeon diorama.

## Release acceptance

- all 60 authored references solve at or under par
- Endless 1–1120 solver verification
- source round-trip coverage
- exact live-plate occupancy behavior
- core take/throw/handoff tests
- callback registration/execution/safety tests
- renderer coverage for Rune Core + companion room
- profile v10 migration
- clean install and untouched v0.11 upgrade
- conflict refusal for locally edited Code Quest files
