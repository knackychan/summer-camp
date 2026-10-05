# Slice 02: Sticker cards on the strip; Wrap gone

**Status:** Design approved by Papa 2026-10-05 (`design.md` D1–D4). Not started.
**Goal:** A kid builds "Move, 5 times" and "Attack, if enemy" with two taps, and the strip shows the words on the card.
**Depends on:** 01
**Files:** `js/games/codequest.js`, `js/games/codequest/strings.js`, `css/codequest.css`, `scripts/check-codequest-ui.py`.

## Change

- **Library.** The `repeat*` and `if*` logic cards become sticker buttons (`sticker:repeat:N`, `sticker:if:<test>`). Picker words: repeat "N times / N 次"; if "only if" + `CONDITIONS[test]` ("only if: Enemy ahead" / "只有在：前方有敵人"). The bottom library stays where it is in this slice (slice 03 moves it).
- **Sticker tap** (D3): target = the one selected card, else the last card of the current program. Uses `withSticker`; `null` → the legacy-bracket message; empty program → the "card first" message. One `pushUndo()` per tap. Announce the result for the screen reader ("Move, 5 times").
- **Strip.** `stripCard` draws any node with a non-null `cardView` as one card: the card's icon + name, and under it one tag per sticker (`.cq-sticker.loop` "5 times", `.cq-sticker.logic` with the condition picture + short words). The running highlight lights the whole card. A `null` view still draws today's bracket.
- **Selection.** Tapping a card selects only that card (drop `extendSelection` from the strip path).
- **Card menu** (D4): ◀, ▶, "Take stickers off" / "撕掉貼紙" (only when `times > 1` or `test`), 🗑. Remove `menu:wrap`, `menu:unwrap`, `menu:count`, `menu:test:*` and the wrap choices row.
- **`strings.js`**: `STICKER` short words for every `if*` id in `IF_TESTS` and for repeat counts; `MESSAGES.stickerNeedsCard`, `stickerNoBracket`; `UI.stickersOff`. All EN + 中文 (Taiwan usage).
- **`check-codequest-ui.py`**: replace the slice-08 "×5 Move, Right, ×3 Move by Wrap" run with the sticker path.

## DONE WHEN

- Harness, both sizes, taps only:
  - q05: Move, ×5 sticker, Right, Move, ×3 sticker → `program` equals the reference shape; Run wins.
  - q16: Heavy attack, if-armored sticker, ×2 sticker → `R2[IF enemyArmoredAhead[heavyAttack]]`.
  - q07: tap ×3 sticker on an empty strip → the "card first" notice, program unchanged.
  - Card menu shows exactly ◀ ▶ (stickers off) 🗑; no Wrap anywhere in the DOM.
  - Every sticker button and menu button ≥ 48 px and hit-testable.
- `node scripts/check.mjs` and `python scripts/check-codequest-ui.py` green.
- Screenshot of q05 and q16 strips for Papa.
