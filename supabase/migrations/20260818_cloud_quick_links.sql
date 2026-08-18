create table if not exists public.quick_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 42),
  url text not null check (url ~ '^https?://'),
  icon_mode text not null default 'site' check (icon_mode in ('site', 'daylo')),
  icon_key text null,
  pinned boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quick_links_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  initialized_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quick_links_user_sort_idx on public.quick_links (user_id, sort_order);
alter table public.quick_links enable row level security;
alter table public.quick_links_state enable row level security;

drop policy if exists "Users manage their Quick Links" on public.quick_links;
create policy "Users manage their Quick Links" on public.quick_links for all to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage their Quick Links state" on public.quick_links_state;
create policy "Users manage their Quick Links state" on public.quick_links_state for all to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.quick_links from anon;
revoke all on public.quick_links_state from anon;
grant select, insert, update, delete on public.quick_links to authenticated;
grant select, insert, update, delete on public.quick_links_state to authenticated;

create or replace function public.daylo_set_quick_links_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists quick_links_set_updated_at on public.quick_links;
create trigger quick_links_set_updated_at before update on public.quick_links
for each row execute function public.daylo_set_quick_links_updated_at();
drop trigger if exists quick_links_state_set_updated_at on public.quick_links_state;
create trigger quick_links_state_set_updated_at before update on public.quick_links_state
for each row execute function public.daylo_set_quick_links_updated_at();

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'quick_links') then
    alter publication supabase_realtime add table public.quick_links;
  end if;
end $$;
