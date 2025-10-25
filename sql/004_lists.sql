create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  name text not null default 'La mia lista',
  created_at timestamptz default now()
);

create table if not exists public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid references public.lists(id) on delete cascade,
  offer_id uuid references public.offers(id) on delete cascade,
  qty numeric(10,2) default 1
);
create unique index if not exists list_items_list_offer_key on public.list_items(list_id, offer_id);

alter table public.lists enable row level security;
alter table public.list_items enable row level security;

drop policy if exists "owner lists" on public.lists;
create policy "owner lists" on public.lists
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "owner items" on public.list_items;
create policy "owner items" on public.list_items
  for all using (
    exists (
      select 1
      from public.lists l
      where l.id = list_items.list_id
        and l.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.lists l
      where l.id = list_items.list_id
        and l.user_id = auth.uid()
    )
  );
