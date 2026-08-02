# Stars economy: wallet, shop, streaks, ranks, family goal

**Status:** approved by Papa, 2026-08-02.
**Slices:** 54–59. Order: 54 → 55 → 56 → 57 → 58 → 59.
**Depends on:** `2026-07-29-star-source-of-truth` (slices 49–53), shipped as `5aa522e`. The tablet no longer keeps a star counter and `star_totals` is truth. **This plan is only safe on top of that** — a shop built on a device-local counter would let a kid spend coins they do not have on one tablet and still have them on another.
**Supersedes:** nothing. Extends the star model in `SPEC_summer_quest_supabase.md` §Stars and reuses the `passes` machinery from `2026-07-26-homework-lock-drills-outing`.

---

## 1. The problem

Stars currently accumulate and then do nothing. A kid earns ~8 a day, watches the number go up, and there is no moment where the number *becomes* something. Papa can grant and revoke, but there is no way to spend, no reason to save, and no pull beyond the next tick.

Measured baseline from `stars_ledger`, 2026-07-26 → 07-31 (5 active days):

| Kid | ⭐ net | stars / active day |
|---|---|---|
| luis | 49 | 9.8 |
| lucien | 39 | 7.8 |
| lili | 38 | 7.6 |

All three are within 25% of each other, so a single price list is fair to all of them without per-kid tuning. Over a ~40-day summer that projects to **~320 ⭐ per kid**, and ~24 ⭐/day across the family. Every number in this design is derived from those two figures.

The earn rate is already structurally capped — 16 blocks/day, activities once/day, Brain Gym once/day — so there is **no grind exploit to defend against** and this plan adds no anti-farming machinery.

---

## 2. Decisions

### D1 — Two numbers, one ledger, no new tables

⭐ and 🪙 are two views of `stars_ledger` (`supabase/schema.sql:40`), not two stores.

| | Formula | Meaning |
|---|---|---|
| ⭐ **Stars Earned** 星星 | `sum(delta) where source in ('app','admin')` | Achievement. Only shopping is excluded, so it effectively only rises. |
| 🪙 **Coins** 金幣 | `sum(delta)` — every row | Wallet. Spending deducts. |

**The existing `stars` name keeps its existing meaning.** `star_totals.stars` is redefined to the ⭐ formula and a **new `coins` column** carries the wallet. Before any `shop`/`cashout` row exists the two are identical, so deploying the view change alone is a no-op — and every current reader of `stars` (admin totals, badges, achievements, Captain view) keeps showing the number it always showed, with no edit. The wallet is purely additive.

Correspondingly in `js/sync.js`: **`starsFor(kid)` is not modified.** `queuedStarDelta` only sums `type:"stars"` ops, spending queues a different op type, so `starsFor` remains exactly ⭐. A parallel `coinsFor(kid)` is added beside it.

**Why two:** with one number, spending makes a kid's score fall. Kids then hoard and never spend, the reward becomes a high score they are afraid to touch, and the economy never actually runs. Splitting the achievement from the currency is what makes spending feel free.

**Why not a wallet table:** the balance is already `sum(delta)`. A `wallets.balance` column would be a second source of truth for a number the ledger already answers — exactly the bug slices 49–53 just finished removing. Purchases are ordinary ledger rows with a new `source` value. That one string is the whole economy.

Revocations (`delta < 0`, `source='admin'`) *do* reduce ⭐. That is correct: a revoke is Papa correcting a star that was never really earned, not a purchase. No baseline reset is needed — today's 49/39/38 are already the right ⭐ values.

### D2 — New ledger sources: `shop` and `cashout`

| source | delta | Written by | Meaning |
|---|---|---|---|
| `app` | +1…+5 | kid client | earned (existing; range widened for streak bonuses) |
| `admin` | any | admin | Papa grant / revoke (existing) |
| `shop` | < 0 | kid client | bought a privilege |
| `cashout` | < 0 | kid client | requested money |

RLS (`supabase/schema.sql:125`):

```sql
-- widened from "between 1 and 3" so a +5 streak bonus can be written
create policy "kid star"  on public.stars_ledger for insert
  with check (source = 'app' and delta between 1 and 5);

-- new: kids may spend, never mint
create policy "kid spend" on public.stars_ledger for insert
  with check (source in ('shop','cashout') and delta < 0);
```

Papa needs one more policy — settling a cash-out is an `update`, and the only existing admin write policies on this table are insert and delete:

