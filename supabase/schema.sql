-- Ezuth cloud storage. Paste this into Supabase → SQL Editor → New query → Run.
-- Each writer's scripts are one row per script; row-level security makes sure
-- a signed-in writer can only ever read or change their own rows.

create table if not exists public.projects (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.projects enable row level security;

-- Only signed-in writers reach the table (and RLS limits them to their own rows).
revoke all on public.projects from anon;
grant select, insert, update, delete on public.projects to authenticated;

drop policy if exists "read own scripts"   on public.projects;
drop policy if exists "add own scripts"    on public.projects;
drop policy if exists "change own scripts" on public.projects;
drop policy if exists "delete own scripts" on public.projects;

create policy "read own scripts"   on public.projects for select using (auth.uid() = user_id);
create policy "add own scripts"    on public.projects for insert with check (auth.uid() = user_id);
create policy "change own scripts" on public.projects for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own scripts" on public.projects for delete using (auth.uid() = user_id);
