-- Enable PostGIS for geometry/distance helpers
create extension if not exists postgis;

-- Core catalog tables
create table if not exists public.chains(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  created_at timestamptz default now()
);

create table if not exists public.stores(
  id uuid primary key default gen_random_uuid(),
  chain_id uuid references public.chains(id) on delete cascade,
  name text not null,
  address text,
  postcode text,
  city text,
  lat double precision,
  lon double precision,
  geom geography(point,4326),
  source_urls jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);
create index if not exists stores_geom_gix on public.stores using gist(geom);

create table if not exists public.flyers(
  id uuid primary key default gen_random_uuid(),
  chain_id uuid references public.chains(id) on delete cascade,
  period_start date,
  period_end date,
  source_url text not null,
  fetched_at timestamptz not null,
  content_hash text,
  storage_path text,
  content_type text
);

create table if not exists public.offers(
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete set null,
  chain_id uuid references public.chains(id) on delete cascade,
  flyer_id uuid references public.flyers(id) on delete set null,
  product_name text not null,
  brand text,
  category text,
  price numeric(10,2) not null,
  original_price numeric(10,2),
  discount_type text,
  discount_value numeric(10,2),
  valid_from date,
  valid_to date,
  unit text,
  unit_price numeric(10,3),
  image_url text,
  source_url text,
  sku text,
  searchable tsvector
);
create index if not exists offers_valid_idx on public.offers(valid_from, valid_to);
create index if not exists offers_store_idx on public.offers(store_id, valid_to);
create index if not exists offers_search_idx on public.offers using gin(searchable);

-- Full text search trigger
create or replace function public.offers_search_tsv() returns trigger as $$
begin
  new.searchable :=
    setweight(to_tsvector('italian', coalesce(new.product_name,'')), 'A') ||
    setweight(to_tsvector('simple',  coalesce(new.brand,'')),        'B') ||
    setweight(to_tsvector('italian', coalesce(new.category,'')),     'C');
  return new;
end;
$$ language plpgsql;

drop trigger if exists offers_search_tsv_trg on public.offers;
create trigger offers_search_tsv_trg
before insert or update on public.offers
for each row execute function public.offers_search_tsv();

-- RLS: public read for catalog tables
alter table public.chains enable row level security;
alter table public.stores enable row level security;
alter table public.flyers enable row level security;
alter table public.offers enable row level security;

drop policy if exists "public read chains" on public.chains;
create policy "public read chains" on public.chains
  for select to anon, authenticated
  using (true);

drop policy if exists "public read stores" on public.stores;
create policy "public read stores" on public.stores
  for select to anon, authenticated
  using (true);

drop policy if exists "public read flyers" on public.flyers;
create policy "public read flyers" on public.flyers
  for select to anon, authenticated
  using (true);

drop policy if exists "public read offers" on public.offers;
create policy "public read offers" on public.offers
  for select to anon, authenticated
  using (true);
