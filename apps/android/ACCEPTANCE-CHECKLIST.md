# Summer Quest Android physical-device acceptance — v0.6.3-desktop

This checklist is the release gate for a real Android tablet. Automated repository tests and ADB smoke checks do **not** replace it.

Target web baseline: `v0.6.3-desktop`. Installed native upgrade: `versionName 1.1` / `versionCode 2`.
Package: `com.summerquest.app`

## Current attempt — 2026-10-03

One authorized Samsung SM-X210 (Android 16/API 36, WebView 154.0.8037.57) was connected. The pre-update APK was saved privately in `.reports/installed-original.apk` (SHA-256 `388ba16b449dee66eebecf8e86f5a4c3c04acb38e092028aa2df6c25108501c0`). Its package was `com.summerquest.app`, native version `1.0`/code `1`, debug signer SHA-256 `6005bd04bfdc18516b032586c97db57fdd82011fafe65dcd49d056ec4ccb72a0`, and launch activity `.MainActivity`. Its bundled entry was root `index.html`, with no `legacy.html`; DevTools showed `https://localhost/`, the root scripts, a service worker controlling the page with cache `summer-quest-v137-codequest-v14`, and the root Adventure screen. No `LEGACY` badge appeared. The earlier reported selector/LEGACY installation is no longer present, so its original cause remains unverified.

The old app exposed `Capacitor.Plugins.SummerQuestNative`, but `SQPlatform.capabilities().native` was false because `js/platform.js` required the unavailable `Capacitor.registerPlugin` method. The shared adapter now accepts the injected plugin. The final APK (SHA-256 `232fb2fd439e9c02514e73061e5777409ecf1609b28c4b480e23e43287648c62`) retained package, signer, launch activity and `https://localhost` origin, and raised native version to `1.1`/code `2`. `adb install -r -t` succeeded without uninstall or data clear. DevTools then showed the root world, 511 bundled files, native bridge/audio-focus flags true, and cache `summer-quest-v142-brick-lab-01`. The existing service worker was left in place; no cache was deleted. A first ADB Back from Space exited the app despite the web handler returning true; AndroidX's Back dispatcher now routes the key to that handler. After rebuilding and reinstalling, ADB Back from Space returned to Pixel Planet, with the app still foregrounded.

Twenty-three `sq:` storage keys existed before and after the update. Hashes for child selection, PINs, saved world view and the 1,545-byte points queue were unchanged. `sq:hubTab` changed with navigation. The separate `sq:queue` changed from 105 bytes to `[]` after launch with configured sync; the pre-update contents were not captured, so server receipt of that operation is not independently established. Only key hashes and sizes are stored in ignored `.reports/`, not family values. The build used the current working tree and local `js/config.js`; there were unrelated uncommitted Origami/Code Quest changes, so the pushed source commit alone cannot reproduce the exact installed APK.

`npm run android:smoke` passed cold process start and background/resume, with no AndroidRuntime crash in its saved excerpt. Human touch, sound, TTS, offline airplane-mode, rotation, and full content checks still need owner observation; this is not a physical acceptance sign-off.

## Previous attempt — deferred, 2026-10-02

Branch: `fix/android-device-acceptance`, based on `eb2065b`. `adb devices -l` returned no devices. The user confirmed the tablet was removed and requested the physical pass later. Nothing was installed or launched, no settings/data/caches were changed, and no physical checks passed or failed. All hardware gates remain open. Earlier software validation is recorded in the [recovery results](../../docs/audits/SUMMER-QUEST-ARCHITECTURE-RECOVERY-RESULTS.md).

## 0. Preserve the existing installation before updating

- [x] Reconnect/unlock the tablet, enable USB debugging and accept this computer's trust prompt if required.
- [x] Identify the actual installed package, versionName/versionCode, signing certificate and launch activity; determine WebView debugging availability.
- [x] Capture the current entry URL/origin, loaded scripts/modules, bridge flag, service-worker/controller/cache identity and visible surface where accessible. Explicitly record inaccessible evidence.
- [x] Preserve the original APK and useful diagnostics in ignored `apps/android/.reports/`; compare its assets with the root build. Keep identifiers, credentials and family data out of commits.
- [ ] Establish the tablet's selector/LEGACY cause from device evidence, or record the remaining uncertainty.
- [x] Verify the candidate APK's package ID, compatible signing, versionCode and unchanged storage origin before installation. Stop if replacement requires data loss or incompatible signing.
- [ ] Record existing profiles, PIN behavior, progress, saved views and queued star operations privately for comparison. Never uninstall, clear app/browser data, reset profiles or delete caches to make acceptance pass.

## 1. Build provenance

- [x] Strict doctor passed as part of `android:build:debug` on the development machine.
- [x] `npm run android:build:debug` completes.
- [x] Record the APK SHA-256 printed by the build command.
- [x] `npm run android:install` installs the exact APK on the target tablet.
- [x] Device tooling reports the expected manufacturer/model, Android version/API level, display size and density.
- [x] Save `apps/android/.reports/build-debug.json` with the test notes.

