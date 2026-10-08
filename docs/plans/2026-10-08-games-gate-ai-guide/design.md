# Games gate by helping points, with a home-help guide

**Status:** **Approved by Papa, 2026-10-08**, with the §12 answers recorded there (all defaults). CLAUDE.md amended the same day (§10). Slice 01 built 2026-10-08 and switched off by default (build notes in `01-points-gate-and-card.md`); waiting on Papa's tablet look.
**Date:** 2026-10-08.
**Slices:** 01–07 in this folder. Order: 01 → 02 → 03 → 04 → 05 → 06 → 07. The guide works without AI after slice 04. AI arrives in 05–06 and can be skipped entirely (D11).
**Builds on:** `2026-10-03-points-system` (Points / 點數, `points_claims`, `point_totals`, reward catalog). That plan replaces the ⭐ / 🪙 economy of `2026-08-02-stars-economy`. Also builds on `2026-07-26-brain-gym` (§6 gate), `2026-07-26-homework-lock-drills-outing` (lock card, Papa PIN override, slice 08 pause) and `2026-10-03-games-practice-split` (Games / Practice tabs).
**Provider:** **OpenAI GPT-6 Luna (`gpt-6-luna`), chosen by Papa 2026-10-08** (§9.2). Papa already has an OpenAI API key; it goes in only as a Supabase secret at slice 05.
**Supersedes:** nothing. This design adds a new games-lock reason, so it **amends the closed exceptions list in CLAUDE.md** (§10). It also moves the AI tutor up from the bottom of SPEC's priorities (§9.4).

---

## 1. What Papa asked for

The test phase is ending. A kid opens Games only after earning enough points that day by helping at home. Papa sets the bar per kid and can always lift it. Brain Gym counts. When the bar isn't met, a guide asks the kid two quick questions and suggests 3 home-help activities that fit the time of day, with a reroll. AI may phrase and choose the picks. Saved decisions keep AI calls, and the money they cost, to a minimum.

## 2. Findings that shape the design

1. **"Points" are already Points / 點數, not ⭐.** The task says to confirm reading points as ⭐ stars from the stars-economy design. That reading is out of date: SPEC's top section (2026-10-03) and `2026-10-03-points-system/design.md` replaced Stars and Quest Coins with one currency, Points / 點數. Points have two totals (`total_earned`, `available`) plus pending, a claim per task (`points_claims`, one identity per kid/day/kind/slot) and the bilingual reward catalog (`reward_catalog_v1`, requests through `points_request_reward`). The stars-economy shop, `coins` and the `shop` / `cashout` ledger sources were never the final model. **This design uses Points / 點數 throughout.** The ledger rule ("a ledger, never a stored counter") still holds: the gate reads claims and totals and never stores a count.
2. **The points database is not live yet.** `supabase/POINTS-ROLLOUT.md` says the 2026-10-03 migration was tested only on a local PostgreSQL. Slice 02 (new award kinds) and everything that confirms points online depend on that rollout. The gate itself (slice 01) reads the tablet's points cache and pending queue, so it works before and after the rollout.
3. **Brain Gym already pays points:** 10 per assigned exercise, at most 3 a day, so **30 a day** (`js/points.js` `brain`). It counts toward the gate with no extra work.
4. **Four of the eight activities already have award kinds.** `homework` 30, `room_rescue` 10, `laundry_helper` 15 and `table_helper` 5 × 3 meals exist on both the client (`js/points.js`) and the server (`points_policy`, `points_claim`). Tidy shoes, tidy the garden, tidy the living room and tidy the office have none. The only general kind, `housework` (20, once a day), needs a parent assignment first and pays once. Three tidy jobs would pay once, and the guide couldn't suggest a job Papa hadn't assigned. Slice 02 adds four kinds instead (D3).
5. **A guide already exists.** `js/summer-agent.js` (`SQSummerAgent`) asks tap-only questions (energy, intent) and recommends quests. Its local provider always works. An optional remote provider is checked by `js/agent-provider.js`, which rejects any answer without both EN and 中文 and drops ids it wasn't offered. The home-help guide reuses this pattern and adds new stages; it is not a second agent.
6. **An AI proxy already exists, but only on the home network.** `server/agent-proxy` (v0.3.3) is a Node server on the family PC. It holds the provider keys and serves tablets on the LAN. If the PC is off, or a tablet is away from home, it can't be reached. SPEC's AI-tutor line asks for a **Supabase Edge Function** proxy, which works wherever the tablet has internet. This design follows SPEC (D9). The LAN proxy stays for AI Lab.
7. **The lock today:** `js/lock-core.js` returns only `reason:"brain"`. Note: CLAUDE.md exception (1), games blocked by a homework redo, no longer matches the code. The lock-core header says Papa removed it on 2026-10-03. This design doesn't touch it, but CLAUDE.md should be corrected when §10 is applied (question Q6).

