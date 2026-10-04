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
