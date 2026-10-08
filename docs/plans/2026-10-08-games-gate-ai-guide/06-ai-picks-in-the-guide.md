# Slice 06 — AI picks and lines in the guide (cached, capped, falls back locally)

**Implements:** design.md D8 (AI source), D9 (client side), D11.
**Depends on:** slices 04 and 05.

## Changes
- **`js/agent-provider.js`**: no contract change. A second instance is created for the guide with `endpoint = SUPABASE_URL + "/functions/v1/games-guide"` and the anon key header. `validate()` gets a `help_pick` stage branch: exactly 3 ids ⊂ the candidates sent, `line` bilingual. Anything else throws, so the local provider answers.
- **`index.html`** guide flow:
  - On the first open in a slot, or on reroll, with `games_gate_v1.ai.enabled` and online: send the top 6 local candidates (design D6) to the function. Show the bubble's existing thinking animation, at most 6.5 s.
  - `fallback:true`, a timeout, offline or an invalid answer → the slice 04 local pick for the same key, saved as `local`. The kid sees the same kind of cards either way. No error text.
  - A cached key (local or server row) never calls the function.
  - After `rerollsPerSlot` AI rerolls, 🎲 keeps working locally (design D8).
- **Admin**: the history table shows the source (`ai` / `local`) and, for AI rows, tokens and cost. The Games gate card gets an "AI today: N calls · $x.xxxx — month $y.yy / cap" line from `guide_usage`, and an *AI suggestions on/off* switch (`games_gate_v1.ai.enabled`).
- **Eval before switching on** (`scripts/eval/games-guide-eval.mjs`, run by hand, costs a few cents, needs Papa's OK to spend): 30 fixed contexts (3 kids × slots × time answers × done-sets). Pass bar: 30/30 valid schema, 30/30 ids ⊂ candidates, ≥ 28/30 picks agree with the deterministic top-6 fit (no homework after 17:30, no garden after 18:00), and Papa reads the 中文 of 10 random lines and accepts them. Results are saved under this folder as `eval-YYYY-MM-DD.md`.

**DONE WHEN:** `node scripts/check.mjs` green. Eval passes and Papa accepts the 中文 sample. In the browser, AI on: first open → one function call, an `ai` row in admin; reopen → no call; reroll ×3 → 3 calls; 4th reroll → a local row, no call. AI off, or wifi off: identical flow, local rows only. Admin cost line matches the sum of `cost_usd`.
