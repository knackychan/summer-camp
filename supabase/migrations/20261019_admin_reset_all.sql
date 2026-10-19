-- Admin reset that really starts a kid from zero (docs/plans/2026-10-19-admin-reset/).
--
-- admin_reset_points (20261009_admin_cleanup.sql) emptied the points tables but
-- left the tablets nothing to notice: they kept their own copy of claims, the
-- Games-gate "reached today" mark and any unsent earnings, so points showed up
-- again after the reset. It also left today's ticks, Brain Gym and the rest of a
-- kid's progress in place.
--
-- admin_reset_all(p_kid, p_progress) does the points reset, clears the points
-- extras (guide picks, "Papa opened Games today"), optionally clears the kid's
-- progress, and writes a per-kid stamp in family_settings.points_reset_v1 that
-- the tablets act on (js/sync.js applyResetStamps). No backup is made (admin-cleanup
-- D2): the typed RESET in Admin is the safeguard.
--
-- Run as the database owner in the SQL editor after 20261009_admin_cleanup.sql;
-- safe to re-run. Tables that do not exist yet are skipped.
begin;

create or replace function public.admin_reset_all(p_kid text default null,p_progress boolean default true) returns jsonb language plpgsql security definer
set search_path=public as $$
declare t text; n integer; total integer:=0; locked integer; k record; stamps jsonb; now_at text:=to_char(clock_timestamp() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  guarded boolean:=exists(select 1 from pg_trigger where tgrelid='public.stars_ledger'::regclass and tgname='points_guard_ledger');
begin
  if not public.admin_cleanup_parent() then raise exception 'Parent approval required'; end if;
  if p_kid is not null and not exists(select 1 from public.kids where id=p_kid) then raise exception 'Unknown kid %',p_kid; end if;
  -- Same lock the points RPCs take, so no claim or approval lands half-way.
  perform 1 from public.kids where p_kid is null or id=p_kid order by id for update;
  get diagnostics locked=row_count;

  -- Points: children before parents. The ledger guard skips every DELETE, so it is
  -- off for this transaction only (admin-cleanup build notes); an error rolls back both.
  if to_regclass('public.points_refunds') is not null then
    execute 'delete from public.points_refunds where $1 is null or request_id in (select request_id from public.points_redemptions where kid_id=$1)' using p_kid;
    get diagnostics n=row_count; total:=total+n;
  end if;
  if guarded then alter table public.stars_ledger disable trigger points_guard_ledger; end if;
  foreach t in array array['points_redemptions','points_requests','points_claims','points_assignments',
    'points_excuses','points_legacy_spending','stars_ledger','guide_decisions'] loop
    if to_regclass('public.'||t) is not null then
      execute format('delete from public.%I where $1 is null or kid_id=$1',t) using p_kid;
      get diagnostics n=row_count; total:=total+n;
    end if;
  end loop;
  if guarded then alter table public.stars_ledger enable trigger points_guard_ledger; end if;
  -- "Papa opened Games today" belongs to the points gate; the kid starts closed again.
  update public.family_settings set value='',updated_at=now()
    where value<>'' and (key='braingate_'||p_kid or p_kid is null and key like 'braingate\_%');

  -- Progress: My Day ticks, rerolls, activities, Brain Gym, words, best scores,
  -- missions, captain help and redo notes. Messages, photos, passes, Summer chats,
  -- schedule overrides, settings and PINs stay (Clean up deletes messages).
  if p_progress then
    foreach t in array array['day_ticks','day_rolls','act_done','brain_done','vocab_mastery','game_stats','day_redos'] loop
      if to_regclass('public.'||t) is not null then
        execute format('delete from public.%I where $1 is null or kid_id=$1',t) using p_kid;
        get diagnostics n=row_count; total:=total+n;
      end if;
    end loop;
    if to_regclass('public.help_claims') is not null then
      delete from public.help_claims where p_kid is null or captain_id=p_kid or helped_kid_id=p_kid;
      get diagnostics n=row_count; total:=total+n;
    end if;
  end if;

  -- The tablets' signal: one stamp per reset kid. A tablet that has not seen it drops
  -- that kid's local points (and progress) and every earning queued before `at`.
  select coalesce((select value::jsonb from public.family_settings where key='points_reset_v1' and value like '{%'),'{}'::jsonb) into stamps;
  for k in select id from public.kids where p_kid is null or id=p_kid loop
    stamps:=stamps||jsonb_build_object(k.id,jsonb_build_object('at',now_at,'progress',p_progress));
  end loop;
  insert into public.family_settings(key,value,updated_at) values('points_reset_v1',stamps::text,now())
    on conflict(key) do update set value=excluded.value,updated_at=excluded.updated_at;

  return jsonb_build_object('kids',locked,'deleted',total,'progress',p_progress,'at',now_at);
end $$;

revoke all on function public.admin_reset_all(text,boolean) from public,anon;
grant execute on function public.admin_reset_all(text,boolean) to authenticated;

commit;
