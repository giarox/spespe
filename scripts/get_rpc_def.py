import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env.supabase')
conn_str = os.getenv('SUPABASE_DB_CONNECTION')

conn = psycopg2.connect(conn_str)
cur = conn.cursor()

cur.execute("""
    SELECT pg_get_functiondef(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'search_products';
""")

row = cur.fetchone()
if row:
    print(row[0])
else:
    print("Function not found")

cur.close()
conn.close()
