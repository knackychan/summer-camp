# Summer Quest Android shell — root runtime recovery

This folder is the native boundary for the Summer Quest Android tablet app. The product runtime remains TypeScript/web-based; native Android code stays deliberately thin and exposes only device capabilities.

## Stable native stack

The shell remains pinned to Capacitor **8.5.2**. The isolated Android package is deliberate: the root web project can keep running and testing without an Android toolchain.

## First-time development-machine setup

Requirements:

- Node 22.18–26 (recovery verified on Node 26.2.0; CI uses Node 24)
- JDK 21–24 (JDK 25 is not compatible with the pinned Gradle 8.14.3 wrapper)
- Android Studio / Android SDK platform 36
- Android SDK Platform Tools (`adb`)
- network access for the first `npm install` / Gradle dependency resolution

From the repository root:

```sh
npm ci
npm --prefix apps/android ci
npm run android:bootstrap
npm run android:doctor:strict
```

`android:bootstrap` builds the bundled web runtime, creates the Capacitor Android project when absent, syncs it, and reapplies the checked-in bounded native overlay.

The generated `apps/android/android/` project and local `.reports/` are workstation artifacts and are intentionally not release-authoritative source. Recreate them from the checked-in config/overlay/scripts.

The root lock owns TypeScript 5.9.3 and Three.js 0.185.1. The Android lock owns
Capacitor 8.5.2; doctor checks the generated Gradle 8.14.3 / AGP 8.13.0 versions.
JDK 21 and SDK platform 36 were verified during recovery. Gradle uses the same
resolved JDK as doctor, including when the path contains spaces.

`build:android-web` compiles the retained learning/agent/storage/core modules and
copies the root app, parent admin, books, and assets. Historical shell modules and
development entries are excluded. `verify:android-web` checks source coverage in
both directions, byte equality, local imports, book images, and the tree digest.
Every native sync runs the same verification on actual `assets/public`; Capacitor's
generated Cordova bridge files are the only native-only exceptions. Config is the
local ignored `js/config.js` when present, otherwise a deterministic offline stub.
The two builds match when their source and browser-config inputs match.
Web build metadata identifies `v0.6.2-recovery`. Fresh Capacitor templates still
use native `versionName "1.0"` / `versionCode 1`; these debug builds validate
packaging. Set a compatible native upgrade version after inspecting the installed
tablet package. Recovery does not install, uninstall, or clear that app.

## Routine build flow

After normal web changes:

```sh
npm run android:sync
npm run android:build:debug
```

The debug build command runs a fresh web/Capacitor sync by default, invokes the generated Gradle wrapper with `assembleDebug`, locates the resulting APK, prints its SHA-256 and writes:

`apps/android/.reports/build-debug.json`

Other supported build gates:

```sh
npm run android:build:release-apk
npm run android:build:release-bundle
```

The release scripts only build the Gradle artifacts. Signing/Play distribution credentials remain outside the repository.

## Connected tablet workflow

Enable Android Developer options + USB debugging and authorize the development computer, then:

```sh
npm run android:device
npm run android:install
npm run android:smoke
```

If more than one device/emulator is connected, call the underlying Android script with a serial:

```sh
npm --prefix apps/android run device -- status --serial <adb-serial>
npm --prefix apps/android run device -- install --serial <adb-serial>
npm --prefix apps/android run device -- smoke --serial <adb-serial>
```

The smoke command verifies process cold-start plus background/resume and stores a small relevant logcat excerpt. It **does not** toggle airplane mode, force rotation, change accessibility settings, or silently alter device state.

Complete `ACCEPTANCE-CHECKLIST.md` on the actual target tablet before declaring physical-device acceptance.

## Windows shortcuts

From Explorer or Command Prompt at the repository root:

- `BUILD-ANDROID-DEBUG.cmd`
- `INSTALL-ANDROID-DEBUG.cmd`
- `CHECK-ANDROID-DEVICE.cmd`

They call the same npm scripts; there is no separate Windows-only build logic.

## Offline model

The APK/AAB bundles `dist/android-web`. Startup therefore does **not** require the LAN server and does not depend on a Service Worker. The Android local Capacitor origin uses HTTPS semantics, while the bundled files remain local to the app.

`dist/android-web/index.html` is the real root Summer Quest app. The v0.5.8/v0.5.9 `legacy.html` + iframe compatibility layer has been removed because it created shell-inside-shell navigation recursion. Existing games, books, Music Room, activities and learning now run directly under their original root runtime.

No `js/config.js` is required. When the private config is absent, the Android build emits an empty local/offline stub and runs local/offline with remote AI disabled.

## Native bridge contract

`MainActivity` registers the deliberately small `SummerQuestNativePlugin` **before** Capacitor creates the bridge. `js/platform.js` obtains that plugin through Capacitor's injected runtime and wraps it as `window.SummerQuestNative`. The root app registers one `summerQuestBack()` handler; there is no iframe/parent Back proxy.

Capabilities:

- haptics: tap / success / warning;
- Android TextToSpeech;
- request/release game audio focus;
- lifecycle resume/pause events;
- audio focus gained/lost events;
- Android Back dispatch through the shared navigation stack.

There is **no** native grading, mastery, reward, curriculum, model routing, provider secret, notification scheduler, camera or microphone path.

## Bridge authority

Never move Quest, Learning Runtime, Student Model, reward, curriculum or agent rules into Java/Kotlin. Those remain shared TypeScript/domain packages.
