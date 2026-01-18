#!/usr/bin/env python3
"""
Import CSV products to Supabase database.
Handles weekly updates with historical data preservation.
"""

import os
import sys
import csv
from pathlib import Path
from datetime import datetime
from supabase import create_client
from dotenv import load_dotenv

# Load credentials
load_dotenv('.env.supabase')

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Missing Supabase credentials")
    print("Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables")
    sys.exit(1)

# Initialize Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print("="*70)
print("IMPORT CSV TO SUPABASE")
print("="*70)
print(f"Database: {SUPABASE_URL}")
print(f"Using service role for full access")
print("="*70)

def parse_csv_value(value):
    """Parse CSV value, handling empty strings as None"""
    if value == '' or value is None:
        return None
    return value

def parse_notes(notes_str):
    """Convert pipe-separated notes to array"""
    if not notes_str:
        return None
    # Split by pipe and clean
    notes = [n.strip() for n in notes_str.split('|') if n.strip()]
    return notes if notes else None

def import_csv_to_database(csv_path):
    """
    Import CSV file to Supabase products table.
    
    Strategy:
    - Each week is a separate import (preserves history)
    - Unique constraint on (product_name, supermarket, offer_start_date)
    - Duplicates within same week are skipped
    - Chain/flyer IDs are added when available
    """
    print(f"\n📂 Reading CSV: {csv_path}")
    
    if not Path(csv_path).exists():
        print(f"❌ CSV file not found: {csv_path}")
        return False
    
    products_to_insert = []
    chain_id = None
    flyer_id = None

    chain_response = (
        supabase.table('chains')
        .select('id')
        .eq('name', os.getenv('SPOTTER_CHAIN') or 'Lidl')
        .limit(1)
        .execute()
    )
    if chain_response.data and isinstance(chain_response.data[0], dict):
        chain_id = chain_response.data[0].get('id')

    if chain_id:
        flyer_response = (
            supabase.table('flyers')
            .select('id')
            .eq('chain_id', chain_id)
            .eq('valid_from', os.getenv('SPOTTER_FLYER_DATE'))
            .limit(1)
            .execute()
        )
        if flyer_response.data and isinstance(flyer_response.data[0], dict):
            flyer_id = flyer_response.data[0].get('id')
    
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            for row_num, row in enumerate(reader, 1):
                # Map CSV columns to Supabase schema
                product = {
                    "supermarket": parse_csv_value(row.get("supermarket")),
                    "retailer": parse_csv_value(row.get("retailer")),
                    "product_name": parse_csv_value(row.get("product_name")),
                    "brand": parse_csv_value(row.get("brand")),
                    "description": parse_csv_value(row.get("description")),
                    "current_price": float(row["current_price"]) if row.get("current_price") else None,
                    "old_price": float(row["old_price"]) if row.get("old_price") else None,
                    "discount_percent": parse_csv_value(row.get("discount_percent")),
                    "saving_amount": float(row["saving_amount"]) if row.get("saving_amount") else None,
                    "saving_type": parse_csv_value(row.get("saving_type")),
                    "weight_or_pack": parse_csv_value(row.get("weight_or_pack")),
                    "price_per_unit": parse_csv_value(row.get("price_per_unit")),
                    "offer_start_date": parse_csv_value(row.get("offer_start_date")),
                    "offer_end_date": parse_csv_value(row.get("offer_end_date")),
                    "global_validity_start": parse_csv_value(row.get("global_validity_start")),
                    "global_validity_end": parse_csv_value(row.get("global_validity_end")),
                    "confidence": float(row["confidence"]) if row.get("confidence") else None,
                    "notes": parse_notes(row.get("notes")),
                    "extraction_quality": parse_csv_value(row.get("extraction_quality")),
                    "chain_id": chain_id,
                    "flyer_id": flyer_id,
                }
                
                products_to_insert.append(product)
                
                if row_num % 100 == 0:
                    print(f"  📖 Parsed {row_num} rows...")
        
        print(f"✅ Parsed {len(products_to_insert)} products from CSV")
        
        # Deduplicate products based on unique key (product_name, supermarket, offer_start_date)
        # Keep the product with highest confidence if duplicates exist
        seen = {}
        for product in products_to_insert:
            key = (product['product_name'], product['supermarket'], product['offer_start_date'])
            if key not in seen:
                seen[key] = product
            else:
                # Keep the product with higher confidence
                if product.get('confidence', 0) > seen[key].get('confidence', 0):
                    seen[key] = product
        
        products_to_insert = list(seen.values())
        print(f"✅ Deduplicated to {len(products_to_insert)} unique products")
        
    except Exception as e:
        print(f"❌ Failed to read CSV: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Insert to Supabase in batches
    print(f"\n💾 Inserting to Supabase...")
    
    BATCH_SIZE = 100
    total_inserted = 0
    total_errors = 0
    
    for i in range(0, len(products_to_insert), BATCH_SIZE):
        batch = products_to_insert[i:i+BATCH_SIZE]
        batch_num = (i // BATCH_SIZE) + 1
        total_batches = (len(products_to_insert) + BATCH_SIZE - 1) // BATCH_SIZE
        
        try:
            # Use upsert to handle duplicates (updates existing based on unique constraint)
            result = supabase.table('products').upsert(
                batch,
                on_conflict='product_name,supermarket,offer_start_date'
            ).execute()
            
            total_inserted += len(batch)
            print(f"  ✅ Batch {batch_num}/{total_batches}: Inserted {len(batch)} products")
            
        except Exception as e:
            total_errors += len(batch)
            print(f"  ❌ Batch {batch_num}/{total_batches} failed: {e}")
            
            # Log detailed error for debugging
            print(f"     First product in failed batch: {batch[0]['product_name']}")
            import traceback
            traceback.print_exc()
    
    print(f"\n{'='*70}")
    print(f"IMPORT COMPLETE")
    print(f"{'='*70}")
    print(f"Total products: {len(products_to_insert)}")
    print(f"Successfully inserted: {total_inserted}")
    print(f"Errors: {total_errors}")
    print(f"{'='*70}")
    
    return total_errors == 0

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python scripts/import_to_supabase.py path/to/products.csv")
        sys.exit(1)
    
    csv_path = sys.argv[1]
    success = import_csv_to_database(csv_path)
    
    sys.exit(0 if success else 1)
