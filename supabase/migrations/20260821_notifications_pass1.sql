create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  master_enabled boolean not null default false,
  new_classroom_tasks_enabled boolean not null default true,
  task_due_tomorrow_enabled boolean not null default true,
  task_due_today_enabled boolean not null default true,
  daily_planning_enabled boolean not null default true,
  daily_planning_time time not null default '17:00',
  plan_start_enabled boolean not null default true,
  plan_start_lead_minutes smallint not null default 15
    check (plan_start_lead_minutes between 0 and 120),
  quiet_hours_enabled boolean not null default true,
  quiet_hours_start time not null default '22:00',
  quiet_hours_end time not null default '07:00',
  notification_preview text not null default 'private'
    check (notification_preview in ('private', 'full')),
  timezone text not null default 'UTC'
    check (char_length(timezone) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device_label text null check (device_label is null or char_length(device_label) <= 80),
  platform text null check (platform is null or char_length(platform) <= 40),
  timezone text null check (timezone is null or char_length(timezone) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint push_subscriptions_id_user_unique unique (id, user_id)
);

create index if not exists push_subscriptions_user_id_idx
on public.push_subscriptions (user_id);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid not null,
  occurrence_key text not null check (char_length(occurrence_key) between 1 and 500),
  notification_type text not null check (notification_type in (
    'classroom_new_task',
    'task_due_tomorrow',
    'task_due_today',
    'daily_planning',
    'plan_start'
  )),
  entity_id text null check (entity_id is null or char_length(entity_id) <= 300),
  scheduled_for timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'skipped', 'failed')),
  attempt_count smallint not null default 0 check (attempt_count between 0 and 10),
  last_error_category text null
    check (last_error_category is null or char_length(last_error_category) <= 80),
  sent_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_deliveries_subscription_owner_fk
    foreign key (subscription_id, user_id)
    references public.push_subscriptions(id, user_id) on delete cascade,
  constraint notification_deliveries_subscription_occurrence_unique
    unique (subscription_id, occurrence_key)
);

create index if not exists notification_deliveries_due_idx
on public.notification_deliveries (status, scheduled_for);
create index if not exists notification_deliveries_user_created_idx
on public.notification_deliveries (user_id, created_at desc);

create table if not exists public.classroom_notification_baselines (
  user_id uuid not null references auth.users(id) on delete cascade,
  google_account_id text not null,
  classroom_course_id text not null,
  baseline_completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, google_account_id, classroom_course_id)
);

create table if not exists public.classroom_coursework_seen (
  user_id uuid not null references auth.users(id) on delete cascade,
  google_account_id text not null,
  classroom_course_id text not null,
  classroom_coursework_id text not null,
  external_id text not null,
  first_seen_at timestamptz not null default now(),
  primary key (
    user_id,
    google_account_id,
    classroom_course_id,
    classroom_coursework_id
  ),
  constraint classroom_coursework_seen_external_unique
    unique (user_id, google_account_id, external_id)
);

create index if not exists classroom_coursework_seen_user_course_idx
on public.classroom_coursework_seen (user_id, google_account_id, classroom_course_id);

alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.classroom_notification_baselines enable row level security;
alter table public.classroom_coursework_seen enable row level security;

drop policy if exists "Users manage their notification preferences" on public.notification_preferences;
create policy "Users manage their notification preferences"
on public.notification_preferences for all to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.notification_preferences from anon;
grant select, insert, update, delete on public.notification_preferences to authenticated;

revoke all on public.push_subscriptions from anon;
revoke all on public.push_subscriptions from authenticated;
revoke all on public.notification_deliveries from anon;
revoke all on public.notification_deliveries from authenticated;
revoke all on public.classroom_notification_baselines from anon;
revoke all on public.classroom_notification_baselines from authenticated;
revoke all on public.classroom_coursework_seen from anon;
revoke all on public.classroom_coursework_seen from authenticated;

create or replace function public.daylo_set_notifications_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notification_preferences_set_updated_at on public.notification_preferences;
create trigger notification_preferences_set_updated_at before update on public.notification_preferences
for each row execute function public.daylo_set_notifications_updated_at();

drop trigger if exists push_subscriptions_set_updated_at on public.push_subscriptions;
create trigger push_subscriptions_set_updated_at before update on public.push_subscriptions
for each row execute function public.daylo_set_notifications_updated_at();
drop trigger if exists notification_deliveries_set_updated_at on public.notification_deliveries;
create trigger notification_deliveries_set_updated_at before update on public.notification_deliveries
for each row execute function public.daylo_set_notifications_updated_at();
drop trigger if exists classroom_notification_baselines_set_updated_at on public.classroom_notification_baselines;
create trigger classroom_notification_baselines_set_updated_at before update on public.classroom_notification_baselines
for each row execute function public.daylo_set_notifications_updated_at();
