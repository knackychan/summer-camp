-- Brain Gym trio sync (found while testing docs/plans/2026-10-08-games-gate-ai-guide/ slice 02).
-- points_brain_trio must pick exactly what SQBrainCore.dailyThree picks on the
-- tablet, or the server refuses real Brain Gym points ("Complete an assigned
-- Brain Gym exercise first"). 20261003_points_system.sql hard-coded the exercise
-- list with Change Maker ('change'), retired by the 2026-10-03 games-practice
-- split, so the shuffle drifted. This re-creates the function with the current
-- non-retired list from js/brain-data.js (same key order, same skills) and adds
-- dailyThree's second pass (fill a shortfall; skills may repeat).
-- scripts/games-gate.test.mjs fails if the list drifts again.
--
-- Run AFTER 20261003_points_system.sql, as the database owner. Safe to re-run.
-- Brain Gym claims already confirmed keep their identity; only future claims
-- are checked against the corrected trio.
begin;

create or replace function public.points_brain_trio(p_kid text,p_day date) returns text[] language plpgsql stable security definer set search_path=public as $$
declare ids text[]:=array['memorymatch','patternecho','fractions','balance','circuit','sorter','sentence','soundmatch','calc','signs','lowhigh','stroop','crunch','clock','wordmem','recall'];
  skills jsonb:='{"memorymatch":"memory","patternecho":"memory","fractions":"math","balance":"math","circuit":"science","sorter":"science","sentence":"language","soundmatch":"language","calc":"math","signs":"math","lowhigh":"memory","stroop":"attention","crunch":"math","clock":"logic","wordmem":"memory","recall":"memory"}';
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
    if cardinality(picked)=3 then exit; end if;
    if not (skills->>tmp)=any(seen) then picked:=array_append(picked,tmp);seen:=array_append(seen,skills->>tmp); end if;
  end loop;
  foreach tmp in array ids loop
    if cardinality(picked)=3 then exit; end if;
    if not tmp=any(picked) then picked:=array_append(picked,tmp); end if;
  end loop;
  return picked;
end $$;

commit;
