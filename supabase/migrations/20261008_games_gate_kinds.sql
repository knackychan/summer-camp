-- Games points gate, slice 02 (docs/plans/2026-10-08-games-gate-ai-guide/02-new-help-award-kinds.md):
-- four home-help award kinds — shoe_tidy 5 (self-checked), garden_tidy 15,
-- living_tidy 10, office_tidy 10 (parent-checked); helping, once a day, no
-- parent assignment needed.
--
-- Run AFTER 20261003_points_system.sql, as the database owner. Safe to re-run:
-- it only re-creates points_policy and points_claim. Both bodies are copied
-- from 20261003_points_system.sql; the only changes are the four kinds in the
-- rules JSON and in the policy-snapshot default amounts. Existing grants on
-- the two functions are kept by `create or replace`.
begin;

create or replace function public.points_policy(p_kind text) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare rules jsonb; custom jsonb; rule jsonb; amount integer;
begin
  rules:='{"morning_teeth":[5,1,"care","self"],"evening_teeth":[5,1,"care","self"],"dressing":[5,1,"care","self"],"shower":[5,1,"care","self"],"table_helper":[5,3,"helping","self"],"plant_patrol":[10,1,"helping","self"],"room_rescue":[10,1,"helping","parent"],"laundry_helper":[15,1,"helping","parent"],"shoe_tidy":[5,1,"helping","self"],"garden_tidy":[15,1,"helping","parent"],"living_tidy":[10,1,"helping","parent"],"office_tidy":[10,1,"helping","parent"],"housework":[20,1,"helping","parent"],"reading":[20,1,"learning","parent"],"brain":[10,3,"learning","brain"],"homework":[30,1,"learning","parent"],"learning":[20,2,"learning","parent"],"movement":[20,1,"movement","parent"],"creative":[20,1,"creative","parent"],"photo":[15,1,"creative","parent"],"music":[15,1,"learning","parent"],"sibling_help":[10,1,"helping","parent"],"outing":[20,1,"movement","parent"],"project":[50,1,"creative","parent"],"balanced_day":[20,1,"bonus","server"],"balanced_week":[50,1,"bonus","server"]}';
  rule:=rules->p_kind;
  if rule is null then raise exception 'Unknown award kind: %',p_kind; end if;
  select value::jsonb into custom from family_settings where key='points_policy_v1';
  amount:=coalesce((custom->'awards'->>p_kind)::integer,(rule->>0)::integer);
  if amount<0 or amount>1000 or amount%5<>0 then raise exception 'Award must be 0..1000 in steps of five'; end if;
  return jsonb_build_object('amount',amount,'limit',(rule->>1)::integer,'category',rule->>2,'verification',rule->>3);
end $$;

create or replace function public.points_claim(p_claim jsonb) returns public.points_claims language plpgsql security definer set search_path=public as $$
#variable_conflict use_variable
declare k text:=p_claim->>'kid_id'; d date:=(p_claim->>'day')::date; kind text:=p_claim->>'kind';
  slot text:=coalesce(nullif(p_claim->>'slot',''),'default'); work text; rule jsonb; c points_claims; assignment points_assignments;
  count_paid integer; original_day date:=d; quest jsonb; freq jsonb; scheduled boolean:=true;
  begin_only boolean:=coalesce((p_claim->>'begin_only')::boolean,false); amount integer; snapshot jsonb:=p_claim->'evidence'->'policy_snapshot';
  history jsonb; review_snapshot boolean:=false; requested_id uuid;
