# Slice 04 — lan-session.js (JS wrapper)

**Decisions:** D2. **Depends on:** 03 for the real transport; the fake works without it.

## Changes
- `js/game-services/lan-session.js` (new) — `isAvailable()`, `host(info)`, `discover(onFound, onLost)`, `join(service)`, `send(peer, msg)`, `onMessage`, `onPeer`, `leave()`, `keepAwake(on)`. JSON encode / decode and the 64 KB limit live here.
- `createLoopback()` — in-memory transport so 2–3 sessions talk inside one Node process or one page.
- Without the plugin: `isAvailable()` is false and every call is a no-op; Brick Lab shows the D2 line in the Join area.
- `sw.js` / Android web build include the new file (check the precache guard and `verify:android-web`).

## Tests
- `scripts/lan-session.test.mjs` — loopback host + 2 guests: hello / welcome / lines / bye; malformed JSON dropped; oversized line dropped; plugin missing → unavailable, no throw.

**DONE WHEN:** `node scripts/check.mjs` green; test passes; browser build shows the "needs the app" line and solo still works.

## As built (2026-10-04)
- `js/game-services/lan-session.js`: `createLanSession(transport?)` → `available`, `host(name, txt)` (name clipped to 60 UTF-8 bytes, TXT values to 200), `stopHosting`, `discover` / `stopDiscover`, `onFound` / `onLost`, `join(service)`, `send(peer, message)` / `broadcast`, `onMessage`, `onPeer`, `close(peer)`, `leave`, `keepAwake`, `dispose`. The transport is `globalThis.__sqLanTransport` (test hook), else the Android plugin (only when it has `lanHost`, so an older APK counts as unavailable), else none.
- `createLoopback()`: an in-memory pretend wifi; `network.device()` is one tablet's transport, with `drop()` to fall off the wifi. Used by the Node tests now and the browser harness in slice 05.
- JSON line encoding moved here from `brick-share.js` (it is game-neutral).
- Brick Lab creates its session at start; outside the app the Join area reads "Building together needs the Summer Quest app · 一起蓋需要 Summer Quest 應用程式" (pre-readers: 📱). `sw.js` precaches the file (cache `summer-quest-v168-lan-session`).

**Verified 2026-10-04:** `check.mjs` green (includes `scripts/lan-session.test.mjs`, 7 tests: no plugin is harmless, plugin wrapping, loopback host/find/join/messages/stop, two guests and broadcast, junk and oversized lines dropped, UTF-8 clipping); `check-brick-lab-ui.py` 106/106 (the browser shows the "needs the app" line and solo play is unchanged).