## 2. Fully local / offline cold start

Do this manually so the tooling never changes the owner's connectivity settings behind their back.

1. Launch Summer Quest once after installation.
2. Close/force-stop Summer Quest.
3. Turn **Airplane mode ON** and confirm Wi-Fi/mobile data are unavailable.
4. Cold-launch Summer Quest from the Android launcher.

Acceptance:

- [ ] Authoritative Summer Quest root app opens without a LAN server.
- [ ] No blank page / connection error appears.
- [ ] Hero → **Pixel Planet** opens as the primary child surface (pixel globe on a starfield, crisp pixels, no blur).
- [ ] Drag spins the globe in any direction, a flick coasts, the planet rights itself; pinch zoom stays bounded (1×–2×) and springs back at the limits.
- [ ] Tap at least three places: the planet turns to centre each, the hero hops, the selection card updates with bilingual text.
- [ ] Tap at least five toys: each plays its animation + sound (silent with Sound off) + haptic, never opens content, never awards stars.
- [ ] Moon / whale / molehill / echo stone open a mini-game card; **GO** plays it in place; **Done 完成** and time-up (**Yay! 好棒！**, **OK 好**) both return to the planet.
- [ ] Frame pacing feels smooth while spinning and during a mini-game (note any stutter with device model).
- [ ] Use **GO** on a world destination and confirm it launches real root-runtime content.
- [ ] Open **Classic menu**, then Back, and confirm it returns to the same world instead of another shell.
- [ ] Games/Activities/Learning/Books/Music remain reachable from the world or Classic menu.
- [ ] Open at least one real game/activity.
- [ ] Open Reading World.
- [ ] Open Music Room and confirm bundled audio loads.
- [ ] Back from content launched in the world returns to the world successfully.
- [ ] Remote AI may be unavailable; local/offline learning must remain usable.

Turn Airplane mode back off after the test.

## 3. Android Back behavior

- [x] From Space launched from the planet, ADB system Back returned to the planet rather than closing the app.
- [ ] During a planet mini-game, Android Back ends the game and stays on the planet.
- [ ] From Classic menu opened from the world, Android Back returns to the world.
- [ ] From the world, Android Back may leave the app; hero switching uses the explicit Switch control (current world-first navigation design).
- [ ] Repeated content launches do not create nested shells, duplicate headers/back controls, blank frames or iframes.
- [ ] At the true root, system Back may leave/close the app normally.

## 4. Portrait / landscape / resizing

Test at least one full rotation cycle while each state is visible.

- [ ] Hero/world: portrait → landscape → portrait.
- [ ] Spin the planet before an orientation change and confirm it redraws at the new size with crisp pixels and the same pose.
- [ ] Books/Music/Games hub: portrait → landscape → portrait.
- [ ] One real game/activity: portrait → landscape → portrait.
- [ ] No clipped primary action or inaccessible navigation.
- [ ] Touch targets remain comfortably tappable.
- [ ] Current child/session/navigation state is retained after rotation.

## 5. Haptics + voice guidance

Use a 3–4-year-old profile or `?age=4` QA launch if needed.

- [ ] Tapping a supported root-runtime action produces the expected light haptic when the tablet supports vibration.
- [ ] Pre-reader voice guidance speaks the selected label through Android TTS.
- [ ] Missing/disabled TTS or vibration does not block navigation.
- [ ] No repeated/overlapping TTS loop occurs after rapid navigation.

## 6. Audio focus + lifecycle

- [ ] Start Music Room audio.
- [ ] Press Home: audio obeys lifecycle/focus behavior and does not become a stuck background loop.
- [ ] Play audio from another app, then return to Summer Quest.
- [ ] Summer Quest recovers cleanly after focus is regained.
- [ ] Lock/unlock the tablet once while Summer Quest is open and confirm audio/runtime recover.

## 7. Persistence / process death

- [ ] Select a child and navigate away from the root screen.
- [ ] Force-stop Summer Quest from Android settings or ADB.
- [ ] Relaunch the app.
- [ ] Child selection persists.
- [ ] No corrupted/blank shell appears.
- [ ] Local learning data present before the stop is still readable.

## 8. Automated ADB smoke after manual checks

Run:

```sh
npm run android:smoke
```

- [x] Cold process start reports OK.
- [x] Background/resume process reports OK.
- [x] Review the saved `.reports/device-smoke-*.json` log excerpt for `AndroidRuntime` crashes.

## Sign-off

Device model: Samsung SM-X210
Android version / API: Android 16 / API 36
APK SHA-256: 232fb2fd439e9c02514e73061e5777409ecf1609b28c4b480e23e43287648c62
Tester: _________________________________
Date: 2026-10-03

- [ ] **Physical-device acceptance PASS**

Notes / failures:

```text

```
