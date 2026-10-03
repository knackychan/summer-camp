-- Points v1. Run the preview first. This transaction preserves IDs and history.
-- Existing installations: run after the earlier migrations. Fresh installs:
-- run schema.sql first, then this file. Re-running this file is safe.
begin;

create table if not exists public.points_migrations (
  version integer primary key, applied_at timestamptz not null default now()
);
create table if not exists public.points_migration_backup (
  version integer not null, source_table text not null, row_key text not null,
  row_data jsonb not null, primary key(version,source_table,row_key)
);
alter table public.points_migrations enable row level security;
alter table public.points_migration_backup enable row level security;
alter table public.stars_ledger add column if not exists unit_version integer not null default 1;
alter table public.stars_ledger add column if not exists correction_of uuid references public.stars_ledger(id);
create unique index if not exists points_correction_once on public.stars_ledger(correction_of) where correction_of is not null;

create table if not exists public.points_legacy_spending (
  kid_id text primary key references public.kids(id), amount bigint not null check(amount>=0),
  request_ids jsonb not null default '[]', created_at timestamptz not null default now()
);
create table if not exists public.points_claims (
  id uuid primary key default gen_random_uuid(), kid_id text not null references public.kids(id),
  day date not null, kind text not null, slot text not null default 'default',
  work_id text not null, amount integer not null check(amount>=0),
  status text not null check(status in ('started','pending','confirmed','denied')) default 'pending',
  category text, evidence jsonb not null default '{}', policy_version integer not null default 1,
  note text not null default '', reviewed_by uuid, reviewed_at timestamptz,
  created_at timestamptz not null default now(), unique(kid_id,day,kind,slot)
);
create index if not exists points_claim_work on public.points_claims(kid_id,work_id);
create table if not exists public.points_assignments (
  kid_id text not null references public.kids(id), day date not null, kind text not null,
  slot text not null default 'default', work_id text not null, goal jsonb not null, amount integer not null,
  created_at timestamptz not null default now(), primary key(kid_id,day,kind,slot)
);
create table if not exists public.points_excuses (
  kid_id text not null references public.kids(id), day date not null,
  category text not null check(category in ('learning','helping','movement')), reason text not null,
  primary key(kid_id,day,category)
);
create table if not exists public.points_requests (
  id uuid primary key references public.asks(id), kid_id text not null references public.kids(id),
  reward_id text not null, label jsonb not null, points integer not null check(points>0),
  currency text, points_per_unit numeric, money_value numeric not null default 0 check(money_value>=0),
  reward_kind text not null default 'experience', status text not null default 'requested'
    check(status in ('requested','approved','denied','refunded')),
  created_at timestamptz not null default now(), decided_at timestamptz, decided_by uuid,
  legacy boolean not null default false, legacy_requested_points integer,
  legacy_amount_verified boolean not null default true
);
create table if not exists public.points_redemptions (
  request_id uuid primary key references public.points_requests(id), kid_id text not null references public.kids(id),
  points integer not null check(points>0), currency text, money_value numeric not null default 0,
  approved_by uuid not null, created_at timestamptz not null default now()
);
create table if not exists public.points_refunds (
  request_id uuid primary key references public.points_redemptions(request_id),
  reason text not null, refunded_by uuid not null, created_at timestamptz not null default now()
);
create table if not exists public.points_policy_history (
  revision text primary key, changed_at timestamptz, policy jsonb not null
);
insert into public.points_policy_history values('default',null,'{}') on conflict do nothing;
insert into public.points_policy_history select updated_at::text,updated_at,value::jsonb from public.family_settings where key='points_policy_v1' on conflict do nothing;

-- Lock all existing currency sources together while converting them once.
lock table public.stars_ledger, public.family_settings, public.asks in share row exclusive mode;
do $$
declare r record; v jsonb; item jsonb; arr jsonb; price integer; title jsonb; spent bigint;
  prepaid boolean; charged text[]; requested_price integer;
