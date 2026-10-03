-- READ ONLY. Run in Supabase SQL Editor BEFORE 20261003_points_system.sql.
-- Export every result and take a project backup first. No family data changes.
begin transaction read only;

-- Stored stars and Quest Coins are one earning source: never add both.
with earnings as (
  select kid_id,sum(delta*case when coalesce((to_jsonb(l)->>'unit_version')::int,1)=1 then 10 else 1 end)::bigint as points
  from public.stars_ledger l group by kid_id
), spending as (
  select substring(key from length('reward_spend_')+1) as kid_id,
    case when jsonb_typeof(value::jsonb)='number' then value::numeric*10
      else coalesce((value::jsonb->>'total')::numeric,0)*case when value::jsonb->>'points_version'='1' then 1 else 10 end end as points
  from public.family_settings where key like 'reward_spend_%'
)
select k.id,coalesce(e.points,0) as total_earned_points,coalesce(s.points,0) as spent_points,
  coalesce(e.points,0)-coalesce(s.points,0) as available_points
from public.kids k left join earnings e on e.kid_id=k.id left join spending s on s.kid_id=k.id order by k.id;

select x->>'id' as reward_id,x->'title' as saved_label,(x->>'cost')::integer as stored_cost,
  (x->>'cost')::integer*case when x->>'points_version'='1' then 1 else 10 end as converted_points
from public.family_settings s cross join lateral jsonb_array_elements(s.value::jsonb) x
where s.key='reward_catalog_v1';
-- No catalog row means preserved seed prices: dessert120/movie200/breakfast250/activity500.

with requests as (
  select a.*,regexp_match(coalesce(a.answer,''),' · ([0-9]+) Quest Coins$') as charged,
    exists(select 1 from public.family_settings s where s.key='reward_spend_'||a.kid_id
      and jsonb_typeof(s.value::jsonb)='object' and (s.value::jsonb->'requests') ? a.id::text) as already_charged
  from public.asks a where a.kind like 'reward:%'
)
select id,kid_id,kind,body as original_label,answer as original_answer,already_charged,
  case when split_part(kind,':',3) ~ '^[1-9][0-9]*$' then split_part(kind,':',3)::integer*10 end as requested_points,
  case when charged is not null then charged[1]::integer*10 end as known_charged_points,
  case when already_charged and answered_at is null then 'Imported approved; no second charge. Reconcile exact paid amount before refund.'
    when (already_charged or coalesce(answer,'') like 'Approved%') and charged is null then 'Exact charged amount unknown: refund held for reconciliation.'
    when charged is not null and charged[1]<>split_part(kind,':',3) then 'Legacy approval changed price; preserve actual charge and original request separately.'
    when split_part(kind,':',3) !~ '^[1-9][0-9]*$' then 'Price must be recovered from saved catalog; migration stops if unavailable.'
    else 'Ready' end as review
from requests order by created_at;

-- Keep IDs and row counts for post-migration comparison.
select 'stars_ledger' as source,count(*) as rows from public.stars_ledger
union all select 'asks',count(*) from public.asks
union all select 'kids',count(*) from public.kids
union all select 'family_settings',count(*) from public.family_settings;
select id,kid_id,delta,reason,source,created_at from public.stars_ledger order by created_at;
rollback;
