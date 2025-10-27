-- Additional metadata to track ingestion of OCR results
alter table if exists public.flyer_page_offers_raw
  add column if not exists ingested_offer_id uuid references public.offers(id) on delete set null,
  add column if not exists ingested_at timestamptz;

-- Ensure unique constraint for deterministic upsert into offers
create unique index if not exists offers_flyer_product_price_idx
  on public.offers (flyer_id, product_name, price);
