# Code Quest: which way the hero faces, and what the Rune is

**Status:** Approved by Papa, 2026-10-05. In chat, after reading `audit.md` (same folder), Papa answered the three open questions:
- T3: the **recommended** hero-hand hint, not rotating card arrows (→ D3).
- F2: **yes** to an additive call-frame `uid` in `interpreter.js` and to the strip flipping to Rune while Rune runs (→ D4, D5).
- F4: **yes** to keeping the name "Rune" with a new icon and renaming q01 (→ D7, D8).

**Implemented:** slices 01–05 shipped 2026-10-05 (see each slice's Implemented line). Pending: Papa's look on a real tablet.
**Game id:** `codequest`.
**Builds on:** `2026-10-03-code-quest-redesign/` (design.md, design-ux-polish.md). Everything there stays in force except:
- Redesign slice 04's single Main ⇄ Rune toggle, which D6 replaces with two visible tabs.
- The redesign's "interpreter untouched" scope note, which D4 amends with one additive field and one read-only method.

## Why

Kids playing Code Quest have two complaints. "Turning doesn't turn the hero." "What is the ƒ?"

The audit found that the hero's sprite does change facing. What goes wrong is everything around it:
- Nothing on screen marks "forward".
- A turn is a one-frame swap with no beat.
- The Left/Right card arrows point screen-left/right, but the turns are relative to the hero. A hero facing the kid turns Left toward screen-right.

The Rune problems are:
- One bug: Rune could call itself from its own editor.
- The program strip goes blank while Rune's body runs.
- A call card hides what it does.
- ƒ is a maths letter. "Rune" also names the q01 sequence lesson.
- The toggle never shows both programs.
- q10 asks a kid to build and call a function on first contact.

## What the brief got wrong (kept so the slices don't repeat it)

- There is no image sprite sheet and no CSS transform. The hero has three code-drawn facing frames (W is E mirrored), and they already swap correctly.
- Rotating the sprite or the camera is out. The sprites are 3/4 top-down art, and polish U6 already rejected camera rotation.
- There are no hover tooltips. The app is tablet-first (CLAUDE.md), so explanations go in bubbles and the coach card.
- Compass words ("Facing: North") don't help 5–7 year olds. Screen words (up / down / left / right) are used, and only for the screen reader.
- 執行 is already the Run button. Function words stay 函式 and 呼叫, which are Taiwan usage and already used everywhere.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | **Facing chevron.** A small cyan pixel chevron with a dark outline sits on the tile in front of the hero and points the way the hero faces.<br>• It is drawn after the upright sprites, so the hero's head never hides it. For a hero facing up, it sits in the top part of the tile ahead, above the head.<br>• It is dimmed (alpha 0.45) when that tile is a wall or outside the room.<br>• It is hidden while the hero slides between tiles, while the turn beat (D2) plays, and once the room is won.<br>• It is drawn for the hero only. | Shows "forward" at a glance without changing the hero art. Cyan is the colour of the hero's ring and of the Explorer path-preview tip, so the same colour already means "where the hero goes". |
| D2 | **Turn beat.** A turn gets a 320 ms FX of kind `turn`:<br>• Pixel arc: a quarter arc around the hero sweeps from the old facing to the new one and is revealed as it goes.<br>• Hand: a small skin-coloured mitten appears at the arc's end. That end is the side the hero turned to, and it is the hero's own left or right hand.<br>• Sound: the existing `pop` sfx plays.<br>The companion's turns get the same beat. With reduced motion the whole arc and hand show at once for the same time. | A turn becomes an event the eye can catch. The hand at the end is Papa's chosen "hero-hand hint" (T3a): Left always ends at the hero's left hand, wherever the hero faces. |
| D3 | **Words for a turn.**<br>• **Step** (not Run): the bubble says "Left turn — toward the hero's left hand." / "左轉——往英雄的左手邊。" (and the Right versions).<br>• **Both modes:** the screen reader hears "Facing up / down / left / right" (面向上方／下方／左邊／右邊).<br>• **Run:** no turn bubble, so a fast run isn't flooded with text. | Step is when a kid is studying a single card. |
| D4 | **The interpreter remembers which call is running** (Papa: yes).<br>• The `function` frame pushed for a `call` keeps the call node's `uid`.<br>• A new read-only `ProgramRunner.activeCalls()` returns the uids of the open function frames, outermost first.<br>• No behaviour, budget, error or event shape changes. | The UI needs to know which call card is running while Rune's body runs, and no event carries that today. |
| D5 | **The strip follows the running program** (Papa: yes).<br>• After each step, `S.activeCalls` is read from the runner. A card is lit if it is the running node or an open call.<br>• While a Rune call's body runs, the strip shows Rune, and the kid sees Rune's own cards light up. When it returns, the strip goes back to Main.<br>• Entering Rune says "Running your Rune…" / "正在執行你的符文……", and leaving says "Rune finished — back to Main." / "符文跑完了——回到主程式。". Other event messages, such as a bump, still take over.<br>• When the run ends (won, resting, done, error, reset or a new room), the strip goes back to whatever the kid was editing before Run. | The moment that teaches "calling runs those cards" becomes visible. Before this, the strip highlight vanished and the hero seemed to move by itself. |
| D6 | **Two visible tabs.**<br>• `▶ Main` and `Rune` (rune-stone icon) sit side by side at the start of the strip. Each is at least 48 CSS px in both directions.<br>• The tab being edited is filled in its colour with a gold edge. The other is dark with a coloured outline.<br>• The Rune tab shows up to 4 dots, one per card in Rune; it shows a hollow dot when Rune is empty.<br>• Both tabs use the `cat-func` navy/blue colours, so Rune is never logic pink.<br>• A call card in a strip is drawn as a bracket: the Rune head plus a mini row of Rune's current cards (`miniCards`), the same way Repeat shows its body. While a call runs, only that call's mini row lights up. | Both programs are always visible, and so is what a call will do. It replaces the single toggle of redesign slice 04, which named only the strip being edited. The 1280×600 two-row dock is re-checked by the harness. |
| D7 | **A rune you can read.**<br>• The ƒ glyph becomes a vector rune-stone: a rounded stone tablet with a carved zigzag mark, filled in the card's colour like the other logic glyphs.<br>• It is used everywhere `glyph('call')` appears: call cards, Rune tab, library Rune card, event-handler cards.<br>• The name "Rune / 符文" stays (Papa). | ƒ reads as the letter f to a 6-year-old. A stone with a mark matches the dungeon's runes. The other logic cards (Repeat, If) are vector glyphs, not sprites, so this stays a vector too. It amends the audit's "pixel sprite" idea. |
| D8 | **q01 is renamed.** Title "First Rune / 第一個符文" becomes "First Steps / 第一步". This is a string-only change: concept, map, par and rewards are untouched. | "Rune" means the function. A sequence lesson called "First Rune" taught the wrong word at the very start. |
| D9 | **Rune can't call itself from its own editor.**<br>• While the Rune strip is being edited, the library hides the Rune card.<br>• `logic:callRune` refuses with "A Rune can't use itself. Use it from Main." / "符文不能呼叫自己，請從主程式使用它。", as a guard for any other path.<br>• `missingFunction` is reworded to "Your Rune is empty. Put some cards in it first." / "你的符文是空的，先放幾張卡片進去。". | This is the bug from audit F1. The old wording used "function" without explaining it. |
| D10 | **Rune coach, once per kid.** It appears the first time a kid opens an authored room offering `callRune` (q10 today), unless the room is an expedition, endless or code room. It is a coach card with a pointer and three steps, each with a 48 px button:<br>1. "This is your Rune — your own card. The cards inside it run together." / "這是你的符文——你自己的卡片。放在裡面的卡片會一起執行。" Points at the Rune tab. [Next ›]<br>2. "Build it once here." / "先在這裡做一次。" The strip flips to Rune and the pointer points at the strip. [Next ›]<br>3. "Then use it again and again from Main." / "然後在主程式裡一用再用。" The strip flips back to Main and the pointer points at the library Rune card. [Got it]<br>"Got it" saves `coach: ['rune']` in the Code Quest profile. This is additive in v12, as `lab` was. The card is not modal: the room stays playable. Leaving the room hides the card, and it returns next time until "Got it". | It gives the "why" before the first function room without changing q10's level, par or answer (audit F6). |
| D11 | **Unchanged:** `model.js`, `levels.js` except the q01 title strings, `parser.js`, `ast.js`, `run.js`, `preview.js`, the Lab, stars and offline. No change to how the turn rules work: Left/Right stay relative to the hero. | This plan is presentation plus one read-only interpreter hook. |

Dropped from the audit:
- The extended bump line ("…facing a wall"). A `blocked` result doesn't say what blocked the hero, and D1's dimmed chevron already shows a wall ahead.
- The library Rune card's mini row. The library cards are fixed size; the Rune tab dots (D6) and call-card brackets carry the preview instead.

## Units

| File | Change |
|---|---|
| `js/games/codequest/room-view.js` | `drawFacing` (D1), `turn` FX with arc + hand (D2) |
| `js/games/codequest/interpreter.js` | `uid` on function frames, `activeCalls()` (D4) |
| `js/games/codequest.js` | turn FX/words (D2, D3), active calls + strip follow (D5), tabs + call brackets (D6), glyph (D7), self-call guard (D9), coach (D10) |
| `js/games/codequest/strings.js` | new strings (D3, D5, D9, D10) |
| `js/games/codequest/levels.js` | q01 title only (D8) |
| `js/games/codequest/progression.js` | `coach` list + `markCoachSeen` (D10) |
| `css/codequest.css` | tabs, call bracket, coach card |
| tests | `scripts/codequest.test.mjs`, `scripts/codequest-renderer.test.mjs`, `scripts/check-codequest-ui.py` |

## Slices

| # | Slice | Depends on |
|---|---|---|
| 01 | Rune can't call itself (D9) | — |
| 02 | Facing chevron, turn beat, turn words (D1–D3) | — |
| 03 | Running Rune is visible (D4, D5, D6's call brackets) | 01 |
| 04 | Rune icon, two tabs, q01 title (D6 tabs, D7, D8) | 03 |
| 05 | Rune coach (D10) | 04 |