## 3. Decisions

### D1 — The bar is **points earned today**, not the balance

The gate compares **today's points** (Asia/Taipei day, `SQ_DAY.iso()`) with the kid's threshold.

```
todayPoints(kid) = sum(amount) of today's points_claims for kid with status in (queued, pending, confirmed)
                 + queued pointClaim ops for today not yet in the claims list
                 + today's positive manual Papa awards, when the tablet has them
```

- **Why not `available` or `total_earned`:** both only grow over the summer. A lifetime threshold would close Games for a week and then never again. Using `available` would also make buying a gift close Games, which punishes using the reward system Papa wants to promote.
- **Pending counts.** Room Rescue, Laundry, Homework and the new tidy jobs need Papa's check before they're confirmed. If the kid had to wait for Papa at work, a finished job would still leave Games shut, and the kid would learn that helping doesn't work. Pending points open Games; only **confirmed** points can be **spent** (the existing points rule, unchanged). If Papa later declines a claim, the money side corrects itself. Games stay open for the day (D2), so the kid never loses an open door.
- `denied` and `started` claims never count. The `balanced_day` bonus (+20) counts once the server writes it.
- It is a pure function in a new `js/games-gate-core.js` (`SQGamesGate`). Like `lock-core.js` and `brain-core.js`, it's shared by `index.html`, `admin.html` and `check.mjs`.

### D2 — Once open, open for the rest of the day

Like the Brain Gym gate (brain-gym §6), the first time `todayPoints ≥ threshold` on a day, Games stay open until midnight Taipei, even if a claim is later declined. The tablet keeps the open state in `localStorage` (`sq:gamesgate:open:<kid>` = day), and every tablet works it out again from the same synced claims. Nothing new is written to the server, and no kid-writable setting is added.

### D3 — Eight home-help activities, kept as data

A new data file, `js/home-help-data.js` (`SQHomeHelp`), lists the 8 activities. Each has `id`, `kind` / `slot` (the points identity), `icon`, `label [en, zh]`, `pitch [en, zh]`, `minutes` (an estimate shown on the card, never timed), `windows` (when it fits, D6), `verify` (`self` | `parent`) and per-kid `goal [en, zh]` (Lucien 4, Lili 7, Luis 9; fairness rule from points-system §3).

| id | Activity | Points kind | Points | Check |
|---|---|---|---:|---|
| `homework` | School homework practice 作業練習 | `homework` (existing) | 30 | Papa |
| `room` | Clean my room 整理房間 | `room_rescue` (existing) | 10 | Papa |
| `clothes` | Tidy my clothes 整理衣服 | `laundry_helper` (existing) | 15 | Papa |
| `table` | Help clean the table 幫忙清理餐桌 | `table_helper` (existing; meal slot from the time) | 5 per meal, ≤ 3 | self |
| `shoes` | Tidy the shoes 整理鞋子 | **`shoe_tidy` (new)** | 5 *(proposed)* | self *(proposed)* |
| `garden` | Tidy the garden 整理花園 | **`garden_tidy` (new)** | 15 *(proposed)* | Papa |
| `living` | Tidy the living room 整理客廳 | **`living_tidy` (new)** | 10 *(proposed)* | Papa |
| `office` | Tidy the office 整理辦公室 | **`office_tidy` (new)** | 10 *(proposed)* | Papa |

