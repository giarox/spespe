-- Migration: Convert discount_percent from TEXT to DECIMAL for better sorting
-- Created at: 2026-01-19 12:00:00

BEGIN;

-- Drop the view that depends on the column
DROP VIEW IF EXISTS shopping_lists_view;

-- Change the column type, stripping the '%' character
ALTER TABLE products 
ALTER COLUMN discount_percent TYPE DECIMAL(5,2) 
USING (NULLIF(TRIM(TRAILING '%' FROM discount_percent), '')::DECIMAL);

-- Recreate the view
CREATE VIEW shopping_lists_view AS
 SELECT shopping_lists.id AS list_id,
    shopping_lists.product_id,
    shopping_lists.quantity,
    shopping_lists.checked,
    shopping_lists.added_at,
    products.id,
    products.supermarket,
    products.retailer,
    products.product_name,
    products.brand,
    products.description,
    products.current_price,
    products.old_price,
    products.discount_percent,
    products.saving_amount,
    products.saving_type,
    products.weight_or_pack,
    products.price_per_unit,
    products.offer_start_date,
    products.offer_end_date,
    products.global_validity_start,
    products.global_validity_end,
    products.confidence,
    products.notes,
    products.extraction_quality,
    products.extracted_at
   FROM (shopping_lists
     JOIN products ON ((products.id = shopping_lists.product_id)));

-- Update the comment to reflect the new type
COMMENT ON COLUMN products.discount_percent IS 'Discount percentage as a negative number (e.g., -31.00)';

-- Recreate the index for optimal sorting
-- Using ASC because larger discounts (e.g., -50.00) are numerically smaller than -10.00
DROP INDEX IF EXISTS idx_products_discount;
CREATE INDEX idx_products_discount ON products(discount_percent ASC NULLS LAST);

COMMIT;

-- rollback:
-- BEGIN;
-- ALTER TABLE products ALTER COLUMN discount_percent TYPE TEXT USING (CASE WHEN discount_percent IS NOT NULL THEN discount_percent::TEXT || '%' ELSE NULL END);
-- COMMENT ON COLUMN products.discount_percent IS 'Discount percentage (e.g., -31%)';
-- DROP INDEX IF EXISTS idx_products_discount;
-- CREATE INDEX idx_products_discount ON products(discount_percent DESC NULLS LAST);
-- COMMIT;
