-- Raw offer extraction results from flyer pages
create table if not exists public.flyer_page_offers_raw (
  id uuid primary key default gen_random_uuid(),
  flyer_id uuid references public.flyers(id) on delete cascade,
  flyer_page_id uuid references public.flyer_pages(id) on delete cascade,
  page_no integer not null,
  product_name text not null,
  price numeric(10,2) not null,
  currency text default 'EUR',
  brand text,
  metadata jsonb default '{}'::jsonb,
  detected_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists flyer_page_offers_raw_flyer_page_idx
  on public.flyer_page_offers_raw(flyer_page_id);

-- Processing log to avoid re-running OCR on the same page indefinitely
create table if not exists public.flyer_page_processing (
  flyer_page_id uuid primary key references public.flyer_pages(id) on delete cascade,
  processed_at timestamptz default now(),
  status text,
  offers_found integer,
  notes text
);

create index if not exists flyer_page_processing_status_idx
  on public.flyer_page_processing(status);
