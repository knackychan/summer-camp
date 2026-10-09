-- Admin clean-up (docs/plans/2026-10-09-admin-cleanup/ design D1–D4).
-- Parent-only functions to delete messages, Summer chats, photos and passes, and
-- to reset points to zero per kid or for everyone. No backup copy is made (D2):
-- the typed confirmation in Admin is the safeguard.
--
-- Run as the database owner in the SQL editor; safe to re-run. Works before the
-- points migration (points tables that do not exist yet are skipped) and without
-- kid_chats (that category then says it is not installed).
begin;

-- admins has RLS, so the parent lookup runs as its owner (same as points_parent(),
-- kid_chat_parent()). Defined here so clean-up does not depend on the points migration.
create or replace function public.admin_cleanup_parent() returns boolean language sql stable security definer
set search_path=public as $$ select exists(select 1 from public.admins where user_id=auth.uid()) $$;

-- Archived ask ids from the archived_asks setting; a malformed value reads as none.
create or replace function public.admin_cleanup_archived() returns text[] language plpgsql stable security definer
set search_path=public as $$
declare ids text[];
begin
  select coalesce(array_agg(x),'{}') into ids
    from public.family_settings s, jsonb_array_elements_text(s.value::jsonb) x where s.key='archived_asks';
  return coalesce(ids,'{}');
exception when others then return '{}';
end $$;

-- The one delete path. Called only by the two functions below, never by a client.
-- Returns {deleted, skipped, paths[]}; paths are Storage paths the browser removes (D4).
create or replace function public.admin_cleanup_apply(p_category text,p_ids text[]) returns jsonb language plpgsql security definer
set search_path=public as $$
declare n integer:=0; keep text[]:='{}'; gone text[]:='{}'; paths text[]:='{}'; ids text[]:=coalesce(p_ids,'{}');
begin
  if p_category='asks' then
    -- D3: an ask that still carries a reward request stays until points are reset.
    if to_regclass('public.points_requests') is not null then
      execute 'select coalesce(array_agg(id::text),''{}'') from public.points_requests where id::text=any($1)' into keep using ids;
    end if;
    with d as (delete from public.asks where id::text=any(ids) and not id::text=any(keep) returning id,audio_path,answer_audio_path)
    select count(*),coalesce(array_agg(id::text),'{}'),
      coalesce(array_remove(array_agg(audio_path),null),'{}')||coalesce(array_remove(array_agg(answer_audio_path),null),'{}')
      into n,gone,paths from d;
    if n>0 then
      update public.family_settings set updated_at=now(),
        value=coalesce((select jsonb_agg(x)::text from unnest(public.admin_cleanup_archived()) x where not x=any(gone)),'[]')
        where key='archived_asks';
    end if;
  elsif p_category='kid_chats' then
    if to_regclass('public.kid_chats') is null then raise exception 'Summer chat transcripts are not installed'; end if;
    execute 'with d as (delete from public.kid_chats where id::text=any($1) returning 1) select count(*) from d' into n using ids;
  elsif p_category='photos' then
    with d as (delete from public.photos where id::text=any(ids) returning path)
    select count(*),coalesce(array_remove(array_agg(path),null),'{}') into n,paths from d;
  elsif p_category='passes' then
    with d as (delete from public.passes where id::text=any(ids) returning 1) select count(*) into n from d;
  else
    raise exception 'Unknown clean-up category %',p_category;
  end if;
  return jsonb_build_object('deleted',n,'skipped',coalesce(array_length(keep,1),0),'paths',to_jsonb(paths));
end $$;

-- D1: delete the rows Papa ticked.
create or replace function public.admin_delete_rows(p_category text,p_ids text[]) returns jsonb language plpgsql security definer
set search_path=public as $$
begin
  if not public.admin_cleanup_parent() then raise exception 'Parent approval required'; end if;
  return public.admin_cleanup_apply(p_category,p_ids);
end $$;

