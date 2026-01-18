#!/usr/bin/env python3
"""
Supabase administration script.
Manages database cleanup, schema creation, and data operations.
"""

import os
import sys
import csv
from pathlib import Path
from supabase import create_client, Client
from dotenv import load_dotenv

# Load credentials
load_dotenv('.env.supabase')

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Missing Supabase credentials")
    sys.exit(1)

# Initialize client with service role (full access)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print("="*70)
print("SUPABASE ADMIN - Database Management")
print("="*70)
print(f"Project URL: {SUPABASE_URL}")
print(f"Access Level: Service Role (Full Admin)")
print("="*70)

# ============================================================================
# STEP 1: AUDIT CURRENT STATE
# ============================================================================

print("\n[STEP 1] Auditing current database state...")
print("-"*70)

# Check existing tables
common_tables = ['products', 'items', 'deals', 'offers', 'flyers', 'test', 'users', 'shopping_lists']

found_tables = []
for table in common_tables:
    try:
        result = supabase.table(table).select('id').limit(1).execute()
        # If successful, count rows
        count_result = supabase.table(table).select('*').execute()
        count = len(count_result.data)
        found_tables.append((table, count))
        print(f"  ✓ Found '{table}': {count} rows")
    except Exception as e:
        if 'could not find' not in str(e).lower():
            print(f"  ⚠️  Error checking '{table}': {e}")

if not found_tables:
    print("  ℹ️  No tables found - database is empty")
else:
    print(f"\n📊 Summary: {len(found_tables)} tables found")

# ============================================================================
# STEP 2: CLEAN UP OLD DATA
# ============================================================================

print("\n[STEP 2] Cleaning up old test data...")
print("-"*70)

tables_to_clean = ['offers', 'flyers']

for table in tables_to_clean:
    try:
        # Try to delete all rows
        result = supabase.table(table).delete().gte('id', 0).execute()
        print(f"  ✓ Cleaned '{table}' table")
    except Exception as e:
        if 'could not find' in str(e).lower():
            print(f"  ℹ️  Table '{table}' doesn't exist - skipping")
        else:
            print(f"  ⚠️  Error cleaning '{table}': {e}")

# Clear old products data
try:
    result = supabase.table('products').delete().gte('id', 0).execute()
    print(f"  ✓ Cleared old 'products' data")
except Exception as e:
    if 'could not find' in str(e).lower():
        print(f"  ℹ️  Products table doesn't exist yet")
    else:
        print(f"  ⚠️  Error clearing products: {e}")

# ============================================================================
# STEP 3: SHOW SQL FOR TABLE CREATION
# ============================================================================

print("\n[STEP 3] Production schema SQL...")
print("-"*70)
print("\n⚠️  Please run this SQL in Supabase SQL Editor:")
print("📍 URL: https://supabase.com/dashboard/project/jttjtsnosmptxzwfhoig/sql/new")
print("\n" + "="*70)

sql = """-- Drop old tables
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS offers CASCADE;
DROP TABLE IF EXISTS flyers CASCADE;

-- Create production products table
CREATE TABLE products (
  id BIGSERIAL PRIMARY KEY,
  
  -- Supermarket info
  supermarket TEXT NOT NULL,
  retailer TEXT,
  
  -- Product details
  product_name TEXT NOT NULL,
  brand TEXT,
  description TEXT,
  
  -- Pricing
  current_price DECIMAL(10,2) NOT NULL,
  old_price DECIMAL(10,2),
  discount_percent TEXT,
  saving_amount DECIMAL(10,2),
  saving_type TEXT,
  
  -- Measurements  
  weight_or_pack TEXT,
  price_per_unit TEXT,
  
  -- Dates
  offer_start_date TEXT,
  offer_end_date TEXT,
  global_validity_start TEXT,
  global_validity_end TEXT,
  
  -- Metadata
  confidence DECIMAL(3,2),
  notes TEXT[],
  extraction_quality TEXT,
  extracted_at TIMESTAMP DEFAULT NOW(),
  
  -- Prevent duplicates within same week
  CONSTRAINT unique_product_per_week 
    UNIQUE (product_name, supermarket, offer_start_date)
);

-- Performance indexes
CREATE INDEX idx_products_supermarket ON products(supermarket);
CREATE INDEX idx_products_price ON products(current_price);
CREATE INDEX idx_products_discount ON products(discount_percent DESC NULLS LAST);
CREATE INDEX idx_products_dates ON products(offer_start_date, offer_end_date);
CREATE INDEX idx_products_extracted ON products(extracted_at DESC);
CREATE INDEX idx_products_name ON products(product_name);

-- Full-text search (Italian language)
CREATE INDEX idx_products_search ON products 
  USING GIN(to_tsvector('italian', 
    COALESCE(product_name, '') || ' ' || 
    COALESCE(brand, '') || ' ' || 
    COALESCE(description, '')
  ));

-- Row Level Security (anyone can read)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access"
  ON products FOR SELECT
  USING (true);

CREATE POLICY "Service role full access"
  ON products FOR ALL
  USING (true);

-- Add helpful comment
COMMENT ON TABLE products IS 'Supermarket products captured from weekly flyers';
COMMENT ON COLUMN products.current_price IS 'Current offer price in euros';
COMMENT ON COLUMN products.discount_percent IS 'Discount percentage (e.g., -31%)';
COMMENT ON COLUMN products.notes IS 'Italian claims like Coltivato in Italia';
"""

print(sql)
print("="*70)

print("\n✅ After running the SQL, come back and I'll import test data!")