```sql
create policy "admin settle" on public.stars_ledger for update to authenticated
  using (source = 'cashout') with check (source = 'cashout');
```

`delta < 0` is the whole defence on the kid side: a kid client can only ever write rows that cost them. `star_totals` (`supabase/schema.sql:76`) gains a `coins` column beside the redefined `stars`, so both numbers arrive in one round trip and no second query is needed anywhere.

### D3 — Coin value, prices, and the family goal live in `family_settings`

Papa must be able to change what a star is worth without a deploy. `family_settings` (`supabase/schema.sql:301`) is already a realtime key/value table, kid-readable and admin-writable. One new key, `shop`, holds JSON:

```json
{
  "coinNtd": 10,
  "goalTarget": 600,
  "goalRewardEn": "A day out we choose together",
  "goalRewardZh": "我們一起選的一日遊",
  "items": [
    { "id": "golden",  "price": 15, "icon": "🎟️", "en": "Golden Pass",        "zh": "黃金券" },
    { "id": "screen",  "price": 10, "icon": "📺", "en": "+30 min screen time", "zh": "多 30 分鐘螢幕時間" },
    { "id": "stayup",  "price": 15, "icon": "🌙", "en": "Stay up 30 min",      "zh": "晚睡 30 分鐘" },
    { "id": "dinner",  "price": 20, "icon": "🍽️", "en": "Pick dinner",         "zh": "決定晚餐" },
    { "id": "outing",  "price": 40, "icon": "🚗", "en": "Choose the outing",   "zh": "選週末去哪" }
  ]
}
```

This follows the existing `TEMPLATE_KEY` JSON-blob precedent (`js/admin.js:156`). Rate, goal, prize and all five prices become editable from one admin card, live to the tablets via the `onFamilySettings` realtime hook already wired at `index.html:3308`.

**Parsing, prices, ranks and streak rules live in one shared module, `js/shop-core.js` (`SQShop`).** The kid app and the admin panel must agree on every one of these numbers; two copies is precisely how a design drifts. This is the established house pattern — `time-core.js`, `lock-core.js`, `brain-core.js`, `chat-core.js` all exist for exactly this reason — and `SQShop` is loaded as a plain global by both `index.html` and `admin.html`, with no module system.

**The retroactive-rate trap:** dropping `coinNtd` from 10 to 5 halves the real value of every coin already saved. Mitigation — a `cashout` row records its NT$ amount **at request time**, so anything already requested is locked and cannot be devalued afterwards. Unspent balances still float with the rate; the admin card states this plainly before saving. Not solved, deliberately: freezing per-coin acquisition rates would mean a per-coin lot ledger, which is far more machinery than a family of five needs.

**The NT$ is stored in the `reason` string**, because `stars_ledger` has no numeric column free and adding one for a family of five is not worth a migration. The format is therefore a **hard contract**, not prose:

```
Cash out 換錢 · NT$<integer>
```

`SQShop.ntdFromReason(reason)` is the only permitted reader (`/NT\$(\d+)/`), the only permitted writer is `SQShop.cashoutReason(ntd)`, and `check.mjs` gates both. Anything that formats or parses that string by hand is a bug.

### D4 — 1 🪙 = NT$10, soft cap

At ~8 🪙/day for ~40 days a kid earns ~NT$3,200 of cash-equivalent. There is **no hard spend cap** — Papa accepted the soft ceiling. What actually holds the budget down is D5: privileges are priced to be better value than cash, and privileges cost nothing.

### D5 — Shop: five privileges plus cash, privileges deliberately out-value cash

| Item | Price | ≈ days |
|---|---|---|
| 🎟️ Golden Pass 黃金券 — skip one block | 15 🪙 | 2 |
| 📺 +30 min screen time 多 30 分鐘螢幕時間 | 10 🪙 | 1.2 |
| 🌙 Stay up 30 min 晚睡 30 分鐘 | 15 🪙 | 2 |
| 🍽️ Pick dinner 決定晚餐 | 20 🪙 | 2.5 |
| 🚗 Choose the weekend outing 選週末去哪 | 40 🪙 | 5 |
| 💵 Cash out 換錢 | 1 🪙 = NT$10 | — |

A kid comparing 10 🪙 for half an hour of screen against 10 🪙 for NT$100 will usually take the screen time. That is the intended outcome: the attractive options are the ones that cost Papa nothing, which is what keeps real spend under the NT$3,000 ceiling without a cap that would feel arbitrary to a kid.

