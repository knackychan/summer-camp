# 01 — Chat panel, presets, keyboard-safe composer

**Depends on:** `2026-10-09-summer-chat-crash-test/01-summer-chat.md` (shipped).

## Scope
- `index.html` — `SUMMER_CHAT_PRESETS`; `openSummerChat()` builds the panel (header with Summer's face, "Chat with Summer 和 Summer 聊天", ✕ Close 關閉), message list, presets row, composer; `visualViewport` fit; one `ask()` send path. `kid-chat` request body unchanged.
- `css/quest-shell.css` — panel layout (design D1, D2), presets, composer, `is-short` keyboard state.
- `sw.js` — cache `summer-quest-v202-summer-chat-panel`, then `v203-portrait`.
- `css/app.css`, `manifest.webmanifest` — portrait allowed outside games (design D7).
- `scripts/check.mjs` — presets are one bilingual array (D3).
- `scripts/check-games-gate-ui.py` — panel checks (below).

Untouched: `supabase/functions/kid-chat/`, `kid_chats`, `kid_chat_v1`, admin transcript view, games, vocab, missions.

## DONE WHEN
- `node scripts/check.mjs` green.
- `scripts/check-games-gate-ui.py` on Chrome 138 green, covering: offline line + disabled composer and presets; a tap beside the panel doesn't close it; docked right at 1024 × 600 (38–47 % wide, full height); Close / Send / preset ≥ 48 px; preset tap shows "Thinking… 想一下…", disables Send and presets, sends the preset's English text, shows its 中文 on the kid bubble; typed message via Send and via Enter; with a simulated keyboard (visual viewport 600 → 300, then scrolled 120 px) the composer stays inside the visible area, presets hide, the list stays on the newest message, the page doesn't scroll; presets return when the keyboard closes; games still gated; Papa's switch hides 💬; full sheet at 854 × 480 with the keyboard up (230 px) after the list overflows; with the keyboard up the header hides and the small ✕ (≥ 48 px) beside Send closes the chat; portrait 800 × 1280: no rotate cover on the hub, the chat is a full sheet and stays above a 760 px visible area; a game in portrait shows the rotate cover, which goes away in landscape.
- Papa's look on a real tablet (design.md "For Papa to check").

## Build notes (2026-10-09)
- Built; both checks green on Chrome 138.0.7204.183. Screenshots: `summer-chat-landscape.png`, `summer-chat-landscape-keyboard.png`, `summer-chat-luis.png`, `summer-chat-small.png`, `summer-chat-small-keyboard.png` in the check's `--out` folder.
- Follow-up the same day (Papa): header hides while the keyboard is up, with a ✕ beside Send; portrait allowed outside games (D7). Portrait survey screenshots of home, planet, Quests, Adventure, My Day: no horizontal overflow at 800 × 1280.
- Headless Chrome has no on-screen keyboard; the check swaps in a stand-in `visualViewport` and shrinks it. A real keyboard (and the APK WebView's own resizing) still needs the tablet check.
