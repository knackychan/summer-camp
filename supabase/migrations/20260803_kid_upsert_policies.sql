-- Tablet upserts need an UPDATE policy, not just INSERT.
--
-- js/sync.js writes day_ticks, act_done and brain_done with .upsert(). Once the
-- row exists on the server, Postgres takes the ON CONFLICT DO UPDATE path, which
-- requires an UPDATE policy as well as INSERT. anon had INSERT only, so every
-- repeat write failed with 42501.
--
-- That is not a lost row, it is a lost session: SyncStore._flush() walks the
-- queue in order and returns on the first error, so one permanently-failing op
-- parks everything behind it forever. Stars stayed in the queue, starsFor() kept
-- counting them (server + queued) so the tablet looked right, and the ledger —
-- the only thing the admin reads — never received them.
--
-- anon already has full INSERT (+ DELETE on day_ticks) here, so UPDATE grants no
-- privilege it did not already have by insert-then-delete.
do $$
begin
  execute 'drop policy if exists "kid retick" on public.day_ticks';
  execute 'drop policy if exists "kid react" on public.act_done';
  execute 'drop policy if exists "kid rebrain" on public.brain_done';

  execute 'create policy "kid retick" on public.day_ticks for update using (true) with check (true)';
  execute 'create policy "kid react" on public.act_done for update using (true) with check (true)';
  execute 'create policy "kid rebrain" on public.brain_done for update using (true) with check (true)';
end $$;
