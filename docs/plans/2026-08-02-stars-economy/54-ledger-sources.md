# Slice 54 — Ledger gains a wallet: `shop` / `cashout` sources, `coins` column

**Goal:** `stars_ledger` can record spending, and `star_totals` returns both numbers. Nothing in the app changes yet — this slice is pure database, and after it deploys every screen shows exactly what it showed before.

**Implements:** design.md D1, D2, D8 (the unique index only).

**Design:** `docs/plans/2026-08-02-stars-economy/design.md` §2 D1, D2.

**Depends on:** nothing. **Hard prerequisite for slices 56, 57, 58, 59.**

**DONE WHEN:**
- `star_totals` returns `kid_id, name, stars, coins`, and for the current data `stars === coins` for all three kids (no spend rows exist yet).
- `select stars from star_totals` returns **49 / 39 / 38** for luis / lucien / lili — byte-identical to before this slice.
- An anon client can insert `{source:'shop', delta:-5}` and is **rejected** for `{source:'shop', delta:5}`, `{source:'shop', delta:0}` and `{source:'nonsense', delta:-5}`.
- An anon client can insert `{source:'app', delta:5}` (was capped at 3).
- Inserting the same `(kid_id, reason)` streak row twice yields error `23505` on the second.
- An authenticated client can `update stars_ledger set granted_by=… where source='cashout'`, and **cannot** update a `source='app'` row.
- `node scripts/check.mjs` passes.

---

## Constraints you must not violate

1. **`star_totals.stars` must not change value.** Its formula changes; its result must not. It is read by the admin totals, the Captain view, `SQNotify` achievements and `js/sync.js:196`. If any of those numbers move after this slice, the formula is wrong.
2. **Edit `supabase/schema.sql` AND add a migration file.** `schema.sql` is the canonical full schema; the migration is what actually runs against the live project. Both, or the next person who runs `schema.sql` from scratch gets a different database than production.
3. **Do not touch any `.js` or `.html` file in this slice.** If your diff contains one, you have gone past the slice boundary.
4. **The RLS block in `schema.sql` is `drop`-then-`create` inside one `do $$` (lines 95–135).** New policies go in *both* halves — a `create` without its matching `drop if exists` makes the whole script non-idempotent and it will fail on the second run.
5. **Never widen a policy beyond what is written here.** `delta < 0` on the `kid buy` policy is the entire defence against a kid minting coins. `using (true)` anywhere on `stars_ledger` insert is a failed slice.
6. **The new policy is called `kid buy`, not `kid spend`.** A policy named `"kid spend"` already exists on `public.passes` (`supabase/schema.sql:279`). Postgres scopes policy names per table so both would work, but the next person grepping `"kid spend"` would find two unrelated rules. Do not reuse the name.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `supabase/schema.sql` | Modify | canonical schema: view, policies, index |
| `supabase/migrations/20260802_stars_economy.sql` | Create | the migration actually applied to the live project |

---

## Task 1: Redefine the view

**File:** `supabase/schema.sql`, lines 74–78.

- [ ] **Step 1:** Replace the whole `star_totals` block with:

```sql
-- 7. Convenience view: live star totals.
--    `stars`  = achievement (earned; shopping never reduces it) — plan 2026-08-02 D1
--    `coins`  = wallet (every row, spending included)
--    Before any shop/cashout row exists these are equal, which is why adding the
--    wallet changed no existing screen.
create or replace view star_totals as
  select k.id as kid_id, k.name,
    coalesce(sum(l.delta) filter (where l.source in ('app','admin')),0)::int as stars,
    coalesce(sum(l.delta),0)::int as coins
  from kids k left join stars_ledger l on l.kid_id = k.id
  group by k.id, k.name;
```

- [ ] **Step 2:** Note for later slices — `js/sync.js:196` currently selects `kid_id,stars`. It keeps working unchanged after this slice. Slice 56 widens it to `kid_id,stars,coins`. **Do not widen it here.**

---

## Task 2: Policies and the index

**File:** `supabase/schema.sql`, the `do $$` block at lines 95–135.

- [ ] **Step 1:** In the `drop policy if exists` half, add these three lines next to the existing `kid star` drop:

