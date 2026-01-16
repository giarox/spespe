#!/usr/bin/env python3
"""
Direct PostgreSQL connection to execute SQL for database setup.
"""

import os
import sys
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env.supabase')

# Supabase PostgreSQL connection string format:
# postgresql://postgres:[YOUR-PASSWORD]@db.jttjtsnosmptxzwfhoig.supabase.co:5432/postgres

SUPABASE_PROJECT_ID = os.getenv('SUPABASE_PROJECT_ID')

print("="*70)
print("SUPABASE DATABASE SETUP")
print("="*70)

# We need the database password to connect via PostgreSQL
print("\n⚠️  To execute SQL directly, I need the database password.")
print("\nYou can find it at:")
print("  https://supabase.com/dashboard/project/jttjtsnosmptxzwfhoig/settings/database")
print("\nLook for 'Database Password' or 'Connection String'")
print("\nOnce you have it, add to .env.supabase:")
print("  SUPABASE_DB_PASSWORD=your-password-here")
print("\nThen I can execute SQL autonomously!")
print("\n" + "="*70)
print("\nAlternatively, you can run the SQL manually (2 minutes):")
print("  1. Go to SQL Editor in Supabase dashboard")
print("  2. Run scripts/supabase_admin.py to see the SQL")
print("  3. Copy/paste and execute")
print("  4. Then run: python scripts/import_test_data.py")
print("="*70)
