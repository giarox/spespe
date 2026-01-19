
import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Load credentials
load_dotenv('.env.supabase')

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Missing Supabase credentials")
    exit(1)

# Initialize client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

try:
    # Sort by discount_percent ASC (numerically smallest first, e.g., -50.0 before -10.0)
    result = supabase.table('products').select('product_name, discount_percent').not_.is_('discount_percent', 'null').order('discount_percent').limit(10).execute()
    
    if result.data:
        print(f"Top 10 discounts (numerically smallest/best):")
        for row in result.data:
            print(f"- {row['product_name']}: {row['discount_percent']}")
    else:
        print("No products with discounts found.")
except Exception as e:
    print(f"Error executing query: {e}")
