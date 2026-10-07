alter table public.my_lists
  add column if not exists color_key text not null default 'sky';

alter table public.my_list_items
  add column if not exists subject_id uuid null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'my_lists_color_key_check'
      and conrelid = 'public.my_lists'::regclass
  ) then
    alter table public.my_lists
      add constraint my_lists_color_key_check
      check (color_key in ('sky', 'peach', 'violet', 'green', 'rose', 'gold', 'teal', 'navy'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'my_list_items_subject_id_fk'
      and conrelid = 'public.my_list_items'::regclass
  ) then
    alter table public.my_list_items
      add constraint my_list_items_subject_id_fk
      foreign key (subject_id)
      references public.subjects (id)
      on delete set null;
  end if;
end $$;

create index if not exists my_list_items_subject_idx
  on public.my_list_items (user_id, subject_id)
  where subject_id is not null;

drop policy if exists "Users create cards in their own My Lists" on public.my_list_items;
create policy "Users create cards in their own My Lists" on public.my_list_items
  for insert to authenticated with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.my_lists
      where my_lists.id = list_id
        and my_lists.user_id = auth.uid()
    )
    and (
      subject_id is null
      or exists (
        select 1 from public.subjects
        where subjects.id = subject_id
          and subjects.user_id = auth.uid()
      )
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
    and (
      subject_id is null
      or exists (
        select 1 from public.subjects
        where subjects.id = subject_id
          and subjects.user_id = auth.uid()
      )
    )
  );
