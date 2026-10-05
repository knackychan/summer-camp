# Code Quest — facing and the ƒ Rune: UX audit

2026-10-05 · status: **audit only, nothing changed** · next step: Papa picks fixes, then a design.md + slices.

Evidence was taken in headless Chromium at 1280×800 through the same seeded save the
`check-codequest-ui.py` harness uses (q02 Turn the Corner, q10 Function Forge). The screenshots are in `shots/`.

## 1. "Turning doesn't rotate the hero"

### What actually happens

The hero **does** change facing on a turn. `heroFrame()` (`js/games/codequest/room-view.js:251`) picks
one of three code-drawn frames (`hero-n`, `hero-e`, `hero-s` in `sprites-world.js:69-83`), and W is E mirrored.
`model.js:637-638` updates `hero.dir` and the snapshot carries it. Four Right turns in place gave S → W → N → E, and each
frame was drawn correctly (`shots/facings.png`: E, S, W, N).

So there is no missing-rotation bug. A kid can still fail to *see* the turn, for these reasons:

| # | Cause | Where |
|---|---|---|
| T1 | **Nothing marks "forward".** E and W differ only by which side a 2–3 px nose and the backpack are on. N and S differ by face versus hair. At the room's whole-number scale the hero is about 48×78 CSS px, and the face is a small part of that. No floor arrow or tile-ahead marker exists. `focusRects()` already works out the tile ahead (`room-view.js:280`), but only so the speech bubble avoids it. | room-view.js |
| T2 | **A turn has no beat.** Move gets a 300 ms slide and a walk pose. A turn sets `heroState = 'idle'`, `heroMotion = null`, `fx = null` and plays no sound (`codequest.js:898-912`). The frame swaps in one paint. During Run the next card fires 360 ms later, so the kid's eye is still on the strip when it happens. | codequest.js `executeOne` |
| T3 | **Left/Right are the hero's, but the card arrows are the screen's.** `LEFT = {N:'W', W:'S', S:'E', E:'N'}`, so it is relative to the hero, which is correct. The Left card glyph is a fixed arrow that bends to screen-left. When the hero faces the kid (S), **Left walks it to screen-right**, the opposite of the arrow on the card. That is the classic mirror trap for 5–7 year olds, and it is most likely the real complaint: "I turned left and it went the other way." | codequest.js `GLYPHS.turnLeft/turnRight` |
| T4 | **The Explorer path preview does not help at the start.** `drawPreview` puts a direction tip only on the *last* tile of a path of ≥ 2 tiles. With an empty program, or one made of turns only, nothing is drawn. | room-view.js:331 |

Camera: it does not move on a turn, and that is correct. Design U6 rejects camera rotation, because it would break "↑ walks up the screen" and need a 4-sided atlas.
CSS `rotate()` on the sprite, as the original brief suggests, would be wrong too: these are 3/4 top-down frames on a canvas, not a top-down token.

### Proposed fixes (smallest first)

- **T1 Facing chevron on the tile ahead.** Draw a 2-tone pixel chevron (cyan, outlined) on the floor tile in front of the hero, through `DIR_STEP`, in `drawMarkings`. Draw it only while the hero is alive and not mid-move. Draw it even when that tile is a wall, dimmed, so "I'm facing the wall" can be read. Also draw one for the companion in rooms that have one. *≈ 1.5 h incl. a renderer test.*
- **T2 Turn beat.** Add a new FX kind `turn`: a short pixel arc sweeping around the hero's feet in the turn's direction (≈ 260 ms), plus the existing `sfx.pop`. Reduced motion shows the arc's end state only. *≈ 1.5 h.*
- **T3 Mirror trap. Pick one (Papa):**
  - (a) **Hero-hand hint.** During the turn beat, flash a small hand/arrow on the side of the hero that the turn goes to, so the kid sees "Left = the hero's left hand". It is cheap and teaches the right model. *≈ 1 h on top of T2.*
  - (b) **Live card glyphs.** The Left/Right library cards rotate their arrow to the facing the program will have reached (last preview `dir`), so the card always points where the hero will go on screen. It is the most direct help, but it changes as you build, which may confuse more than it helps. *≈ 3 h.*
  - Recommendation: **(a)** now. Revisit (b) only if Papa still sees the mix-up after T1 + T2 + (a).