The four new kinds are added in **one** place on each side: `rules` in `js/points.js`, and `points_policy` plus the `points_claim` snapshot default table in SQL (slice 02 migration). Each is category `helping`, once a day, and needs no parent assignment. Papa can change the amounts later in Admin → Points & assignments, as for any kind. Proposed amounts follow the points-system scale: the size of the job, not minutes. `check.mjs` gains a guard that every `SQHomeHelp` item resolves to a real `SQPoints.rules` kind and has both languages.

The guide lists **only** these 8. It never invents an activity, and the AI can only choose among ids it is given (D8).

### D4 — The "not enough yet" card

Tapping Games (the hub tab, a Games tile, a planet landmark, or any `startGame` route) while the points gate is shut shows one card. It uses the same overlay and layout as the Brain Gym card (`brainLockHtml`):

```
                 🏡
     Helping time first! 先幫忙一下！
   ███████░░░░░  35 / 50 points today 今天 35 / 50 點
   15 more and Games open — you've got this!
   再 15 點遊戲就開了，你可以的！

   🎁 You have 420 points to spend. "Choose the family movie" is 200!
   🎁 你有 420 點可以用，「選家庭電影」只要 200 點！

   [ 🧭 Help me choose 幫我選 ]   [ 📅 My Day 我的一天 ]   [ 🔧 Papa 爸爸 ]
```

- **Coach, not cop:** teal / gold progress, never red. No "you didn't", no list of what's missing, no countdown. The line always names the gap as a small, positive step. Lines come from a short bilingual pool in `SQHomeHelp.lines`, chosen by day seed so they vary without randomness.
- **Two numbers, clearly labelled:** *today's points* for the gate, and *points to spend* (`available`) for the gift. They do different jobs (D1), so the card never mixes them.
- **The gift reminder uses the existing reward catalog** (`reward_catalog_v1`, Admin → Quests → Rewards). No second reward system. Rule: show the kid's own requested or saved-for reward if there is one. Otherwise show the cheapest available reward costing more than `available` ("N more points to …"). If every reward is affordable, show the cheapest one ("You can already get … — ask Papa!"). If the catalog is empty or cash is the only item, fall back to a generic line: "Points can become a gift — ask Papa 點數可以換禮物，問爸爸". Wording is question Q3.
- **🔧 Papa** opens the existing PIN override (`openGamesToday` pattern), which opens Games for that kid today (D7).
- **Brain Gym first:** if the Brain Gym gate is also shut, the Brain Gym card shows first (it is the shortest way to 30 points). It gets one extra line: "Brain Gym gives 30 points too 頭腦體操也有 30 點". Lock order in `computeLock` is `brain` → `points`.
- A Lucien-friendly mode (`age ≤ 5`): the bar is shown as 🧹-icons filling up rather than numbers, and the line is read aloud with the app's existing Web Speech, EN then 中文.

### D5 — The guide asks two tap-only questions

`🧭 Help me choose` opens the guide, built on the `SQSummerAgent` look (speech bubble + chips):

1. **"What's already done today? 今天已經做了什麼？"** Multi-select chips of the 8 activities. Ones with a claim today are pre-ticked and greyed. Purpose: skip what's done ("some are already done").
2. **"How much time do you have now? 你現在有多少時間？"** `⚡ A little 一點點 (≈5 min)` · `🙂 Some 一些 (≈15 min)` · `💪 Lots 很多 (30+ min)`.

Then the guide shows **3 activity cards**, each with icon, bilingual label, points and the kid's goal line, plus **🎲 Other ideas 換一批** (reroll) and **Back**. Tapping a card starts that task's existing points flow (`beginPointAttempt` → finish → self-confirm or "Papa will check 爸爸會確認"). That is the same identity My Day and Quests use, so a task can't be paid twice (points-system §5.1).

**No free text anywhere.** Kids only tap, so nothing a kid types ever reaches a model. This removes prompt injection and keeps chat history out of the AI. Guides, Learn, My Day and the ask channel stay unlocked and unchanged.

### D6 — The schedule decides what fits

A pure function `SQHomeHelp.eligible(kid, ctx)` ranks the activities. `ctx` = Taipei minutes (`SQ_DAY.nowMins()`), today's `DAY` with template and overrides (`SQTime`, the current and next block via `timelineInfo`), done ids, time answer, today's claims.

