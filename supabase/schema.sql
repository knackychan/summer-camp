-- ============================================================
-- SUMMER QUEST — Supabase schema (free tier)
-- Paste into Supabase SQL Editor. Idempotent-ish: run once.
-- ============================================================

-- 1. Kid profiles (seeded, not user-managed)
create table if not exists kids (
  id         text primary key,            -- 'lucien' | 'lili' | 'luis'
  name       text not null,
  color      text not null,
  pin        text,                        -- optional 4-digit PIN, null = no PIN
  created_at timestamptz default now()
);

insert into kids (id, name, color) values
  ('lucien','Lucien','#3DDC97'),
  ('lili','Lili','#FF6FB5'),
  ('luis','Luis','#4EA8FF')
on conflict (id) do nothing;

-- 2. Daily schedule ticks (one row per ticked block)
create table if not exists day_ticks (
  kid_id     text not null references kids(id),
  day        date not null,
  block_idx  int  not null,               -- index into the client DAY[] array
  created_at timestamptz default now(),
  primary key (kid_id, day, block_idx)
);

-- 3. Mission rerolls (keeps 🎲 swaps consistent across devices)
create table if not exists day_rolls (
  kid_id    text not null references kids(id),
  day       date not null,
  block_idx int  not null,
  count     int  not null default 0,
  primary key (kid_id, day, block_idx)
);

-- 4. Stars as an append-only ledger (total = sum of deltas)
create table if not exists stars_ledger (
  id         uuid primary key default gen_random_uuid(),
  kid_id     text not null references kids(id),
  delta      int  not null,               -- +1, +2, -1 …
  reason     text not null,               -- 'day mission: Sport', 'admin bonus: helped Lucien'
  source     text not null default 'app', -- 'app' | 'admin'
  granted_by text,                        -- admin uid when source='admin'
  created_at timestamptz default now()
);
create index if not exists idx_ledger_kid on stars_ledger (kid_id, created_at desc);

-- 5. Free-choice activity completions (Activities tab, once/day)
create table if not exists act_done (
  kid_id  text not null references kids(id),
  day     date not null,
  act_idx int  not null,
  primary key (kid_id, day, act_idx)
);

-- 6. Word Wizard mastery + game bests (cross-device continuity)
create table if not exists vocab_mastery (
  kid_id     text not null references kids(id),
  word_key   text not null,               -- 'w:cat' | 's:i want water'
  box        int  not null default 0,
  updated_at timestamptz default now(),
  primary key (kid_id, word_key)
);

create table if not exists game_stats (
  kid_id  text not null references kids(id),
  stat    text not null,                  -- 'best_race' | 'best_orc' | 'best_shop' | 'best_balloon' | 'missions'
  value   int  not null default 0,
  primary key (kid_id, stat)
);

-- 7. Convenience view: live star totals
create or replace view star_totals as
  select k.id as kid_id, k.name, coalesce(sum(l.delta),0)::int as stars
  from kids k left join stars_ledger l on l.kid_id = k.id
  group by k.id, k.name;

-- ============================================================
-- RLS: anon (kid tablets) can read everything and write
-- app-sourced rows; only the authenticated admin can write
-- admin-sourced ledger rows or delete/correct anything.
-- ============================================================
alter table kids          enable row level security;
alter table day_ticks     enable row level security;
alter table day_rolls     enable row level security;
alter table stars_ledger  enable row level security;
alter table act_done      enable row level security;
alter table vocab_mastery enable row level security;
alter table game_stats    enable row level security;

