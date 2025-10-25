-- Sample catalog data for local testing / Supabase demo.
-- Safe to run multiple times thanks to NOT EXISTS guards.

-- Chains --------------------------------------------------------------------
insert into public.chains (name, website)
select 'Esselunga', 'https://www.esselunga.it'
where not exists (select 1 from public.chains where name = 'Esselunga');

insert into public.chains (name, website)
select 'Coop', 'https://www.coop.it'
where not exists (select 1 from public.chains where name = 'Coop');

insert into public.chains (name, website)
select 'Conad', 'https://www.conad.it'
where not exists (select 1 from public.chains where name = 'Conad');

-- Stores --------------------------------------------------------------------
with data as (
  select 'Esselunga'::text as chain, 'Esselunga Milano Garibaldi'::text as name,
         'Piazza Gae Aulenti 6'::text as address, '20154'::text as postcode,
         'Milano'::text as city, 45.4840::double precision as lat, 9.1895::double precision as lon
  union all
  select 'Coop', 'Coop Milano Duomo', 'Via Torino 32', '20123', 'Milano', 45.4636, 9.1879
  union all
  select 'Conad', 'Conad Firenze Centro', 'Via dei Calzaiuoli 25', '50122', 'Firenze', 43.7714, 11.2550
)
insert into public.stores (chain_id, name, address, postcode, city, lat, lon, geom)
select c.id, d.name, d.address, d.postcode, d.city, d.lat, d.lon,
       ST_SetSRID(ST_MakePoint(d.lon, d.lat), 4326)::geography
from data d
join public.chains c on c.name = d.chain
where not exists (
  select 1 from public.stores s where s.name = d.name
);

-- Products ------------------------------------------------------------------
insert into public.products (name, brand)
select 'Latte intero 1L', 'Granarolo'
where not exists (select 1 from public.products where name = 'Latte intero 1L');

insert into public.products (name, brand)
select 'Pasta Fusilli 500g', 'Barilla'
where not exists (select 1 from public.products where name = 'Pasta Fusilli 500g');

insert into public.products (name, brand)
select 'Olio Extravergine 1L', 'Monini'
where not exists (select 1 from public.products where name = 'Olio Extravergine 1L');

-- Offers --------------------------------------------------------------------
with offer_data as (
  select 'Esselunga'::text as chain, 'Esselunga Milano Garibaldi'::text as store,
         'Latte intero 1L'::text as product, 1.39::numeric as price, 1.59::numeric as original_price,
         current_date as valid_from, current_date + interval '7 days' as valid_to,
         'https://www.esselunga.it/volantini'::text as source_url
  union all
  select 'Coop', 'Coop Milano Duomo', 'Pasta Fusilli 500g', 0.89, 1.29,
         current_date, current_date + interval '7 days',
         'https://www.coop.it/volantini'
  union all
  select 'Conad', 'Conad Firenze Centro', 'Olio Extravergine 1L', 5.49, 6.20,
         current_date, current_date + interval '10 days',
         'https://www.conad.it/volantini'
)
insert into public.offers (
  id, chain_id, store_id, product_id, price, original_price,
  valid_from, valid_to, product_name, brand, source_url
)
select gen_random_uuid(),
       c.id,
       s.id,
       p.id,
       o.price,
       o.original_price,
       o.valid_from::date,
       o.valid_to::date,
       p.name,
       p.brand,
       o.source_url
from offer_data o
join public.chains c on c.name = o.chain
join public.stores s on s.name = o.store
join public.products p on p.name = o.product
where not exists (
  select 1
  from public.offers existing
  where existing.chain_id = c.id
    and existing.store_id = s.id
    and existing.product_id = p.id
    and coalesce(existing.valid_from, date '1970-01-01') = o.valid_from::date
);
