-- Ezuth: limits so one account can't fill the database.
-- Paste into Supabase → SQL Editor → New query → Run. Safe to run again.
--   · a script can be at most ~5 MB (a long feature with notes is well under 1 MB)
--   · script ids are short app-made ids
--   · each writer can keep at most 500 scripts in the cloud

alter table public.projects drop constraint if exists projects_data_size;
alter table public.projects add constraint projects_data_size check (pg_column_size(data) < 5000000);

alter table public.projects drop constraint if exists projects_id_length;
alter table public.projects add constraint projects_id_length check (char_length(id) between 1 and 64);

create or replace function public.projects_limit_per_writer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- (upserts fire this too, so saving an existing script is always allowed)
  if not exists (select 1 from public.projects where user_id = new.user_id and id = new.id)
     and (select count(*) from public.projects where user_id = new.user_id) >= 500 then
    raise exception 'Script limit reached (500 per account).' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists projects_limit_per_writer on public.projects;
create trigger projects_limit_per_writer
  before insert on public.projects
  for each row execute function public.projects_limit_per_writer();
