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

## As built (2026-10-04)
- `js/brick-lab/brick-together.js` (`BrickTogether`) holds the session: hosting (hello → welcome → roster; every guest request through the lab's sequencer; every applied change broadcast), joining (requests out, numbered changes in through `createClient`, resync on a gap), per-kid undo (`createUndo`), and the worlds found nearby. The lab keeps the scene and calls in through `commit()` / `change()` / `undo()`.
- Hosting starts whenever a world opens; the service is "‹kid name› · ‹world name›" with TXT `game=bricklab, proto=1, kid, world`. Leaving the world stops it (guests get `bye`).
- Kid names, avatars and colours come from `ctx.kids` (the same `KIDS` table on every tablet), passed through `js/games/bricklab.js`; only kid ids travel.
- While hosting, undo is always the own-change undo (inverse ops), with or without guests; in a browser (no transport) solo undo is unchanged.
- **No tint** (design D6 note): the selection outline takes the placer's colour and the hint names them; bricks keep their colour. Crew chips (avatar + name, kid colour) top right; a guest has no Save button.
- `sw.js` precaches `brick-together.js` (cache `summer-quest-v169-brick-together`).

**Verified 2026-10-04:** `check.mjs` green, including `scripts/brick-together.test.mjs` (11 protocol tests on the loopback: two guests join and get the world, a guest's brick reaches everyone as theirs, host changes in order, two kids on one brick end the same everywhere, shared undo own-only and refused after a sibling's change, leave / host close / host dropping off / version refuse / same kid twice / resync after a gap). `check-brick-lab-ui.py` 125/125 including 19 new checks on a pretend wifi in the page: hosting on open, a scripted sibling joining and building, the placer shown on tap, our brick reaching her, undo of our own brick only, her leaving, her brick saved in our world, joining her world from the Join list, building there, and being sent home when she closes it with nothing of hers saved. Screenshots: `.tmp/brick-lab-ui/together-host.png`, `together-placer.png`, `together-join.png`, `together-guest.png`. **Not yet on real tablets** (DONE WHEN needs two APKs on the home wifi).