1. **Drop** done or already-claimed activities, kinds at their daily limit, and anything outside its `windows`.
2. **Score** what's left: +3 if the current or next `DAY` block is that kind of work (Homework block → `homework`; a meal block ± 30 min → `table` with that meal's slot), +2 if `minutes` fits the time answer, +1 for each point-gap step it closes (prefer what reaches the threshold), and −1 if suggested in the last two plans (variety).
3. Ties are broken by a seed of `kid:day:slot:reroll`, so every tablet gets the same list.

Default windows, as data (Papa can adjust them in the data file, question Q5):

| Activity | Fits |
|---|---|
| Homework | 09:00 – 17:30 (*before dinner*); best inside the Homework block |
| Table | ± 30 min around the breakfast / lunch / dinner blocks of today's `DAY` |
| Garden | 08:00 – 18:00 (daylight) |
| Room, clothes, shoes, living room, office | 08:00 – 20:30 |

After 20:30 the guide has nothing to suggest. It says so kindly: "Rest time — helping starts again tomorrow 休息時間，明天再來幫忙". The not-enough card still shows the 🔧 Papa button.

This deterministic list is the **source of truth for what is allowed**. AI (D8) only picks 3 of the top 6 and writes the sentence. Without AI, the guide shows the top 3.

### D7 — Papa's controls

One new `family_settings` key, **`games_gate_v1`**, written only by Papa: admin RLS, plus a guard added to `points_guard_settings` that requires `points_parent()`.

```json
{
  "enabled": false,
  "threshold": { "luis": 50, "lili": 50, "lucien": 40 },
  "rerollsPerSlot": 3,
  "ai": { "enabled": false, "callsPerKidPerDay": 8, "familyCallsPerDay": 24, "dailyUsdCap": 0.05, "monthlyUsdCap": 1.00 }
}
```

- **Ships switched off.** `enabled: false` until Papa turns it on, so slice 01 can merge mid-summer with no effect on the kids.
- **Per-kid threshold** in steps of 5, 0–300. **0 = no points gate for that kid.**
- **Lift the lock:** (a) set the threshold to 0, (b) switch `enabled` off for everyone, (c) **Open Games today** for one kid, from admin or the 🔧 PIN on the card. This reuses the `braingate_<kid>` = today mechanism. That key already exists. RLS lets the tablet's Papa PIN pad write it, but only to a date or empty (`"kid braingate"` policy). Today it opens the brain gate. Slice 03 broadens its meaning to "Papa opened Games today for this kid", covering both gates, and the card says so.
- The existing **Games category lock** (`catlock_<kid>_games`) and **app pause** (`applock_<kid>`) are unchanged and still win over everything.
- **Admin view** (Admin → Quests → Points & assignments, English-only chrome per D23): one row per kid shows *today's points / threshold* as a bar, gate state (`open`, `open — Papa`, `waiting`), Open-today / Undo buttons, the threshold stepper, and the last 7 days of saved guide decisions (D8: slot, answers, the 3 picks, source `ai` / `local`, rerolls, which pick the kid started). The AI usage line shows calls today and USD today / this month against the caps.
- **Test mode** (`sq:testMode`) keeps turning every lock off.

### D8 — Saved decisions: cache key, expiry, reroll cap

**Window.** A day has three **slots**, as data in `SQHomeHelp.slots`: `morning` < 12:00 ≤ `afternoon` < 17:00 ≤ `evening`. Taipei time.

**Cache key:** `kid : day : slot : rerollIndex`.

- First open of the guide in a slot → **one** decision: AI if allowed (D9–D11), else local. It is saved under `rerollIndex = 0` together with the answers.
- Opening the guide again in the same slot → **the saved decision, no call**. Picks the kid has done or started since then are hidden. If all 3 are gone, the next ones come from the **local** ranking, with no AI call.
- **Reroll** → `rerollIndex + 1` → a new decision, saved. Changing the answers counts as a reroll.
- **New slot or new day** → new key → new decision.

**Reroll cap:** `rerollsPerSlot` (default 3) AI rerolls per kid per slot. After that, or if any AI cap (D10) is reached, 🎲 **still works** and draws the next 3 from the local ranking, cycling through all eligible activities. A kid never sees "no more rerolls". Only the source changes, and admin shows that.