begin
  perform 1 from kids where id=k for update;
  if not found then raise exception 'Unknown child'; end if;
  if d is null or d>(now() at time zone 'Asia/Taipei')::date then raise exception 'Award date cannot be in the future'; end if;
  rule:=points_policy(kind);
  if kind in ('balanced_day','balanced_week') then raise exception 'Bonuses are calculated by the server'; end if;
  if kind='project' then d:=d-(extract(isodow from d)::integer-1); end if;
  if kind='table_helper' and slot not in ('breakfast','lunch','dinner') then raise exception 'Choose one meal'; end if;
  if kind='learning' and slot not in ('1','2') then raise exception 'Choose assigned learning session 1 or 2'; end if;
  if kind not in ('table_helper','learning','brain') then slot:='default'; end if;
  select * into c from points_claims where kid_id=k and day=d and points_claims.kind=kind and points_claims.slot=slot;
  if found and (c.status in ('pending','confirmed') or (c.status='started' and begin_only)) then return c; end if;
  select * into assignment from points_assignments where kid_id=k and day=d and points_assignments.kind=kind and points_assignments.slot=slot;
  if kind in ('learning','housework','outing','project') and assignment.kid_id is null then raise exception 'A parent must assign this task first'; end if;
  -- Parent-assigned identity wins over arbitrary client evidence. Canonical defaults
  -- unify all entrances; an outing/project can share an explicitly assigned work ID.
  work:=coalesce(assignment.work_id,d::text||':'||kind||':'||slot);
  if kind='plant_patrol' then
    select x into quest from family_settings s cross join lateral jsonb_array_elements(s.value::jsonb) x where s.key='quest_catalog_v1' and x->>'id'='plant_patrol';
    freq:=coalesce(quest->'frequency','{"type":"interval_days","every":2,"anchor":"2026-09-23"}');
    if quest->>'enabled'='false' or (quest ? 'allowedKids' and not (quest->'allowedKids' ? k)) then raise exception 'Task unavailable'; end if;
    if freq->>'type'='interval_days' then scheduled:=original_day>=(freq->>'anchor')::date and mod(original_day-(freq->>'anchor')::date,greatest(1,(freq->>'every')::integer))=0;
    elsif freq->>'type'='days' then scheduled:=(freq->'days') @> to_jsonb(array[extract(dow from original_day)::integer]);
    elsif freq->>'type'='weekdays' then scheduled:=extract(isodow from original_day)::integer between 1 and 5;
    elsif freq->>'type'='weekends' then scheduled:=extract(isodow from original_day)::integer in (6,7); end if;
    if not scheduled then raise exception 'Plant Patrol is not scheduled today'; end if;
  end if;
  if kind='brain' and (not slot=any(points_brain_trio(k,d)) or (not begin_only and not exists(select 1 from brain_done where kid_id=k and day=d and game_id=slot))) then raise exception 'Complete an assigned Brain Gym exercise first'; end if;
  select count(*) into count_paid from points_claims where kid_id=k and day=d and points_claims.kind=kind and status<>'denied' and id is distinct from c.id;
  if count_paid>=(rule->>'limit')::integer then raise exception 'Award limit reached'; end if;
  if exists(select 1 from points_claims where kid_id=k and work_id=work and status<>'denied' and id is distinct from c.id and not(kind='project' and points_claims.kind='creative')) then
    select * into c from points_claims where kid_id=k and work_id=work and status<>'denied' and id is distinct from c.id order by created_at limit 1; return c;
  end if;
  amount:=coalesce(c.amount,assignment.amount,(rule->>'amount')::integer);
  if c.id is null and assignment.kid_id is null and snapshot is not null then
    if coalesce(snapshot->>'updated_at','')='' then
      select policy into history from points_policy_history where revision='default';
    else
      select policy into history from points_policy_history where changed_at=(snapshot->>'updated_at')::timestamptz;
    end if;
    if history is null then raise exception 'Unknown award policy revision; reconnect before confirming this attempt'; end if;
    -- Defaults are stable; policy history supplies overrides. Never accept an
    -- arbitrary client amount. A previous policy requires explicit parent review.
    amount:=coalesce((history->'awards'->>kind)::integer,(case kind when 'morning_teeth' then 5 when 'evening_teeth' then 5 when 'dressing' then 5 when 'shower' then 5 when 'table_helper' then 5 when 'plant_patrol' then 10 when 'room_rescue' then 10 when 'laundry_helper' then 15 when 'shoe_tidy' then 5 when 'garden_tidy' then 15 when 'living_tidy' then 10 when 'office_tidy' then 10 when 'housework' then 20 when 'reading' then 20 when 'brain' then 10 when 'homework' then 30 when 'learning' then 20 when 'movement' then 20 when 'creative' then 20 when 'photo' then 15 when 'music' then 15 when 'sibling_help' then 10 when 'outing' then 20 when 'project' then 50 end));
    if (snapshot->>'amount')::integer is distinct from amount then raise exception 'Award amount does not match its policy revision'; end if;
    review_snapshot:=amount<>(rule->>'amount')::integer;
  end if;
  if c.id is null then
    requested_id:=coalesce((p_claim->>'id')::uuid,gen_random_uuid());
    insert into points_claims(id,kid_id,day,kind,slot,work_id,amount,category,evidence,status,note)
      values(requested_id,k,d,kind,slot,work,amount,rule->>'category',coalesce(p_claim->'evidence','{}'),case when begin_only then 'started' else 'pending' end,case when review_snapshot then 'Previous award policy: parent review required' else '' end) returning * into c;
  else
    update points_claims set status=case when begin_only then 'started' else 'pending' end,evidence=coalesce(p_claim->'evidence',evidence) where id=c.id returning * into c;
  end if;
  -- A browser cannot prove when an offline task happened. Historical completions
  -- remain durable but require a parent's check before becoming spendable.
  if original_day<(now() at time zone 'Asia/Taipei')::date and assignment.kid_id is null then
    update points_claims set note='Offline activity from an earlier day: parent review required' where id=c.id returning * into c;
  end if;
  if not begin_only and c.note='' and rule->>'verification' in ('self','brain') then perform points_confirm(c.id);perform points_bonuses(k,original_day); end if;
  select * into c from points_claims where id=c.id; return c;
end $$;

commit;
