# Code Quest: simple cards — stickers, two rows, a picker on the right

**Status:** Design approved by Papa in chat, 2026-10-05. Slices 01–04 built 2026-10-06 (see "As built" at the end); waiting on Papa's tablet play of q10–q12.
**Game id:** `codequest`.
**Builds on:** `2026-10-03-code-quest-redesign/` and `2026-10-05-code-quest-facing-and-rune/`. Everything there stays in force except what "Supersedes" lists below. Those docs stay in the repo.

## Why

Papa played q11 "Reusable Strike" ("Call a Rune") and could not work out what to do. He put Attack in the Rune, pressed Run, and nothing happened. His verdict: Wrap, the Rune strip and Main are far too complicated for the kids. And the bottom card shelf is a flat, unsorted row — q15 shows 64 cards in it.

What the game actually did in his run (checked against `model.js`):

| What he built | What the game did |
|---|---|
| Attack in the Rune, Main empty | Refused with "Add at least one action card first." — wrong, he had added one, inside the Rune. |
| Attack in the Rune, Main without a Rune card | "This quest asks you to Call Rune." — no card is called "Call Rune"; the library card says "Rune". |
| Main = Rune, Rune = one Attack | Ran one hit. Each goblin has 2 HP, so it looked like nothing happened. |

Also: Run pressed while the Rune tab is open quietly runs Main; "call" is never explained; the Rune coach shows once in q10 and never again.

## What the levels really need

Of 72 rooms, 24 are card rooms (`blocks` or `hybrid`); the other 48 are typed code. In those 24 reference solutions:
- every Repeat wraps exactly **one** card, except q12's Rune `R2[attack, attack]` (Attack ×4 does the same and is shorter);
- every If wraps exactly **one** card, and no room uses else;
- q16 is the only nesting: `R2[IF armored [heavyAttack]]`, one card with both;
- q45 repeats Move by an expression count (`R(L(5), …)`); it stays a legacy bracket (D2).
- every Rune body is **one** node.

