-- Parent push notifications (docs/plans/2026-10-19-parent-app/ D4).
-- A parent's device registers a Web Push subscription; when a tablet's task
-- claim becomes 'pending' or a reward request is 'requested', a trigger asks the
-- notify-parents Edge Function (through pg_net) to push to every parent device.
-- pg_cron sends one summary when a device's quiet hours end.
--
-- Tablets are never slowed or blocked: the trigger only queues an HTTP call and
-- swallows any error. Nothing here is readable by the anon key.
--
-- Independent of the other migrations except public.admins and the points
-- tables. Run as the database owner; safe to re-run. After running it, set the
-- two private values (see supabase/functions/notify-parents/README.md):
--   insert into public.parent_push_config(key,value) values
--     ('function_url','https://<project>.supabase.co/functions/v1/notify-parents'),
--     ('webhook_secret','<same value as the PUSH_WEBHOOK_SECRET secret>')
--   on conflict(key) do update set value=excluded.value;
begin;

create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists public.parent_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%'),
  p256dh text not null,
  auth text not null,
  device_label text not null default '',
  kids text[] not null default '{}',                     -- empty = every kid
  kinds text[] not null default '{task,reward}',
  quiet_start text not null default '21:30' check (quiet_start ~ '^\d{2}:\d{2}$'),
  quiet_end text not null default '07:00' check (quiet_end ~ '^\d{2}:\d{2}$'),
  enabled boolean not null default true,
  last_digest_day date,
  last_ok_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.parent_push_subscriptions enable row level security;

-- admins has RLS, so the parent lookup runs as its owner (same as games_gate_parent()).
create or replace function public.parent_push_parent() returns boolean language sql stable security definer
set search_path=public as $$ select exists(select 1 from public.admins where user_id=auth.uid()) $$;
revoke all on function public.parent_push_parent() from public;
grant execute on function public.parent_push_parent() to anon,authenticated;

drop policy if exists "parent owns push devices" on public.parent_push_subscriptions;
create policy "parent owns push devices" on public.parent_push_subscriptions for all to authenticated
  using (user_id=auth.uid() and public.parent_push_parent())
  with check (user_id=auth.uid() and public.parent_push_parent());
revoke all on public.parent_push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.parent_push_subscriptions to authenticated;

-- Private settings: the function URL and the shared webhook secret. RLS on with
-- no policy and no grants, so only the owner (the trigger) reads it.
create table if not exists public.parent_push_config (key text primary key, value text not null);
alter table public.parent_push_config enable row level security;
revoke all on public.parent_push_config from anon, authenticated;

create or replace function public.parent_push_call(p_body jsonb) returns void language plpgsql security definer
set search_path=public as $$
declare u text; s text;
begin
  select value into u from parent_push_config where key='function_url';
  select value into s from parent_push_config where key='webhook_secret';
  if coalesce(u,'')='' or coalesce(s,'')='' then return; end if;
  perform net.http_post(url:=u, body:=p_body,
    headers:=jsonb_build_object('Content-Type','application/json','x-push-secret',s), timeout_milliseconds:=5000);
exception when others then
  raise warning 'parent push skipped: %', sqlerrm;   -- never fail the tablet's write
end $$;
revoke all on function public.parent_push_call(jsonb) from public, anon, authenticated;

create or replace function public.parent_push_on_claim() returns trigger language plpgsql security definer
set search_path=public as $$
begin
  if new.status='pending' and (tg_op='INSERT' or old.status is distinct from 'pending') then
    perform parent_push_call(jsonb_build_object('type','claim','id',new.id));
  end if;
  return null;
end $$;
drop trigger if exists parent_push_claim on public.points_claims;
create trigger parent_push_claim after insert or update of status on public.points_claims
  for each row execute function public.parent_push_on_claim();

create or replace function public.parent_push_on_request() returns trigger language plpgsql security definer
set search_path=public as $$
begin
  if new.status='requested' and (tg_op='INSERT' or old.status is distinct from 'requested') then
    perform parent_push_call(jsonb_build_object('type','request','id',new.id));
  end if;
  return null;
end $$;
drop trigger if exists parent_push_request on public.points_requests;
create trigger parent_push_request after insert or update of status on public.points_requests
  for each row execute function public.parent_push_on_request();

-- Quiet-hours summary: every 15 minutes the function checks which devices just
-- left their quiet hours. Re-running replaces the job instead of adding another.
select cron.unschedule(jobid) from cron.job where jobname='parent-push-digest';
select cron.schedule('parent-push-digest','*/15 * * * *',$$select public.parent_push_call('{"type":"digest"}'::jsonb)$$);

commit;
