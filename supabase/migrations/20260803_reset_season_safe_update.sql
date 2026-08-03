-- Supabase safe-update compatibility: reset_season clears kid PINs with a
-- WHERE clause so projects with safe-update enabled do not reject the RPC.

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
  update kids set pin = null where pin is not null;
  insert into family_settings (key, value) values ('season_reset_at', now()::text);
end;
$$;

revoke all on function public.reset_season() from public, anon;
grant execute on function public.reset_season() to authenticated;
