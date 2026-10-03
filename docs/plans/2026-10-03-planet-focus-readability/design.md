# Pixel Planet — focus, zoom and readability

**Status:** approved by Papa, 2026-10-03 (chat: "OK" to the readability review, plus two requests: pinch zoom must keep its zoom, and an attached focus prompt).
**Builds on:** `docs/plans/2026-10-02-pixel-planet/` (slices 60–64). Where this doc and that design disagree, this one wins for the features below.

## Why
On the tablet the planet reads as "low resolution":
- The scale was 6 CSS px per art px (4.5 on small screens) with `devicePixelRatio` ignored. On a 1.5×, 2.25× or 2.625× screen, art pixels come out 6 and 7 device px wide in turns, and the globe shimmers as it rotates.
- Sprites melt into busy dithered terrain. The only thing on screen that marks the selected place is a card docked at the bottom.
- Releasing a pinch looked like it threw the zoom away. The pinch rubber-banded past 1×–2× and sprang back when the fingers lifted.

## Decisions
| # | Decision | Rationale |
|---|---|---|
| D1 | **Whole device pixels per art pixel.** `scale = round(target × dpr) / dpr`, where the target is still 6 CSS px (4.5 under 600 CSS px). | Every art pixel is the same width on every tablet. Planet size in art pixels is unchanged, so the 2026-10-03 "50% bigger" amendment still holds (±½ device px). |
| D2 | **A pinch keeps exactly what the child sees.** Pinch zoom clamps hard to 1×–2× while the fingers are down: no rubber band, no spring-back on release. Zoom range and the saved view are unchanged. | What you see when you let go is what stays. The old overshoot snapped back on release and read as "zoom reset". |
| D3 | **Focus mode.** Tapping a place, a game toy or the moon enters focus. The planet eases to centre it (not the moon). The rest of the scene dims (planet, stars, other sprites, sparks). The focused sprite is redrawn on top at 2× with a pop and a 1-art-px white outline. | Makes the thing the child is choosing the clear subject of the screen. 2× is a whole number, so the enlarged sprite stays crisp. |
| D4 | **The prompt is attached to the element.** In focus, the selection card sits below the enlarged sprite with a tail pointing at it, follows it each frame, and flips above the sprite when there is no room below. During a mini-game the card goes back to its docked HUD position. | The prompt belongs to the thing it describes. The mini-game layout (`gameEnv.floor`) still measures the docked card. |
| D5 | **Show how to go.** In focus the card shows a bilingual hint ("Tap GO or tap it again · 點「出發」或再點一次") with a bouncing 👆, and the GO button pulses. Tapping the enlarged sprite again does the same as GO. GO reads "GO 出發 →". | Shows the action instead of expecting the child to find it. Fixes the English-only GO label (bilingual invariant). |
| D6 | **Any press outside the prompt leaves focus.** A press on the canvas anywhere except the enlarged sprite exits focus. That press never fires a tap (no toy reaction, no new selection), but a drag or pinch that starts with it carries on as usual. A press inside the card does nothing. | One rule for the child: press away to go back. Consuming the tap stops the first "go back" press from triggering something else. |
| D7 | **Focus is a moment, not saved state.** The world opens unfocused, and a successful launch clears focus, so coming back from an activity shows the plain planet. `saveView()` still writes `selected` (the `readView` contract and its test stay), but startup no longer restores it. | Opening onto a dimmed screen with a card is confusing. |
| D8 | **Reduced motion.** No pop, no dim fade, no pulse or bounce: focus appears at 2× straight away. | Same rule as the rest of the world. |

## Not changed
Toys without a game still just react in place, with no focus. Mini-games, stars (none), the registry launch path, `snapshot()` fields, and the art and palette (slices 04–05 handle art).

## Slices
- `01-crisp-pixel-grid.md` — D1
- `02-pinch-keeps-zoom.md` — D2
- `03-focus-mode.md` — D3–D8
- `04-calm-terrain-and-bases.md` — terrain contrast, landmark bases (pending)
- `05-edges-clouds-rim.md` — edge thinning, solid clouds, CSS atmosphere (pending)
