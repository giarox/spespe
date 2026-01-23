DROP FUNCTION IF EXISTS public.search_products(text);

CREATE OR REPLACE FUNCTION public.search_products(search_text text)
 RETURNS TABLE(id bigint, supermarket text, retailer text, product_name text, brand text, description text, current_price numeric, old_price numeric, discount_percent text, saving_amount numeric, saving_type text, weight_or_pack text, price_per_unit text, offer_start_date text, offer_end_date text, global_validity_start text, global_validity_end text, confidence numeric, notes text[], extraction_quality text, extracted_at timestamp without time zone, chain_id uuid, flyer_id uuid)
 LANGUAGE sql
 STABLE
AS $function$
  WITH search_base AS (
    SELECT p.*,
           greatest(
             word_similarity(search_text, coalesce(p.product_name, '')),
             word_similarity(search_text, coalesce(p.brand, ''))
           ) AS fuzzy_score,
           CASE
             WHEN p.product_name ILIKE search_text || '%' OR p.brand ILIKE search_text || '%'
               THEN 1.0
             ELSE 0.0
           END AS prefix_score
    FROM products p
    WHERE search_text IS NOT NULL
      AND search_text <> ''
      AND (
        p.product_name ILIKE search_text || '%'
        OR p.brand ILIKE search_text || '%'
        OR word_similarity(search_text, coalesce(p.product_name, '')) >= 0.5
        OR word_similarity(search_text, coalesce(p.brand, '')) >= 0.5
      )
  ),
  ranked AS (
    SELECT *, greatest(prefix_score, fuzzy_score) AS score,
           row_number() OVER (
             PARTITION BY chain_id, flyer_id, lower(product_name)
             ORDER BY greatest(prefix_score, fuzzy_score) DESC,
                      discount_percent DESC NULLS LAST,
                      current_price ASC,
                      extracted_at DESC
           ) AS rn
    FROM search_base
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
    flyer_id
  FROM ranked
  WHERE rn = 1
  ORDER BY score DESC, discount_percent DESC NULLS LAST, current_price ASC;
$function$;