-- read/write policies. Kept in one block so reruns cannot stop halfway on an existing policy.
do $$
begin
  execute 'drop policy if exists "read kids" on public.kids';
  execute 'drop policy if exists "read ticks" on public.day_ticks';
  execute 'drop policy if exists "read rolls" on public.day_rolls';
  execute 'drop policy if exists "read ledger" on public.stars_ledger';
  execute 'drop policy if exists "read acts" on public.act_done';
  execute 'drop policy if exists "read vocab" on public.vocab_mastery';
  execute 'drop policy if exists "read stats" on public.game_stats';
  execute 'drop policy if exists "kid tick" on public.day_ticks';
  execute 'drop policy if exists "kid untick" on public.day_ticks';
  execute 'drop policy if exists "kid roll" on public.day_rolls';
  execute 'drop policy if exists "kid star" on public.stars_ledger';
  execute 'drop policy if exists "kid act" on public.act_done';
  execute 'drop policy if exists "kid vocab" on public.vocab_mastery';
  execute 'drop policy if exists "kid stats" on public.game_stats';
  execute 'drop policy if exists "admin star" on public.stars_ledger';
  execute 'drop policy if exists "admin fix" on public.stars_ledger';
  execute 'drop policy if exists "admin pins" on public.kids';

  execute 'create policy "read kids" on public.kids for select using (true)';
  execute 'create policy "read ticks" on public.day_ticks for select using (true)';
  execute 'create policy "read rolls" on public.day_rolls for select using (true)';
  execute 'create policy "read ledger" on public.stars_ledger for select using (true)';
  execute 'create policy "read acts" on public.act_done for select using (true)';
  execute 'create policy "read vocab" on public.vocab_mastery for select using (true)';
  execute 'create policy "read stats" on public.game_stats for select using (true)';
  execute 'create policy "kid tick" on public.day_ticks for insert with check (true)';
  execute 'create policy "kid untick" on public.day_ticks for delete using (true)';
  execute 'create policy "kid roll" on public.day_rolls for all using (true) with check (true)';
  execute 'create policy "kid star" on public.stars_ledger for insert with check (source = ''app'' and delta between 1 and 3)';
  execute 'create policy "kid act" on public.act_done for insert with check (true)';
  execute 'create policy "kid vocab" on public.vocab_mastery for all using (true) with check (true)';
  execute 'create policy "kid stats" on public.game_stats for all using (true) with check (true)';
  execute 'create policy "admin star" on public.stars_ledger for insert to authenticated with check (source = ''admin'')';
  execute 'create policy "admin fix" on public.stars_ledger for delete to authenticated using (true)';
  execute 'create policy "admin pins" on public.kids for update to authenticated using (true)';
end $$;

-- Realtime: enable on day_ticks + stars_ledger in Dashboard → Database → Replication
do $$
begin
  alter publication supabase_realtime add table day_ticks;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table stars_ledger;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table asks;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table passes;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table photos;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table kids;
exception when duplicate_object then null;
end $$;


-- ============================================================
-- v2 additions — assistance features (brainstorm 2026-07-26)
-- ============================================================

-- Papa's daily message (shown at the top of My Day)
create table if not exists papa_notes (
  day        date primary key,
  body       text not null,               -- bilingual free text, Papa writes it
  created_at timestamptz default now()
);