- **T4 Facing announcement (screen-reader / bubble only).** After a turn, `announce()` reads "Facing the door" or "Facing up" rather than compass words, which 5–7 year olds don't use. *≈ 0.5 h.*

New strings (EN / 繁中): `Facing up / 面向上方`, `Facing down / 面向下方`, `Facing left / 面向左邊`, `Facing right / 面向右邊`, `Turned to the hero's left / 英雄往自己的左手邊轉`, `Turned to the hero's right / 英雄往自己的右手邊轉`.

## 2. "What is the ƒ?"

### What the kid sees (q10, `shots/q10-start.png`)

- A library card **ƒ Rune**, the same size and shape as Move/Left/Right, so it reads as one more action.
- A small **▶ Main** button at the start of the strip. It names the strip *being edited*. Tapping it switches to the Rune strip, and it then reads **ƒ Rune** in pink. Nothing on screen shows that a second program exists or what is in it.
- Goal pill: "Build Rune as a reusable dash and call it twice." The only intro bubble is the generic "Build a turn routine, predict the result, then run it."

### Root causes

| # | Cause | Where |
|---|---|---|
| F1 | **Bug: Rune can call itself from the editor.** The library shows ƒ Rune while you edit Rune. Tapping it appends `call('rune')` inside Rune ("Rune call added.", `shots/q10-rune-self-call.png`), and the run then dies with "Rune tried to call itself forever". Confirmed in the browser. | `libraryHTML()` codequest.js:361, `logic:callRune` handler :702 |
| F2 | **The strip goes blank while Rune runs.** The interpreter reports the *inner* action's uid. The Main strip's call card is never marked `.executing` while Rune's body runs (measured: 0 highlighted cards on both Rune steps, 1 on the Turn step). The kid watches the highlight vanish and the hero move "by itself". This is the moment that should teach "calling runs those cards", and it is invisible. | `running()` codequest.js:225, interpreter.js:110 |
| F3 | **A call card hides what it does.** `ƒ Rune` in Main shows no contents, and the library card shows none either. Repeat and IF brackets already show their bodies with `miniCards()`; the call card doesn't. | `stripCard`/`miniCards` codequest.js:242-260 |
| F4 | **The ƒ glyph and the word "Rune" carry no meaning for this age.** ƒ is a maths italic f, and kids read it as the letter f. "Rune" is also the name of the q01 *sequence* lesson ("First Rune"), the rune core, rune gate, rune circuit, Rune Library and the exit rune marking. The one word means six things. | `GLYPHS.call`, levels.js q01, strings.js |
| F5 | **The toggle names the current strip, not the choice.** One 48 px button whose label flips. This was a deliberate trade-off in redesign slice 04 (keep the dock two rows at 1280×600), but it means Rune's contents are never visible while you edit Main. | `stripTabsHTML()` codequest.js:265 |
| F6 | **No "why" before the first function room.** q10 asks the kid to build *and* call on first contact. The only scaffold: tapping ƒ Rune while Rune is empty jumps to the Rune strip with "Rune is empty. Build the Rune function first." That uses the word *function* without explaining it. | levels.js q10, `MESSAGES.missingFunction` |

Bilingual: 符文 (Rune) / 函式 (function) / 呼叫 (call) are consistent and use Taiwan's terms. Keep 函式 and 呼叫, not 函數 or 執行: 執行 is already the **Run** button.

### Proposed fixes

- **F1 Hide ƒ Rune in the library while editing Rune.** Filter `callRune` out of `libraryHTML()` when `S.editor === 'rune'`. Add a harness check. *≈ 0.5 h. Do this first: it is a real bug.*
- **F2 Light the call card while its body runs.** Two options:
  - (a) Push the call node's `uid` onto the call frame in `interpreter.js` (one additive field). Have `executeOne` keep `S.activeCallUid` and mark that card `.executing` with a "running inside" pulse.
  - (b) Also auto-flip the strip to Rune while its body runs and back after, so the kid *sees* Rune open, run and close.
  - Recommendation: (a) + (b), Step mode included. *≈ 2.5 h.* The interpreter change is additive, but it touches a file the redesign kept "untouched", so Papa needs to OK it.
