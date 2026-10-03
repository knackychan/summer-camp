# Summer Quest v0.5.8 — Android Device Foundation validation

Date: 2026-09-30  
Baseline: v0.5.7 Tablet Runtime Hardening

## Scope validated

v0.5.8 adds a thin Android-native boundary while keeping the Summer Quest learning/runtime authority in shared web/TypeScript code.

- Capacitor packages are pinned to stable 8.5.2 in the isolated `apps/android` package.
- `dist/android-web` is a deterministic local bundle whose root is the modern kid shell.
- The historical root runtime is preserved as `legacy.html` for existing games/books/music.
- Missing private `js/config.js` produces a local/offline stub; startup does not require a provider key or LAN server.
- Android mode treats packaged assets as offline-ready and does not register the browser Service Worker.
- `MainActivity` registers `SummerQuestNativePlugin` before `BridgeActivity.onCreate()` constructs the bridge and loads the page.
- The native plugin is capability-only: haptics, Android TTS, audio focus and lifecycle events. Android Back enters the shared web navigation stack first.
- The legacy iframe proxies device capabilities through its same-origin parent and cannot replace the parent native Back handler.
- Haptics include an API 24–25 fallback that does not call the API-26-only `VibrationEffect` path.
- Native overlay permissions remain only INTERNET + VIBRATE; no camera, microphone, location, contacts or notification permission is introduced.

## Automated gates

### TypeScript/build

Passed:

```text
npm run typecheck:mobile
npm run build:mobile
npm run typecheck:agent
npm run build:agent
npm run build:android-web
```

The Android payload is deterministic at **278 payload files** with tree SHA-256:

```text
491861495b0313721b61edb41117ca610d75c44d18a97ae3cdc5a7f727a6ef55
```

### Android foundation

```text
npm run test:android-foundation
9/9 passed
```

Coverage includes stable dependency pins/config, bundle structure/hash, Android-vs-browser legacy URLs, Capacitor plugin registration, parent→legacy iframe capability proxying, typed PlatformService Back/audio behavior, native capability/permission boundaries, API 24–25 vibration safety and shared audio hooks.

### Audio / tablet / offline focused gates

```text
node --experimental-default-type=module --test scripts/music-audio.test.mjs
13/13 passed

npm run test:tablet-runtime
passed

npm run test:offline-shell
passed
```

### Full repository gate

```text
node --experimental-default-type=module --test scripts/*.test.mjs
327/327 passed
```

### Legacy checker comparison

`node scripts/check.mjs` exits 1 by design on both trees because of inherited findings.

```text
v0.5.7 baseline: 132 findings
v0.5.8 target:   132 findings
added:             0
removed:           0
```

## Toolchain / physical-device gate

This validation environment has Node 22 and Java 21, but it does **not** have:

- the pinned Capacitor npm packages installed;
- a generated `apps/android/android` project;
- Android SDK / Android Studio / adb.

`node apps/android/scripts/doctor.mjs` therefore reports:

```text
OK node22
MISSING capacitorInstalled
MISSING androidProject
MISSING androidSdk
```

Accordingly, **Gradle compilation, APK/AAB creation, emulator launch and physical-tablet installation are not claimed as passed here**. On an Android development machine, run:

```sh
cd apps/android
npm install
cd ../..
npm run android:bootstrap
npm run android:open
```

Then build/run from Android Studio or `npm --prefix apps/android run run` and perform the physical-device acceptance below.

## Remaining physical-device acceptance

1. Install on at least one Android tablet at API 24+ and one current Android tablet.
2. Cold-start in airplane mode; verify kid shell, local lessons and existing legacy activities start without LAN/server access.
3. Exercise Android Back from child shell and an embedded legacy activity.
4. Background/foreground during Music Room playback; verify audio focus loss suspends and focus regain resumes only an already-unlocked audio context.
5. Verify tap/success/warning haptics on hardware with vibration and graceful false/no-op behavior on hardware without it.
6. Verify native TTS for English and Traditional Chinese on a device with those voices installed.
7. Rotate portrait/landscape and repeat the v0.5.7 tablet touch/runtime checks inside the native shell.

Those are hardware/toolchain acceptance items, not web-runtime blockers.
