import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/database.types";

export function createServiceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE env vars");
  }

  return createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
}
