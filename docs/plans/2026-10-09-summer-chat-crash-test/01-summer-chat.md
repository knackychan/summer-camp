# Slice 01 — Summer chat end to end

**Implements:** design.md D1–D7. **Depends on:** games-gate-ai-guide slice 05 (OpenAI key secret, function deploy path).

## Changes
- `supabase/functions/kid-chat/chat.mjs` + `index.ts`: validate `{kid, session, messages}`; Papa's switch; moderation on the last kid message; Responses API call (`gpt-6-luna`, strict `{en, zh}` schema, 20 s timeout); moderation on the reply; save one `kid_chats` row; return `{en, zh, flagged}`. Errors → a fixed bilingual "try again" line, never a stack.
- `supabase/migrations/20261009_kid_chats.sql`: table, RLS read for parents only, no tablet writes. Idempotent.
- `index.html`: 💬 in the companion sheet; chat overlay with bubbles, 🔊, a 500-character text box and Send; offline line.
- `js/admin.js`: chat switch and 7-day transcripts.
- Tests: `scripts/kid-chat-fn.test.mjs` (fake fetch + DB): good reply saved with cost; flagged kid text → no model call, flagged row; flagged reply replaced; switch off; bad requests; model error → fallback line. Browser: chat round trip with the function faked.

**DONE WHEN:** `node scripts/check.mjs` green; function deployed; migration run; a real message from a tablet gets a bilingual reply and shows in admin; Papa tries it with the kids.