- **F3 Peek inside the call card.** Render a call node as a bracket like Repeat: the head is the Rune icon, and the body is `miniCards(S.runeProgram)`. The library card gets the same mini row, or "empty" dots. *≈ 1.5 h.*
- **F4 A Rune icon a kid can read.** Replace the ƒ path with a code-drawn rune-stone or scroll pixel sprite (the same method as the other card sprites) in the card colour, used everywhere a call or the Rune strip appears. Rename q01 "First Rune 第一個符文" to "First Steps 第一步", a string-only change with no gameplay data touched. *≈ 1.5 h.* Optional, for Papa: rename the function concept to **Spell 咒語** to free "Rune" for the dungeon objects. That is bigger (strings, Rune Library, code view). I don't recommend it unless F1–F5 aren't enough.
- **F5 Two visible tabs.** Show `▶ Main | ✦ Rune ··` as a segmented control. The Rune tab carries a 3-dot mini preview of its cards, the active tab is filled, the other is outlined. Re-check 1280×600 with the harness. *≈ 2 h.*
- **F6 First-visit coach in q10.** Show three one-line bubbles, once per kid (flag saved in the Code Quest profile, additive), each pointing at its target:
  1. "This is your Rune: your own card. Cards you put inside it run together." → points at the Rune tab.
  2. "Build it once…" → the tab opens, and the kid adds cards.
  3. "…then use it again and again from Main." → points at the ƒ Rune library card.

  The level and its par stay unchanged. *≈ 2.5 h.*

New strings (EN / 繁中):

| Key | EN | 繁中 |
|---|---|---|
| coach1 | This is your Rune — your own card. The cards inside it run together. | 這是你的符文——你自己的卡片。放在裡面的卡片會一起執行。 |
| coach2 | Build it once here. | 先在這裡做一次。 |
| coach3 | Then use it again and again from Main. | 然後在主程式裡一用再用。 |
| runeRunning | Running your Rune… | 正在執行你的符文…… |
| runeDone | Rune finished — back to Main. | 符文跑完了——回到主程式。 |
| runeEmptyCard | empty | 空的 |
| firstSteps (q01 title) | First Steps | 第一步 |
| missingFunction (reword) | Your Rune is empty. Put some cards in it first. | 你的符文是空的，先放幾張卡片進去。 |
| noSelfCall (if F1 shows a notice instead of hiding) | A Rune can't use itself. Use it from Main. | 符文不能呼叫自己，請從主程式使用它。 |

## 3. Navigation feedback (general)

- There is no minimap, and none is needed: rooms are ≤ 9×7 and fit whole on screen (D2).
- Bump message: "Bump! Something blocks the corridor." It does not mention facing. With T1 the blocked chevron already sits on the wall; extend the line to "…The hero is facing a wall." (`…英雄正面對著牆。`).
- The q02 goal ("Follow the corridor to the exit.") teaches no direction words. T1 and T3(a) carry that lesson visually, so no level text needs to change.

## 4. Effort summary

| Fix | Hours | Touches |
|---|---|---|
| F1 hide self-call | 0.5 | codequest.js + harness |
| T1 facing chevron | 1.5 | room-view.js + renderer test |
| T2 turn beat | 1.5 | codequest.js, room-view.js |
| T3(a) hero-hand hint | 1 | room-view.js |
| T4 facing announce + bump line | 0.5 | codequest.js, strings.js |
| F2 call card lights + Rune opens while running | 2.5 | interpreter.js (additive), codequest.js |
| F3 call card shows contents | 1.5 | codequest.js, codequest.css |
| F4 rune icon + q01 title | 1.5 | sprites-world.js, codequest.js, levels.js (title string) |
| F5 two visible tabs | 2 | codequest.js, codequest.css, harness |
| F6 q10 first-visit coach | 2.5 | codequest.js, progression.js (additive flag), strings.js |
| **Total** | **≈ 15 h** | Model, levels' maps/par, and gameplay untouched |

Suggested slicing: **01** F1 alone (bug). **02** T1+T2+T3(a)+T4. **03** F2+F3. **04** F4+F5. **05** F6.
Every slice needs `node scripts/check.mjs` plus `check-codequest-ui.py` green, and a screenshot pass at 1280×600.

## 5. Decisions for Papa

1. T3: hero-hand hint (a, recommended) or live-rotating card arrows (b)?
2. F2: OK to add the call `uid` to `interpreter.js` call frames (additive), and to auto-flip the strip to Rune while it runs?
3. F4: keep "Rune" (with a new icon and the q01 rename, recommended) or rename the concept to "Spell 咒語"?
