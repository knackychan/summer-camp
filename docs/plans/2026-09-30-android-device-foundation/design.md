# v0.5.8 — Android Device Foundation

Date: 2026-09-30
Baseline: v0.5.7 Tablet Runtime Hardening

## Goal

Turn the existing tablet-first web runtime into a thin Android-native shell without moving learning, curriculum, grading, rewards, quest, or AI authority into native code.

## Product decisions

- Use stable Capacitor 8.5.2. Capacitor 9 is prerelease and is not a release dependency for this milestone.
- The native shell wraps the existing TypeScript/web child runtime. Kotlin/Java owns only device capabilities and lifecycle seams.
- Android bundled assets are the offline authority. The native shell does not depend on a Service Worker to restart offline.
- The Android entry surface is the current `apps/kid` shell. The legacy root app is packaged separately as `legacy.html` so embedded games/books/music continue to work without rewriting gameplay.
- Native Back first asks the shared `NavigationService` stack to go back. Only when the web stack cannot consume Back does Android leave the Activity.
- Haptics, TTS and audio focus are capabilities behind `PlatformService` / `SQPlatform`; feature code does not import Capacitor or Android SDK APIs directly.
- Native lifecycle/focus events may resume or suspend the already-existing shared WebAudio context. They cannot affect learning/mastery/reward state.
- No notification permission, background job, analytics SDK, account SDK, camera, microphone, or new network authority is added in v0.5.8.
- Provider secrets remain server-side. A native install with no `js/config.js` is a fully local/offline learning build; optional remote AI remains an explicit later configuration concern.

## Build model

1. Root `npm run build:android-web` compiles TypeScript and emits a deterministic `dist/android-web` bundle.
2. `dist/android-web/index.html` is the child shell adapted to the bundle root.
3. The historical root child/game host is emitted as `dist/android-web/legacy.html`.
4. `apps/android` is an isolated Capacitor package pinned to 8.5.2 and points at `../../dist/android-web`.
5. `npm --prefix apps/android run bootstrap` creates/syncs the Capacitor Android project on a development machine with npm + Android SDK, then reapplies the small Summer Quest native overlay.

## Native bridge

Android exposes only these bounded capabilities:

- tap/success/warning haptics;
- native TTS;
- request/release music/game audio focus;
- Activity lifecycle events (`resume` / `pause`);
- audio focus gained/lost events;
- Android Back dispatch.

The browser implementation remains no-op/fallback compatible.

## Acceptance

- Existing mobile/agent TypeScript builds and typechecks remain green.
- `build:android-web` creates a self-contained child-shell bundle with no dependency on the LAN server for app startup.
- The bundle contains `index.html`, `legacy.html`, compiled mobile modules, legacy JS, books/assets and an empty local config stub when no private config exists.
- Android mode disables Service Worker registration and marks bundled offline readiness directly.
- Android legacy activity URLs resolve to bundled `legacy.html`; browser/PWA URLs remain unchanged.
- Native Back can be consumed by the shared navigation stack.
- Shared WebAudio requests native audio focus on unlock, suspends on focus loss and resumes after native focus/lifecycle return.
- Native overlay contains no provider keys and requests only INTERNET + VIBRATE permissions.
- A structural Android foundation test passes without an Android SDK.
- If Android SDK/Gradle is absent in the validation environment, APK compilation is reported as pending hardware/toolchain validation, not claimed as passed.
- Existing automated suite stays green and `scripts/check.mjs` gains no new findings.
