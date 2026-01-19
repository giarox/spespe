import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env.supabase')
conn_str = os.getenv('SUPABASE_DB_CONNECTION')

conn = psycopg2.connect(conn_str)
cur = conn.cursor()

cur.execute("""
    SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
    FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='products';
""")

rows = cur.fetchall()
for row in rows:
    print(row)

cur.close()
conn.close()
