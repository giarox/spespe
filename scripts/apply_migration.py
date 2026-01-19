#!/usr/bin/env python3
import os
import sys
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env.supabase')

DB_PWD = os.getenv('SUPABASE_DB_PASSWORD')
PROJECT_ID = os.getenv('SUPABASE_PROJECT_ID')
DB_HOST = f"db.{PROJECT_ID}.supabase.co"
DB_NAME = "postgres"
DB_USER = "postgres"
DB_PORT = "5432"

if not DB_PWD or not PROJECT_ID:
    print("❌ Missing Supabase credentials")
    sys.exit(1)

connection_string = f"postgresql://{DB_USER}:{DB_PWD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

def apply_migration(file_path):
    print(f"Applying migration: {file_path}")
    try:
        with open(file_path, 'r') as f:
            sql = f.read()
        
        conn = psycopg2.connect(connection_string)
        conn.autocommit = False # Handle transactions in SQL if needed, or here
        cur = conn.cursor()
        
        cur.execute(sql)
        conn.commit()
        
        cur.close()
        conn.close()
        print("✅ Migration applied successfully!")
        return True
    except Exception as e:
        print(f"❌ Failed to apply migration: {e}")
        if 'conn' in locals() and conn:
            conn.rollback()
        return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/apply_migration.py path/to/migration.sql")
        sys.exit(1)
    
    success = apply_migration(sys.argv[1])
    sys.exit(0 if success else 1)
