# Miniature 3D World — v0.6.1 design contract

The world is an **exploration surface over Summer Quest**, not a replacement app and not a menu disguised as a planet.

## Interaction contract

- World fills the child viewport after hero selection.
- Drag rotates/looks around using OrbitControls.
- Pinch changes camera distance inside bounded limits.
- A short tap raycasts physical scene objects.
- Selection only reveals the chosen destination; explicit GO performs navigation.
- No essential activity requires text labels to be permanently painted across the scene.
- Classic menu remains available for accessibility/fallback.

## Architecture contract

- Root `index.html` remains the sole app host.
- `SQContentRegistry` is the source of world destinations.
- Root/shared navigation owns content entry and Back behavior.
- Android/Capacitor provides device capability only.
- Never introduce an iframe, nested product shell, duplicate activity registry, or world-owned game implementation.

## Art direction

The v0.6.1 scene uses deliberately lightweight procedural low-poly geometry so interaction/performance can be validated before committing to a larger art pipeline. The target feeling is a small playful lived-in world: a compact island/planetoid with paths, vegetation, buildings and activity props that can be viewed from different angles rather than a static globe or card carousel.

Future visual iteration may replace procedural landmarks with authored GLB assets while preserving the same registry/navigation contract.
