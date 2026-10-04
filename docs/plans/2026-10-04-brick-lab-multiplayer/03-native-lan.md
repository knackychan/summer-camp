# Slice 03 — Native LAN plugin

**Decisions:** D1, D9 (keep awake). **Depends on:** nothing.

## Changes
- `apps/android/native-overlay/app/src/main/java/com/summerquest/app/SummerQuestNativePlugin.java` — game-neutral:
  - `lanHost({name, txt})` → `{port}`: `ServerSocket` on an ephemeral port, NSD register `_sqbricks._tcp` with TXT (`kid`, `world`, `proto`). One reader thread per peer; newline-delimited UTF-8; a line over 64 KB drops the peer.
  - `lanStop()`, `lanDiscover()` / `lanStopDiscover()` (NSD discover + resolve; events `lanFound {id, name, host, port, txt}` / `lanLost {id}`), `lanJoin({host, port})`, `lanSend({peer, line})`, `lanLeave()`.
  - Events `lanPeerOpen`, `lanLine {peer, line}`, `lanPeerClosed {peer}`.
  - `keepAwake({on})` — `FLAG_KEEP_SCREEN_ON` on the activity.
  - `WifiManager.MulticastLock` held while discovering or hosting; everything released in `handleOnDestroy` and on `lanStop` / `lanLeave`.
- Overlay `AndroidManifest.xml` — `ACCESS_WIFI_STATE`, `CHANGE_WIFI_MULTICAST_STATE`, `ACCESS_NETWORK_STATE`. No location permission.
- An `apps/android/scripts` probe (like `probe-3d`): host on device A, discover + join + echo a line from device B.

**DONE WHEN:** `npm run android:build:debug` builds; on 2 tablets on the home wifi with internet off, B finds A's service and a line goes both ways; the Android 8 tablet is one of the two.

## As built (2026-10-04)
- The transport lives in its own overlay file, `LanHub.java`; the plugin only exposes it (`lanHost`, `lanStop`, `lanDiscover`, `lanStopDiscover`, `lanJoin`, `lanSend` — peer `"*"` sends to everyone —, `lanClose` to drop one peer, `lanLeave`, `keepAwake`) and forwards its events (`lanFound`, `lanLost`, `lanPeerOpen`, `lanLine`, `lanPeerClosed`, `lanError`). `apply-native-overlay.mjs` copies it.
- **Service type `_sqplay._tcp`, not `_sqbricks._tcp`**: the transport is game-neutral, so the game goes in the TXT record (`game=bricklab`). The web side keeps the service name and TXT values short (NSD names are 63 bytes; Chinese is 3 bytes a character).
- Lines are read with their own 64 KB cap (a longer line drops that peer); `\r` is ignored. `lanHost` resolves once NSD has registered the name (it may be renamed on a clash) with `{port, name}`, or with a `warning` when announcing failed but the socket is up.
- `probe-lan.mjs` / `npm run android:probe-lan` / `PROBE-ANDROID-LAN.cmd`: two USB tablets, host + find + join + a line each way (with Chinese) + host stop closes the guest.
- `android-device-foundation.test.mjs` asserts the new methods, the overlay entry, the multicast permission and no location permission.

**Verified 2026-10-04:** `check.mjs` green; `npm run android:sync` + `npm run android:build:debug` build the APK with the new code (Gradle `BUILD SUCCESSFUL`). **Not yet run on tablets** — no device was connected: the DONE WHEN (two tablets, internet off, the Android 8 one included) needs `PROBE-ANDROID-LAN.cmd`.
