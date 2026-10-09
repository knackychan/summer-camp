# games-guide Edge Function

Picks 3 home-help activities with OpenAI `gpt-6-luna` for the games-gate guide
(`docs/plans/2026-10-08-games-gate-ai-guide/`, slices 05–06). The tablet sends
the top local candidates; the function checks the request, returns a saved
decision if one exists for that kid / day / slot / reroll, or asks the model,
checks its answer and saves an `ai` row in `guide_decisions` with its tokens and
cost. Anything wrong (AI switched off, bad answer, timeout, refusal, HTTP error)
returns `{fallback: true, reason}` and the tablet uses its own local pick.

**No spend caps** (Papa, 2026-10-09). What still limits calls: one decision per
key, the day and slot must be now, and `reroll` ≤ `games_gate_v1.rerollsPerSlot`
(default 3), so at most 4 calls per kid per slot, 36 a day for the family.
The OpenAI project's own budget is the only money limit.

Files: `index.ts` (HTTP + database), `guide.mjs` (logic, tested by
`scripts/games-guide-fn.test.mjs`), `items.mjs` (copy of the home-help list,
checked against `js/home-help-data.js`).

## Before deploying

1. `guide_decisions` exists (`supabase/migrations/20261008_guide_decisions.sql`,
   POINTS-ROLLOUT.md step 10).
2. The OpenAI key is a Supabase secret, set from your own terminal or the
   dashboard (Edge Functions → Secrets):
   `npx supabase secrets set OPENAI_API_KEY=...`
   Use a key from its own OpenAI API project with a monthly budget set.
   Never put the key in this repo, `js/config.js`, a committed `.env` or an APK
   (`supabase/functions/**/.env*` is gitignored; `scripts/check.mjs` scans for
   key shapes).

## Deploy

```
npx supabase login
npx supabase functions deploy games-guide --project-ref iwwjfegkloxcbcqjwocz
```

The function reads the database with the key Supabase injects into hosted
functions; nothing else to configure. AI stays off until
`games_gate_v1.ai.enabled` is true (slice 06 adds the admin switch).

## Try it

With the anon key from `js/config.js` (PowerShell, today's Taipei date and slot):

```
$body = '{"kid":"lili","day":"2026-10-09","slot":"morning","reroll":0,"answers":{"done":[],"time":"some"},"candidates":["homework","shoes","garden","living","office","clothes"],"need":30}'
curl.exe -s -X POST "$env:SB_URL/functions/v1/games-guide" -H "Authorization: Bearer $env:SB_ANON" -H "content-type: application/json" -d $body
```

Run it twice: the second answer is the same row with `"cached": true`.

## Rotate the key

Create a new key in the OpenAI project, `npx supabase secrets set OPENAI_API_KEY=...`
again (the function picks it up on its next start), then revoke the old key.
