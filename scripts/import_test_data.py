#!/usr/bin/env python3
"""
Import test data from CSV to Supabase products table.
"""

import os
import sys
import csv
from pathlib import Path
from supabase import create_client
from dotenv import load_dotenv

# Load credentials
load_dotenv('.env.supabase')

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def import_test_products():
    """Import a few test products manually"""
    print("\n📦 Importing test products...")
    
    # Test products from your ground truth
    test_products = [
        {
            "supermarket": "Lidl",
            "product_name": "Broccoli",
            "brand": None,
            "current_price": 0.89,
            "old_price": 1.29,
            "discount_percent": "-31%",
            "weight_or_pack": "500 g confezione",
            "price_per_unit": "1 kg = 1,78 €",
            "offer_start_date": "19/01",
            "offer_end_date": "25/01",
            "notes": ["Coltivato in Italia"],
            "confidence": 0.95
        },
        {
            "supermarket": "Lidl",
            "product_name": "Filetto di petto di pollo a fette",
            "brand": None,
            "current_price": 4.99,
            "old_price": 6.99,
            "discount_percent": "-28%",
            "saving_amount": 2.0,
            "saving_type": "absolute",
            "weight_or_pack": "650 g confezione",
            "price_per_unit": "1 kg = 7,68 €",
            "offer_start_date": "19/01",
            "offer_end_date": "25/01",
            "notes": ["Allevato in Italia"],
            "confidence": 0.82
        },
        {
            "supermarket": "Lidl",
            "product_name": "Porchetta affettata",
            "brand": "Dal Salumiere",
            "current_price": 1.59,
            "old_price": 2.39,
            "discount_percent": "-33%",
            "weight_or_pack": "120 g confezione",
            "price_per_unit": "1 kg = 13,25 €",
            "offer_start_date": "19/01",
            "offer_end_date": "25/01",
            "notes": ["Porchetta arrosto", "Cotta al forno"],
            "confidence": 0.93
        },
        {
            "supermarket": "Lidl",
            "product_name": "Frollini fior di grano",
            "brand": "Realforno",
            "current_price": 1.39,
            "old_price": 1.99,
            "discount_percent": "-30%",
            "weight_or_pack": "700 g confezione",
            "price_per_unit": "1 kg = 1,99 €",
            "offer_start_date": "19/01",
            "offer_end_date": "25/01",
            "confidence": 0.92
        },
        {
            "supermarket": "Lidl",
            "product_name": "Chiocciole di pasta fillo",
            "brand": "ERIDANOUS",
            "description": "Con ripieno ai porri e formaggio",
            "current_price": 2.99,
            "weight_or_pack": "4 x 170 g confezione",
            "price_per_unit": "1 kg = 4,40 €",
            "offer_start_date": "22/01",
            "offer_end_date": "25/01",
            "notes": ["da giovedì 22/01"],
            "confidence": 0.90
        }
    ]
    
    try:
        result = supabase.table('products').insert(test_products).execute()
        print(f"✅ Imported {len(test_products)} test products")
        return True
    except Exception as e:
        print(f"❌ Import failed: {e}")
        return False

def verify_data():
    """Verify imported data"""
    print("\n✓ Verifying imported data...")
    
    try:
        # Count products
        result = supabase.table('products').select('*').execute()
        count = len(result.data)
        print(f"  Total products: {count}")
        
        # Show first product
        if result.data:
            first = result.data[0]
            print(f"  Sample: {first['product_name']} - €{first['current_price']}")
        
        return True
    except Exception as e:
        print(f"❌ Verification failed: {e}")
        return False

if __name__ == '__main__':
    print("="*70)
    print("IMPORT TEST DATA TO SUPABASE")
    print("="*70)
    
    # Import test products
    if import_test_products():
        verify_data()
        print("\n✅ Database is ready for web app development!")
    else:
        print("\n❌ Import failed - check error messages above")
        sys.exit(1)
