# Summer chat — a real chat panel

**Status:** requested by Papa, 2026-10-09 (brief: the chat hides behind the tablet keyboard and feels like a toy popup). Slice 01 built 2026-10-09 and checked in Chrome 138; **waiting on Papa's try on a real tablet** (see "For Papa to check").

**Amends** `2026-10-09-summer-chat-crash-test/` for the chat's *layout only*. Its safety model is untouched: system prompt, OpenAI moderation, the `kid-chat` Edge Function, the `kid_chats` table and the `kid_chat_v1` switch work exactly as before. Presets go through the same function and moderation as typed text.

## Decisions

### D1 — Docked right on wide landscape screens, a full sheet otherwise
`(min-width: 900px) and (min-aspect-ratio: 5/4)` → a full-height panel on the right, `clamp(420px, 43vw, 640px)` wide (≈ 43 % on a 1024 px tablet), with the app dimmed but visible on the left. Anything narrower or taller (small landscape screens, portrait) → a full-height sheet. The aspect-ratio test (not `orientation`) keeps a big tablet from flipping layout when a WebView shrinks the window for the keyboard.

Portrait is allowed outside games since D7, so the full sheet is what a kid sees with the tablet upright.

### D2 — Keyboard-safe by sizing to the visual viewport
The overlay's `top`/`height` follow `window.visualViewport` (`resize` + `scroll`), so the panel is exactly the visible area and the composer sits just above the keyboard. `100dvh` alone does not shrink for the on-screen keyboard in Chrome. Only the message list scrolls (`min-height: 0`, `overscroll-behavior: contain`); the page itself never scrolls. If the list was on the newest message before the resize, it stays there. Focusing the text box re-fits once more after 350 ms for keyboards that finish sliding late. Listeners remove themselves once the panel is gone.

When the visible height is under 460 px (keyboard up), the header and the presets row hide and a 56 px **✕** appears beside Send, so the messages keep the room (Papa, 2026-10-09, after asking whether the keyboard itself can be made shorter — it can't from the app; see "Keyboard height" below).

### D3 — Presets: one bilingual data array
`SUMMER_CHAT_PRESETS` in `index.html` (`{icon, en, zh}`, 8 questions, Taiwan usage — 起司). A tap sends `en` as the kid's message (the transcript Papa sees stays in one language, and replies are always EN + 中文 anyway); the kid's own bubble shows both. Papa (2026-10-09): fine for now; which language a preset sends should follow a language mode once the app has one. There is no app-wide language mode today (only the book reader's and Code Quest's own toggles), so this waits for that decision; the switch is one line in the preset tap handler. One horizontal row of 64 px buttons with a fading right edge as the "swipe for more" hint (no hover, no scrollbar). `scripts/check.mjs` checks every preset has an icon, EN, 中文 and fits the 500-character limit.

### D4 — One send path, one question at a time
Typed text and presets share `ask()`. While Summer is thinking, Send and the presets are disabled (the text box stays usable so the keyboard doesn't drop). After a reply the text box takes focus again only if the kid was typing (or on a mouse/keyboard computer), so a preset tap never pops the tablet keyboard open.

### D5 — Enter sends; never mid-注音
Enter sends on every device (`enterkeyhint="send"` shows a Send key on the tablet keyboard); Shift+Enter is a new line. Enter is ignored while an IME candidate is open (`isComposing` / keyCode 229), so a kid typing 注音 can pick characters without sending half a word. The text box grows to about four lines; max length stays 500.

### D6 — No backdrop dismiss
Closing ends the conversation (nothing is stored), so a stray tap on the dimmed app beside the panel must not erase it. The panel uses the existing `data-nodismiss` opt-out; **✕ Close 關閉** in the header (56 px) and Android Back still close it. This is the only kid popup besides app pause that ignores the backdrop.

### D7 — Portrait allowed, except in games
Papa, 2026-10-09: "make the portrait mode available but locked for games, games need to be in landscape normally." The "Turn your tablet sideways 請將平板橫放" cover in `css/app.css` now shows in portrait only while `body.game-mode` is on (every registry game, which includes Brain Gym rounds). Instruments already carry their own prompt (`js/game-services/music.js`). Planet, Base Camp tabs, My Day, Summer and the chat work upright. `manifest.webmanifest` goes from `"orientation": "landscape"` to `"any"` so an installed PWA can turn upright too. The rotate cover is a prompt, not a forced turn: neither a browser tab nor the APK WebView lets the page rotate the screen itself.

### Kept as is
Never locked by any game/category lock; hidden by app pause and by Papa's `kid_chat_v1` switch (the ☀️ button / 💬 action); offline or no `config.js` → "Summer needs wifi to chat. 和 Summer 聊天需要網路。", the text box and presets disabled, nothing queued; 🔊 on every Summer reply; Lucien hears replies automatically; conversation lives only in the open panel.

## Keyboard height
The on-screen keyboard is a separate Android app; neither a web page nor our APK can change its height. Per tablet: Gboard → Settings → Preferences → Keyboard height (Short / Extra short) and Number row off; Samsung Keyboard → Settings → Size and transparency. Avoid Gboard's floating mode for the chat: it doesn't change the visual viewport, so it can sit over the text box.

## For Papa to check on a real tablet
1. Landscape, Chrome: tap the text box — the keyboard opens and the text box + Send stay visible right above it; the newest message stays in view.
2. Same in the installed APK (WebView) — it may resize the window instead of the visual viewport; both should look the same.
3. Type in 注音: picking a character with Enter must not send.
4. Tap a preset with the keyboard closed: it sends, and the keyboard does **not** open.
5. Whether the dimmed app on the left is right, or the panel should leave the app un-dimmed.
6. Whether tapping beside the panel should close it after all (D6).
7. Upright tablet: Planet, Base Camp tabs, My Day, an activity and a book are comfortable in portrait (only the planet, hub tabs and chat were looked at in the browser); a game shows the turn-sideways cover and plays once turned.
