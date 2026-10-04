# Slice 05 — Host and join

**Decisions:** D4, D5, D6. **Depends on:** 01, 02, 04.

## Changes
- Opening a world: start `lan-session.host()` with TXT `{kid, world: name, proto}` and run the slice 02 sequencer on top. The host's own changes go through the same sequencer. Leaving the world: `bye` to all, stop hosting.
- Menu Join area: live list from `discover()`, one card per world: "🧱 Maya · Castle 城堡". The tablet's own world is never listed. Pre-reader: kid avatar + world picture.
- Joining: `hello` → `welcome` → load the world (the guest's own worlds untouched) → stream `apply`. Guest changes go out as `req`; the guest shows the change when the host's `apply` comes back (a ghost while pending is fine).
- Presence chips at the top of the view, one per kid in their colour (fixed palette by kid order in `ctx.kids`). Toasts "Leo joined! Leo 加入了!" / "Leo left · Leo 離開了".
- Bricks tinted by `by` while in a shared world; shared-world undo = own last change (D6).
- `keepAwake(true)` on the host while at least one guest is connected.
- Delete / rename / clear all: hidden during a session.

## Tests
- `scripts/brick-share.test.mjs` + loopback: host + 2 guests build, leave, rejoin; the host's saved world holds everyone's bricks; guests' own worlds unchanged.
- `scripts/check-brick-lab-ui.py` with the loopback injected: Join list, chips, toasts.

**DONE WHEN:** `node scripts/check.mjs` green; tests pass; on 2 real tablets B sees A's world within ~5 s and joins, each sees the other's bricks within 1 s, and after B leaves, A's saved world contains B's bricks.