```sql
  execute 'drop policy if exists "kid buy" on public.stars_ledger';
  execute 'drop policy if exists "admin settle" on public.stars_ledger';
```

- [ ] **Step 2:** In the `create policy` half, **replace** the existing `kid star` line:

```sql
  execute 'create policy "kid star" on public.stars_ledger for insert with check (source = ''app'' and delta between 1 and 3)';
```

with the widened version plus the two new policies:

```sql
  -- widened 3 -> 5 so a streak bonus (+5 at 7 days) can be written by the tablet
  execute 'create policy "kid star" on public.stars_ledger for insert with check (source = ''app'' and delta between 1 and 5)';
  -- kids may spend, never mint: delta < 0 is the whole defence
  execute 'create policy "kid buy" on public.stars_ledger for insert with check (source in (''shop'',''cashout'') and delta < 0)';
  -- Papa settles a cash-out by stamping granted_by; nothing else is updatable
  execute 'create policy "admin settle" on public.stars_ledger for update to authenticated using (source = ''cashout'') with check (source = ''cashout'')';
```

Note the doubled single quotes — the whole statement is inside a SQL string literal.

- [ ] **Step 3:** Immediately after the `do $$ … end $$;` block, add the streak index:

```sql
-- One streak bonus per kid per reason. The reason carries the date, so the same
-- streak length reached again after a break is a different row and still pays.
-- applyOp already swallows 23505 on star inserts (js/sync.js), so a replay, a
-- second tablet or a re-check after reload all collapse to this one row with no
-- client-side bookkeeping at all. (plan 2026-08-02 D8)
create unique index if not exists uniq_streak_bonus
  on stars_ledger (kid_id, reason)
  where source = 'app' and reason like 'Streak%';
```

---

## Task 3: The migration file

- [ ] **Step 1:** Create `supabase/migrations/20260802_stars_economy.sql` containing exactly the three changes above, in this order, self-contained:

```sql
-- ============================================================
-- Stars economy (plan docs/plans/2026-08-02-stars-economy, slice 54)
--
-- Adds a wallet to the existing ledger. No new table: a purchase is a
-- stars_ledger row with a negative delta and source 'shop' or 'cashout'.
-- ============================================================

-- 1. star_totals gains `coins`; `stars` keeps its existing VALUE while its
--    formula narrows to earned-only. Identical results until a spend row exists.
create or replace view star_totals as
  select k.id as kid_id, k.name,
    coalesce(sum(l.delta) filter (where l.source in ('app','admin')),0)::int as stars,
    coalesce(sum(l.delta),0)::int as coins
  from kids k left join stars_ledger l on l.kid_id = k.id
  group by k.id, k.name;

-- 2. Policies.
do $$
begin
  execute 'drop policy if exists "kid star" on public.stars_ledger';
  execute 'drop policy if exists "kid buy" on public.stars_ledger';
  execute 'drop policy if exists "admin settle" on public.stars_ledger';

  execute 'create policy "kid star" on public.stars_ledger for insert with check (source = ''app'' and delta between 1 and 5)';
  execute 'create policy "kid buy" on public.stars_ledger for insert with check (source in (''shop'',''cashout'') and delta < 0)';
  execute 'create policy "admin settle" on public.stars_ledger for update to authenticated using (source = ''cashout'') with check (source = ''cashout'')';
end $$;

-- 3. One streak bonus per kid per reason.
create unique index if not exists uniq_streak_bonus
  on stars_ledger (kid_id, reason)
  where source = 'app' and reason like 'Streak%';

-- 4. Seed the shop config if it is not already there. Empty goalReward is
--    intentional — the kid app renders a placeholder until Papa names the prize.
insert into family_settings (key, value) values ('shop', '{}')
  on conflict (key) do nothing;
```

- [ ] **Step 2:** Apply it to the live project (Supabase SQL editor, or `mcp__supabase__apply_migration` with name `stars_economy`).

---

## Task 4: Prove each guarantee, one query at a time

Run these against the live project. **Every one must produce the stated result** — do not proceed to slice 55 on a partial pass.

