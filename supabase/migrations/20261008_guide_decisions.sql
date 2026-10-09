-- Home-help guide decisions, slice 04 (docs/plans/2026-10-08-games-gate-ai-guide/
-- 04-local-guide-schedule-and-cache.md, design.md D8). One row per
-- kid / Taipei day / slot / reroll: the answers and the (up to) three picks.
-- Tablets insert their own local decisions and mark which pick a kid started;
-- AI rows (source 'ai', model, tokens, cost) are written only by the
-- games-guide Edge Function with its hosted service role (slice 05).
-- Rows are kept for Papa's history; nothing deletes them.
--
-- Independent of the points migration. Run as the database owner; safe to re-run.
begin;

create table if not exists public.guide_decisions (
  kid_id text not null references public.kids(id), day date not null,
  slot text not null check (slot in ('morning','afternoon','evening')),
  reroll integer not null check (reroll >= 0),
  answers jsonb not null,
  picks jsonb not null check (jsonb_typeof(picks)='array' and jsonb_array_length(picks) <= 3),
  source text not null check (source in ('ai','local')),
  model text, input_tokens integer, output_tokens integer, cost_usd numeric(10,6),
  started_id text,
  created_at timestamptz not null default now(),
  primary key (kid_id, day, slot, reroll)
);
alter table public.guide_decisions enable row level security;

drop policy if exists "read guide decisions" on public.guide_decisions;
drop policy if exists "tablet saves local guide decisions" on public.guide_decisions;
drop policy if exists "tablet marks guide pick started" on public.guide_decisions;
create policy "read guide decisions" on public.guide_decisions for select using (true);
-- a tablet can only claim a local decision: never AI fields, never a cost
create policy "tablet saves local guide decisions" on public.guide_decisions for insert to anon, authenticated
  with check (source = 'local' and model is null and input_tokens is null and output_tokens is null and cost_usd is null);
create policy "tablet marks guide pick started" on public.guide_decisions for update to anon, authenticated
  using (true) with check (true);

-- column privileges do the rest: insert and select rows, update only started_id
revoke all on public.guide_decisions from anon, authenticated;
grant select, insert on public.guide_decisions to anon, authenticated;
grant update (started_id) on public.guide_decisions to anon, authenticated;

commit;
