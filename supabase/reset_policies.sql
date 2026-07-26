-- One-shot recovery helper if schema.sql was run before policies were idempotent.
-- Run this once in Supabase SQL editor, then rerun supabase/schema.sql.
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

  execute 'drop policy if exists "read settings" on public.family_settings';
  execute 'drop policy if exists "admin settings" on public.family_settings';
  execute 'drop policy if exists "read overrides" on public.day_overrides';
  execute 'drop policy if exists "write overrides" on public.day_overrides';
  execute 'drop policy if exists "update overrides" on public.day_overrides';
  execute 'drop policy if exists "delete overrides" on public.day_overrides';
  execute 'drop policy if exists "outing toggle" on public.passes';
  execute 'drop policy if exists "outing undo" on public.passes';
end $$;
