# Code Quest v0.14 — State Machines, Independent Behaviors & Message Protocols

## Release intent

v0.14 continues directly from the frozen v0.13 Code Quest patch. It is the final standalone, upgrade-safe Code Quest handoff before application to the authoritative Summer Quest repository; it does not create a parallel app, router, runtime, or coding engine. After host acceptance, development should continue from the integrated repository rather than a new standalone v0.15 patch.

The release turns the v0.13 signal/callback layer into a coherent cooperative-programming system with persistent actor state, independent Hero/Companion behaviors, a bounded FIFO mailbox, multi-room protocol puzzles, physical signal feedback, and a child-readable event debugger.

## 1. Restricted actor state instead of general mutation

v0.13 intentionally rejected assignment. v0.14 introduces only two assignable paths:

```js
hero.state = "attack";
companion.state = "regroup";
```

The allowed state values are:

```text
explore
defend
attack
regroup
wait
escape
```

Parser output uses a dedicated `state` AST node. The interpreter emits a deterministic state event, and the model applies that event to the selected actor.

No general assignment was opened. Code such as `hero.hp = 99`, arbitrary object mutation, variable reassignment, computed property writes, browser globals, `eval()` and `new Function()` remain rejected.

Actor state survives the normal:

```text
PROGRAM → WORLD TURN → PROGRAM
```

boundary, which makes finite-state behavior useful across repeated turns instead of being a one-shot syntax demonstration.

## 2. One interpreter, two independent persistent behaviors

Profile schema v12 stores separate bounded sources and enable flags for:

- Hero persistent behavior
- Companion persistent behavior

Each source is still handler-oriented: top-level executable nodes must be `on(...)` registrations, backed by safe named Code Quest functions.

The UI enforces ownership on newly saved behavior:

- Hero behavior may command Hero actions/state/signals.
- Companion behavior may command Companion actions/state/signals.

At runtime both behavior programs register their handlers into the same `CodeQuestModel` and execute through the same `ProgramRunner`. There are not two interpreters.

Persistent behaviors remain disabled in early curriculum rooms. Auto-loading is limited to:

- campaign q59+
- Endless
- expeditions

This keeps beginner sequencing/loop lessons isolated from advanced automation.

## 3. FIFO signal mailbox

The four v0.13 channels remain the only signal names:

```text
ready
help
switch
retreat
```

Each emitted signal creates a message record with a deterministic id, sender, receiver, channel and turn.

The mailbox is bounded to eight pending messages. When full, new messages are dropped deterministically and `messagesDropped` is incremented. There is no recursive or unbounded event delivery.

Messages are scheduled in FIFO order. Main-program signal handlers retain v0.13's global signal-event behavior. Actor-owned persistent handlers are mailbox-scoped: a Hero behavior consumes messages addressed to Hero, and a Companion behavior consumes messages addressed to Companion. Multiple matching handlers receive the same scheduled message in stable registration order, while delivery accounting records each message exactly once.

Readable properties now include:

```js
hero.signal.last
hero.signal.from
hero.signal.count
hero.signal.pending

companion.signal.last
companion.signal.from
companion.signal.count
companion.signal.pending
```

The previous v0.13 last-signal properties continue to work.

## 4. Signal-driven dungeon protocols

Rune gates can now require either:

- one legacy signal channel; or
- a bounded set of paired channels.

For example, a split-corridor gate can require both `switch` and `ready`. Received channels are tracked as deterministic model state, and the gate opens only after all required channels have been observed.

Signals are still model actions. They are not DOM events, `postMessage`, sockets, network requests, or arbitrary JavaScript callbacks.

## 5. Protocol Citadel campaign q67–q72

### q67 — Hero State

Introduces a persistent Hero finite state. The child explores once, switches to `attack`, then relies on that state on later turns to defeat a goblin.

### q68 — Companion State

Introduces independent Companion state. The Companion transitions from `wait` to `regroup`, and its later behavior branches on its own state.

### q69 — Message Queue