**Expiry:** a decision is used only inside its slot and day. Rows are kept (not deleted) for the admin history; admin shows 7 days. The tablet keeps today's decisions in `localStorage` `sq:guide:v1` and drops earlier days on boot.

**Storage:** new table **`guide_decisions`**:

```sql
create table if not exists public.guide_decisions (
  kid_id text not null references public.kids(id), day date not null,
  slot text not null check (slot in ('morning','afternoon','evening')),
  reroll integer not null check (reroll >= 0),
  answers jsonb not null,             -- {done:[ids], time:'little'|'some'|'lots'}
  picks jsonb not null,               -- [{id, line:[en,zh]}] × ≤3, ids ∈ SQHomeHelp
  source text not null check (source in ('ai','local')),
  model text, input_tokens integer, output_tokens integer, cost_usd numeric(10,6),
  started_id text,                    -- which pick the kid tapped, if any
  created_at timestamptz not null default now(),
  primary key (kid_id, day, slot, reroll)
);
```

- `source = 'local'` rows are inserted by the tablet (anon RLS: `with check (source = 'local')`), queued offline like other writes, and upserted on the primary key so a replay is a no-op.
- `source = 'ai'` rows are written **only by the Edge Function**. That is the only place the AI answer and its token cost are recorded, so admin's spend figure can't be faked by a tablet.
- Read: everyone, the same as other family tables.

### D9 — Where AI runs: a Supabase Edge Function

A new function, **`supabase/functions/games-guide/index.ts`** (Deno), is the only code that talks to the AI provider.

- **Provider:** OpenAI **`gpt-6-luna`** over the Responses API (`POST https://api.openai.com/v1/responses`), reasoning effort `low`. This is the same request shape and the same `openai-luna-cheap` profile as the LAN proxy's `server/agent-proxy/src/providers/OpenAIProvider.ts`, so the two stay alike.
- **Key handling:** `OPENAI_API_KEY` is set by Papa with `supabase secrets set …` from his own terminal. It is never in the repo, never in `js/config.js`, never in a committed `.env`, never in an APK. The function reads the service role from its built-in hosted environment to write `guide_decisions` / `guide_usage`. That key stays in Supabase's hosting and is never committed (CLAUDE.md secrets rule).
- **Input (from the tablet):** `{kid, day, slot, reroll, answers, candidates:[top-6 ids]}`. The function **re-derives nothing it can't check**. It verifies `kid` ∈ the 3 kids, `day` = today in Taipei, ids ∈ `SQHomeHelp`, and reroll ≤ cap. If a row for the key already exists, it returns that row (idempotent, no new call).
- **Prompt input:** age band (4 / 7 / 9 → "preschool", "early primary", "primary"), slot, minutes, time answer, the candidate list with their labels and points, and points still needed. No names, no history, no free text.
- **Output:** structured JSON only (`text.format` = `json_schema`, `strict: true`): exactly 3 distinct ids from `candidates`, each with `line: [en ≤ 90 chars, zh ≤ 45 chars]`. It's validated again on the tablet with the `SQAgentProvider.validate` rules (bilingual required, `<>` and control characters stripped, unknown ids dropped). Any failure, timeout (6.5 s, existing default), refusal or cap hit → `{fallback:true}` → the tablet uses the local decision and saves it as `local`.
- **Refusal / incomplete:** a `refusal` content part, an `incomplete` status (for example `max_output_tokens`) or an HTTP error is treated as `fallback:true`. It is never retried on another model.
- **The anon key can call the function.** It is public by design (SPEC), so anyone with the URL could spend credits. The caps in D10 are therefore enforced **inside the function against the database**, not on the tablet. As a backstop, the key lives in its **own OpenAI API project** (used by nothing else) with a **monthly budget** set in the OpenAI platform's project settings. Slice 05 confirms whether that budget stops requests or only sends an alert. Either way, the database caps are the real guard.

### D10 — Rate limits and spend caps

A new table, **`guide_usage`** (`day`, `kid_id`, `calls`, `cost_usd`), is only written by the function in the same transaction as the `guide_decisions` insert. Before calling the model, the function checks:

| Cap | Default | When hit |
|---|---|---|
| AI calls per kid per day | 8 | local decision |
| AI calls per family per day | 24 | local decision |
| AI spend per family per day | US$0.05 | local decision |
| AI spend per family per month (Taipei month) | US$1.00 | local decision |
| AI rerolls per kid per slot | 3 | local decision |

