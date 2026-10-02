# Summer Quest Android physical-device acceptance — v0.6.1

This checklist is the release gate for a real Android tablet. Automated repository tests and ADB smoke checks do **not** replace it.

Target baseline: `v0.6.1`
Package: `com.summerquest.app`

## 1. Build provenance

- [ ] `npm run android:doctor:strict` passes on the development machine.
- [ ] `npm run android:build:debug` completes.
- [ ] Record the APK SHA-256 printed by the build command.
- [ ] `npm run android:install` installs the exact APK on the target tablet.
- [ ] `npm run android:device` reports the expected manufacturer/model, Android version/API level, display size and density.
- [ ] Save `apps/android/.reports/build-debug.json` with the test notes.

## 2. Fully local / offline cold start

Do this manually so the tooling never changes the owner's connectivity settings behind their back.

1. Launch Summer Quest once after installation.
2. Close/force-stop Summer Quest.
3. Turn **Airplane mode ON** and confirm Wi-Fi/mobile data are unavailable.
4. Cold-launch Summer Quest from the Android launcher.

Acceptance:

- [ ] Authoritative Summer Quest root app opens without a LAN server.
- [ ] No blank page / connection error appears.
- [ ] Hero → **Miniature 3D World** opens as the primary child surface.
- [ ] Drag rotates/looks around the world; pinch zoom remains bounded and stable.
- [ ] Tap at least three physical landmarks/props and confirm the selection card updates.
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

- [ ] From content launched from the 3D world, Android Back returns to the 3D world rather than immediately closing the app.
- [ ] From Classic menu opened from the world, Android Back returns to the world.
- [ ] From the world, Android Back returns to hero selection; at hero selection system Back may leave the app.
- [ ] Repeated content launches do not create nested shells, duplicate headers/back controls, blank frames or iframes.
- [ ] At the true root, system Back may leave/close the app normally.

## 4. Portrait / landscape / resizing

Test at least one full rotation cycle while each state is visible.

- [ ] Hero/world: portrait → landscape → portrait.
- [ ] Rotate the world camera before orientation change and confirm the 3D scene recovers without a black canvas.
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

- [ ] Cold process start reports OK.
- [ ] Background/resume process reports OK.
- [ ] Review the saved `.reports/device-smoke-*.json` log excerpt for `AndroidRuntime` crashes.

## Sign-off

Device model: __________________________
Android version / API: __________________
APK SHA-256: ___________________________
Tester: _________________________________
Date: __________________________________

- [ ] **Physical-device acceptance PASS**

Notes / failures:

```text

```
