# Slice 02 — 2.5D dungeon crawler presentation

Status: **implemented in patch v0.2.0**.

## Visual decision

Code Quest is not presented as a top-down tactical grid. The model remains grid-based for deterministic programming, but the child sees an **angled side / three-quarter pixel dungeon diorama**.

The floor recedes into depth, walls rise vertically, the foreground boundary is cut away, and sprites are large enough to read on a tablet. The hidden grid is an implementation coordinate system, not part of the fantasy presentation.

## Architecture

```text
CodeQuestModel snapshot
        ↓
dungeon-view.js
  projection / depth sorting
  cutaway walls / lighting
  visual interpolation / FX
        ↓
pixel-art.js
  named sprite frames + icons
```

Rules do not depend on sprite size, camera coordinates or DOM state.

## Dungeon state added in this slice

Map tokens:

- `K` key
- `D` locked door
- `^` active floor trap

New action:

- `disarm`

`open` now operates on a closed chest or a locked door directly ahead. Opening a locked door consumes one key.

New conditions:

- `doorAhead`
- `trapAhead`
- `hasKey`

New objective dimensions:

- `collectAllKeys`
- `unlockAllDoors`
- `disarmAllTraps`

Enemies path around closed doors. Active traps damage the hero when entered. Disarmed traps remain visible but safe.

## Content

Three authored Clockwork Crypt quests extend the original twelve:

| Quest | Main concept | Par |
|---|---|---:|
| q13 Key Crypt | state + keyed lock | 5 |
| q14 Spike Logic | IF + hazard sensor | 5 |
| q15 Dungeon Algorithm | composition across dungeon systems | 14 |

Infinite Tower now has five deterministic template families, including traps and key/door rooms.

## Renderer behavior

- canvas internal size: 480×270
- fixed Pixel Planet palette
- no external network art dependency
- depth-sorted vertical entities
- raised wall cubes with low foreground cutaway
- back-wall dungeon masonry and torch light
- hero movement interpolation between logical tiles
- attack / open / trap FX
- large 3× pixel sprites for actors where room width permits
- canvas remains a pure projection of a model snapshot

## Debugging / programming UX

The currently executed action card (including nested cards where a UID is retained) receives an execution highlight while Run/Step proceeds. This ties the visible sprite action to the program instruction and preserves the "debugger as play" principle.

## Validation

- all 15 authored reference programs solve;
- exact par block counts match every reference;
- Infinite Tower floors 1–200 solve deterministically;
- renderer smoke test exercises q15 snapshot + movement interpolation against a no-op Canvas 2D test context;
- installer passes clean install and v0.1 safe-upgrade/idempotency tests.

Full DOM/PWA/Android acceptance remains a host-repo/device gate after patch application.
