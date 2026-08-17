create table if not exists public.classroom_sync_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  classroom_course_id text not null,
  classroom_course_name text not null default '',
  subject_id uuid null references public.subjects(id) on delete set null,
  sync_enabled boolean not null default true,
  sync_active boolean not null default true,
  sync_no_due_date boolean not null default false,
  sync_completed boolean not null default false,
  last_synced_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint classroom_sync_settings_user_course_unique unique (user_id, classroom_course_id)
);

alter table public.classroom_sync_settings enable row level security;

drop policy if exists "Users can read their Classroom sync settings" on public.classroom_sync_settings;
create policy "Users can read their Classroom sync settings"
on public.classroom_sync_settings for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their Classroom sync settings" on public.classroom_sync_settings;
create policy "Users can insert their Classroom sync settings"
on public.classroom_sync_settings for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their Classroom sync settings" on public.classroom_sync_settings;
create policy "Users can update their Classroom sync settings"
on public.classroom_sync_settings for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their Classroom sync settings" on public.classroom_sync_settings;
create policy "Users can delete their Classroom sync settings"
on public.classroom_sync_settings for delete
using (auth.uid() = user_id);

create index if not exists classroom_sync_settings_user_id_idx
on public.classroom_sync_settings (user_id);

create or replace function public.set_classroom_sync_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_classroom_sync_settings_updated_at on public.classroom_sync_settings;
create trigger set_classroom_sync_settings_updated_at
before update on public.classroom_sync_settings
for each row execute function public.set_classroom_sync_settings_updated_at();
