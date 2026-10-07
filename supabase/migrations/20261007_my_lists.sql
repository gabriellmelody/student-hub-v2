create table if not exists public.my_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint my_lists_user_id_id_unique unique (user_id, id)
);

create table if not exists public.my_list_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  list_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  notes text not null default '' check (char_length(notes) <= 5000),
  is_completed boolean not null default false,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint my_list_items_owned_list_fk
    foreign key (user_id, list_id)
    references public.my_lists (user_id, id)
    on delete cascade
);

create index if not exists my_lists_user_sort_idx
  on public.my_lists (user_id, sort_order, created_at);
create index if not exists my_list_items_user_list_sort_idx
  on public.my_list_items (user_id, list_id, sort_order, created_at);

alter table public.my_lists enable row level security;
alter table public.my_list_items enable row level security;

drop policy if exists "Users read their own My Lists" on public.my_lists;
create policy "Users read their own My Lists" on public.my_lists
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users create their own My Lists" on public.my_lists;
create policy "Users create their own My Lists" on public.my_lists
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users update their own My Lists" on public.my_lists;
create policy "Users update their own My Lists" on public.my_lists
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users delete their own My Lists" on public.my_lists;
create policy "Users delete their own My Lists" on public.my_lists
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users read their own My List cards" on public.my_list_items;
create policy "Users read their own My List cards" on public.my_list_items
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users create cards in their own My Lists" on public.my_list_items;
create policy "Users create cards in their own My Lists" on public.my_list_items
  for insert to authenticated with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.my_lists
      where my_lists.id = list_id
        and my_lists.user_id = auth.uid()
    )
  );
drop policy if exists "Users update cards in their own My Lists" on public.my_list_items;
create policy "Users update cards in their own My Lists" on public.my_list_items
  for update to authenticated using (auth.uid() = user_id) with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.my_lists
      where my_lists.id = list_id
        and my_lists.user_id = auth.uid()
    )
  );
drop policy if exists "Users delete cards from their own My Lists" on public.my_list_items;
create policy "Users delete cards from their own My Lists" on public.my_list_items
  for delete to authenticated using (auth.uid() = user_id);

revoke all on public.my_lists from anon;
revoke all on public.my_list_items from anon;
grant select, insert, update, delete on public.my_lists to authenticated;
grant select, insert, update, delete on public.my_list_items to authenticated;

create or replace function public.daylo_set_my_lists_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists my_lists_set_updated_at on public.my_lists;
create trigger my_lists_set_updated_at before update on public.my_lists
for each row execute function public.daylo_set_my_lists_updated_at();
drop trigger if exists my_list_items_set_updated_at on public.my_list_items;
create trigger my_list_items_set_updated_at before update on public.my_list_items
for each row execute function public.daylo_set_my_lists_updated_at();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'my_lists'
  ) then
    alter publication supabase_realtime add table public.my_lists;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'my_list_items'
  ) then
    alter publication supabase_realtime add table public.my_list_items;
  end if;
end $$;

