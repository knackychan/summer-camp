-- ============================================================
-- Data repair: unlabelled stars in stars_ledger
-- Written 2026-07-27. One-off — not a migration, safe to delete once settled.
--
-- THE BUG (fixed in js/sync.js + index.html on 2026-07-27):
--   A tablet that was open when Papa granted a star applied the grant to its
--   local `progress` but never moved `store.last`. The next save diffed a +N
--   nobody had claimed, and enqueueDiff stamped it with the generic reason and
--   inserted it AGAIN. Every admin grant landing on an open tablet was
--   therefore counted twice.
--
-- CAUTION — read before running anything below.
--   Two different things land in the unlabelled bucket, and only one is a bug:
--
--   (a) DUPLICATES from the store.last fault above. Reversible, should go.
--   (b) LEGACY rows. Until the labelling build actually reached the tablets,
--       the lowercase string 'app progress' was the ONLY reason any app star
--       ever received. Those are real stars the kids earned. A tablet that was
--       offline, or still on the old build, flushes its queued ops in a burst
--       on the next reload — which looks like a pile of identical +1 rows
--       seconds apart, but is just a backlog arriving.
--
--   The cutoff is DERIVED FROM THE DATA, not hardcoded: it is the timestamp of
--   the first app row that carries a real reason. Before that moment no tablet
--   was capable of labelling anything, so "unlabelled" says nothing about
--   whether a row is a duplicate. Deploy dates are the wrong basis — a commit
--   can sit undeployed, and tablets pick up a build whenever they reload.
--
--   PART 1's verdict column separates them. Read it before repairing.
--
-- WHAT THE REAL DATA SHOWED (2026-07-27):
--   357 unlabelled rows / 374 stars, spanning 07-26 13:33 to 07-27 08:03,
--   against only ~65 stars of positive admin grants in the same window. So the
--   overwhelming majority are genuine, and every one of them predates the
--   cutoff. Conclusion: there was nothing worth repairing in the history. This
--   file's ongoing value is PART 0 and PART 5 as a watch, not PART 3.
--
-- DISARMED: every write below is commented out. Nothing here changes data
--           until you uncomment it yourself.
--
-- Runs in the Supabase SQL editor (postgres role, bypasses RLS).
-- ============================================================


-- ============================================================
-- PART 0 — What reason strings actually exist? Run this FIRST.
-- Guessing the string cost a wasted run once already: the repair originally
-- matched 'App progress%' case-sensitively and silently found nothing, because
-- the old build wrote it lowercase. Look before matching.
-- ============================================================
select
  source,
  reason,
  count(*)                                          as rows,
  sum(delta)                                        as stars,
  min(created_at at time zone 'Asia/Taipei')        as first_seen_taipei,
  max(created_at at time zone 'Asia/Taipei')        as last_seen_taipei
from stars_ledger
group by source, reason
order by rows desc, reason;


-- ============================================================
-- PART 1 — Classify every unlabelled row.
-- ILIKE, so it catches 'app progress', 'App progress app進度' and the new
-- 'Unlabelled — check the app' alike.
-- ============================================================
with unlabelled as (
  select *
  from stars_ledger
  where source = 'app'
    and delta > 0
    and (reason ilike 'app progress%' or reason ilike 'unlabelled%')
)
select
  u.id,
  u.kid_id,
  u.delta,
  to_char(u.created_at at time zone 'Asia/Taipei', 'DD Mon HH24:MI:SS') as when_taipei,
  a.delta                                                              as admin_delta,
  a.reason                                                             as admin_reason,
  round(extract(epoch from (u.created_at - a.created_at)))             as seconds_after_admin,
  case
    when u.created_at < (select coalesce(min(created_at), 'infinity')
                       from stars_ledger
                       where source = 'app'
                         and reason not ilike 'app progress%'
                         and reason not ilike 'unlabelled%')
      then 'LEGACY — predates reason plumbing; a real star, leave it alone'
    when a.id is null
      then 'ORPHAN — no admin grant before it; probably a real star, lost reason'
    when u.created_at - a.created_at < interval '10 minutes'
      then 'ECHO — candidate duplicate, check the admin_reason beside it'
    else 'UNCLEAR — admin grant too far back to blame'
  end as verdict
from unlabelled u
left join lateral (
  select l.id, l.delta, l.reason, l.created_at
  from stars_ledger l
  where l.kid_id = u.kid_id
    and l.source = 'admin'
    and l.delta > 0
    and l.created_at < u.created_at
  order by l.created_at desc
  limit 1
) a on true
order by u.created_at desc;