**Golden Pass cannot be exploited.** It costs 15 🪙 to skip a block worth 1 ⭐ — heavily net-negative, so it stays an escape hatch for a bad day rather than a strategy. It reuses the existing `passes` table (`supabase/schema.sql:198`) and its already-built spend flow; the shop only inserts the row.

### D6 — Privileges buy instantly; only cash waits

Buying a privilege deducts and applies immediately, with no Papa approval. This preserves the auto-grant policy (2026-08-02): the kid's own coins are already theirs, and an approval gate on spending their own money would be the same withholding pattern that policy exists to prevent. Papa can still revoke afterwards, as with any star.

Cash is different only because it physically cannot leave the app — Papa has to hand over notes. So cash-out is inherently request → fulfil, and that is a logistics fact, not an approval gate.

### D7 — Payday is Sunday, and coins leave at request time

A kid taps cash-out → a `cashout` row is written immediately and the coins leave the wallet **now**. Two reasons: it makes double-spending impossible without any locking, and the wait between request and payday is the entire saving lesson.

Sunday, the admin shows one card — three names, three amounts, one **Paid ✓** button that stamps `granted_by`. Unpaid is `granted_by is null`. That column already means "the admin who settled this row", so this is its existing semantic, not an overload. **No new table for cash-outs:** the deduction row has to exist regardless, and a parallel `cashouts` table would be a second write to keep in sync with it.

### D8 — Streaks 🔥

A streak day is a complete day, by the same rule the admin already uses (`js/admin.js:176`): the union of ticked blocks and granted/spent passes covers every block in `DAY`.

**The streak is derived, never stored.** `hydrate()` gains one query for the last 30 days of `day_ticks` and `passes`; `SQShop.streakFrom(days, dayLength, today)` folds them into a number. Storing a counter would reintroduce exactly the class of bug slices 49–53 just finished removing, and there is no place to put it anyway — the kid client's RLS on `family_settings` only permits writing `applock_*` and `braingate_*` keys (`supabase/schema.sql:489`, `:540`), so a stored streak would need a new kid-writable key, which is a wider hole than one extra read.

**Double-award is prevented by the database, not by client bookkeeping.** A partial unique index makes the second insert of the same bonus a no-op:

```sql
create unique index if not exists uniq_streak_bonus
  on stars_ledger (kid_id, reason) where source = 'app' and reason like 'Streak%';
```

`applyOp` already swallows `23505` on star inserts (`js/sync.js:430`), so a replay, a second tablet, or a re-check after reload all collapse to one row with no client-side guard at all. Because the reason carries the date, the same streak length reached again after a break is a different row and is correctly awarded.

Bonuses land as ordinary `source='app'` ledger rows:

| Streak | Bonus |
|---|---|
| 3 days | +2 🪙 |
| 7 days | +5 🪙 |
| every 7 after | +5 🪙 |

A 7-day streak is ~12% above base earnings — enough to be worth protecting, not enough to distort the economy.

**Coach, not cop.** When a streak breaks the flame simply goes out. No red, no "you lost your streak", no count of what was forfeited. The counter reads `Start a new streak today 今天重新開始`. A broken streak is an invitation, exactly like a late block.

No streak freezes. If a kid loses a streak to a family holiday and it stings, Papa can grant bonus stars — the tool already exists. Add freezes only if that actually happens.

### D9 — Rank is derived, never stored

```
🌱 Sprout 0 · 🥉 Bronze 50 · 🥈 Silver 150 · 🥇 Gold 300 · 💎 Legend 500
```

A pure function of ⭐ shown beside the star count. No table, no unlock event, no persistence — a rank is always recomputable, so storing it would only create something that can drift.

Pacing against the measured 8 ⭐/day: Bronze in week one (Luis is at 49 now), Silver ~day 19, Gold ~day 38, Legend needs an exceptional summer.

**Why this does not duplicate badges.** `SQNotify.ACHIEVEMENTS` (`js/notify.js:63`) already has star milestones at 1/10/25/50/100, and those stay untouched. A badge is a *moment you collected and keep forever*; a rank is your *current standing*. Different jobs, and the badge thresholds are deliberately offset from the rank thresholds so they do not fire together and dilute each other.

### D10 — Family goal counts ⭐, never 🪙

