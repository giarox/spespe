
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
    result = supabase.table('products').select('product_name, brand').eq('supermarket', 'Eurospin').limit(10).execute()
    
    if result.data:
        print(f"Found {len(result.data)} products:")
        for row in result.data:
            print(f"- {row['product_name']} ({row['brand'] or 'N/A'})")
    else:
        print("No products found for Eurospin.")
except Exception as e:
    print(f"Error executing query: {e}")