-- ============================================================
-- PART 2 — Per-kid totals. "inflated_by" is what PART 3 would take back.
-- Legacy and orphan stars are counted separately and are NOT touched.
-- ============================================================
with unlabelled as (
  select l.*,
         l.created_at < (select coalesce(min(created_at), 'infinity')
                       from stars_ledger
                       where source = 'app'
                         and reason not ilike 'app progress%'
                         and reason not ilike 'unlabelled%') as is_legacy,
         exists (
           select 1 from stars_ledger a
           where a.kid_id = l.kid_id
             and a.source = 'admin'
             and a.delta > 0
             and a.created_at < l.created_at
             and l.created_at - a.created_at < interval '10 minutes'
         ) as looks_like_echo
  from stars_ledger l
  where l.source = 'app'
    and l.delta > 0
    and (l.reason ilike 'app progress%' or l.reason ilike 'unlabelled%')
)
select
  k.id                                                       as kid,
  coalesce(sum(l.delta), 0)                                  as stars_now,
  coalesce(sum(u.delta), 0)                                  as unlabelled_total,
  coalesce(sum(u.delta) filter (where u.is_legacy), 0)       as legacy_kept,
  coalesce(sum(u.delta) filter (
    where not u.is_legacy and not u.looks_like_echo), 0)     as orphans_kept,
  coalesce(sum(u.delta) filter (
    where not u.is_legacy and u.looks_like_echo), 0)         as inflated_by,
  coalesce(sum(l.delta), 0) - coalesce(sum(u.delta) filter (
    where not u.is_legacy and u.looks_like_echo), 0)         as stars_after_repair
from kids k
left join stars_ledger l on l.kid_id = k.id
left join unlabelled  u on u.id = l.id
group by k.id
order by k.id;


-- ============================================================
-- PART 3 — The repair. DISARMED. Uncomment only after reading PART 1.
--
-- Reverses by INSERTING a matching negative row, never by deleting: stars are
-- a ledger (CLAUDE.md), so the history has to keep showing what happened and
-- why. Each correction embeds the id of the row it cancels, which is what
-- makes it safe to run twice — the NOT EXISTS clause skips anything already
-- corrected.
-- ============================================================

-- ---- VARIANT A (recommended): reverse post-cutoff echoes only ---------------
-- Skips LEGACY and ORPHAN rows. Giving a kid a star they did not earn is a far
-- smaller harm than taking one they did, so anything ambiguous stays.
--
-- begin;
--
-- insert into stars_ledger (kid_id, delta, reason, source)
-- select
--   u.kid_id,
--   -u.delta,
--   'Correction · duplicate from sync bug [' || u.id || ']',
--   'admin'
-- from stars_ledger u
-- where u.source = 'app'
--   and u.delta > 0
--   and (u.reason ilike 'app progress%' or u.reason ilike 'unlabelled%')
--   and u.created_at >= (select coalesce(min(created_at), 'infinity')
                       from stars_ledger
                       where source = 'app'
                         and reason not ilike 'app progress%'
                         and reason not ilike 'unlabelled%')
--   and exists (
--     select 1 from stars_ledger a
--     where a.kid_id = u.kid_id
--       and a.source = 'admin'
--       and a.delta > 0
--       and a.created_at < u.created_at
--       and u.created_at - a.created_at < interval '10 minutes'
--   )
--   and not exists (
--     select 1 from stars_ledger c
--     where c.reason like '%[' || u.id || ']%'
--   );
--
-- -- re-run PART 2 here, then:
-- commit;   -- or: rollback;


-- ---- VARIANT B: reverse EVERY unlabelled row --------------------------------
-- Almost certainly wrong now that legacy rows are known to be in the bucket —
-- this strips stars the kids genuinely earned before 2026-07-26 18:21.
-- Kept only as a record of the alternative. Do not run it casually.
--
-- begin;
--
-- insert into stars_ledger (kid_id, delta, reason, source)
-- select
--   u.kid_id,
--   -u.delta,
--   'Correction · unlabelled star removed [' || u.id || ']',
--   'admin'
-- from stars_ledger u
-- where u.source = 'app'
--   and u.delta > 0
--   and (u.reason ilike 'app progress%' or u.reason ilike 'unlabelled%')
--   and not exists (
--     select 1 from stars_ledger c
--     where c.reason like '%[' || u.id || ']%'
--   );
--
-- commit;


-- ============================================================
-- PART 4 — Undo the repair, if the totals look wrong afterwards.
-- Deletes only the correction rows this script created; the original history
-- is untouched either way.
-- ============================================================
-- delete from stars_ledger where reason like 'Correction ·%';


-- ============================================================
-- PART 5 — Ongoing watch. Should return zero rows for anything AFTER the
-- 2026-07-27 deploy. A hit means a star source was added without a
-- noteStars() reason; scripts/check.mjs guards that at build time, this
-- catches it live.
--
-- Already-corrected rows are excluded: the repair cancels them with a negative
-- row rather than deleting them, so without this they would sit in the result
-- forever and the watch would never read clean.
-- ============================================================
select
  u.kid_id,
  count(*)                                       as rows,
  sum(u.delta)                                   as stars,
  max(u.created_at at time zone 'Asia/Taipei')   as latest_taipei
from stars_ledger u
where u.source = 'app'
  and u.delta > 0
  and (u.reason ilike 'app progress%' or u.reason ilike 'unlabelled%')
  and u.created_at > now() - interval '7 days'
  and not exists (
    select 1 from stars_ledger c
    where c.reason like '%[' || u.id || ']%'
  )
group by u.kid_id;