So "select cards, Wrap them into a bracket" is far more power than any card room needs. A card that carries a repeat and/or a condition covers all 24.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | **Stickers instead of Wrap.** Repeat and If become stickers that sit on one card.<br>• Repeat stickers: one per repeat id the room offers (`repeat2/3/5` → "2 times / 2 次", "3 times / 3 次", "5 times / 5 次").<br>• If stickers: one per `if*` id the room offers, picture + short words on the card ("if enemy / 如果有敵人", "if trap / 如果有陷阱", "if hurt / 如果受傷", "if poisoned / 如果中毒", "if danger / 如果有危險", "if armored / 如果有盔甲", "if lever / 如果有拉桿", …). In the picker the If sticker uses the longer words: "only if" + the existing `CONDITIONS` text.<br>• A card holds at most one repeat sticker and one if sticker. A new repeat sticker replaces the old one; same for if.<br>• The sticker hangs under the card name as a coloured tag: repeat in the loop colour, if in the logic pink. Its words always show, in every representation (Papa: stickers must have a simple text label). | Papa: stickers, if they are clear and carry a simple text label. It matches what the levels need, and "Move, 5 times" is how a kid already says it. |
| D2 | **Stickers are only a view of the existing AST.** No new node type.<br>• card + repeat N → `repeat(N, [card])`<br>• card + if T → `ifNode(T, [card])`<br>• card + both → `repeat(N, [ifNode(T, [card])])` (q16's shape)<br>Any other shape (several cards in one Repeat/If, else, nested deeper, `forOf`, expression counts) is a **legacy bracket**: drawn as today's bracket, still runs, can be removed or moved, but can't take stickers. Only the Code sheet or a loaded loadout can make one. | `model.js`, `interpreter.js`, `levels.js`, par, block counts and the code rooms stay untouched. A sticker card counts the same blocks as the bracket it replaces. |
| D3 | **How a kid adds a sticker.** Tap a sticker in the picker: it goes on the selected card, or on the last card of the glowing row when none is selected. Empty row: "Put a card first, then its sticker." / "先放一張卡片，再貼貼紙。". A legacy bracket: "This card can't take stickers." / "這張卡片不能貼貼紙。". Every sticker change is one undo step. | One tap, no menu, no selection ritual. "Last card" is the card the kid just placed. |
| D4 | **The card menu shrinks.** Tapping a card selects that one card (no more multi-select runs) and opens: ◀ move, ▶ move, "Take stickers off" / "撕掉貼紙" (only when the card has any), 🗑 remove. Wrap, Unwrap, the count cycler and the test picker are gone. | Every removed control was there to build or edit brackets. |
| D5 | **Two rows, always visible.** In a room offering `callRune` the bottom shows two rows: **Rune** (🪨 rune-stone icon) above, **Hero** (▶) below. Other rooms show only the Hero row.<br>• The Hero row glows by default; tapping a row's name makes it glow, and new cards go to the glowing row.<br>• The 🪨 Rune card sits at the top of the picker. While the Rune row glows it is dimmed with "Use it in the Hero row" / "在英雄那一排使用它" (D9 of facing-and-rune stays as the guard).<br>• On a 🪨 card in the Hero row: the card shows only the stone and "Rune / 符文", no mini row of cards (both rows are on screen).<br>• While running, the card being run lights up in its own row. The strip never flips. | Papa: "two rows instead of a switchable queue". It is Lightbot's main + procedure rows, which 4–6 year olds manage. |
| D6 | **Words fixed.**<br>• Hero row empty, Rune row not empty: "Your Rune is ready! Put the 🪨 card in the Hero row." / "你的符文準備好了！把 🪨 卡片放到英雄那一排。"<br>• `needCall`: "This quest needs the 🪨 Rune card in the Hero row." / "這一關要把 🪨 符文卡片放到英雄那一排。"<br>• `functionHint` and the tab-flip messages `runeRunning` / `runeDone` are no longer shown.<br>• The Rune coach becomes one card pointing at the Rune row: "Cards in the Rune row run every time the hero reaches a 🪨 card." / "每次英雄走到 🪨 卡片，符文那一排的卡片就會執行。" [Got it]. Same once-per-kid `coach: ['rune']` flag. | The three messages Papa hit all named the wrong thing. |
| D7 | **Picker on the right.** The card library leaves the bottom and becomes a column on the right of the play area, about a quarter of the width; the dungeon shrinks to fit. Run / Step / Reset sit at the foot of that column. The bottom holds only the program row(s) and Undo / Clear.<br>• ≤ 8 cards + stickers in the room: one list, no tabs.<br>• More: tabs, only for groups the room has: 🚶 Walk (move, turn), ⚔️ Fight (attack group), ✋ Use (use group), 🧪 Care (care group), 🐾 Friend (ally group), 🏷️ Stickers (repeat + if). Groups follow the existing `opCategory`.<br>• The 🪨 Rune card is pinned above the tabs.<br>• The open tab is remembered per room for the session; a new room opens on Walk.<br>• Every target ≥ 48 CSS px; it must fit 1280×600 and 1280×800 with no page scroll. | Papa: "picker on the right, leave the bottom for the code". Categories turn q15's 64-card hunt into one tab tap plus a short list. |
| D8 | **Unchanged:** `model.js`, `interpreter.js` (the `activeCalls()` hook from facing-and-rune stays and is still used to light the running Rune card), `parser.js`, `ast.js`, `levels.js`, par, the Code sheet and the typed-code rooms' editing, the Lab, stars, offline, the facing chevron and turn beat. | Presentation and input only. |

## Supersedes

- Redesign slice 04's bottom library shelf, and its strip-end tools layout (D7).
- UX-polish slice 08's card menu Wrap / Unwrap / count / test controls and multi-card selection (D4).
- Facing-and-rune D5 (strip follows the running program — the strip no longer flips), D6 (Main/Rune tabs and call-card brackets with mini rows), D10's three-step coach (now one card). D1–D4, D7–D9 of that plan stay.

## Units

| File | Change |
|---|---|
| `js/games/codequest/stickers.js` (new, pure) | `cardView(node)` → `{ card, times, test }` or `null` for a legacy bracket; `withSticker(node, sticker)`, `withoutStickers(node)`; build the D2 shapes with fresh uids |
| `js/games/codequest.js` | sticker cards on the strip, sticker taps, slim card menu, two rows, picker column + tabs, messages, one-card coach |
| `js/games/codequest/strings.js` | sticker words, picker tab names, new messages (EN + 中文) |
| `css/codequest.css` | sticker tags, two rows, right column picker |
| `sw.js` | add `stickers.js` to `APP_SHELL`, bump `CACHE_NAME` |
| tests | `scripts/codequest.test.mjs` (stickers), `scripts/check-codequest-ui.py` (taps, layout, both sizes) |

## Slices

| # | Slice | Depends on |
|---|---|---|
| 01 | Sticker model (pure, tested) | — |
| 02 | Sticker cards on the strip; slim card menu; Wrap gone | 01 |
| 03 | Picker on the right with tabs | 02 |
| 04 | Two rows for the Rune; words and coach fixed | 02 |

## As built (2026-10-06)

Built as written, with these choices the slices left open or the screen forced:

- **Picker width.** The column is `clamp(240px, 27%, 348px)`, not 25 %: q15's six tabs need 6 × 48 px plus gaps, which does not fit in a quarter of a 1280 px screen.
- **Two-row dock is compact.** With both rows on screen the cards use the small size (56 px wide), and at 1280×600 smaller still, so every 9×7 room keeps its 2× pixel scale. `check-codequest-ui.py` now checks all 72 rooms draw at 2× or more at both sizes.
- **Sticker tags sit side by side** under the card name; a card with stickers grows sideways (up to 190 px) instead of taller. Rooms that offer stickers reserve one tag line in the row so adding the first sticker never moves the room.
- **If-sticker pictures** reuse the room sprites (goblin for enemy, trap for trap, lever for lever, …); every `if*` test has a short line in `strings.js` `STICKER.short`.
- **Running Rune.** The card being run lights up in its own row; the 🪨 card in the Hero row whose Rune is running gets a dashed ring (`calling`), read from `activeCalls()` (D8). Only one card is ever lit.
- **Row switching.** Tapping a row's label or its empty space makes it glow; tapping a card in the other row also switches to that row.
- **Card menu** uses the trash glyph for 🗑 and the words "Take stickers off / 撕掉貼紙" for the sticker button.
- **Speech bubble.** The scene beside the picker is narrower, so with the goal card and the event debugger both open the bubble could find no clear spot. `bubble.js`'s caption fallback now also tries every gap along the bottom (then top) edge, nearest the middle first, and the debugger panel is only as tall as its content. Outside that fallback the bubble behaves as before.
- **`snapshot()`** gains `pickerTab` and `roomScale` for the browser checks. `strip-edit.js` is unchanged (its Wrap helpers and tests stay; the game no longer calls them).