Combined ⭐ across all three kids, target **600** (≈25 days at the family's measured 24 ⭐/day). Progress bar on every kid's hub. `star_totals` already returns all three rows in one read, so this costs no extra query.

*(`summer_wall_poster.html` lives outside `summer-quest/` and has no Supabase client. A poster bar is out of scope for slices 54–59; raise it as its own slice if Papa wants it.)*

**Counting ⭐ and not 🪙 is the point:** one kid's shopping spree can never set the family back. Nobody is ever incentivised to resent a sibling for spending.

This replaces a leaderboard, which Papa rejected. Ranking the three publicly would fix Lucien's 39-vs-49 gap onto his screen as a standing fact — the opposite of "coach, not cop". A shared pot makes Luis's lead an asset to his siblings and gives Captain Luis a real job.

Reward: **a day out the three of them choose together** — the negotiation is half the value. Editable via `shop.goalReward`; until set, the bar reads `Papa is choosing the prize 爸爸在想獎品`.

### D11 — The shop is a Rewards segment, not a new tab

`RW_SEGS` (`index.html:3109`) already drives the Rewards tab's segmented control (Badges / Stars / News / Papa). The shop is one more entry: `["shop","🪙 Shop 商店"]`. No new tab, no nav change, no new render path — the existing `renderRewards` switch gains one branch.

The hub header (`#hubStars`) grows from one number to the full line: `⭐ 49 · 🪙 34 · 🔥 3 · 🥉`.

### D12 — Bilingual, per the standing invariant

Every kid-facing string ships EN + 繁體中文: item names, rank names, streak messages, shop confirmations, payday states, empty states. Shop item text lives in the `shop` settings JSON, so **`check.mjs` must validate bilingual completeness of that blob**, not just of the static strings — otherwise the one place Papa can add new kid-facing text is the one place the guard does not look. Admin card chrome stays English-only (D23, 2026-07-27).

---

## 3. Deliberately not built

| Skipped | Add when |
|---|---|
| Sibling leaderboard | never — Papa's call, and it conflicts with "coach, not cop" |
| Server-side overdraft check | a wallet actually goes negative. Client-side guard only; offline queue replay could in principle overspend. Three kids, one tablet each, and Papa sees every row in the ledger. `ponytail:` comment at the guard. |
| Wishlist / kid-proposed items | Papa passes on it; the `items` array in settings already lets him add one by hand |
| Streak freezes | a real holiday actually breaks a streak and it matters |
| Coin expiry, interest, sibling trading, dynamic pricing | never — none of these solve a problem this family has |
| Per-coin rate lots (D3 devaluation) | Papa actually changes `coinNtd` downward and it causes an argument |
| Anti-grind limits | never — the daily schedule already caps earnings structurally |

---

## 4. Slices

| # | File | DONE WHEN (summary — the slice file is authoritative) |
|---|---|---|
| 54 | `54-ledger-sources.md` | A kid client can insert `shop`/`cashout` rows with `delta<0` and is rejected for `delta>=0`; `star_totals` returns `stars` **and** `coins`, with `stars` byte-identical to before; `+5` app rows accepted; the streak index rejects a duplicate. |
| 55 | `55-shop-core-and-admin.md` | `SQShop` unit-tested in plain Node; Papa edits rate, goal, prize and all five prices from Admin → Stars; a rate cut warns with the real coins at risk before saving. |
| 56 | `56-wallet-rank-hub.md` | Hub reads `⭐ n · 🪙 n · 🥉`; both numbers survive an offline boot and match the admin; rank derived, never stored. |
| 57 | `57-shop-and-buying.md` | Kid buys a privilege online and offline; coins deduct and ⭐ does not; Golden Pass is bought per block from My Day; the balance guard blocks overspend. |
| 58 | `58-cashout-payday.md` | Coins leave at request time with the NT$ frozen in the row; a later rate cut does not change what is owed; **Paid ✓** stamps `granted_by` and the sheet clears for good. |
| 59 | `59-streak-and-family-goal.md` | Streak derived from 30 days of history, pays +2/+5 exactly once (deduplicated by the database), breaks without shaming; family bar sums ⭐ across three kids. |

Each slice ships independently. `node scripts/check.mjs` green is a precondition for every commit, and **slice 54 is a hard prerequisite for 56–59**.

**Dependency order:** 54 → 55 → 56 → 57 → 58, with 59 needing only 54, 55 and 56 (it can run in parallel with 57–58).
