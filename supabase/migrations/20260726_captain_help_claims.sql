create table if not exists help_claims (
  id            uuid primary key default gen_random_uuid(),
  captain_id    text not null references kids(id) default 'luis',
  helped_kid_id text not null references kids(id),
  day           date not null,
  body          text not null,
  status        text not null default 'requested',
  reviewed_by   text,
  reviewed_at   timestamptz,
  created_at    timestamptz default now(),
  constraint help_claims_captain_luis check (captain_id = 'luis'),
  constraint help_claims_not_self check (captain_id <> helped_kid_id)
);

create index if not exists idx_help_claims_status on help_claims (status, created_at desc);
create index if not exists idx_help_claims_day on help_claims (day, created_at desc);

alter table help_claims enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'help_claims' and policyname = 'read help claims'
  ) then
    create policy "read help claims" on help_claims for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'help_claims' and policyname = 'kid help claim'
  ) then
    create policy "kid help claim" on help_claims for insert
      with check (captain_id = 'luis' and status = 'requested' and reviewed_at is null);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'help_claims' and policyname = 'admin help claims'
  ) then
    create policy "admin help claims" on help_claims for update to authenticated using (true) with check (true);
  end if;
end $$;

do $$
begin
  alter publication supabase_realtime add table help_claims;
exception when duplicate_object then null;
end $$;
