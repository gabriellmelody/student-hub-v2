create table if not exists public.planning_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_date date not null,
  plan_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_plans_user_date_unique unique (user_id, plan_date)
);

alter table public.planning_preferences enable row level security;
alter table public.daily_plans enable row level security;

drop policy if exists "Users manage their planning preferences" on public.planning_preferences;
create policy "Users manage their planning preferences" on public.planning_preferences
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage their daily plans" on public.daily_plans;
create policy "Users manage their daily plans" on public.daily_plans
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.planning_preferences from anon;
revoke all on public.daily_plans from anon;
grant select, insert, update, delete on public.planning_preferences to authenticated;
grant select, insert, update, delete on public.daily_plans to authenticated;

create or replace function public.daylo_set_planning_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists planning_preferences_set_updated_at on public.planning_preferences;
create trigger planning_preferences_set_updated_at before update on public.planning_preferences
for each row execute function public.daylo_set_planning_updated_at();
drop trigger if exists daily_plans_set_updated_at on public.daily_plans;
create trigger daily_plans_set_updated_at before update on public.daily_plans
for each row execute function public.daylo_set_planning_updated_at();

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'planning_preferences') then
    alter publication supabase_realtime add table public.planning_preferences;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'daily_plans') then
    alter publication supabase_realtime add table public.daily_plans;
  end if;
end $$;
