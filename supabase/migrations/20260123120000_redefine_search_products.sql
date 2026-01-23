-- Migration: Redefine search_products to use websearch_to_tsquery with score output
-- Created at: 2026-01-23 12:00:00

BEGIN;

CREATE OR REPLACE FUNCTION public.search_products(search_text text)
 RETURNS TABLE(id bigint, supermarket text, retailer text, product_name text, brand text, description text, current_price numeric, old_price numeric, discount_percent text, saving_amount numeric, saving_type text, weight_or_pack text, price_per_unit text, offer_start_date text, offer_end_date text, global_validity_start text, global_validity_end text, confidence numeric, notes text[], extraction_quality text, extracted_at timestamp without time zone, chain_id uuid, flyer_id uuid, score numeric)
 LANGUAGE sql
 STABLE
AS $function$
  WITH search_base AS (
    SELECT p.*, 
           to_tsvector('italian', coalesce(p.product_name, '') || ' ' || coalesce(p.brand, '') || ' ' || coalesce(p.description, '')) AS search_vector,
           websearch_to_tsquery('italian', search_text) AS search_query
    FROM products p
    WHERE search_text IS NOT NULL
      AND search_text <> ''
  ),
  scored AS (
    SELECT p.*, 
           CASE
             WHEN p.product_name ILIKE search_text || '%' THEN 1.0
             WHEN p.brand ILIKE search_text || '%' THEN 0.9
             ELSE ts_rank_cd(p.search_vector, p.search_query)
           END AS search_rank,
           CASE
             WHEN p.product_name ILIKE search_text || '%' OR p.brand ILIKE search_text || '%' THEN 1.0
             ELSE 0.0
           END AS prefix_score
    FROM search_base p
    WHERE p.product_name ILIKE search_text || '%'
       OR p.brand ILIKE search_text || '%'
       OR p.search_vector @@ p.search_query
  ),
  ranked AS (
    SELECT *, greatest(search_rank, prefix_score) AS score,
           row_number() OVER (
             PARTITION BY chain_id, flyer_id, lower(product_name)
             ORDER BY greatest(search_rank, prefix_score) DESC,
                      discount_percent DESC NULLS LAST,
                      current_price ASC,
                      extracted_at DESC
           ) AS rn
    FROM scored
  )
  SELECT
    id,
    supermarket,
    retailer,
    product_name,
    brand,
    description,
    current_price,
    old_price,
    discount_percent,
    saving_amount,
    saving_type,
    weight_or_pack,
    price_per_unit,
    offer_start_date,
    offer_end_date,
    global_validity_start,
    global_validity_end,
    confidence,
    notes,
    extraction_quality,
    extracted_at,
    chain_id,
    flyer_id,
    score
  FROM ranked
  WHERE rn = 1
  ORDER BY score DESC, discount_percent DESC NULLS LAST, current_price ASC;
$function$;

-- rollback:
-- DROP FUNCTION IF EXISTS public.search_products(text);

COMMIT;
