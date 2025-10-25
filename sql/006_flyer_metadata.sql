-- Flyer metadata enhancements for scraper ingestion

alter table public.flyers
  add column if not exists vendor text,
  add column if not exists viewer_url text,
  add column if not exists publication_id text;

create index if not exists flyers_publication_id_idx on public.flyers(publication_id);

create table if not exists public.flyer_pages (
  id uuid primary key default gen_random_uuid(),
  flyer_id uuid references public.flyers(id) on delete cascade,
  page_no integer not null,
  image_url text not null,
  image_hash text,
  width integer,
  height integer,
  created_at timestamptz default now()
);
create unique index if not exists flyer_pages_flyer_page_idx on public.flyer_pages(flyer_id, page_no);

create table if not exists public.flyer_runs (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid references public.chains(id) on delete cascade,
  flyer_id uuid references public.flyers(id) on delete cascade,
  vendor text,
  status text not null,
  pages_processed integer default 0,
  offers_detected integer default 0,
  error_message text,
  started_at timestamptz default now(),
  finished_at timestamptz
);
create index if not exists flyer_runs_chain_idx on public.flyer_runs(chain_id);