`cost_usd` = tokens × a price table **in the function** (`gpt-6-luna` standard: $0.10 input / $0.50 output per million). The tablet never reports cost. Defaults are generous compared with the estimate in §9.3: 8 calls a day is about $0.003. A hit cap is silent to the kid and visible to Papa.

### D11 — AI is optional; the feature stands without it

The deterministic ranking (D6) and local phrasing already meet requirements 1–6. AI adds variety and warmer, situation-aware sentences, a "guide" feel. `games_gate_v1.ai.enabled` is off by default, and slices 05–06 can wait or never ship. Recommendation: ship 01–04, run the gate for a week with local picks, then decide whether AI is worth turning on.

### D12 — Offline-first

- **Gate:** computed only from the tablet's points cache, claims and queue (D1). It never waits for the network. A boot with no network uses the cached `games_gate_v1`. With no cache at all, the gate is **open** (the default is off, and a tablet should never lock a kid out because it can't read settings).
- **Guide:** offline → the same 2 questions → the local top 3 → saved as `local` and queued. Never an AI call, never a spinner longer than the 6.5 s timeout when online.
- **Missing `config.js`** (local-only mode) → gate settings are local only, editable through the 🔧 Papa PIN menu. AI is impossible.

## 4. What does not change

- Games, their data, scoring and bests. Only the gate in front of them changes.
- Brain Gym gate behaviour, the Games category lock, the app pause, test mode.
- Practice tab: Brain Gym tiles always open. Key Hunt, Home Row and Word Wizard follow the games lock, as they do under the brain gate today (games-practice-split D3).
- Point amounts and limits of existing kinds, verification rules, reward catalog, redemption RPCs.
- Guides, Learn, My Day, Ask channel, Books, Music: never points-gated.
- No timers, no per-minute tracking. `minutes` on a card is a hint for choosing, never measured.

## 5. Screen time

The gate *is* the screen-time moment Papa described. It is **indicated** in two places and **enforced** only at the Games door:

- My Day's screen blocks ("Screen #1 — earned") show 🔓 *Games open* or 🏡 *35 / 50 points*, using the same `SQGamesGate.state()`.
- Admin's per-kid bar (D7) is where Papa checks whether a kid has enough.

## 6. Data and modules (summary)

| New | What |
|---|---|
| `js/games-gate-core.js` (`SQGamesGate`) | `todayPoints`, `state(kid, ctx)` → `{open, reason:'points'|'papa'|'off'|'reached', today, threshold, need}`, gift-reminder pick. Pure. |
| `js/home-help-data.js` (`SQHomeHelp`) | 8 activities, slots, windows, card lines, `eligible()`. Data + pure ranking. |
| `js/lock-core.js` | `computeLock` gains `pointsOpen` (default `true`) → `reason:"points"` after `brain`. |
| `family_settings.games_gate_v1` | D7 config. |
| `guide_decisions`, `guide_usage` | D8, D10. |
| `supabase/functions/games-guide/` | D9 proxy. |
| Migration `2026xxxx_games_gate.sql` | 4 new award kinds (slice 02), the two tables + RLS + settings guard (slices 03–05). |

## 7. Bilingual

Every kid-facing string is a `[en, zh]` pair in Taiwan usage: 點數, 作業, 整理, 客廳, 辦公室, 花園, 鞋子, 換一批. `check.mjs` already fails on a kid-facing string without 中文. Slice 01 adds `SQHomeHelp` and the card lines to that scan. AI lines are rejected unless both languages are present (D9). Admin chrome is English only.

## 8. Tablet

All buttons ≥ 56 px tall. Chips are big tap targets with no hover states. The card fits 1024 × 600 and 1280 × 800 without scrolling. Reduced motion: the bar fills without animation.

## 9. AI provider

### 9.1 Can Claude Pro or ChatGPT Pro be used directly? **No.**

Both companies bill chat subscriptions and API use separately:

