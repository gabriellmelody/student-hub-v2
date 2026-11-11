alter table public.tasks
  add column if not exists manual_overrides jsonb not null default '{}'::jsonb;
