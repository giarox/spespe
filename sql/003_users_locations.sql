create table if not exists public.users (
  id uuid primary key,
  email text unique,
  created_at timestamptz default now()
);

create table if not exists public.user_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  label text default 'Casa',
  address text,
  lat double precision,
  lon double precision,
  is_default boolean default true,
  created_at timestamptz default now()
);

alter table public.user_locations enable row level security;

drop policy if exists "owner manage locations" on public.user_locations;
create policy "owner manage locations" on public.user_locations
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