begin
  if exists(select 1 from public.points_migrations where version=1) then return; end if;
  insert into public.points_migration_backup
    select 1,'stars_ledger',id::text,to_jsonb(l) from public.stars_ledger l;
  insert into public.points_migration_backup
    select 1,'family_settings',key,to_jsonb(s) from public.family_settings s;
  insert into public.points_migration_backup
    select 1,'asks',id::text,to_jsonb(a) from public.asks a where kind like 'reward:%';
  update public.stars_ledger set delta=delta*10,unit_version=2 where unit_version=1;
  for r in select * from public.family_settings where key like 'reward_spend_%' loop
    v:=r.value::jsonb;
    if jsonb_typeof(v)='number' then v:=jsonb_build_object('total',v,'requests','[]'::jsonb); end if;
    spent:=coalesce((v->>'total')::bigint,0)*case when v->>'points_version'='1' then 1 else 10 end;
    if spent<0 then raise exception 'Invalid legacy spending for %',r.key; end if;
    insert into public.points_legacy_spending(kid_id,amount,request_ids)
      values(substring(r.key from length('reward_spend_')+1),spent,coalesce(v->'requests','[]'));
    update public.family_settings set value=(v||jsonb_build_object('total',spent,'points_version',1))::text where key=r.key;
  end loop;
  select value::jsonb into arr from public.family_settings where key='reward_catalog_v1';
  if arr is not null then
    if jsonb_typeof(arr)<>'array' then raise exception 'Reward catalog must be an array; repair before migrating'; end if;
    select coalesce(jsonb_agg(x||jsonb_build_object('cost',(x->>'cost')::integer*case when x->>'points_version'='1' then 1 else 10 end,'points_version',1)),'[]')
      into arr from jsonb_array_elements(arr) x;
    update public.family_settings set value=arr::text where key='reward_catalog_v1';
  else
    arr:='[{"id":"choose_dessert","enabled":true,"icon":"🍨","cost":120,"points_version":1,"title":["Choose dessert","選甜點"],"blurb":["You choose the family dessert.","今天的家庭甜點由你選。"]},{"id":"movie_pick","enabled":true,"icon":"🎬","cost":200,"points_version":1,"title":["Movie Pick","選電影"],"blurb":["Choose the next family movie.","下一部家庭電影由你選。"]},{"id":"breakfast_pick","enabled":true,"icon":"🥞","cost":250,"points_version":1,"title":["Breakfast Pick","選早餐"],"blurb":["Choose a special breakfast idea.","選一個特別的早餐。"]},{"id":"special_activity","enabled":true,"icon":"🎟️","cost":500,"points_version":1,"title":["Special Activity","特別活動"],"blurb":["Save up for a parent-approved special activity.","存起來換一個爸爸核准的特別活動。"]}]';
    insert into public.family_settings(key,value) values('reward_catalog_v1',arr::text);
  end if;
  -- Keep the old ask/body verbatim. The immutable snapshot is the new source of truth.
  for r in select * from public.asks where kind like 'reward:%' loop
    select x into item from jsonb_array_elements(arr) x where x->>'id'=split_part(r.kind,':',2) limit 1;
    price:=case when split_part(r.kind,':',3) ~ '^[1-9][0-9]*$' then split_part(r.kind,':',3)::integer*10 else (item->>'cost')::integer end;
    if price is null then raise exception 'Cannot recover requested price for reward request %',r.id; end if;
    requested_price:=price;
    select exists(select 1 from public.points_legacy_spending s where s.kid_id=r.kid_id and s.request_ids ? r.id::text) into prepaid;
    charged:=regexp_match(coalesce(r.answer,''),' · ([0-9]+) Quest Coins$');
    if charged is not null then price:=charged[1]::integer*10; end if;
    title:=case when coalesce(r.body,'')<>'' then jsonb_build_array(r.body,r.body) else coalesce(item->'title',jsonb_build_array(split_part(r.kind,':',2),split_part(r.kind,':',2))) end;
    insert into public.points_requests(id,kid_id,reward_id,label,points,status,created_at,decided_at,legacy,legacy_requested_points,legacy_amount_verified)
      values(r.id,r.kid_id,split_part(r.kind,':',2),title,price,
        case when prepaid or r.answer like 'Approved%' then 'approved' when r.answered_at is null then 'requested' else 'denied' end,
        r.created_at,r.answered_at,true,requested_price,not(prepaid or coalesce(r.answer,'') like 'Approved%') or charged is not null);
  end loop;
  insert into public.family_settings(key,value) values('points_unit_version','2') on conflict(key) do update set value='2';
  insert into public.family_settings(key,value) values('points_economy_v1','{"currency":"","pointsPerUnit":null,"monthlyBudget":null,"cashEnabled":false}') on conflict do nothing;
  insert into public.points_migrations(version) values(1);
end $$;

create or replace function public.points_parent() returns boolean language sql stable security definer
set search_path=public as $$ select exists(select 1 from public.admins where user_id=auth.uid()) $$;

create or replace function public.points_policy(p_kind text) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare rules jsonb; custom jsonb; rule jsonb; amount integer;
begin
  rules:='{"morning_teeth":[5,1,"care","self"],"evening_teeth":[5,1,"care","self"],"dressing":[5,1,"care","self"],"shower":[5,1,"care","self"],"table_helper":[5,3,"helping","self"],"plant_patrol":[10,1,"helping","self"],"room_rescue":[10,1,"helping","parent"],"laundry_helper":[15,1,"helping","parent"],"housework":[20,1,"helping","parent"],"reading":[20,1,"learning","parent"],"brain":[10,3,"learning","brain"],"homework":[30,1,"learning","parent"],"learning":[20,2,"learning","parent"],"movement":[20,1,"movement","parent"],"creative":[20,1,"creative","parent"],"photo":[15,1,"creative","parent"],"music":[15,1,"learning","parent"],"sibling_help":[10,1,"helping","parent"],"outing":[20,1,"movement","parent"],"project":[50,1,"creative","parent"],"balanced_day":[20,1,"bonus","server"],"balanced_week":[50,1,"bonus","server"]}';
  rule:=rules->p_kind;
  if rule is null then raise exception 'Unknown award kind: %',p_kind; end if;
  select value::jsonb into custom from family_settings where key='points_policy_v1';
  amount:=coalesce((custom->'awards'->>p_kind)::integer,(rule->>0)::integer);
  if amount<0 or amount>1000 or amount%5<>0 then raise exception 'Award must be 0..1000 in steps of five'; end if;
  return jsonb_build_object('amount',amount,'limit',(rule->>1)::integer,'category',rule->>2,'verification',rule->>3);
end $$;

