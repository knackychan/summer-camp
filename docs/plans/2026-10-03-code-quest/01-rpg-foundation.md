# Slice 01 — Code Quest RPG foundation

Status: **implemented in patch v0.1.0** and retained unchanged as the foundation under v0.2.0. Final host acceptance still requires applying the patch to the authoritative Summer Quest repository and running its full gate/device checks.

## Dependencies

- registry game host / `ctx` contract
- `js/game-services/scheduler.js`
- `js/world/planet-palette.js`
- Games manifest
- service worker APP_SHELL

## Scope

- registry-native `codequest` game
- bilingual tablet UI
- pixel-sprite room renderer
- pure AST + deterministic interpreter
- Run + Step execution
- turn-based enemy phase
- movement, rotation, combat, chests, potions
- 12 authored foundation quests (v0.2 extends this to 15)
- Repeat / IF / reusable Rune function
- generated JavaScript preview
- saved profile, ingredient inventory, equipment
- draggable + tap-able potion bench
- deterministic Infinite Tower generator
- solver/reference solution gate
- lifecycle pause/teardown through scheduler

## DONE WHEN

- `node scripts/codequest.test.mjs` passes.
- every authored level reference solves and exactly matches its `parBlocks`.
- at least 120 generated Infinite Tower floors solve under the same pure model.
- Code Quest can lazy-load from the Games registry with no ambient app reads.
- every new runtime dependency is in `APP_SHELL` and the cache name is bumped.
- `stop()` removes listeners, dialog, drag ghost, frame/timer resources and stage class.
- every kid-facing UI string is paired English + Traditional Chinese.
- coarse-pointer controls are >=48 px except compact non-primary internal tool controls where layout requires smaller buttons.
- potion ingredients can be placed both by pointer drag and by tap.
- no stars/localStorage/network calls are introduced.
- authoritative repo passes `node scripts/check.mjs` after application.

## Current patch validation

- Pure Code Quest test suite passes locally.
- All 12 foundation reference programs solve; v0.2 extends the total authored solver gate to 15.
- Floors 1–120 of the original generator solve; v0.2 expands validation to floors 1–200 and five room families.
- Source syntax checks pass for all Code Quest ES modules.

Browser, offline-reload and physical Android tablet acceptance must be performed after applying to the full repo because the supplied reference archive does not include the authoritative host/index/service worker/browser harness.
