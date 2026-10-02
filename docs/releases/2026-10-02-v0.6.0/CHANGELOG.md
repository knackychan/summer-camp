# Summer Quest v0.6.0 — Unified Runtime Repair

## Changed

- Promoted root `index.html` back to the single authoritative Summer Quest runtime for web, PWA and Android.
- Removed the Android `legacy.html`/iframe host architecture that could recursively nest shells and duplicate navigation.
- Added `SQContentRegistry`, a normalized facade over the existing games, books, activities, Music Room and top-level sections for future exploration UIs.
- Added one root-owned Android Back path across books, music, activities, games and hub/root navigation.
- PWA manifest and Service Worker now start/fallback at root `index.html`; cache is `summer-quest-v110-unified-runtime`.
- Demoted `apps/kid` Planet UI to an explicit prototype/reference surface rather than product authority.
- Fixed Windows Capacitor bootstrap spawning on current Node, removed the TypeScript-only Capacitor config requirement, hardened SDK discovery/local.properties handling, and constrained the Gradle doctor to JDK 21–24.
- Local server primary tablet URL is now root `index.html` rather than `/apps/kid/`.

## Validation

- Full automated suite: 342/342 pass.
- `typecheck:mobile`: pass.
- `typecheck:agent`: pass.
- Android foundation: 8/8 pass.
- Android build/device acceptance: 11/11 pass.
- Unified runtime architecture: 5/5 pass.
- Offline shell and mobile architecture gates: pass.
- Legacy checker: 132 findings on v0.5.9 and v0.6.0; 0 added, 0 removed.
- Rendered Chromium click-through is not claimed in the hosted environment because local/file navigation is blocked by administrative browser policy.
- Physical repaired-APK tablet acceptance remains required.
