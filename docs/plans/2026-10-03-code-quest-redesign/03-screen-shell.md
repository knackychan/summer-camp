# Slice 03 — Screen shell: stage + dock + language switch (D4, D5)

**Goal:** The decluttered screen: big scene, two overlays, bottom dock, one language at a time.
**Depends on:** 02.
**Files:** `js/games/codequest.js`, `js/games/codequest/strings.js`, `css/codequest.css`.

## Change

- Layout: stage (scene canvas + overlays) on top, dock at the bottom. Landscape tablets fill the viewport row under the host bar with no page scroll.
- Host bar (`settings()`): Map, Camp, `</>` Code, EN/中, pause. The rank/profile badge leaves the bar.
- Overlays: goal pill (tap ⇒ objective checklist popover), hearts, key/potion counts only when the room uses them.
- Speech bubble over the hero replaces `.cq-notice`: ~3 s, anchored with `drawRoom`'s anchors, coach wording, no red.
- Removed from the main screen: `.cq-stats`, `.cq-quest`, `.cq-notice`, `.cq-tabs`, block counter, representation switcher (moves to the Code sheet in slice 06).
- Language: `settings.codequest.lang[kid]` (`en` default, or `zh`), saved through `ctx.saveSettings()`. `pair()` / `label()` render only the active language with a `lang` attribute; the switch is written in the language it switches to (Kitchen Quest pattern). `strings.js` keeps both languages for every string.
- CSS rewritten in the new look: dark stone panels, warm parchment goal pill, colour-per-category cards. Rules for removed elements leave the stylesheet.

## DONE WHEN

- At 1280×800 and 1280×600: no page scroll; scene canvas ≥ 55 % of viewport height; every button ≥ 48×48 CSS px.
- EN mode: no CJK text inside `.cq` except the switch; ZH mode: no English except the switch and JavaScript code. The choice persists per kid.
- `node scripts/check.mjs` green.

## Implementation notes (2026-10-03)

- Typed-code rooms do **not** auto-open the Code sheet (a modal on room start fought the bubble and the host); the `</>` button is highlighted and the bubble says "This room is solved in code. Tap Code to write it."
- Win / Map / Camp dialogs dim the room; only Pause draws pause bars.
- The event debugger for advanced rooms is a non-modal side panel toggled by a 🐞 button on the scene (it must stay visible while a program runs); the Code sheet also shows it.
- Strip and library rows act on tap-release (`click`) so a finger can pan them; every other control still acts on press.
