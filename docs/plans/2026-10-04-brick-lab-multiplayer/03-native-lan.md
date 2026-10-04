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
