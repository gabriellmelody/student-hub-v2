create table if not exists public.note_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint note_folders_user_id_id_unique unique (user_id, id)
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  folder_id uuid null,
  title text not null default '' check (char_length(title) <= 200),
  content jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  plain_text text not null default '' check (char_length(plain_text) <= 100000),
  is_pinned boolean not null default false,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notes_folder_id_fk
    foreign key (folder_id)
    references public.note_folders (id)
    on delete set null
);

create index if not exists note_folders_user_sort_idx
  on public.note_folders (user_id, sort_order, created_at);
create index if not exists notes_user_updated_idx
  on public.notes (user_id, updated_at desc);
create index if not exists notes_user_folder_updated_idx
  on public.notes (user_id, folder_id, updated_at desc)
  where deleted_at is null;
create index if not exists notes_user_deleted_idx
  on public.notes (user_id, deleted_at desc)
  where deleted_at is not null;
create index if not exists notes_user_pinned_updated_idx
  on public.notes (user_id, updated_at desc)
  where is_pinned = true and deleted_at is null;

alter table public.note_folders enable row level security;
alter table public.notes enable row level security;

drop policy if exists "Users read their own note folders" on public.note_folders;
create policy "Users read their own note folders" on public.note_folders
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users create their own note folders" on public.note_folders;
create policy "Users create their own note folders" on public.note_folders
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users update their own note folders" on public.note_folders;
create policy "Users update their own note folders" on public.note_folders
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users delete their own note folders" on public.note_folders;
create policy "Users delete their own note folders" on public.note_folders
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users read their own notes" on public.notes;
create policy "Users read their own notes" on public.notes
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users create their own notes" on public.notes;
create policy "Users create their own notes" on public.notes
  for insert to authenticated with check (
    auth.uid() = user_id
    and (
      folder_id is null
      or exists (
        select 1 from public.note_folders
        where note_folders.id = folder_id
          and note_folders.user_id = auth.uid()
      )
    )
  );
drop policy if exists "Users update their own notes" on public.notes;
create policy "Users update their own notes" on public.notes
  for update to authenticated using (auth.uid() = user_id) with check (
    auth.uid() = user_id
    and (
      folder_id is null
      or exists (
        select 1 from public.note_folders
        where note_folders.id = folder_id
          and note_folders.user_id = auth.uid()
      )
    )
  );
drop policy if exists "Users delete their own notes" on public.notes;
create policy "Users delete their own notes" on public.notes
  for delete to authenticated using (auth.uid() = user_id);

revoke all on public.note_folders from anon;
revoke all on public.notes from anon;
grant select, insert, update, delete on public.note_folders to authenticated;
grant select, insert, update, delete on public.notes to authenticated;

create or replace function public.daylo_set_notes_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists note_folders_set_updated_at on public.note_folders;
create trigger note_folders_set_updated_at before update on public.note_folders
for each row execute function public.daylo_set_notes_updated_at();
drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at before update on public.notes
for each row execute function public.daylo_set_notes_updated_at();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'note_folders'
  ) then
    alter publication supabase_realtime add table public.note_folders;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notes'
  ) then
    alter publication supabase_realtime add table public.notes;
  end if;
end $$;
