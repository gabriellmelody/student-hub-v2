alter table public.tasks
  add column if not exists google_calendar_event_id text null,
  add column if not exists google_calendar_id text null,
  add column if not exists google_calendar_account_id text null,
  add column if not exists google_calendar_event_html_link text null,
  add column if not exists scheduled_date date null,
  add column if not exists scheduled_start_time time null,
  add column if not exists scheduled_duration_minutes integer null,
  add column if not exists scheduled_timezone text null;

alter table public.tasks
  drop constraint if exists tasks_scheduled_duration_minutes_check;
alter table public.tasks
  add constraint tasks_scheduled_duration_minutes_check
  check (
    scheduled_duration_minutes is null
    or scheduled_duration_minutes between 15 and 720
  );

create unique index if not exists tasks_google_calendar_event_unique_idx
  on public.tasks (user_id, google_calendar_id, google_calendar_event_id)
  where google_calendar_event_id is not null;

create index if not exists tasks_user_scheduled_date_idx
  on public.tasks (user_id, scheduled_date)
  where google_calendar_event_id is not null;

-- Existing tasks RLS remains authoritative. These nullable columns contain
-- linkage metadata only and inherit the same authenticated user boundary.
