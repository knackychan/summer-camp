# Summer chat — free AI chat for the kids (crash test)

**Status:** approved by Papa, 2026-10-09 ("remove all the prompt limit, let the kids be able to discuss with the AI chat at any moment, we will try this as a crash test"). A trial: Papa watches the transcripts and decides what stays.

**Supersedes** games-gate-ai-guide design D5's "no free text anywhere" **for this chat only**. The home-help guide stays tap-only. Also follows D10 as amended the same day: no spend caps.

## Decisions

### D1 — Chat with Summer at any moment
The ☀️ Summer button (bottom corner, every screen inside the app) opens the companion sheet, which always offers **💬 Chat with Summer 和 Summer 聊天**. The chat is never locked by any lock (Brain Gym, points gate, category locks), like the ask channel. App pause (Papa's own switch) still covers it because the button isn't shown then.

### D2 — No limits on the kids
No message count, no daily cap, no reroll-style limit. Only technical bounds so one request can't be huge: the tablet sends the current conversation's last 20 messages, each up to 1000 characters (the text box allows 500). Closing the chat ends the conversation; nothing is kept on the tablet.

### D3 — Safety stays
- A fixed system prompt: Summer is a warm, playful companion for children aged 4–9 in Taiwan; short, simple, age-fitting answers; no violence, scary, sexual or adult content; never asks for or repeats personal details (full name, address, school, phone, passwords, photos); never suggests meeting anyone or keeping secrets from parents; feelings, health, safety or worrying topics → kind words and "let's tell Papa"; doesn't help get around app locks or rules; honest that it's an AI helper.
- **OpenAI moderation** (`omni-moderation-latest`, free) on the kid's message and on the reply. A flagged kid message gets a gentle fixed bilingual answer pointing to Papa, with no model call; a flagged reply is replaced by that answer. Both are marked `flagged` for Papa.
- The model sees only the age band and the current conversation: no names, no other history.

### D4 — Bilingual replies
Every reply is `{en, zh}` through a strict JSON schema (Traditional Chinese, Taiwan usage), so the bilingual invariant holds for AI text too. 🔊 reads the reply aloud, English then 中文 (helps Lucien, who can't read yet).

### D5 — Papa sees everything
Each exchange (kid message + reply, flag, tokens, cost) is saved by the function in a new table `kid_chats`: written only by the function, readable only by a parent in `admins`. Admin → Quests → Points & assignments shows the last 7 days, newest first, flagged ones marked, with the AI cost.

### D6 — Papa's switch
`family_settings.kid_chat_v1 = {"enabled": true|false}`; missing = on. Off hides 💬 on the tablets and the function answers with a fixed "chat is resting" line. Toggle in the same admin card.

### D7 — Offline
No wifi or no `config.js` → the chat opens with "Summer needs wifi to chat 和 Summer 聊天需要網路", and nothing is queued. Games and My Day are unaffected.

## Pieces
- `supabase/functions/kid-chat/` — `chat.mjs` (logic, Node-testable), `index.ts` (HTTP, database), deployed like `games-guide`.
- `supabase/migrations/20261009_kid_chats.sql` — table + RLS.
- `index.html` — chat overlay from the companion sheet. `js/admin.js` — switch + transcripts.
- Tests: `scripts/kid-chat-fn.test.mjs`; browser check in `scripts/check-games-gate-ui.py` with the function faked.

## Risks
- The anon key is public, so with no caps the function is an open door to the OpenAI key for anyone who extracts it. The OpenAI project budget is the only money limit. Papa accepted this for the trial.
- Children may type personal details; the prompt never asks or repeats them, but they reach OpenAI and the transcript table.
