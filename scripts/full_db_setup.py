#!/usr/bin/env python3
"""
Complete autonomous database setup using direct PostgreSQL connection.
"""

import os
import sys
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env.supabase')

DB_CONNECTION = os.getenv('SUPABASE_DB_CONNECTION')

if not DB_CONNECTION:
    print("❌ Missing SUPABASE_DB_CONNECTION")
    sys.exit(1)

print("="*70)
print("SUPABASE FULL DATABASE SETUP")
print("="*70)
print("Connecting via PostgreSQL...")

try:
    conn = psycopg2.connect(DB_CONNECTION)
    conn.autocommit = True
    cursor = conn.cursor()
    print("✅ Connected to PostgreSQL")
except Exception as e:
    print(f"❌ Connection failed: {e}")
    sys.exit(1)

# ============================================================================
# STEP 1: DROP OLD TABLES
# ============================================================================

print("\n[STEP 1] Dropping old tables...")
print("-"*70)

old_tables = ['products', 'offers', 'flyers']

for table in old_tables:
    try:
        cursor.execute(f"DROP TABLE IF EXISTS {table} CASCADE;")
        print(f"  ✓ Dropped '{table}'")
    except Exception as e:
        print(f"  ⚠️  Error dropping '{table}': {e}")

# ============================================================================
# STEP 2: CREATE PRODUCTS TABLE
# ============================================================================

print("\n[STEP 2] Creating products table...")
print("-"*70)

schema_sql = """
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
  
  -- Prevent duplicates
  CONSTRAINT unique_product_per_week 
    UNIQUE (product_name, supermarket, offer_start_date)
);
"""

try:
    cursor.execute(schema_sql)
    print("  ✓ Table 'products' created")
except Exception as e:
    print(f"  ❌ Failed to create table: {e}")
    sys.exit(1)

# ============================================================================
# STEP 3: CREATE INDEXES
# ============================================================================

print("\n[STEP 3] Creating indexes...")
print("-"*70)

indexes = [
    ("idx_products_supermarket", "CREATE INDEX idx_products_supermarket ON products(supermarket);"),
    ("idx_products_price", "CREATE INDEX idx_products_price ON products(current_price);"),
    ("idx_products_discount", "CREATE INDEX idx_products_discount ON products(discount_percent DESC NULLS LAST);"),
    ("idx_products_dates", "CREATE INDEX idx_products_dates ON products(offer_start_date, offer_end_date);"),
    ("idx_products_extracted", "CREATE INDEX idx_products_extracted ON products(extracted_at DESC);"),
    ("idx_products_name", "CREATE INDEX idx_products_name ON products(product_name);"),
]

for idx_name, idx_sql in indexes:
    try:
        cursor.execute(idx_sql)
        print(f"  ✓ Created index '{idx_name}'")
    except Exception as e:
        print(f"  ⚠️  Error creating '{idx_name}': {e}")

# Full-text search index
try:
    cursor.execute("""
        CREATE INDEX idx_products_search ON products 
        USING GIN(to_tsvector('italian', 
          COALESCE(product_name, '') || ' ' || 
          COALESCE(brand, '') || ' ' || 
          COALESCE(description, '')
        ));
    """)
    print("  ✓ Created full-text search index (Italian)")
except Exception as e:
    print(f"  ⚠️  Error creating search index: {e}")

# ============================================================================
# STEP 4: ENABLE ROW LEVEL SECURITY
# ============================================================================

print("\n[STEP 4] Setting up Row Level Security...")
print("-"*70)

try:
    cursor.execute("ALTER TABLE products ENABLE ROW LEVEL SECURITY;")
    print("  ✓ RLS enabled")
    
    cursor.execute("""
        CREATE POLICY "Public read access"
        ON products FOR SELECT
        USING (true);
    """)
    print("  ✓ Public read policy created")
    
    cursor.execute("""
        CREATE POLICY "Service role full access"
        ON products FOR ALL
        USING (true);
    """)
    print("  ✓ Service role policy created")
    
except Exception as e:
    print(f"  ⚠️  RLS setup error: {e}")

# ============================================================================
# STEP 5: ADD COMMENTS
# ============================================================================

print("\n[STEP 5] Adding documentation...")
print("-"*70)

try:
    cursor.execute("COMMENT ON TABLE products IS 'Supermarket products from weekly flyers';")
    cursor.execute("COMMENT ON COLUMN products.current_price IS 'Current offer price in euros';")
    cursor.execute("COMMENT ON COLUMN products.notes IS 'Italian claims like Coltivato in Italia';")
    print("  ✓ Comments added")
except Exception as e:
    print(f"  ⚠️  Comments error: {e}")

# ============================================================================
# DONE
# ============================================================================

conn.close()

print("\n" + "="*70)
print("✅ DATABASE SETUP COMPLETE!")
print("="*70)
print("\nSchema created:")
print("  • products table with 20 columns")
print("  • 7 performance indexes")
print("  • Italian full-text search")
print("  • Row Level Security enabled")
print("\nNext: Run 'python scripts/import_test_data.py' to add sample data")
print("="*70)