- [ ] **Step 1: the value did not move.**

```sql
select kid_id, stars, coins from star_totals order by kid_id;
```

Expected: `lili 38 38`, `lucien 39 39`, `luis 49 49`. If `stars` is not 38/39/49, Task 1 is wrong — stop.

- [ ] **Step 2: a kid can spend.** Run as **anon** (Supabase SQL editor runs as service role and will bypass RLS — use the browser console on the kid app, or `set role anon;` first):

```sql
set role anon;
insert into stars_ledger (kid_id, delta, reason, source) values ('lili', -1, 'slice 54 probe', 'shop');
```
Expected: **succeeds**.

- [ ] **Step 3: a kid cannot mint.** Each of these must fail with `new row violates row-level security policy`:

```sql
insert into stars_ledger (kid_id, delta, reason, source) values ('lili',  1, 'probe', 'shop');
insert into stars_ledger (kid_id, delta, reason, source) values ('lili',  0, 'probe', 'shop');
insert into stars_ledger (kid_id, delta, reason, source) values ('lili', -1, 'probe', 'admin');
insert into stars_ledger (kid_id, delta, reason, source) values ('lili', -1, 'probe', 'nonsense');
insert into stars_ledger (kid_id, delta, reason, source) values ('lili',  6, 'probe', 'app');
```

If **any** of these succeeds, the policy is too wide. Stop and fix before continuing.

- [ ] **Step 4: the widened earn cap works.**

```sql
insert into stars_ledger (kid_id, delta, reason, source) values ('lili', 5, 'slice 54 probe +5', 'app');
```
Expected: **succeeds** (would have failed before this slice).

- [ ] **Step 5: coins and stars now diverge.**

```sql
reset role;
select kid_id, stars, coins from star_totals where kid_id='lili';
```
Expected: `stars 43, coins 42` — the +5 counted in both, the −1 shop row counted only in coins. **This single row is the proof the whole design works.**

- [ ] **Step 6: the streak index bites.**

```sql
set role anon;
insert into stars_ledger (kid_id, delta, reason, source) values ('lili', 2, 'Streak 🔥 3 days · 2026-08-02', 'app');
insert into stars_ledger (kid_id, delta, reason, source) values ('lili', 2, 'Streak 🔥 3 days · 2026-08-02', 'app');
```
Expected: first succeeds, second fails with `23505 duplicate key value violates unique constraint "uniq_streak_bonus"`.

- [ ] **Step 7: settle works, and only on cash-outs.** As an **authenticated** admin:

```sql
insert into stars_ledger (kid_id, delta, reason, source) values ('lili', -3, 'Cash out 換錢 · NT$30', 'cashout');
update stars_ledger set granted_by = 'probe' where source='cashout' and reason like '%NT$30%';   -- expect: 1 row
update stars_ledger set granted_by = 'probe' where source='app' and reason like 'slice 54 probe%'; -- expect: 0 rows
```

The second `update` reporting **0 rows** is the guarantee: Papa cannot rewrite an earned star through the settle path.

- [ ] **Step 8: clean up every probe row.**

```sql
reset role;
delete from stars_ledger where reason like 'slice 54 probe%'
   or reason = 'Streak 🔥 3 days · 2026-08-02'
   or reason = 'Cash out 換錢 · NT$30';
select kid_id, stars, coins from star_totals order by kid_id;
```
Expected: back to `38 38 / 39 39 / 49 49`. **If these are not the original numbers, you have left test data in the kids' real balances.**

- [ ] **Step 9:** `node scripts/check.mjs` — green.

- [ ] **Step 10: commit.**

```bash
git add supabase/schema.sql supabase/migrations/20260802_stars_economy.sql
git commit -m "feat(stars): ledger gains shop/cashout sources and a coins column"
```

---

## Notes for the implementer

If you are tempted to add a `wallets` table, or a `balance` column on `kids`, re-read design.md D1. The balance is `sum(delta)` and the view already answers it. A second place to store it is the exact bug that plan `2026-07-29-star-source-of-truth` spent five slices deleting.

Nothing visible changes after this slice. That is the success condition, not a problem — Step 1 and Step 8 exist to prove it.
