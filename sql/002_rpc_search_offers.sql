create or replace function public.rpc_search_offers(
  q text,
  ul_lat double precision,
  ul_lon double precision,
  mode text,
  radius_km double precision,
  chain_filter uuid
)
returns table (
  id uuid,
  store_id uuid,
  chain_id uuid,
  chain_name text,
  product_name text,
  brand text,
  category text,
  price numeric,
  original_price numeric,
  discount_type text,
  discount_value numeric,
  valid_from date,
  valid_to date,
  unit text,
  unit_price numeric,
  image_url text,
  source_url text,
  sku text,
  store_name text,
  store_address text,
  store_city text,
  d_km double precision,
  score double precision
)
language sql
as $$
with base as (
  select
    o.*,
    c.name as chain_name,
    s.name as store_name,
    s.address as store_address,
    s.city as store_city,
    p.name as product_name,
    p.brand as brand,
    case
      when ul_lat is null or ul_lon is null or s.lat is null or s.lon is null
        then null
      else ST_DistanceSphere(ST_MakePoint(ul_lon, ul_lat), ST_MakePoint(s.lon, s.lat)) / 1000.0
    end as d_km
  from public.offers o
  join public.chains c on c.id = o.chain_id
  left join public.stores s on s.id = o.store_id
  left join public.products p on p.id = o.product_id
  where
    (current_date between coalesce(o.valid_from, current_date) and coalesce(o.valid_to, current_date))
    and (q is null or o.searchable @@ plainto_tsquery('italian', q))
    and (chain_filter is null or o.chain_id = chain_filter)
)
, filtered as (
  select *
  from base
  where
    radius_km is null
      or d_km is null
      or d_km <= radius_km
)
, mm as (
  select
    min(price) minp,
    max(price) maxp,
    min(d_km) mind,
    max(d_km) maxd
  from filtered
)
select
  f.id,
  f.store_id,
  f.chain_id,
  f.chain_name,
  f.product_name,
  f.brand,
  null::text as category,
  f.price,
  f.original_price,
  null::text as discount_type,
  null::numeric as discount_value,
  f.valid_from,
  f.valid_to,
  null::text as unit,
  null::numeric as unit_price,
  f.image_url,
  f.source_url,
  null::text as sku,
  f.store_name,
  f.store_address,
  f.store_city,
  f.d_km,
  case
    when mode = 'price' then
      (1 - ((f.price - mm.minp) / nullif(mm.maxp - mm.minp, 0)))
    when mode = 'distance' then
      (1 - ((coalesce(f.d_km, mm.maxd) - mm.mind) / nullif(mm.maxd - mm.mind, 0)))
    else
      (0.6 * (1 - ((f.price - mm.minp) / nullif(mm.maxp - mm.minp, 0)))) +
      (0.4 * (1 - ((coalesce(f.d_km, mm.maxd) - mm.mind) / nullif(mm.maxd - mm.mind, 0))))
  end as score
from filtered f
cross join mm
order by score desc nulls last
limit 50;
$$;
