# Summer Quest v0.6.1 — Miniature 3D World

Date: 2026-10-02
Baseline: v0.6.0 Unified Runtime Repair

## Product change

Hero selection now enters a real miniature 3D Summer Quest world inside the authoritative root runtime. This replaces the flat/prototype planet direction as the primary child exploration surface while preserving the v0.6.0 single-runtime architecture.

The world is a Three.js/WebGL scene using the repository's existing vendored Three.js 0.185.1 + OrbitControls. Children can drag to rotate/look around the island and pinch/zoom within bounded camera limits. The scene includes raised island terrain, water, plaza/pathing, trees, rocks, clouds, a child avatar, and distinct activity buildings/props.

## Registry-backed destinations

Main physical landmarks resolve through `SQContentRegistry`:

- Quests
- Games
- Activities
- Learning
- Books
- Music
- Today
- Rewards

Featured physical props also launch existing content directly:

- Monster Truck
- Solar System
- Space book
- Paint

No world item owns a second route or duplicate content implementation. `SQContentRegistry` remains the bridge into the real root runtime.

## Navigation

- Selecting a hero opens the 3D world by default.
- Content launched from the world records `world` as its return surface.
- Shared/Android Back returns games, books, music and activities to the world when they originated there.
- Opening a world section enters the existing Classic hub; Back returns to the world.
- `Classic menu` remains an explicit fallback.
- Android Back from the world returns to hero selection.
- No iframe, product shell or nested app host is introduced.

## Runtime/offline packaging

- Added `css/world-explorer.css`.
- Added `js/world/world-explorer.js`.
- Android web bundle now contains 279 files.
- Android bundle release metadata advances to `v0.6.1`.
- PWA cache name advances to `summer-quest-v111-miniature-world` and includes the world module/style.

## Validation changes

- Added `scripts/world-explorer.test.mjs`.
- Added `npm run test:world`.
- Added `scripts/check-world-explorer-ui.py` for rendered local/browser acceptance.
- Updated the physical Android checklist for camera, landmark, world-return, Classic-menu and rotation behavior.
- Updated existing offline/cache assertions for the v0.6.1 cache.

## Intentionally deferred

This is the first 3D-world vertical slice, not final art direction. It does not add NPC walking, character locomotion, decoration/unlock systems, day/night, world persistence across process death, or a custom 3D asset pipeline. Those should only follow physical tablet acceptance of interaction, readability and performance.
