-- Reset ALL points to zero (Papa's request, 2026-10-09).
-- Admin → Settings → Clean up does the same per kid without SQL
-- (migrations/20261009_admin_cleanup.sql); this script also keeps a backup copy.
-- Run in the Supabase SQL editor as the database owner (the default "postgres" role).
-- It is NOT part of the app and the app cannot run it. Not reversible except from the
-- backup tables this script creates first (points_reset_backup_*).
--
-- Clears: stars_ledger (all earnings), points claims / assignments / excuses,
-- reward requests / redemptions / refunds, legacy spending.
-- Keeps: kids, asks (inbox rows), family_settings (policy, rewards, PINs, gate),
-- day ticks, activities, Brain Gym, vocab, game scores (those are the season reset).
-- Works before and after the 2026-10-03 points migration: missing tables are skipped.
begin;

-- 1. Backup first (one copy per table; re-running keeps the first copy).
do $$
declare t text;
begin
  foreach t in array array['stars_ledger','points_claims','points_assignments','points_excuses',
    'points_requests','points_redemptions','points_refunds','points_legacy_spending'] loop
    if to_regclass('public.'||t) is not null
       and to_regclass('public.'||t||'_reset_backup_20261009') is null then
      execute format('create table public.%I as table public.%I', t||'_reset_backup_20261009', t);
      execute format('alter table public.%I enable row level security', t||'_reset_backup_20261009');
    end if;
  end loop;
end $$;

-- 2. Delete, children before parents. The ledger guard turns every DELETE into a
-- silent no-op, even for the owner, so it is off for this transaction only.
do $$
declare t text;
  guarded boolean:=exists(select 1 from pg_trigger where tgrelid='public.stars_ledger'::regclass and tgname='points_guard_ledger');
begin
  if guarded then alter table public.stars_ledger disable trigger points_guard_ledger; end if;
  foreach t in array array['points_refunds','points_redemptions','points_requests','points_claims',
    'points_assignments','points_excuses','points_legacy_spending','stars_ledger'] loop
    if to_regclass('public.'||t) is not null then
      execute format('delete from public.%I', t);
    end if;
  end loop;
  if guarded then alter table public.stars_ledger enable trigger points_guard_ledger; end if;
end $$;

commit;

-- 3. Check (run after the commit): every kid must read 0.
select * from public.star_totals;
-- Run this one only if the points migration is installed (else error 42P01):
-- select * from public.point_totals;