-- Ask channel: questions/help requests from kids, answers from Papa
create table if not exists asks (
  id         uuid primary key default gen_random_uuid(),
  kid_id     text not null references kids(id),
  kind       text not null default 'question',  -- 'question' | 'urgent' | 'canned'
  body       text,                              -- typed text or canned label
  audio_path text,                              -- Supabase Storage path for voice memos
  answer     text,
  answer_audio_path text,
  answered_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_asks_open on asks (answered_at) where answered_at is null;

-- Passes: golden (reward, spendable) and excused (incapacity)
create table if not exists passes (
  id         uuid primary key default gen_random_uuid(),
  kid_id     text not null references kids(id),
  kind       text not null,                -- 'golden' | 'excused'
  status     text not null default 'granted', -- 'requested' | 'granted' | 'denied' | 'spent'
  reason     text,                         -- kid's request reason / Papa's grant reason
  day        date,                         -- when spent/applied
  block_idx  int,                          -- which block it excused/skipped
  granted_by text,
  created_at timestamptz default now()
);

-- Photo proof / dinner gallery (files in Storage bucket 'proofs')
create table if not exists photos (
  id         uuid primary key default gen_random_uuid(),
  kid_id     text not null references kids(id),
  day        date not null,
  block_idx  int,
  path       text not null,
  created_at timestamptz default now()
);

-- Learn tab: composed searches (transparency, not surveillance)
create table if not exists search_log (
  id         uuid primary key default gen_random_uuid(),
  kid_id     text not null references kids(id),
  query      text not null,
  engine     text not null default 'kiddle',
  created_at timestamptz default now()
);

-- Captain view: Luis can claim that he helped a sibling; Papa reviews it.
create table if not exists help_claims (
  id            uuid primary key default gen_random_uuid(),
  captain_id    text not null references kids(id) default 'luis',
  helped_kid_id text not null references kids(id),
  day           date not null,
  body          text not null,
  status        text not null default 'requested', -- 'requested' | 'approved' | 'denied'
  reviewed_by   text,
  reviewed_at   timestamptz,
  created_at    timestamptz default now(),
  constraint help_claims_captain_luis check (captain_id = 'luis'),
  constraint help_claims_not_self check (captain_id <> helped_kid_id)
);
create index if not exists idx_help_claims_status on help_claims (status, created_at desc);
create index if not exists idx_help_claims_day on help_claims (day, created_at desc);

alter table papa_notes enable row level security;
alter table asks       enable row level security;
alter table passes     enable row level security;
alter table photos     enable row level security;
alter table search_log enable row level security;
alter table help_claims enable row level security;

do $$
begin
  execute 'drop policy if exists "read notes" on public.papa_notes';
  execute 'drop policy if exists "admin notes" on public.papa_notes';
  execute 'drop policy if exists "read asks" on public.asks';
  execute 'drop policy if exists "kid ask" on public.asks';
  execute 'drop policy if exists "admin answer" on public.asks';
  execute 'drop policy if exists "read passes" on public.passes';
  execute 'drop policy if exists "kid request" on public.passes';
  execute 'drop policy if exists "kid spend" on public.passes';
  execute 'drop policy if exists "admin passes" on public.passes';
  execute 'drop policy if exists "read photos" on public.photos';
  execute 'drop policy if exists "kid photo" on public.photos';
  execute 'drop policy if exists "read search" on public.search_log';
  execute 'drop policy if exists "kid search" on public.search_log';
  execute 'drop policy if exists "read help claims" on public.help_claims';
  execute 'drop policy if exists "kid help claim" on public.help_claims';
  execute 'drop policy if exists "admin help claims" on public.help_claims';

  execute 'create policy "read notes" on public.papa_notes for select using (true)';
  execute 'create policy "admin notes" on public.papa_notes for all to authenticated using (true) with check (true)';
  execute 'create policy "read asks" on public.asks for select using (true)';
  execute 'create policy "kid ask" on public.asks for insert with check (answer is null)';
  execute 'create policy "admin answer" on public.asks for update to authenticated using (true)';
  execute 'create policy "read passes" on public.passes for select using (true)';
  execute 'create policy "kid request" on public.passes for insert with check (status = ''requested'')';
  execute 'create policy "kid spend" on public.passes for update using (status = ''granted'') with check (status = ''spent'')';
  execute 'create policy "admin passes" on public.passes for all to authenticated using (true) with check (true)';
  execute 'create policy "read photos" on public.photos for select using (true)';
  execute 'create policy "kid photo" on public.photos for insert with check (true)';
  execute 'create policy "read search" on public.search_log for select using (true)';
  execute 'create policy "kid search" on public.search_log for insert with check (true)';
  execute 'create policy "read help claims" on public.help_claims for select using (true)';
  execute 'create policy "kid help claim" on public.help_claims for insert with check (captain_id = ''luis'' and status = ''requested'' and reviewed_at is null)';
  execute 'create policy "admin help claims" on public.help_claims for update to authenticated using (true) with check (true)';
end $$;

do $$
begin
  alter publication supabase_realtime add table help_claims;
exception when duplicate_object then null;
end $$;

-- ============================================================
-- v3 additions — lock / reschedule / outing (plans 2026-07-26)
-- ============================================================

-- Family-wide settings (admin PIN etc). Plaintext by design — toddler lock, not security.
create table if not exists family_settings (
  key        text primary key,
  value      text not null default '',
  updated_at timestamptz default now()
);
alter table family_settings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'family_settings' and policyname = 'read settings'
  ) then
    create policy "read settings" on family_settings for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'family_settings' and policyname = 'admin settings'
  ) then
    create policy "admin settings" on family_settings for all to authenticated using (true) with check (true);
  end if;
