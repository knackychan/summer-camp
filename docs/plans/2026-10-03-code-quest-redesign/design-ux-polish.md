# Code Quest redesign — UX polish addendum (bubble, card menu, zoom)

**Approved by Papa:** 2026-10-04 (chat, "ok lets go") — U1–U8 as written, D2 amendment for slice 09 included.
**Amends:** `design.md` in this folder — D2 (camera) only if U6 is approved; restores D4's per-card toolbar, which slice 04's implementation note replaced with a fixed tray. Everything else in `design.md` stays in force, D8 (presentation only) included.
**Slices:** 07 bubble placement · 08 card menu · 09 zoom + pan. Each ships alone.

## Why

Papa's UX review of the v0.14 redesign build raised three problems: the speech bubble covers parts of the puzzle, editing cards means hopping between the strip and a tool tray at its end, and nobody can look closer at a room.

What the code shows (checked 2026-10-04 against `js/games/codequest.js` and `room-view.js`):

| Reported | Actual |
|---|---|
| Bubble overlaps the program dock | Impossible today: the bubble lives in `.cq-scene` (`overflow:hidden`), the dock is a sibling section. |
| Bubble overlaps goal pill / hearts | Partly guarded: `placeBubble()` only keeps clear of the HUD row's bottom edge. It ignores the 🐞 toggle, the debug panel and the open goal popover. |
| Bubble covers obstacles | Real. The below-hero fallback is a fixed `head.y + 56` CSS px whatever the scale, then clamped to the scene bottom, so it can land on the hero, the tile ahead, an enemy or the exit. |
| Wide/narrow rooms squash | No: `fitRoom()` uses one integer scale for both axes, tiles stay square. |
| 3/4 view hides things | Real but small: a wall cap is drawn 8 px up into the row north of it (`drawWall`), so a prop, key or enemy standing directly north of an interior wall loses its lower half. |
| Card editing is spread out | Real: tap toggles selection in the strip; ◀ ✕ ▶ ↶ 🗑 sit in a fixed tray at the strip end; wrapping happens in the library. |
| No way to edit Repeat count / IF test | Real: once wrapped, the only fix is Undo. There is also no Unwrap. |
| Drag-to-reorder | Not implemented (`S.drag` is only for Camp ingredients). |

## Decisions (proposed)

| # | Decision | Rationale |
|---|---|---|
| U1 | **Bubble placement is scored, not fixed.** Candidates above / right / left / below the hero; rejects any that touch the goal pill, vitals, open goal popover, 🐞 toggle, debug panel or scene edge; prefers the one covering the fewest important tiles (hero, the tile ahead, enemies, chests, keys, exit, preview path). It keeps its side while still valid, so it doesn't jump around as the hero walks. | Fixes the real overlaps. Pure function, testable in Node. |
| U2 | **Fallback is a caption, not mid-screen.** If every candidate collides, the bubble docks to the bottom edge of the scene with no tail. | The requested "middle 40 % of canvas height" fallback is exactly where the room is drawn, so it would cover the puzzle. |
| U3 | **Tap a card ⇒ floating card menu** above it: ◀ ▶ ✕ and Wrap ▸ (the room's available logic only). On a Repeat bracket head: a ×N chip that cycles through the room's available counts (2/3/5) + Unwrap. On an IF head: the room's available tests + Unwrap. | Goes back to design.md D4 ("tap a card ⇒ small toolbar"). Everything sits on the card. |
| U4 | **No long-press, no right-click-only actions.** Tapping a card next to a selected one extends the selection (contiguous only); tapping a card elsewhere starts a new selection. | Long-press is invisible to a 5-year-old, and the strip is a horizontal scroller whose cards act on tap-release so a finger can pan it (slice 03 note). A 500 ms hold fights that pan. |
| U5 | **Strip-end tray keeps only program-level tools**: ↶ Undo, 🗑 Clear. Card tools leave it. Library tap inserts after the single selected card, else appends; the new card pulses once (static outline under reduced motion) and scrolls into view. **No toast**: adding a card is a routine edit, and `announce()` already keeps routine edits out of the bubble on purpose. | One place for card actions, no new on-screen noise. |
| U6 | **Zoom in, never out; no rotation.** Default framing stays D2's whole-room integer fit ("Home"). Zoom adds +1 and +2 whole device-pixel steps via pinch, wheel or on-scene ＋/－ buttons; while zoomed, a one-finger drag pans, clamped to the room buffer. ⌂ Home appears only when not at default. Reset, room change and win return Home. While a program runs zoomed, the camera follows the hero (clamped). | Bigger tiles help a 7" tablet. Zooming out below the fit only wastes pixels. Rotation (N/NE/E/SE) is rejected because the diagonals are the isometric view D1 rejected for 5–7 year olds; rotating needs wall faces and props drawn from 4 sides (≈4× the atlas, against D3); and it breaks the "↑ walks up the screen" picture that the Explorer path preview teaches. |
| U7 | **Occlusion fix: x-ray silhouettes.** An actor, prop or pickup partly covered by a wall cap gets a 1-px outline silhouette drawn over the wall (Gungeon-style). | Fixes the real "hidden behind walls" case without moving the camera. |
| U8 | **Reduced motion** turns off the animations only: the zoom/pan tween, follow easing, card pulse and menu pop. Zoom, pan and the menu still work and simply snap. | They are user-initiated controls, not decoration. |

Bilingual: every new label (menu items, ×N chip, Unwrap, zoom / Home buttons, aria-labels) ships EN + 繁體中文 in `strings.js` and renders in the active language (D5). Tablet: every new target ≥ 48 × 48 CSS px, nothing hover-only.

## Out of scope

Model, interpreter, AST shape, levels, par, available cards (D8). Arbitrary Repeat counts (only the room's `available.logic` counts are offered). Drag-to-reorder (◀ ▶ in the menu covers it; a drag on a horizontal scroller is a separate design question).
