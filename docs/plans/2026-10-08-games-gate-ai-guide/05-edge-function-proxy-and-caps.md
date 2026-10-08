# Slice 05 — `games-guide` Edge Function, usage table and spend caps (no kid-facing change)

**Implements:** design.md D9, D10 (server side).
**Depends on:** slice 04 (`guide_decisions`); **Papa's OK on Q4** (AI tutor moved up). Without it, stop here and leave 05–06 unbuilt.

## Changes
- **`supabase/functions/games-guide/index.ts`** (new, Deno):
  - Provider: OpenAI **`gpt-6-luna`** (Papa, 2026-10-08) through the Responses API, `POST https://api.openai.com/v1/responses` with `fetch`. This follows the same request shape as `server/agent-proxy/src/providers/OpenAIProvider.ts`: `reasoning: {effort: "low"}`, `instructions`, `input`, `max_output_tokens: 700`, `text.format = {type: "json_schema", name: "games_guide_picks", strict: true, schema}`. Read the output text the same way as that file's `extractOpenAIText`, and read `usage.input_tokens` / `output_tokens` for cost. Re-check the exact parameters against OpenAI's current API reference at build time. Timeout below the tablet's 6.5 s.
  - Request validation: `kid` ∈ {luis, lili, lucien}; `day` = Taipei today; `slot` = Taipei slot now (± one slot at a boundary); every candidate id ∈ the home-help ids (a copy of the id list generated from `js/home-help-data.js` at build time, see the check below); `reroll` ≤ `rerollsPerSlot`.
  - Idempotent: if `guide_decisions` already has the key, return it with no model call.
  - Caps (design D10) read from `games_gate_v1.ai` and checked against `guide_usage` in one transaction. If over, return `{fallback:true, reason}`.
  - Response check: exactly 3 distinct ids ⊂ candidates, `line` `[en ≤ 90, zh ≤ 45]`, both non-empty, `<>` and control characters stripped. Otherwise, or on a `refusal` content part, `status: "incomplete"` or a non-2xx response, return `{fallback:true}`. No retry on another model.
  - On success: insert `guide_decisions` (`source:'ai'`, model, tokens, `cost_usd` from an in-function price table) and update `guide_usage` in the same transaction. Return the row.
  - Prompt: fixed system text (role: a warm guide for a family helping game; choose exactly 3 of the given candidates that best fit the time of day, the time the child has, and the points still needed; one short encouraging line each in English and Traditional Chinese (Taiwan usage); never shame, never mention lateness; no other content). The user turn is the JSON context only (age band, slot, minutes, time answer, need, candidates with labels / points / minutes). No names, no history.
- **SQL** `2026xxxx_guide_usage.sql`: `guide_usage(day date, kid_id text, calls int, cost_usd numeric(10,6), primary key(day,kid_id))`. RLS: read admin only; no anon or authenticated write (only the function writes, using its hosted service role).
- **Secrets / deploy doc** `supabase/functions/games-guide/README.md`: create a **dedicated OpenAI API project** for the guide (separate from the ChatGPT subscription, which doesn't cover API use) and add prepaid credits. Set that project's monthly budget, and note whether it hard-stops or only alerts. Then `supabase secrets set OPENAI_API_KEY=…` from Papa's own terminal. `supabase functions deploy games-guide`. How to rotate the key. **No key, `.env` or service-role value is ever written to the repo**; `.gitignore` gains `supabase/functions/**/.env*`.
- **`scripts/check.mjs`**:
  - Secret scan extended to `supabase/functions/**` (no `sk-proj-` / `sk-` OpenAI key shapes, no service-role JWT shape, no `OPENAI_API_KEY=` with a value).
  - The id list in the function equals `SQHomeHelp` ids.
- **`scripts/games-guide-fn.test.mjs`**: runs the handler with a fake `fetch` (canned Responses API bodies) and a fake DB. Cases: cap reached → fallback with no model call; repeat key → cached row with no model call; bad model output (2 ids, missing 中文, an unknown id) → fallback; refusal → fallback; good output → one decision row + usage +1, with cost computed from tokens.

**DONE WHEN:** `node scripts/check.mjs` green, including the secret scan. Function tests pass. Deployed to the Supabase project with Papa's key, a `curl` with the anon key returns 3 valid bilingual picks. The same `curl` repeated returns the same row, with `guide_usage.calls` unchanged. With `dailyUsdCap` set to 0 it returns `fallback:true`. `git grep -nE "sk-(proj-)?[A-Za-z0-9]{20,}"` finds nothing.
