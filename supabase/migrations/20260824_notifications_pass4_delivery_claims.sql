alter table public.notification_deliveries
  add column if not exists next_attempt_at timestamptz null,
  add column if not exists last_attempt_at timestamptz null;

create index if not exists notification_deliveries_retry_idx
on public.notification_deliveries (status, next_attempt_at)
where status in ('pending', 'failed');

create or replace function public.daylo_claim_notification_delivery(
  claim_user_id uuid,
  claim_subscription_id uuid,
  claim_occurrence_key text,
  claim_notification_type text,
  claim_entity_id text,
  claim_scheduled_for timestamptz
)
returns table (id uuid, attempt_count smallint)
language sql
security definer
set search_path = ''
as $$
  insert into public.notification_deliveries (
    user_id, subscription_id, occurrence_key, notification_type, entity_id,
    scheduled_for, status, attempt_count, last_attempt_at, next_attempt_at
  ) values (
    claim_user_id, claim_subscription_id, claim_occurrence_key,
    claim_notification_type, claim_entity_id, claim_scheduled_for,
    'pending', 1, now(), null
  )
  on conflict (subscription_id, occurrence_key) do update
  set status = 'pending',
      attempt_count = public.notification_deliveries.attempt_count + 1,
      last_attempt_at = now(),
      next_attempt_at = null,
      last_error_category = null,
      scheduled_for = excluded.scheduled_for
  where public.notification_deliveries.attempt_count < 3
    and (
      (public.notification_deliveries.status = 'failed'
        and public.notification_deliveries.next_attempt_at <= now())
      or
      (public.notification_deliveries.status = 'pending'
        and public.notification_deliveries.last_attempt_at < now() - interval '15 minutes')
    )
  returning public.notification_deliveries.id,
            public.notification_deliveries.attempt_count;
$$;

revoke all on function public.daylo_claim_notification_delivery(uuid, uuid, text, text, text, timestamptz) from public;
revoke all on function public.daylo_claim_notification_delivery(uuid, uuid, text, text, text, timestamptz) from anon;
revoke all on function public.daylo_claim_notification_delivery(uuid, uuid, text, text, text, timestamptz) from authenticated;
grant execute on function public.daylo_claim_notification_delivery(uuid, uuid, text, text, text, timestamptz) to service_role;
