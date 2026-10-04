# Slice 06 — When things go wrong

**Decisions:** D9, D11. **Depends on:** 05.

| Case | Behaviour |
|---|---|
| Host closes the world / app / tablet sleeps | Guests: "Maya's world closed · Maya 的世界關閉了", back to their menu. |
| Guest loses wifi | "Looking for Maya's world… 正在找 Maya 的世界…", retry ~30 s via discovery; rejoin = fresh `welcome`; pending requests dropped. After 30 s: back to the menu with the "closed" line. |
| Nobody hosting | "No worlds open nearby · 附近沒有開著的世界". No error tone. |
| `proto` mismatch | Both: "Update the app on both tablets · 兩台平板都要更新"; `refuse`, clean close. |
| Same kid joins twice | The second connection replaces the first. |
| Papa pause on a guest | The guest sends `bye` and leaves. |
| Papa pause on the host | The world closes for everyone (row 1). |
| Shared undo after a sibling's change | "Someone changed that · 有人改過了", nothing changes. |

No red, no alarm sounds (coach, not cop).

## Tests
- Loopback: each row above that can be simulated (drop, refuse, duplicate kid, pause).
- Real tablets: rows 1, 2, 6, 7.

**DONE WHEN:** `node scripts/check.mjs` green; tests pass; every row checked on real tablets.

## As built (2026-10-04)
| Case | Behaviour shipped |
|---|---|
| Host closes the world / Back / app closed / Papa pause | Guests get `bye` (or the link closes) → "Maya's world closed · Maya 的世界關閉了", back to their menu. A Papa pause stops the game, and `destroy()` disposes the session, which sends the `bye`. |
| Host app goes to the background (`summerquest:native-pause`) | The world leaves the wifi and guests go home; on `native-resume` it is hosted again. While guests are in, the host screen is kept awake, so this is the home button, not the screen timing out. |
| Guest's link drops (host vanished or wifi blinked) | The plate stays under a calm overlay with the host's avatar: "Looking for Lili's world… · 正在找 Lili 的世界…". The guest looks for the same kid + world name for 30 s and rejoins on its own (fresh `welcome`; requests in flight are dropped; own undo kept). After 30 s: back to the menu with the "closed" line. Back works at any time. |
| Guest app goes to the background | The guest leaves and is on its menu when it comes back. |
| `proto` mismatch | The newcomer gets `refuse` and "Update the app on both tablets · 兩台平板都要更新"; the host shows the same toast. |
| Same kid twice | The older connection is told `refuse: replaced` before it closes, so it goes home instead of looking again. (Without this the two connections took turns knocking each other off; the Node test caught it.) |
| Shared undo after a sibling's change | "Someone changed that · 有人改過了" (slice 05). |

**Verified 2026-10-04:** `check.mjs` green (`brick-together.test.mjs` 13 tests: adds host-vanishes-then-give-up, wifi blink with an automatic rejoin and a fresh copy, app pause on the host, the same kid replacing without fighting back). `check-brick-lab-ui.py` 130/130: version refusal, app pause and resume, a vanished host with the "looking for" overlay (`.tmp/brick-lab-ui/together-lost.png`) and the automatic rejoin. **Not yet on real tablets**: rows 1, 2, 6 and 7 need the device run of slice 07.
