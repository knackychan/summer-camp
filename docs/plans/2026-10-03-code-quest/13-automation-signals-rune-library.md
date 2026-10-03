# Code Quest v0.13 — Automation, Signals & Rune Library

## Goal

Extend Code Quest from local callbacks into bounded reusable automation. Hero and companion can exchange named signals, advanced rooms can react to those signals through the existing deterministic callback runner, and useful safe programs can be retained in a profile-level Rune Library.

The feature remains one engine: picture/block actions, written source, signals, callbacks, dungeon actions and persistent code all resolve through the existing AST/parser/interpreter contract. No JavaScript runtime, `eval`, network, DOM or hidden agent is introduced.

## Signal contract

Allowed channels are exactly:

- `ready`
- `help`
- `switch`
- `retreat`

Either actor may emit one:

```js
hero.signal("ready");
companion.signal("switch");
```

Written-code mode can react with the normal event registration form:

```js
function relay() {
  companion.move();
}

on("signal", relay);
hero.signal("ready");
```

The handler can read the most recent signal without mutating it:

```js
hero.signal.last
hero.signal.from
hero.signal.count
```

Signals are bounded actions. They do not cross into browser messaging, storage, networking or arbitrary event names.

## Signal Foundry curriculum

- q61 **Ping Gate** — send `ready` to open a signal-controlled gate.
- q62 **Answer Back** — register a signal handler that moves the companion.
- q63 **Two Watchers** — combine a signal handler with a danger handler.
- q64 **Companion Relay** — let the companion emit `switch`.
- q65 **Message Router** — branch on `hero.signal.last`.
- q66 **Automation Core** — combine persistent-handler architecture, signal reaction and danger reaction in one advanced room.

## Persistent Rune Library

Profile v11 owns four safe source slots. They are explicit user saves, not automatic opaque state. Each slot is reparsed through the same restricted Code Quest parser when loaded.

The library is available across campaign, Endless and expeditions, so children can keep useful routines instead of rebuilding them in every room.

## Persistent behavior source

A separate optional behavior source can store handler architecture. To save it as persistent behavior:

- parsing must succeed;
- every top-level executable node must be an `on(...)` registration;
- referenced functions remain normal bounded Code Quest functions;
- browser or arbitrary JavaScript remains unavailable.

Automatic behavior injection is intentionally limited to advanced event-capable campaign rooms (q59+), Endless and expeditions. It does not alter early sequencing/loop lessons when replayed.

## Bounds

- signal names are allow-listed;
- maximum eight signal actions within the normal program budget;
- maximum five distinct active handlers;
- handler functions are zero-argument;
- handler registration remains top-level;
- callbacks execute through `ProgramRunner`;
- signal state is read-only to child code;
- Rune Library has exactly four slots;
- persistent behavior is opt-in and can be disabled.

## Regression target

The v0.13 release verifies 66 authored quests and deterministic Infinite Tower floors 1–1280, plus signal parsing/round-trip, signal-gate behavior, profile v11 migration, Rune Library bounds and persistent behavior storage/toggle semantics.