-- Exact unsigned Math.imul and mulberry32 used by SQBrainCore.dailyThree.
create or replace function public.points_imul(a bigint,b bigint) returns bigint language sql immutable
as $$ select mod(a::numeric*b::numeric,4294967296)::bigint $$;
create or replace function public.points_brain_trio(p_kid text,p_day date) returns text[] language plpgsql stable security definer set search_path=public as $$
declare ids text[]:=array['memorymatch','patternecho','fractions','balance','circuit','sorter','sentence','soundmatch','calc','signs','lowhigh','stroop','crunch','clock','change','wordmem','recall'];
  skills jsonb:='{"memorymatch":"memory","patternecho":"memory","fractions":"math","balance":"math","circuit":"science","sorter":"science","sentence":"language","soundmatch":"language","calc":"math","signs":"math","lowhigh":"memory","stroop":"attention","crunch":"math","clock":"logic","change":"money","wordmem":"memory","recall":"memory"}';
  seed text:='brain'||p_day::text||p_kid; a bigint:=7; t bigint; i integer; j integer; tmp text; picked text[]:='{}'; seen text[]:='{}';
begin
  if exists(select 1 from family_settings where key='brain_enabled_'||p_kid and value='0') then return '{}'; end if;
  for i in 1..length(seed) loop a:=mod(a*31+ascii(substr(seed,i,1)),4294967296); end loop;
  for i in reverse cardinality(ids)..2 loop
    a:=mod(a+1831565813,4294967296); t:=points_imul(a # (a>>15),a|1);
    t:=mod(t+points_imul(t # (t>>7),t|61),4294967296);
    j:=floor((t # (t>>14))::numeric/4294967296*i)::integer+1;
    tmp:=ids[i];ids[i]:=ids[j];ids[j]:=tmp;
  end loop;
  foreach tmp in array ids loop
    if not (skills->>tmp)=any(seen) then picked:=array_append(picked,tmp);seen:=array_append(seen,skills->>tmp); end if;
    if cardinality(picked)=3 then exit; end if;
  end loop;
  return picked;
end $$;

create or replace function public.points_legacy_tasks(p_id uuid,p_kid text) returns table(day date,kind text,slot text)
language plpgsql stable security definer set search_path=public as $$
declare bits text[]; old_slot bigint; d date; kinds text[]; item text;
begin
  bits:=regexp_match(p_id::text,'^b10c57a2-([0-9]{4})-([0-9]{2})([0-9]{2})-([0-9]{4})-([0-9]{12})$');
  if bits is null or bits[4]<>(case p_kid when 'lucien' then '0001' when 'lili' then '0002' when 'luis' then '0003' else '' end) then return; end if;
  d:=(bits[1]||'-'||bits[2]||'-'||bits[3])::date;old_slot:=bits[5]::bigint;
  if old_slot=998 then return query select d,'brain'::text,x from unnest(points_brain_trio(p_kid,d)) x;return; end if;
  if old_slot in (1,6,13,3381978352,4226580734,1723184357) then
    return query select d,'table_helper'::text,case old_slot when 1 then 'breakfast' when 4226580734 then 'breakfast' when 13 then 'dinner' when 1723184357 then 'dinner' else 'lunch' end;return;
  end if;
  if old_slot=2 then return query select d,'learning'::text,'1'::text;return; end if;
  kinds:=case old_slot
    when 0 then array['morning_teeth','dressing'] when 3 then array['reading'] when 4 then array['homework']
    when 8 then array['creative'] when 10 then array['creative'] when 11 then array['movement'] when 12 then array['room_rescue']
    when 14 then array['shower','evening_teeth'] when 15 then array['photo']
    when 3171263926 then array['morning_teeth'] when 5002012941 then array['plant_patrol'] when 2242939490 then array['room_rescue']
    when 3473137359 then array['laundry_helper'] when 5178361163 then array['shower'] when 4917870774 then array['evening_teeth']
    when 1713473470 then array['reading'] when 1274446388 then array['movement'] when 2416943091 then array['creative']
    when 4159434264 then array['dressing'] when 999 then array['balanced_day'] else array[]::text[] end;
  foreach item in array kinds loop return query select d,item,'default'::text; end loop;
end $$;

-- Zero-value reservations stop a completed legacy task earning again through a
-- new entrance. They never add to the converted ledger or retroactively award bonuses.
insert into public.points_claims(kid_id,day,kind,slot,work_id,amount,status,evidence,note)
select l.kid_id,t.day,t.kind,t.slot,t.day||':'||t.kind||':'||t.slot,0,'confirmed',jsonb_build_object('legacy_id',l.id),'Preserved legacy completion'
from public.stars_ledger l cross join lateral public.points_legacy_tasks(l.id,l.kid_id) t
where l.delta>0 and not exists(select 1 from public.stars_ledger c where c.correction_of=l.id)
on conflict(kid_id,day,kind,slot) do nothing;

create or replace view public.point_totals as
select k.id as kid_id,
  coalesce((select sum(delta) from public.stars_ledger where kid_id=k.id),0)::bigint as total_earned,
  (coalesce((select amount from public.points_legacy_spending where kid_id=k.id),0)+coalesce((select sum(r.points) from public.points_redemptions r left join public.points_refunds f on f.request_id=r.request_id where r.kid_id=k.id and f.request_id is null),0))::bigint as spent,
  (coalesce((select sum(delta) from public.stars_ledger where kid_id=k.id),0)-coalesce((select amount from public.points_legacy_spending where kid_id=k.id),0)-coalesce((select sum(r.points) from public.points_redemptions r left join public.points_refunds f on f.request_id=r.request_id where r.kid_id=k.id and f.request_id is null),0))::bigint as available,
  coalesce((select sum(amount) from public.points_claims where kid_id=k.id and status='pending'),0)::bigint as pending
from public.kids k;
-- Old clients still read stars. Keep that compatibility view in old units;
-- new clients read point_totals and unit_version=2 ledger rows.
create or replace view public.star_totals as
select k.id as kid_id,k.name,(coalesce(sum(l.delta),0)/10)::integer as stars
from public.kids k left join public.stars_ledger l on l.kid_id=k.id group by k.id,k.name;

create or replace function public.points_confirm(p_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare c points_claims;
begin
  select * into strict c from points_claims where id=p_id;
  insert into stars_ledger(id,kid_id,delta,reason,source,granted_by,unit_version,created_at)
    values(c.id,c.kid_id,c.amount,case when c.kind='legacy' then coalesce(c.evidence->>'reason','Imported legacy activity') else 'Points · '||c.kind||' · '||c.day||' · '||c.slot end,
      'app',auth.uid()::text,2,case when c.kind='legacy' then coalesce((c.evidence->>'created_at')::timestamptz,c.created_at) else now() end) on conflict(id) do nothing;
  update points_claims set status='confirmed',reviewed_at=now(),reviewed_by=auth.uid() where id=p_id;
end $$;

create or replace function public.points_bonuses(p_kid text,p_day date) returns void language plpgsql security definer set search_path=public as $$
declare monday date:=p_day-(extract(isodow from p_day)::integer-1); n integer; cid uuid; cat text;
begin
  -- Caller holds the kid row lock. No client can invoke this helper.
  foreach cat in array array['learning','helping','movement'] loop
    if not exists(select 1 from points_claims where kid_id=p_kid and day=p_day and status='confirmed' and category=cat)
      and not exists(select 1 from points_excuses where kid_id=p_kid and day=p_day and category=cat) then return; end if;
  end loop;
  insert into points_claims(kid_id,day,kind,work_id,amount,status,category)
    values(p_kid,p_day,'balanced_day','bonus:'||p_day,(points_policy('balanced_day')->>'amount')::integer,'pending','bonus')
    on conflict(kid_id,day,kind,slot) do nothing returning id into cid;
  if cid is not null then perform points_confirm(cid); end if;
  select count(*) into n from points_claims where kid_id=p_kid and kind='balanced_day' and category='bonus' and status='confirmed' and day between monday and monday+6;
  if n>=4 then
    insert into points_claims(kid_id,day,kind,work_id,amount,status,category)
      values(p_kid,monday,'balanced_week','week:'||monday,(points_policy('balanced_week')->>'amount')::integer,'pending','bonus')
      on conflict(kid_id,day,kind,slot) do nothing returning id into cid;
    if cid is not null then perform points_confirm(cid); end if;
  end if;
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
    amount:=coalesce((history->'awards'->>kind)::integer,(case kind when 'morning_teeth' then 5 when 'evening_teeth' then 5 when 'dressing' then 5 when 'shower' then 5 when 'table_helper' then 5 when 'plant_patrol' then 10 when 'room_rescue' then 10 when 'laundry_helper' then 15 when 'housework' then 20 when 'reading' then 20 when 'brain' then 10 when 'homework' then 30 when 'learning' then 20 when 'movement' then 20 when 'creative' then 20 when 'photo' then 15 when 'music' then 15 when 'sibling_help' then 10 when 'outing' then 20 when 'project' then 50 end));
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

create or replace function public.points_begin_attempt(p_claim jsonb) returns public.points_claims language sql security definer set search_path=public
as $$ select public.points_claim(p_claim||'{"begin_only":true}'::jsonb) $$;

create or replace function public.points_review_claim(p_id uuid,p_approve boolean,p_note text default '') returns public.points_claims language plpgsql security definer set search_path=public as $$
declare c points_claims; paid integer;
begin
  if not points_parent() then raise exception 'Parent approval required'; end if;
  select * into strict c from points_claims where id=p_id;
  perform 1 from kids where id=c.kid_id for update;
  select * into strict c from points_claims where id=p_id for update;
  if c.status<>'pending' then return c; end if;
  if p_approve then
    if c.kind='legacy' and exists(select 1 from points_legacy_tasks(c.id,c.kid_id) t join points_claims pc on pc.kid_id=c.kid_id and pc.day=t.day and pc.kind=t.kind and pc.slot=t.slot where pc.status<>'denied') then raise exception 'This legacy activity was already claimed in Points'; end if;
    if c.kind='project' then
      select coalesce(sum(amount),0) into paid from points_claims where kid_id=c.kid_id and work_id=c.work_id and status='confirmed' and id<>c.id;
      update points_claims set amount=greatest(0,amount-paid) where id=c.id;
    elsif exists(select 1 from points_claims where kid_id=c.kid_id and work_id=c.work_id and status='confirmed' and id<>c.id) then raise exception 'This work was already awarded'; end if;
    perform points_confirm(c.id); perform points_bonuses(c.kid_id,c.day);
    if c.kind='legacy' then
      insert into points_claims(kid_id,day,kind,slot,work_id,amount,status,evidence,note)
      select c.kid_id,t.day,t.kind,t.slot,t.day||':'||t.kind||':'||t.slot,0,'confirmed',jsonb_build_object('legacy_id',c.id),'Preserved legacy completion' from points_legacy_tasks(c.id,c.kid_id) t on conflict(kid_id,day,kind,slot) do nothing;
    end if;
  else update points_claims set status='denied',reviewed_at=now(),reviewed_by=auth.uid() where id=c.id; end if;
  update points_claims set note=p_note where id=c.id returning * into c; return c;
end $$;

create or replace function public.points_assign(p_kid text,p_day date,p_kind text,p_slot text,p_work_id text,p_goal jsonb) returns public.points_assignments language plpgsql security definer set search_path=public as $$
#variable_conflict use_variable
declare a points_assignments; d date:=p_day; slot text:=coalesce(nullif(p_slot,''),'default');
begin
  if not points_parent() then raise exception 'Parent assignment required'; end if;
  perform points_policy(p_kind);
  if p_kind in ('balanced_day','balanced_week','brain') then raise exception 'This task is assigned automatically'; end if;
  if p_kind='project' then d:=d-(extract(isodow from d)::integer-1); end if;
  if p_kind not in ('learning','table_helper') then slot:='default'; end if;
  if coalesce(length(trim(p_work_id)),0)<1 or jsonb_typeof(p_goal)<>'array' or jsonb_array_length(p_goal)<>2 or coalesce(p_goal->>0,'')='' or coalesce(p_goal->>1,'')='' then raise exception 'A work ID and English/Chinese goal are required'; end if;
  perform 1 from kids where id=p_kid for update;
  if exists(select 1 from points_claims where kid_id=p_kid and day=d and kind=p_kind and points_claims.slot=slot) then raise exception 'Cannot change an assignment after its claim'; end if;
  insert into points_assignments(kid_id,day,kind,slot,work_id,goal,amount) values(p_kid,d,p_kind,slot,p_work_id,p_goal,(points_policy(p_kind)->>'amount')::integer)
    on conflict on constraint points_assignments_pkey do update set work_id=excluded.work_id,goal=excluded.goal,amount=excluded.amount returning * into a;return a;
end $$;

create or replace function public.points_excuse(p_kid text,p_day date,p_category text,p_reason text) returns void language plpgsql security definer set search_path=public as $$
begin
  if not points_parent() then raise exception 'Parent approval required'; end if;
  if length(trim(p_reason))=0 then raise exception 'Reason required'; end if;
  perform 1 from kids where id=p_kid for update;
  insert into points_excuses values(p_kid,p_day,p_category,p_reason) on conflict(kid_id,day,category) do update set reason=excluded.reason;
  perform points_bonuses(p_kid,p_day);
end $$;

create or replace function public.points_legacy_award(p_row jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare row_id uuid:=(p_row->>'id')::uuid; k text:=p_row->>'kid_id'; amount integer:=(p_row->>'delta')::integer; c points_claims; l stars_ledger; d date;
begin
  perform 1 from kids where id=k for update;
  if not found then raise exception 'Unknown child'; end if;
  select * into l from stars_ledger where id=row_id;
  if found then
    if l.kid_id<>k then raise exception 'Legacy identity belongs to another child'; end if;
    return jsonb_build_object('id',l.id,'kid_id',k,'amount',l.delta,'status','confirmed');
  end if;
  select * into c from points_claims where id=row_id;
  if found then return to_jsonb(c); end if;
  if amount is null or amount not between 1 and 3 then raise exception 'Invalid legacy app award'; end if;
  d:=coalesce((p_row->>'created_at')::timestamptz,now()) at time zone 'Asia/Taipei';
  insert into points_claims(id,kid_id,day,kind,slot,work_id,amount,evidence,note)
    values(row_id,k,d,'legacy',row_id::text,'legacy:'||row_id,amount*10,p_row,'Older tablet award: parent review required') returning * into c;
  return to_jsonb(c);
end $$;

create or replace function public.points_manual_award(p_id uuid,p_kid text,p_amount integer,p_reason text) returns public.stars_ledger language plpgsql security definer set search_path=public as $$
declare l stars_ledger;
begin
  if not points_parent() then raise exception 'Parent approval required'; end if;
  if p_amount is null or p_amount<=0 or p_amount>10000 or coalesce(length(trim(p_reason)),0)=0 then raise exception 'Use 1..10000 points and a reason'; end if;
  perform 1 from kids where id=p_kid for update;
  insert into stars_ledger(id,kid_id,delta,reason,source,granted_by,unit_version) values(p_id,p_kid,p_amount,p_reason,'admin',auth.uid()::text,2) on conflict(id) do nothing;
  select * into strict l from stars_ledger where id=p_id;
  if l.kid_id<>p_kid or l.delta<>p_amount or l.reason<>p_reason then raise exception 'Award ID already used'; end if;
  return l;
end $$;

create or replace function public.points_correct_award(p_id uuid,p_reason text) returns public.stars_ledger language plpgsql security definer set search_path=public as $$
declare original stars_ledger; correction stars_ledger; available bigint;
begin
  if not points_parent() then raise exception 'Parent approval required'; end if;
  if coalesce(length(trim(p_reason)),0)=0 then raise exception 'Reason required'; end if;
  select * into strict original from stars_ledger where id=p_id;
  perform 1 from kids where id=original.kid_id for update;
  select * into correction from stars_ledger where correction_of=p_id;
  if found then return correction; end if;
  if original.delta<=0 then raise exception 'Only earnings can be corrected'; end if;
  select t.available into available from point_totals t where kid_id=original.kid_id;
  if available<original.delta then raise exception 'Refund outstanding exchanges before correcting spent earnings'; end if;
  insert into stars_ledger(kid_id,delta,reason,source,granted_by,unit_version,correction_of)
    values(original.kid_id,-original.delta,p_reason,'admin',auth.uid()::text,2,p_id) returning * into correction;
  return correction;
end $$;

create or replace function public.points_request_reward(p_id uuid,p_kid text,p_reward_id text,p_points integer default null) returns public.points_requests language plpgsql security definer set search_path=public as $$
declare r points_requests; item jsonb; economy jsonb; cost integer; currency text; rate numeric; monetary numeric:=0; reward_kind text;
begin
  perform 1 from kids where id=p_kid for update;
  if not found then raise exception 'Unknown child'; end if;
  select * into r from points_requests where id=p_id;
  if found then
    if r.kid_id<>p_kid or r.reward_id<>p_reward_id then raise exception 'Request ID already used'; end if;
    return r;
  end if;
  select * into r from points_requests where kid_id=p_kid and reward_id=p_reward_id and status='requested' order by created_at limit 1;
  if found then return r; end if;
  select x into item from family_settings s cross join lateral jsonb_array_elements(s.value::jsonb) x where s.key='reward_catalog_v1' and x->>'id'=p_reward_id;
  if item is null or item->>'enabled'='false' then raise exception 'Reward is unavailable'; end if;
  cost:=(item->>'cost')::integer; reward_kind:=coalesce(item->>'kind','experience');
  select value::jsonb into economy from family_settings where key='points_economy_v1';
  currency:=nullif(economy->>'currency','');rate:=(economy->>'pointsPerUnit')::numeric;
  if cost<=0 then raise exception 'Reward needs a positive point price'; end if;
  if reward_kind in ('gift','cash') then
    if currency is null or rate is null or rate<=0 or (economy->>'monthlyBudget')::numeric is null or (economy->>'monthlyBudget')::numeric<=0 then raise exception 'Configure currency, conversion rate and monthly budget first'; end if;
    if reward_kind='cash' then
      if economy->>'cashEnabled'<>'true' then raise exception 'Cash redemption is disabled'; end if;
      if cost%100<>0 then raise exception 'Cash exchanges use 100-point steps'; end if;
    end if;
    monetary:=cost/rate;
  end if;
  -- p_points is an optional stale-price guard, never the source of the price.
  if p_points is not null and p_points<>cost then raise exception 'Reward price changed; review it before requesting'; end if;
  insert into asks(id,kid_id,kind,body) values(p_id,p_kid,'reward:'||p_reward_id||':'||cost,coalesce(item->>'icon','🎁')||' '||(item->'title'->>0)||' / '||(item->'title'->>1));
  insert into points_requests(id,kid_id,reward_id,label,points,currency,points_per_unit,money_value,reward_kind)
    values(p_id,p_kid,p_reward_id,item->'title',cost,currency,rate,monetary,reward_kind) returning * into r;
  return r;
end $$;

create or replace function public.points_approve_redemption(p_id uuid) returns public.points_requests language plpgsql security definer set search_path=public as $$
declare r points_requests; funds bigint; economy jsonb; used numeric; budget numeric; start_month timestamptz;
begin
  if not points_parent() then raise exception 'Parent approval required'; end if;
  select * into strict r from points_requests where id=p_id;
  -- Every award, approval and refund uses this same per-child lock.
  perform 1 from kids where id=r.kid_id for update;
  select * into strict r from points_requests where id=p_id for update;
  if r.status='approved' or r.status='refunded' then return r; end if;
  if r.status<>'requested' then raise exception 'Request was declined'; end if;
  select available into funds from point_totals where kid_id=r.kid_id;
  if funds<r.points then raise exception 'Not enough confirmed points'; end if;
  select value::jsonb into economy from family_settings where key='points_economy_v1' for share;
  if r.money_value>0 then
    budget:=(economy->>'monthlyBudget')::numeric;
    if r.currency is distinct from nullif(economy->>'currency','') or budget is null or budget<=0 then raise exception 'Configure the original currency and a monthly budget'; end if;
    if r.reward_kind='cash' and economy->>'cashEnabled'<>'true' then raise exception 'Cash redemption is disabled'; end if;
    start_month:=date_trunc('month',now() at time zone 'Asia/Taipei') at time zone 'Asia/Taipei';
    select coalesce(sum(d.money_value),0) into used from points_redemptions d left join points_refunds f on f.request_id=d.request_id where d.kid_id=r.kid_id and d.created_at>=start_month and f.request_id is null;
    if used+r.money_value>budget then raise exception 'Monthly redemption budget reached; points remain available next month'; end if;
  end if;
  insert into points_redemptions(request_id,kid_id,points,currency,money_value,approved_by) values(r.id,r.kid_id,r.points,r.currency,r.money_value,auth.uid());
  update points_requests set status='approved',decided_at=now(),decided_by=auth.uid() where id=r.id returning * into r;
  update asks set answer='Approved · '||(r.label->>0)||' · '||r.points||' Points / 點數',answered_at=now() where id=r.id;
  insert into family_settings(key,value) select 'reward_spend_'||r.kid_id,jsonb_build_object('total',spent,'points_version',1)::text from point_totals where kid_id=r.kid_id on conflict(key) do update set value=excluded.value;
  return r;
end $$;

create or replace function public.points_deny_redemption(p_id uuid) returns public.points_requests language plpgsql security definer set search_path=public as $$
declare r points_requests;
begin
  if not points_parent() then raise exception 'Parent approval required'; end if;
  select * into strict r from points_requests where id=p_id;
  perform 1 from kids where id=r.kid_id for update;
  select * into strict r from points_requests where id=p_id for update;
  if r.status='denied' then return r; end if;
  if r.status<>'requested' then raise exception 'Only pending requests can be declined'; end if;
  update points_requests set status='denied',decided_at=now(),decided_by=auth.uid() where id=p_id returning * into r;
  update asks set answer='Not this time · Ask Papa again later / 下次再問爸爸',answered_at=now() where id=p_id;return r;
end $$;

create or replace function public.points_refund_redemption(p_id uuid,p_reason text) returns public.points_requests language plpgsql security definer set search_path=public as $$
declare r points_requests;
begin
  if not points_parent() then raise exception 'Parent approval required'; end if;
  if coalesce(length(trim(p_reason)),0)=0 then raise exception 'Refund reason required'; end if;
  select * into strict r from points_requests where id=p_id;
  perform 1 from kids where id=r.kid_id for update;
  select * into strict r from points_requests where id=p_id for update;
  if r.status='refunded' then return r; end if;
  if r.status<>'approved' then raise exception 'Only approved exchanges can be refunded'; end if;
  if not r.legacy_amount_verified then raise exception 'Legacy charged amount needs reconciliation from backup before refund'; end if;
  if not exists(select 1 from points_redemptions where request_id=p_id) then
    -- A legacy approved ask is represented in the converted spending baseline.
    -- Move its charge into the itemized history before issuing the refund.
    update points_legacy_spending set amount=amount-r.points where kid_id=r.kid_id and amount>=r.points;
    if not found then raise exception 'Legacy spending needs reconciliation before refund'; end if;
    insert into points_redemptions(request_id,kid_id,points,currency,money_value,approved_by,created_at) values(r.id,r.kid_id,r.points,r.currency,r.money_value,auth.uid(),coalesce(r.decided_at,r.created_at));
  end if;
  insert into points_refunds(request_id,reason,refunded_by) values(p_id,p_reason,auth.uid()) on conflict do nothing;
  update points_requests set status='refunded',decided_at=now(),decided_by=auth.uid() where id=p_id returning * into r;
  update asks set answer=coalesce(answer,'')||' · Refunded / 已退還 · '||p_reason,answered_at=now() where id=p_id;
  insert into family_settings(key,value) select 'reward_spend_'||r.kid_id,jsonb_build_object('total',spent,'points_version',1)::text from point_totals where kid_id=r.kid_id on conflict(key) do update set value=excluded.value;
  return r;
end $$;

-- SECURITY DEFINER functions above are the only currency mutation boundary.
create or replace function public.points_guard_ledger() returns trigger language plpgsql set search_path=public as $$
begin
  if current_user=pg_get_userbyid((select relowner from pg_class where oid='public.stars_ledger'::regclass)) then return new; end if;
  if tg_op='INSERT' and new.unit_version=1 and new.source='app' then
    perform public.points_legacy_award(to_jsonb(new));return null;
  end if;
  raise exception 'Use the Points RPC; ledger history cannot be edited or deleted';
end $$;
drop trigger if exists points_guard_ledger on public.stars_ledger;
create trigger points_guard_ledger before insert or update or delete on public.stars_ledger for each row execute function public.points_guard_ledger();

create or replace function public.points_guard_settings() returns trigger language plpgsql set search_path=public as $$
declare item jsonb; v jsonb;
begin
  if tg_op='DELETE' then
    if old.key like 'reward_spend_%' or old.key in ('points_unit_version','points_economy_v1','points_policy_v1','reward_catalog_v1','quest_catalog_v1') then raise exception 'Points settings cannot be deleted; edit them instead'; end if;
    return old;
  end if;
  if new.key like 'reward_spend_%' or new.key='points_unit_version' then
    if current_user<>pg_get_userbyid((select relowner from pg_class where oid='public.family_settings'::regclass)) then raise exception 'Use the Points RPC to change spending'; end if;
  elsif new.key in ('points_economy_v1','points_policy_v1','reward_catalog_v1','quest_catalog_v1') then
    if current_user<>pg_get_userbyid((select relowner from pg_class where oid='public.family_settings'::regclass)) and not public.points_parent() then raise exception 'Parent setting required'; end if;
    v:=new.value::jsonb;
    if new.key='reward_catalog_v1' then
      for item in select * from jsonb_array_elements(v) loop
        if item->>'points_version' is distinct from '1' or (item->>'cost')::integer<=0 or jsonb_array_length(item->'title')<>2 then raise exception 'Update this admin app before saving Points rewards'; end if;
      end loop;
    elsif new.key='points_economy_v1' then
      if tg_op='UPDATE' and (old.value::jsonb->>'currency') is distinct from (v->>'currency') and exists(select 1 from public.points_redemptions d left join public.points_refunds f on f.request_id=d.request_id where d.money_value>0 and f.request_id is null and d.created_at>=date_trunc('month',now() at time zone 'Asia/Taipei') at time zone 'Asia/Taipei') then raise exception 'Keep the currency unchanged until the current redemption month ends'; end if;
      if nullif(v->>'currency','') is not null and (v->>'currency') !~ '^[A-Z]{3}$' then raise exception 'Currency must be a three-letter code'; end if;
      if (v->>'pointsPerUnit')::numeric<=0 or (v->>'monthlyBudget')::numeric<0 then raise exception 'Invalid conversion rate or budget'; end if;
      if v->>'cashEnabled'='true' and (nullif(v->>'currency','') is null or (v->>'pointsPerUnit')::numeric is null or (v->>'monthlyBudget')::numeric is null or (v->>'monthlyBudget')::numeric<=0) then raise exception 'Configure currency, rate and budget before enabling cash'; end if;
    elsif new.key='points_policy_v1' then
      for item in select value from jsonb_each(coalesce(v->'awards','{}')) loop
        if (item::text)::integer<0 or (item::text)::integer>1000 or (item::text)::integer%5<>0 then raise exception 'Awards use 0..1000 points in steps of five'; end if;
      end loop;
      if tg_op='UPDATE' then insert into public.points_policy_history values(old.updated_at::text,old.updated_at,old.value::jsonb) on conflict do nothing; end if;
      new.updated_at:=clock_timestamp();
      insert into public.points_policy_history values(new.updated_at::text,new.updated_at,v) on conflict do nothing;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists points_guard_settings on public.family_settings;
create trigger points_guard_settings before insert or update or delete on public.family_settings for each row execute function public.points_guard_settings();

create or replace function public.points_guard_asks() returns trigger language plpgsql set search_path=public as $$
begin
  if current_user=pg_get_userbyid((select relowner from pg_class where oid='public.asks'::regclass)) then return new; end if;
  if tg_op='INSERT' and new.kind like 'reward:%' then
    -- Old tablets can still request; their encoded amount is not trusted.
    perform public.points_request_reward(new.id,new.kid_id,split_part(new.kind,':',2));return null;
  end if;
  if tg_op='UPDATE' and (old.kind like 'reward:%' or new.kind like 'reward:%') then raise exception 'Use the atomic Points approval RPC'; end if;
  return new;
end $$;
drop trigger if exists points_guard_asks on public.asks;
create trigger points_guard_asks before insert or update on public.asks for each row execute function public.points_guard_asks();

-- A season is a learning reset, never a wallet reset. Preserve asks, settings,
-- ledger, award identities, assignments and redemptions so replay cannot pay again.
create or replace function public.reset_season() returns void language plpgsql security definer set search_path=public as $$
begin
  if not points_parent() then raise exception 'reset_season: not an admin'; end if;
  perform 1 from kids order by id for update;
  truncate table day_ticks,day_rolls,act_done,vocab_mastery,game_stats,papa_notes,passes,photos,search_log,help_claims,day_overrides,day_redos,brain_done;
  insert into family_settings(key,value) values('season_reset_at',now()::text) on conflict(key) do update set value=excluded.value,updated_at=now();
end $$;

do $$
declare t text; f record;
begin
  foreach t in array array['points_legacy_spending','points_claims','points_assignments','points_excuses','points_requests','points_redemptions','points_refunds','points_policy_history'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop policy if exists "points read" on public.%I',t);
    execute format('create policy "points read" on public.%I for select using (true)',t);
    execute format('grant select on public.%I to anon, authenticated',t);
    execute format('revoke insert,update,delete,truncate on public.%I from anon, authenticated',t);
  end loop;
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'points_%' loop
    execute format('revoke all on function %s from public,anon,authenticated',f.sig);
  end loop;
end $$;
grant select on public.point_totals to anon,authenticated;
revoke truncate on public.stars_ledger,public.asks,public.family_settings,public.kids,public.points_migrations,public.points_migration_backup from public,anon,authenticated;
revoke all on public.points_migrations,public.points_migration_backup from anon,authenticated;
grant insert on public.points_policy_history to authenticated;
drop policy if exists "parent archives policy" on public.points_policy_history;
create policy "parent archives policy" on public.points_policy_history for insert to authenticated with check(public.points_parent());
grant execute on function public.points_parent(),public.points_policy(text),public.points_brain_trio(text,date),public.points_claim(jsonb),public.points_begin_attempt(jsonb),public.points_legacy_award(jsonb),public.points_request_reward(uuid,text,text,integer) to anon,authenticated;
grant execute on function public.points_review_claim(uuid,boolean,text),public.points_assign(text,date,text,text,text,jsonb),public.points_excuse(text,date,text,text),public.points_manual_award(uuid,text,integer,text),public.points_correct_award(uuid,text),public.points_approve_redemption(uuid),public.points_deny_redemption(uuid),public.points_refund_redemption(uuid,text) to authenticated;
revoke all on function public.reset_season() from public,anon;
grant execute on function public.reset_season() to authenticated;
do $$
declare t text;
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach t in array array['points_claims','points_assignments','points_requests'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
        execute format('alter publication supabase_realtime add table public.%I',t);
      end if;
    end loop;
  end if;
end $$;
commit;