-- D1: clear a category for one kid (null = every kid); p_archived_only applies to asks only.
create or replace function public.admin_clear(p_category text,p_kid text default null,p_archived_only boolean default false) returns jsonb language plpgsql security definer
set search_path=public as $$
declare ids text[];
begin
  if not public.admin_cleanup_parent() then raise exception 'Parent approval required'; end if;
  if p_kid is not null and not exists(select 1 from public.kids where id=p_kid) then raise exception 'Unknown kid %',p_kid; end if;
  if p_category='asks' then
    select array_agg(id::text) into ids from public.asks
      where (p_kid is null or kid_id=p_kid) and (not coalesce(p_archived_only,false) or id::text=any(public.admin_cleanup_archived()));
  elsif p_category='kid_chats' then
    if to_regclass('public.kid_chats') is null then raise exception 'Summer chat transcripts are not installed'; end if;
    execute 'select array_agg(id::text) from public.kid_chats where $1 is null or kid_id=$1' into ids using p_kid;
  elsif p_category='photos' then
    select array_agg(id::text) into ids from public.photos where p_kid is null or kid_id=p_kid;
  elsif p_category='passes' then
    select array_agg(id::text) into ids from public.passes where p_kid is null or kid_id=p_kid;
  else
    raise exception 'Unknown clean-up category %',p_category;
  end if;
  return public.admin_cleanup_apply(p_category,ids);
end $$;

-- D2: points back to zero for one kid (null = every kid). Children before parents.
-- The ledger guard turns every DELETE into a silent no-op (its owner branch returns
-- NEW, which is null on delete), so it is switched off for this transaction only;
-- an error rolls that back with the rest. Kids, asks, settings, policy history and
-- learning state are kept. Claims go too, so today's routines can be earned again.
create or replace function public.admin_reset_points(p_kid text default null) returns jsonb language plpgsql security definer
set search_path=public as $$
declare t text; n integer; total integer:=0; locked integer;
  guarded boolean:=exists(select 1 from pg_trigger where tgrelid='public.stars_ledger'::regclass and tgname='points_guard_ledger');
begin
  if not public.admin_cleanup_parent() then raise exception 'Parent approval required'; end if;
  if p_kid is not null and not exists(select 1 from public.kids where id=p_kid) then raise exception 'Unknown kid %',p_kid; end if;
  -- Same lock the points RPCs take, so no claim or approval lands half-way.
  perform 1 from public.kids where p_kid is null or id=p_kid order by id for update;
  get diagnostics locked=row_count;
  if to_regclass('public.points_refunds') is not null then
    execute 'delete from public.points_refunds where $1 is null or request_id in (select request_id from public.points_redemptions where kid_id=$1)' using p_kid;
    get diagnostics n=row_count; total:=total+n;
  end if;
  if guarded then alter table public.stars_ledger disable trigger points_guard_ledger; end if;
  foreach t in array array['points_redemptions','points_requests','points_claims','points_assignments',
    'points_excuses','points_legacy_spending','stars_ledger'] loop
    if to_regclass('public.'||t) is not null then
      execute format('delete from public.%I where $1 is null or kid_id=$1',t) using p_kid;
      get diagnostics n=row_count; total:=total+n;
    end if;
  end loop;
  if guarded then alter table public.stars_ledger enable trigger points_guard_ledger; end if;
  return jsonb_build_object('kids',locked,'deleted',total);
end $$;

-- D4: the admin removes photo / voice files itself after the rows are gone. The
-- buckets only allow read and insert, so a parent needs a delete policy; without it
-- Storage quietly removes nothing. Kids' tablets (anon) still cannot delete files.
drop policy if exists "parent deletes files" on storage.objects;
create policy "parent deletes files" on storage.objects for delete to authenticated
  using (bucket_id in ('voices','proofs') and public.admin_cleanup_parent());

-- Supabase grants new functions to anon/authenticated by default; take that back.
-- The parent check stays callable by authenticated: the Storage policy runs it as the caller.
revoke all on function public.admin_cleanup_parent() from public,anon;
grant execute on function public.admin_cleanup_parent() to authenticated;
revoke all on function public.admin_cleanup_archived(),public.admin_cleanup_apply(text,text[]) from public,anon,authenticated;
revoke all on function public.admin_delete_rows(text,text[]),public.admin_clear(text,text,boolean),public.admin_reset_points(text) from public,anon;
grant execute on function public.admin_delete_rows(text,text[]),public.admin_clear(text,text,boolean),public.admin_reset_points(text) to authenticated;

commit;
