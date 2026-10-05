# Slice 07 — Device acceptance

**Depends on:** 06 (and 08 if shipped).

Three tablets, including the Android 8 / Chrome-WebView 138 one, on the home wifi with the router's internet unplugged.

- [ ] Each tablet: the existing build shows as world 1.
- [ ] A opens a world; B and C see it within ~5 s.
- [ ] B and C join; all three build at once for 10 minutes; each sees the others' bricks within 1 s.
- [ ] Two kids grab the same brick: no crash, the world ends up the same on all three.
- [ ] Shared undo only undoes your own change.
- [ ] B turns wifi off and on: rejoins with the right world.
- [ ] A presses Back: B and C see the "closed" line and land on their menu.
- [ ] A reopens the world: every brick from B and C is there.
- [ ] B's and C's own worlds are unchanged.
- [ ] A's screen stayed awake while guests were in.
- [ ] Every kid-facing line seen was EN + 中文; nothing red.
- [ ] `check-android8-ui.py` with Chrome 138 passes.

**DONE WHEN:** checklist signed off by Papa.

## Run on 2026-10-05: two tablets on USB, automated

Tablets: SM-T385 (Android 9, Chrome/WebView 138, Luis) and SM-X210 (Android 16, Lili), on the home wifi `cht8562`. **The router's internet was still connected** and **only two tablets** were available. The checklist was driven over USB by `ACCEPT-ANDROID-LAN.cmd` (`apps/android/scripts/accept-lan.mjs`): the host opens a throwaway world "Wifi test 測試" and deletes it at the end, and bricks are placed through the lab's own `change()` path, not by touch. Report and screenshots go to `apps/android/.reports/lan-acceptance/`.

- `PROBE-ANDROID-LAN.cmd`: passed both ways. Found in 334 / 234 ms, round trip 319 / 977 ms, 中文 intact, the host's stop closes the guest.
- Checklist, SM-T385 hosting, 10 minutes: **15/15** after the two fixes below. 336 bricks each, 672 in the end. Each tablet saw the other's brick within 360 ms (p95, including the driver's polling). Nothing was refused and there were no page errors. The guest's wifi went off and on and it was back in about 6 s with the brick the host placed meanwhile.
- Same checklist with roles swapped (SM-X210 hosting), 2 minutes: 15/15.
- `check-android8-ui.py` with Chrome 138 (headless shell): all four profiles ok, Brick Lab included.
- Screenshots reviewed: joined, building, "Looking for Luis's world… · 正在找 Luis 的世界…", "Luis's world closed · Luis 的世界關閉了". Every line is EN + 中文 and nothing is red.

Found and fixed on the way:
- **A world past about 600 bricks could not be joined.** The whole world went in one welcome line, and lines are capped at 64 KB, so the host dropped it silently and the guest waited forever. The first 10-minute run failed at the wifi blink with 672 bricks. Fixed in `03b4117`: the welcome is split into several lines and `PROTO` is now 2 (see design.md, amended 2026-10-05).
- **Brick Lab drew its first frames stretched on a cold load.** It sized the scene before its stylesheet arrived. `check-android8-ui.py`'s no-WebGL retry profile caught it. Fixed in `624fda6`.
- Measuring note: while DevTools is attached, the WebView keeps the screen on by itself. The keep-awake checks therefore read the window flag with DevTools detached. Hosting alone does not keep the screen on, a guest joining does, and closing the world releases it.

Seen, not fixed: just after the host closes a world, the guest's menu can still show its join card for a few seconds, until NSD reports it gone. Tapping it in that window shows the "can't join" line.

Ticked by the run: world 1, seen within ~5 s, building at once (two tablets, 10 min), same brick, shared undo, wifi off/on, host Back, reopen, own worlds unchanged, kept awake, EN + 中文 / nothing red, `check-android8-ui.py`.
**Still for Papa:** a third tablet, the router's internet unplugged, a few minutes of real finger building, and the sign-off.
