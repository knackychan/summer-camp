# Code Quest v0.11 — Environmental Logic & Companion Protocol

## Goal

Make the physical dungeon itself teach state machines and reactive programming. v0.11 keeps the existing angled 2.5D pixel presentation and safe AST/interpreter, but introduces mechanisms whose state changes over multiple world turns and a bounded companion that can be programmed through the same abstraction ladder.

## Curriculum: Logic Labyrinth

- **q49 Boolean Gate** — exact-two toggle circuit; demonstrates boolean state that can become true and later false.
- **q50 Clock Trap** — time-dependent state; the same IF/ELSE routine is rerun across alternating world turns.
- **q51 Push Compiler** — pushable world state and pressure-plate side effects.
- **q52 Moving Bridge** — reactive timing around a moving platform and impassable pit cells.
- **q53 Quest State** — NPC state machine plus collectible quest token and reusable route function.
- **q54 Companion Protocol** — companion follow/assist commands integrated with normal combat.

## Deterministic systems

### Boolean circuits

Circuit modes are bounded to `all`, `any`, `exact`, or `odd`. Toggle levers may deactivate, so a dynamic gate can close if the circuit falls out of the accepted state. No user code mutates gates directly.

### Clock traps

A room owns a two-phase deterministic clock. World-turn completion advances the phase. A cycle trap computes active/safe state from clock phase plus a bounded phase offset. Step execution remains deterministic and replayable.

### Push blocks

`hero.push()` only affects the single block directly ahead. The block must have a free destination; a successful push moves the hero into the block's old cell. Landing on a pressure plate activates the existing circuit logic.

### Moving platforms

Each platform has a small fixed path supplied by authored/generated content. Platforms advance once per world turn. A hero or companion standing on the platform is carried with it. Pits remain impassable unless a platform occupies the pit cell.

### NPC quest state

Quest NPCs use a bounded state machine: `idle → started → complete`. Tokens are deterministic room objects. Completing the quest grants only an authored bounded reward.

### Companion

The companion has no free-form AI. Its bounded modes/actions are:

- Follow: move to the hero's previous cell when the hero moves.
- Hold: remain at its current position.
- Guard: reduce one incoming hero hit by one point, then clear.
- Assist: attack the selected/nearest valid target within a small fixed range for bounded damage.

The companion is visible state, not a hidden background agent.

## Safe-code surface

Picture cards, blocks, hybrid code and restricted written JavaScript all target the same AST actions/conditions/properties. New written syntax remains parser-controlled; there is no `eval()`, browser access, network execution, arbitrary mutation or unbounded loop.

## Rendering

The 2.5D renderer adds dedicated pixel sprites for clock traps, push blocks, moving platforms, quest tokens and companion. Pit cells render as voids under the angled floor projection. All vertical objects/actors remain depth-sorted.

## Regression target

- 54 authored quests
- 960 Endless Tower floors
- AST/source/parser/solve round-trip across all authored/generated references
- profile schema v9
- safe upgrade from untouched v0.1–v0.10 Code Quest installations
