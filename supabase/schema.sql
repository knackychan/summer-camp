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

-- read for everyone (family app: URL is the perimeter, PIN is the lock)
create policy "read kids"    on kids          for select using (true);
create policy "read ticks"   on day_ticks     for select using (true);
create policy "read rolls"   on day_rolls     for select using (true);
create policy "read ledger"  on stars_ledger  for select using (true);
create policy "read acts"    on act_done      for select using (true);
create policy "read vocab"   on vocab_mastery for select using (true);
create policy "read stats"   on game_stats    for select using (true);

-- kid-device writes (anon): only 'app' source, small positive deltas
create policy "kid tick"   on day_ticks    for insert with check (true);
create policy "kid untick" on day_ticks    for delete using (true);
create policy "kid roll"   on day_rolls    for all    using (true) with check (true);
create policy "kid star"   on stars_ledger for insert
  with check (source = 'app' and delta between 1 and 3);
create policy "kid act"    on act_done     for insert with check (true);
create policy "kid vocab"  on vocab_mastery for all   using (true) with check (true);
create policy "kid stats"  on game_stats   for all    using (true) with check (true);

-- admin (any authenticated user = Papa's account): full ledger power
create policy "admin star" on stars_ledger for insert to authenticated
  with check (source = 'admin');
create policy "admin fix"  on stars_ledger for delete to authenticated using (true);
create policy "admin pins" on kids         for update to authenticated using (true);

-- Realtime: enable on day_ticks + stars_ledger in Dashboard → Database → Replication


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

alter table papa_notes enable row level security;
alter table asks       enable row level security;
alter table passes     enable row level security;
alter table photos     enable row level security;
alter table search_log enable row level security;

create policy "read notes"   on papa_notes for select using (true);
create policy "admin notes"  on papa_notes for all to authenticated using (true) with check (true);
create policy "read asks"    on asks   for select using (true);
create policy "kid ask"      on asks   for insert with check (answer is null);
create policy "admin answer" on asks   for update to authenticated using (true);
create policy "read passes"  on passes for select using (true);
create policy "kid request"  on passes for insert with check (status = 'requested');
create policy "kid spend"    on passes for update using (status = 'granted') with check (status = 'spent');
create policy "admin passes" on passes for all to authenticated using (true) with check (true);
create policy "read photos"  on photos for select using (true);
create policy "kid photo"    on photos for insert with check (true);
create policy "read search"  on search_log for select using (true);
create policy "kid search"   on search_log for insert with check (true);

-- Storage: create buckets 'voices' and 'proofs' (public read, anon insert) in Dashboard.
-- Push for urgent asks: Edge Function on asks INSERT where kind='urgent'
-- → POST to ntfy.sh/<family-topic> (or a Telegram bot). Free, no app needed.
