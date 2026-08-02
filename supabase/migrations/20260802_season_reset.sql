-- ============================================================
-- Season reset — one atomic wipe, callable only by Papa.
--
-- security definer so it runs as the function owner: no per-table
-- delete policy is needed (asks, photos, search_log and help_claims
-- have none) and a half-finished reset is impossible.
--
-- kids rows survive (they are seeded, not user data); their PINs are
-- cleared. family_settings is emptied, which is what takes the Papa
-- PIN, the app pauses and every schedule change back to the defaults
-- in js/day-data.js — "restart the schedule to the beginning".
--
-- season_reset_at is re-inserted right after: the tablets watch that
-- key and drop their local copy of last season (js/sync.js hydrate).
-- ============================================================

-- Who may erase the season. The rest of the admin surface trusts the
-- `authenticated` role as a whole, which is fine for row-level edits —
-- but the anon key is public in a static site, so if email signup is
-- ever left on, a self-registered stranger is `authenticated` too.
-- This one function is unrecoverable, so it gets an explicit allowlist
-- instead. Never truncated by reset_season.
create table if not exists admins (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz default now()
);
alter table admins enable row level security;
-- RLS on with no policy = deny all. Only security-definer functions read it;
-- add an admin with:  insert into admins (user_id) values ('<uuid>');
insert into admins (user_id) select id from auth.users on conflict do nothing;

create or replace function public.reset_season()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from admins where user_id = auth.uid()) then
    raise exception 'reset_season: not an admin';
  end if;

  truncate table
    day_ticks, day_rolls, stars_ledger, act_done, vocab_mastery, game_stats,
    papa_notes, asks, passes, photos, search_log, help_claims,
    day_overrides, day_redos, brain_done, family_settings;
  update kids set pin = null;
  insert into family_settings (key, value) values ('season_reset_at', now()::text);
end;
$$;

revoke all on function public.reset_season() from public, anon;
grant execute on function public.reset_season() to authenticated;
