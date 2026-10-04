# Solar System UI rework — single header, EN/中 toggle

Scope: `js/games/solar.js` only. Fixes the duplicate-header look (screenshot:
top row repeated the bilingual speed chips that the bottom `.timeband` also
shows) and adds a per-kid EN/中 display toggle. Supersedes nothing in
`docs/plans/2026-07-27-solar-system/` beyond UI chrome — gameplay, sim,
quiz data untouched.

## D1 — the "two headers" bug, diagnosed from actual code

The host (`index.html`/`css/app.css` `.game-fs` grid) already gives every
full-screen game one top row: `#back | .setbar (game's settings(bar,ctx)) |
.hud | #mute`, with the stage filling the rest at 100% height, no scroll.
That part of a since-superseded outside enhancement brief was already solved
by the platform — not something this game needed to build.

The actual bug: `solar.js` wired a `settings(bar,ctx)` into that host row
that rendered full bilingual speed chips (e.g. "10 days 10天") — but that
`ctx` is the lightweight settings-bar ctx (`kid, kids, settings, saveSettings,
restart` only, no live binding to the running game instance), so clicking a
chip there only wrote a "default for next launch" and did **nothing** to the
live simulation. The bottom `.timeband` had its own, fully independent,
*actually live* speed chips tied to `R.speedId`. Result: two speed controls,
one of them inert — exactly the duplication in the screenshot.

Separately, the Explore/Quiz/Galaxy mode switcher (`modebar`) floated as its
own small pill cluster inside the canvas, top-left — a second header-shaped
thing sitting right under the host's real header.

**Decision:** delete `settings(bar,ctx)` entirely (dead/misleading control;
host now hides the empty setbar row for solar). Move the mode switcher into
a full-width bar docked to the top of the canvas (`modebar`, restyled),
visually matching `.timeband`'s look so top and bottom read as one system.
Bottom `.timeband` keeps sole ownership of speed controls, unchanged in
behavior. This stays inside `init()`'s live closure — mode switching must
stay instant, not a full `ctx.restart()` reload.

## D2 — EN/中 toggle overrides the bilingual-always rule, for this screen only

Project rule (CLAUDE.md): every kid-facing string ships EN **and** 繁體中文
together, always. This screen adds a toggle that shows **one language at a
time** — Papa explicitly approved this override for `solar.js` only
(2026-10-04). It is not a precedent for any other screen; any other game
wanting the same needs its own sign-off.

Mechanism: `R.uiRoot.dataset.lang = "en"|"zh"`. Every bilingual string the
game renders is emitted as two inline elements, `.i18n-en` / `.i18n-zh`,
with `[data-lang="en"] .i18n-zh{display:none}` (and the mirror rule) doing
the hiding. Both strings stay literally present in the DOM and in source —
`scripts/check.mjs`'s bilingual check is data-driven (`solar-data.js` field
pairs), so it is unaffected by how the UI chooses to display them.

Covers: mode chips, day/year counters (previously English-only at runtime —
a pre-existing bug this fixes as a side effect), speed chip labels, info
card (type, name, description, fact box, stat grid, voice button), quiz
banner, end card.

Persisted per-kid: `ctx.settings.solar.lang[ctx.kid]`, written via
`ctx.saveSettings()` — same shape as `codequest`/`kitchen`'s per-kid
language prefs. Default `"en"`.

## Files touched

`js/games/solar.js` only. No `index.html`/`css/app.css` changes — the host
grid already provides the single real top row and full-height stage.

## Out of scope

- Back button: already host-owned (`#back`), solar.js never had one and
  doesn't get one.
- Any other game's bilingual display.
- Gameplay, simulation speed math, quiz grading, mission pools.
