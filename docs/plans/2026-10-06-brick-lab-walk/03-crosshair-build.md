# Slice 03 — Build from the crosshair

**Requested by Papa, 2026-10-06.** Implements design.md W9, W10.

**Depends on:** 02.

## Changes
- `js/brick-lab/brick-walk-view.js` — a crosshair at the view centre; each frame a ray from it hits a piece or the ground, `landing()` gives the spot for the part picked in the rail, and the usual ghost shows there when it is within 8 studs and does not overlap the walker (W9). Nothing hit / out of reach / overlap: no ghost, no message.
- Buttons ＋ Place 放上去, － Remove 拿掉, ⟳ Turn 轉一轉 (≥ 56 px, `pointerdown`). Place and Remove send the same `add` / `remove` ops as Build (Undo, save unchanged). Remove never targets the walker or its riders.
- The rail keeps picking part and colour while walking; the picked part stays armed.
- Strings: `place`, `remove`, `turn`.

**DONE WHEN:** `check.mjs` green; in the browser, walking, the kid places a 2×4 brick on the ground and another on top of it, turns one, removes one, and Undo takes them back in order; no ghost when aiming past 8 studs or into the minifig.

**Shipped 2026-10-06:** a white crosshair in the middle of the view and a building pad bottom right (⟳ Turn and － Remove 68 px above, ＋ Place and ⤒ Jump 88 px below; 60 / 76 px under 760 px wide). `walkAim()` casts from the screen centre each time the camera moves or the part, colour or turn changes; `walkAct()` sends the usual `add` / `remove` ops. As built:
- **The behind view looks over the right shoulder** (`BEHIND.shoulder` 1.6, pulled in when a piece is beside the head), so the figure's head never hides the crosshair. Amends W4's "from the head".
- **A side aims beside it:** when the crosshair is on the side of a piece, the aim point moves half a stud out from that face before `landing()`, so a part goes next to what the kid points at (on top when they point at a top). Build taps are unchanged.
- No ghost when nothing is hit within 8 studs, when `landing()` says blocked (rails), or when the spot would be in the walker's column (`hitsWalker`, node-tested); Place then does nothing. Remove never targets the walker or its riders (the hidden originals are skipped in the cast; the stand-in never raycasts).
- **Undo while walking** takes back this walk's places and removes, last first, still walking; once they are gone the next Undo takes back the walk. The hidden figure and riders stay hidden through a snapshot Undo (`walkSync`).
- A rail tile tap while walking doesn't open the part's info card (it covered the joystick); the ghost shows the part.
- Browser check (scratch), 37/37 on Edge SwiftShader on the committed tree alone, adding: picking a part shows a ghost; ＋ places a 2×2 at the ghost; ⟳ then a 1×4 lands at 90°; － removes the piece under the crosshair, never the figure or hat; three Undos bring back the removed piece and take back both placed ones while still walking, the real figure and hat staying hidden; the next Undo ends the walk; looking up past reach shows no ghost and Place adds nothing; no page errors.
