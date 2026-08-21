create table if not exists public.google_integration_tokens (
  user_id uuid not null references auth.users(id) on delete cascade,
  integration text not null check (integration in ('classroom', 'calendar')),
  encrypted_payload text not null,
  google_account_id text null,
  google_account_email text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, integration)
);

alter table public.google_integration_tokens enable row level security;
revoke all on public.google_integration_tokens from anon;
revoke all on public.google_integration_tokens from authenticated;

create or replace function public.daylo_set_google_integration_tokens_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists google_integration_tokens_set_updated_at on public.google_integration_tokens;
create trigger google_integration_tokens_set_updated_at
before update on public.google_integration_tokens
for each row execute function public.daylo_set_google_integration_tokens_updated_at();
