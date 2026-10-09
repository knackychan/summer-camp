-- Summer chat transcripts (docs/plans/2026-10-09-summer-chat-crash-test/ design D5).
-- One row per exchange: what the kid wrote and Summer's EN + 中文 reply, with
-- the moderation flag and the AI cost. Written only by the kid-chat Edge Function
-- (hosted database key); readable only by a parent in public.admins. Tablets can
-- neither read nor write it. Kept for Papa; nothing deletes rows.
--
-- Independent of the points migration. Run as the database owner; safe to re-run.
begin;

create table if not exists public.kid_chats (
  id bigint generated always as identity primary key,
  kid_id text not null references public.kids(id),
  session_id text not null,
  kid_text text not null,
  reply_en text not null,
  reply_zh text not null,
  flagged boolean not null default false,
  model text, input_tokens integer, output_tokens integer, cost_usd numeric(10,6),
  created_at timestamptz not null default now()
);
create index if not exists kid_chats_created on public.kid_chats(created_at desc);
alter table public.kid_chats enable row level security;

-- admins has RLS, so the parent lookup runs as its owner (same as games_gate_parent()).
create or replace function public.kid_chat_parent() returns boolean language sql stable security definer
set search_path=public as $$ select exists(select 1 from public.admins where user_id=auth.uid()) $$;
revoke all on function public.kid_chat_parent() from public;
grant execute on function public.kid_chat_parent() to anon,authenticated;

drop policy if exists "parent reads kid chats" on public.kid_chats;
create policy "parent reads kid chats" on public.kid_chats for select to authenticated using (public.kid_chat_parent());
revoke all on public.kid_chats from anon, authenticated;
grant select on public.kid_chats to authenticated;

commit;
