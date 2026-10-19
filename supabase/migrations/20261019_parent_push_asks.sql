-- Parent push for the Ask panel (docs/plans/2026-10-19-parent-app/, §10).
-- Papa (2026-10-19): no notification arrived when a kid sent a message from
-- Ask. The first push migration only watched points_claims and points_requests;
-- this adds asks. Run after 20261019_parent_push.sql, as the database owner;
-- safe to re-run.
--
-- asks.kind: question | canned | urgent (the Ask panel), quest_verify:* (a
-- finished quest to check). reward:* rows are skipped because the matching
-- points_requests row already notifies.
begin;

create or replace function public.parent_push_on_ask() returns trigger language plpgsql security definer
set search_path=public as $$
begin
  if new.kind not like 'reward:%' then
    perform parent_push_call(jsonb_build_object('type','ask','id',new.id));
  end if;
  return null;
end $$;
drop trigger if exists parent_push_ask on public.asks;
create trigger parent_push_ask after insert on public.asks
  for each row execute function public.parent_push_on_ask();

-- Devices registered before this switch only listed task and reward: add the
-- Ask messages to them, and make them part of the default for new devices.
alter table public.parent_push_subscriptions alter column kinds set default '{task,reward,ask}';
update public.parent_push_subscriptions set kinds=array_append(kinds,'ask') where not ('ask'=any(kinds));

commit;