Sends `ready` followed by `switch`. A single `signal` handler executes twice, proving FIFO message ordering.

### q70 — Split Corridors

Hero and Companion occupy separated corridors. The Companion moves independently while a paired `switch` + `ready` protocol opens the Hero route.

### q71 — Remote Switch

The Hero cannot physically operate the lower-chamber mechanism. A signal callback causes the isolated Companion to interact with the lever, opening the remote gate.

### q72 — Dual Processor

A cooperative state-machine boss encounter combining:

- Hero and Companion state
- FIFO signals
- callbacks
- paired signal gates
- Companion movement/guarding
- ranged elemental combat
- repeated program cycles
- boss defeat and escape

The encounter remains an RPG fight rather than an abstract state diagram.

## 6. Event debugger and physical feedback

Advanced rooms expose a compact event debugger showing:

- current callback actor
- pending message queue
- pending callback queue
- recent bounded trace entries
- handler registration
- signal send/delivery
- state transition
- callback start/end
- actions
- world turns

The model retains only the latest 32 trace entries.

The renderer adds pixel-style signal pulse FX between actors/receivers and a small actor-state transition pulse. Rendering remains a projection of model state; it does not own gameplay logic.

## 7. Infinite Tower expansion

Endless generation expands from 28 to 32 deterministic encounter families.

The four new families exercise:

1. persistent Hero state
2. FIFO two-message handling
3. split actors + paired signal gate
4. remote Companion mechanism callback

Regression verification now covers floors 1–1536, including source round-trip and reference solving.

## 8. Profile schema v12 migration

`normalizeProfile()` accepts v1–v12.

A v11 profile migrates its former shared persistent behavior as follows:

- old `behaviorSource` → `companionBehaviorSource`
- old `behaviorEnabled` → `companionBehaviorEnabled`
- `heroBehaviorSource` starts empty
- `heroBehaviorEnabled` starts false
- four-slot Rune Library is preserved

Legacy `behaviorSource` / `behaviorEnabled` mirror fields remain available for older host/debug surfaces.

Campaign completion, best blocks, inventory, recipes, equipment, generated relics, Endless progress, expedition state and prior cooperative/callback data are preserved through the normal profile normalizer.

## 9. Safety and execution bounds

v0.14 keeps the existing restrictions and adds bounds for the new event system:

- no `eval()`
- no `new Function()`
- no arbitrary browser globals
- no arbitrary networking from player code
- no unrestricted loops
- no computed/dynamic object access
- no general assignment
- actor state values are allow-listed
- signal names are allow-listed
- mailbox max: 8 messages
- registered handlers max: 8
- callback queue max: 16
- event trace max: 32
- callbacks still execute with bounded `ProgramRunner` budgets

## 10. Release validation

The release regression suite validates:

- 72 authored quest reference solutions
- q67–q72 directly
- 32 Endless encounter families
- Infinite Tower floors 1–1536
- AST/source/parser round-trips
- dedicated state-node serialization/execution
- rejection of general mutation
- state persistence across turns
- Hero/Companion state isolation
- FIFO message ordering
- mailbox overflow bounds
- paired signal mechanisms
- cross-room remote callbacks
- independent Hero/Companion persistent behaviors through one runner
- v11 → v12 behavior migration
- four-slot Rune Library compatibility
- inherited callbacks/signals/cooperative systems
- 2.5D rendering of split actors, signal pulses and state FX
- installer fresh compatible-host install
- untouched v0.13 → v0.14 upgrade
- installer idempotency
- refusal to overwrite locally modified Code Quest files
- root module version
- forbidden execution-path scan

## 11. Host integration status

This patch is release-validated against its synthetic compatible-host fixtures and untouched v0.13 upgrade bytes.

Final browser/PWA/Android/tablet acceptance must still be performed after applying the patch to the user's actual authoritative current Summer Quest repository. That host has not been supplied in this session, so the patch intentionally does not mutate an unknown Summer Quest checkout.