- **Claude Pro / Max** cover the claude.ai apps (and Claude Code under the plan's limits). They **do not include API access**. API keys come from the **Claude Console** (platform.claude.com), which has its own billing and prepaid credits. Source: Anthropic help center, "I have a paid Claude plan … why do I have to pay separately to use the Claude API and Console?" (article 9876003).
- **ChatGPT Plus / Pro** cover chatgpt.com. API usage is **billed separately** on the OpenAI API platform, with its own payment method or prepaid credits. Source: OpenAI help center, "Is API usage included in ChatGPT subscriptions?" (article 8156019) and "Managing billing for ChatGPT and the API platform" (9039756).

A subscription's login can't be used as an API key from a server, and trying would break both companies' terms. The app needs a separate, prepaid API account, with a tiny balance at this volume (§9.3).

### 9.2 Options compared

Prices are standard per-million-token rates, checked 2026-10-08. Anthropic rates are from the claude-api reference (cached 2026-10-06). OpenAI rates are from developers.openai.com/api/docs/pricing.

| | Claude Haiku 5.5 `claude-haiku-5-5` | OpenAI GPT-5.6 Luna `gpt-5.6-luna` | **OpenAI GPT-6 Luna `gpt-6-luna` (chosen)** |
|---|---|---|---|
| Exists? | Yes. Current Haiku. | **Yes, verified** on OpenAI's pricing page. Papa's "GPT Luna 5.6" is this model. Launched July 2026, price cut 30 July 2026. | Yes. Newer, cheaper Luna. Already the default profile in this repo's LAN proxy (`ModelCatalog.ts`). |
| Input / output $ per 1M | 0.10 / 0.50 | 0.20 / 1.20 | **0.10 / 0.50** |
| Cost per guide call (§9.3) | ≈ $0.00035 | ≈ $0.00078 | **≈ $0.00035** |
| Structured JSON output | Yes (`output_config.format`) | Yes | Yes |
| Fits an Edge Function | Official SDK `npm:@anthropic-ai/sdk` in Deno | Official SDK | Official SDK |
| Notes | One vendor for the guide. Effort `low` keeps thinking short. No refusal fallback on Haiku (we fall back locally). | Twice the price of the other two for the same job. Older than GPT-6 Luna. | Same price as Haiku. Same model as the LAN proxy's default, so one request shape across both. Needs an OpenAI **API** account (prepaid), not the ChatGPT plan. |

*First draft recommended Claude Haiku 5.5. It is kept here for the record.*

**Decision (Papa, 2026-10-08): OpenAI GPT-6 Luna (`gpt-6-luna`), reasoning `low`, strict JSON-schema output, through the Edge Function.** It costs the same as Haiku 5.5 and less than half of GPT-5.6 Luna. It is already this repo's default profile (`openai-luna-cheap`), so the LAN proxy and the Edge Function use the same model and request shape. zh-TW quality is still checked by the 30-case eval in slice 06 before AI is switched on. The function has a single provider call, so swapping vendors later is one file. This design does **not** build multi-provider routing into the function; the LAN proxy already has that for AI Lab. Note: Papa's ChatGPT subscription doesn't pay for this (§9.1). It needs an OpenAI **API** account with prepaid credits.

### 9.3 Monthly cost estimate per kid (assumptions stated), `gpt-6-luna`

Assumptions: system prompt + candidates ≈ **1,500 input tokens**; output (JSON for 3 picks with bilingual lines, plus low-effort reasoning tokens, which are billed as output) ≈ **400 output tokens**. OpenAI's automatic prompt caching may make repeated system text cheaper. The estimate ignores that, so it errs high.

```
per call  = 1,500 × $0.10/1M + 400 × $0.50/1M = $0.00015 + $0.00020 = $0.00035
typical   = 3 slots × (1 first + 1 reroll) = 6 calls/day  → $0.0021/day → ×30 ≈ $0.06 / kid / month
cap-bound = 8 calls/day (D10)                          → $0.0028/day → ×30 ≈ $0.08 / kid / month
3× token error safety margin                                       → ≤ $0.25 / kid / month
family of 3, worst case with margin                                → ≤ $0.75 / month
```

Most days the gate closes nothing after the first hours, and saved decisions are reused (D8), so real use should sit near or below "typical". Supabase Edge Functions are included in the free tier (500K invocations/month on Supabase's pricing page; check when deploying). The family would make ~500 a month. **The real cost is the smallest prepaid OpenAI API credit purchase**, which at this rate lasts years. Check the minimum on the OpenAI platform billing page.

### 9.4 Priority flag: this moves the AI tutor up

SPEC lists the AI tutor last (P3, "Edge Function with transcript review in admin"). Slices 05–06 build the first Edge Function, the first server-held provider key and the first spend caps: the AI tutor's base, built now. **Papa needs to OK this reordering** (question Q4). Without that OK, stop after slice 04. The gate and local guide are complete without AI.

## 10. CLAUDE.md amendment (proposed, applied only after approval)

The list of games-lock exceptions in CLAUDE.md is closed. This design adds a new reason, so after Papa approves, the **Coach, not cop** bullet gains:

> (5) the daily **points gate**: Games open once the kid has earned Papa's per-kid threshold of points **today** (Asia/Taipei; pending points count), then stay open the rest of the day, per `docs/plans/2026-10-08-games-gate-ai-guide/`. Papa sets the threshold per kid (0 = off), can switch the gate off, and can open Games for a kid today. Brain Gym, Practice drills under the existing rule, guides, Learn, My Day and the ask channel are never points-gated.

…and `docs/plans/2026-10-08-games-gate-ai-guide/` (slices 01–07) is added to "Approved plans currently pending". The same edit should also fix exception (1), which describes a homework-redo lock that `js/lock-core.js` says Papa removed on 2026-10-03 (Q6). Nothing in CLAUDE.md is edited before approval.

## 11. Risks

- **Points rollout:** until the 2026-10-03 migration is live, everything is pending and on one tablet. The gate still works (D1), but a second tablet sees another kid's pending points only after sync. Acceptable: the gate is not money.
- **Honest self-check:** `shoe_tidy` and `table_helper` are self-checked, so a kid could tap without doing the job. That's already true for teeth and table today. Papa can switch a kind to parent-check by changing its `verify` (Q2).
- **Anon-callable function:** mitigated by the database-enforced caps plus a dedicated OpenAI project with a monthly budget (D9–D10).
- **Lock fatigue:** a gate that is too high turns helping into a chore wall. The defaults (40 / 50) are roughly the Brain Gym trio plus one or two small jobs. Papa watches the admin bars in week one.

## 12. Questions for Papa (answer before slice 01)

**Answered by Papa, 2026-10-08. Every proposed default was accepted:**
1. Thresholds **Luis 50 · Lili 50 · Lucien 40**, on today's points with pending counted.
2. New activities as proposed: shoes 5 (self-check), garden 15, living room 10, office 10 (Papa-checked). The office is included.
3. Gift line **with numbers**.
4. **Build the AI now** (slices 05–06). The guide and the future AI tutor **share one spend-cap table** and use separate functions.
5. Rerolls and windows as proposed.
6. **Fix CLAUDE.md exception (1)**, done in the §10 amendment.

The original questions, kept for the record:

1. **Threshold default.** Proposed **50 points/day for Luis and Lili, 40 for Lucien** (Brain Gym's 30 plus one or two jobs). Same bar for all three, or different? And confirm *today's points with pending counted* (D1), not the balance.
2. **New activities' points and check.** Proposed: shoes 5 (self-check), garden 15, living room 10, office 10 (all Papa-checked). OK? Is the office a room the kids may enter and tidy?
3. **Gift wording.** Proposed: "🎁 You have {available} points to spend. '{reward}' is {cost}! 你有 {available} 點可以用，「{reward}」只要 {cost} 點！". Or a gentler fixed line without numbers?
4. **AI or not, and the tutor.** OK to move the AI tutor's Edge Function up (§9.4)? Should this guide and the future tutor **share** one Edge Function and one spend cap (recommended: shared caps table, separate function per job), or be fully separate? Or ship 01–04 only for now?
5. **Rerolls and windows.** Proposed: 3 AI rerolls per slot (unlimited local rerolls after that), slots split at 12:00 and 17:00, homework fits before 17:30, garden 08:00–18:00, nothing suggested after 20:30. Change any?
6. **CLAUDE.md exception (1).** It still says a homework redo blocks games; the code says Papa removed that on 2026-10-03. Fix the text when §10 is applied?
