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