end $$;

-- Per-day block time overrides (reschedule). Base DAY plan lives in the client;
-- kid_id 'all' = family-wide; a kid-specific row wins over 'all' for that kid.
create table if not exists day_overrides (
  day        date not null,
  block_idx  int  not null,
  kid_id     text not null default 'all',
  t          text not null,
  updated_at timestamptz default now(),
  primary key (day, block_idx, kid_id)
);
alter table day_overrides enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'day_overrides' and policyname = 'read overrides'
  ) then
    create policy "read overrides" on day_overrides for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'day_overrides' and policyname = 'write overrides'
  ) then
    create policy "write overrides" on day_overrides for insert with check (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'day_overrides' and policyname = 'update overrides'
  ) then
    create policy "update overrides" on day_overrides for update using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'day_overrides' and policyname = 'delete overrides'
  ) then
    create policy "delete overrides" on day_overrides for delete using (true);
  end if;
end $$;

do $$
begin
  alter publication supabase_realtime add table day_overrides;
exception when duplicate_object then null;
end $$;

-- Outing mode: bulk 'outing' passes over a block range (design.md §3).
-- credited=true → each block earns its star; false → excused, no stars.
alter table passes add column if not exists credited boolean not null default true;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'passes' and policyname = 'outing toggle'
  ) then
    create policy "outing toggle" on passes for insert
      with check (kind = 'outing' and status = 'granted');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'passes' and policyname = 'outing undo'
  ) then
    create policy "outing undo" on passes for delete
      using (kind = 'outing');
  end if;
end $$;

-- Storage: create buckets 'voices' and 'proofs' (public read, anon insert) in Dashboard.
-- Push for urgent asks: Edge Function on asks INSERT where kind='urgent'
-- → POST to ntfy.sh/<family-topic> (or a Telegram bot). Free, no app needed.

-- P1 storage for ask-channel voice memos.
insert into storage.buckets (id, name, public)
values ('voices', 'voices', true)
on conflict (id) do update set public = true;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'voices public read'
  ) then
    create policy "voices public read" on storage.objects
      for select using (bucket_id = 'voices');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'voices anon insert'
  ) then
    create policy "voices anon insert" on storage.objects
      for insert to anon with check (bucket_id = 'voices');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'voices auth insert'
  ) then
    create policy "voices auth insert" on storage.objects
      for insert to authenticated with check (bucket_id = 'voices');
  end if;
end $$;

-- P2 storage for photo proof uploads and dinner gallery.
insert into storage.buckets (id, name, public)
values ('proofs', 'proofs', true)
on conflict (id) do update set public = true;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'proofs public read'
  ) then
    create policy "proofs public read" on storage.objects
      for select using (bucket_id = 'proofs');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'proofs anon insert'
  ) then
    create policy "proofs anon insert" on storage.objects
      for insert to anon with check (bucket_id = 'proofs');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'proofs auth insert'
  ) then
    create policy "proofs auth insert" on storage.objects
      for insert to authenticated with check (bucket_id = 'proofs');
  end if;
end $$;
