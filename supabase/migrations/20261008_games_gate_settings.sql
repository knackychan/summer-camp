-- Games points gate, slice 03 (docs/plans/2026-10-08-games-gate-ai-guide/03-papa-controls-and-admin-view.md):
-- seed family_settings.games_gate_v1 switched OFF, and let only Papa (an
-- allowlisted parent in public.admins) change it, with its values checked.
--
-- Independent of the 2026-10-03 points migration: it uses public.admins
-- directly, so it can run before or after it. Run as the database owner.
-- Safe to re-run. Tablets can never write this key (no anon policy allows it);
-- this trigger also stops a signed-in account that is not a parent.
begin;

insert into public.family_settings(key,value)
values('games_gate_v1','{"enabled":false,"threshold":{"luis":50,"lili":50,"lucien":40},"rerollsPerSlot":3,"ai":{"enabled":false,"callsPerKidPerDay":8,"familyCallsPerDay":24,"dailyUsdCap":0.05,"monthlyUsdCap":1}}')
on conflict(key) do nothing;

-- admins has RLS, so the parent lookup runs as its owner (same idea as
-- points_parent()); the guard itself must not, or every caller would pass the
-- owner check below.
create or replace function public.games_gate_parent() returns boolean language sql stable security definer
set search_path=public as $$ select exists(select 1 from public.admins where user_id=auth.uid()) $$;
revoke all on function public.games_gate_parent() from public;
grant execute on function public.games_gate_parent() to anon,authenticated;

create or replace function public.games_gate_guard_settings() returns trigger language plpgsql set search_path=public as $$
declare v jsonb; k text; n numeric;
begin
  if tg_op='DELETE' then
    if old.key='games_gate_v1' then raise exception 'Games gate settings cannot be deleted; switch the gate off instead'; end if;
    return old;
  end if;
  if new.key<>'games_gate_v1' then return new; end if;
  if current_user<>pg_get_userbyid((select relowner from pg_class where oid='public.family_settings'::regclass))
     and not public.games_gate_parent() then
    raise exception 'Parent setting required';
  end if;
  begin v:=new.value::jsonb; exception when others then raise exception 'Games gate settings must be JSON'; end;
  if jsonb_typeof(v)<>'object' or jsonb_typeof(coalesce(v->'enabled','false'::jsonb))<>'boolean' then
    raise exception 'Games gate: enabled must be true or false';
  end if;
  foreach k in array array['luis','lili','lucien'] loop
    if v->'threshold'->k is not null then
      if jsonb_typeof(v->'threshold'->k)<>'number' then raise exception 'Games gate thresholds are numbers'; end if;
      n:=(v->'threshold'->>k)::numeric;
      if n<0 or n>300 or n<>trunc(n) or mod(n,5)<>0 then raise exception 'Games gate thresholds are 0..300 in steps of five'; end if;
    end if;
  end loop;
  if v ? 'rerollsPerSlot' and (jsonb_typeof(v->'rerollsPerSlot')<>'number' or (v->>'rerollsPerSlot')::numeric not between 0 and 10) then
    raise exception 'Games gate rerolls are 0..10';
  end if;
  foreach k in array array['callsPerKidPerDay','familyCallsPerDay','dailyUsdCap','monthlyUsdCap'] loop
    if v->'ai'->k is not null and (jsonb_typeof(v->'ai'->k)<>'number' or (v->'ai'->>k)::numeric<0) then
      raise exception 'Games gate AI caps are numbers of zero or more';
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists games_gate_guard_settings on public.family_settings;
create trigger games_gate_guard_settings before insert or update or delete on public.family_settings
  for each row execute function public.games_gate_guard_settings();

commit;
