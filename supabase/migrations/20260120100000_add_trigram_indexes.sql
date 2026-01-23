-- Migration: Add trigram indexes for fuzzy search optimization
-- Created at: 2026-01-20 10:00:00

BEGIN;

-- Enable pg_trgm extension for trigram-based similarity searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create trigram indexes for product_name and brand
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_name_trgm
  ON products USING GIN (product_name gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_brand_trgm
  ON products USING GIN (brand gin_trgm_ops);

-- rollback:
-- DROP INDEX IF EXISTS idx_products_brand_trgm;
-- DROP INDEX IF EXISTS idx_products_name_trgm;
-- DROP EXTENSION IF EXISTS pg_trgm;

COMMIT;