# Slice 24 — Conversation dock

**Depends on:** 20 (shell has a dock column), 21 (component vocabulary).
**Design:** `design.md` §3. Decisions D3, D4, D5 — carried unchanged from slice 13.

## Why

Slice 13's conversation rail was the right idea attached to the wrong shell: it only existed on one page because there was only one page. In the new shell it is present on every route, so navigating to `#stars` never means missing a question.

## Files

- `admin.html` — `aside.dock` content
- `css/admin.css` — `.dock`, `.stream`, `.msg`, `.pin`, `.dock__send`
- `js/admin.js` — `renderConversation()` retargeted; scroll and filter logic preserved

## Steps

1. **Move the existing conversation panel into `aside.dock`.** `chatStream()`, `chatRowHtml()`, `chatFilterChips()`, `renderConversation()` and `sendChatMessage()` keep their behaviour; only the container and the class names change.
2. **Restyle rows** to the ops vocabulary: `.msg--kid` (left), `.msg--papa` (right, filled with `--action-bg`), `.msg--task` (full-width, `--status-now` ground, carries Approve/Deny/Grant), `.sys` (centred, quiet).
3. **Pinned Papa note** stays at the top of the dock, never filtered out, with an Edit control routing to `#content`.
4. **Filters** keep `localStorage["sq-admin-chat-filters"]` and its defaults (`ask`, `claim`, `pass` on; `system`, `photo` off). Chips gain `aria-pressed` (A10). Kid filter single-select, kind filter multi-select, `⚡ Needs you` overriding both.
5. **Scroll behaviour preserved:** auto-scroll only when already at the bottom; otherwise show the "new messages ↓" pill. `chatStuckToBottom` and `chatUnseen` are kept as-is.
6. **Drawer below 1280px:** `.dock.is-open`, opened by the counted top-bar trigger, closed by its ✕, the scrim, or Escape. Focus moves into the dock on open and back to the trigger on close.
7. **Empty result** renders "Nothing here" plus a one-tap "Clear filters".

## DONE WHEN

- The conversation is visible and usable on all seven routes at ≥1281px, and one tap away below that.
- Every action from the old rail — reply, voice playback, approve/deny claim, grant/deny pass, archive, send — works from the dock.
- Filters survive a reload; the badge and the `⚡ Needs you` chip always agree (they share `queueRows()` from slice 23).
- Scrolled up, a new message does not yank the viewport; the pill appears and scrolls on tap.
- Drawer traps nothing: Escape closes it and focus returns to the trigger.
- `node scripts/check.mjs` green; every new string that reaches a kid ships EN + 繁體中文 (D23).
