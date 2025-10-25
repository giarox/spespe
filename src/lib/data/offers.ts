import { createServer } from "@/lib/supabase/server";
import type { OfferWithRelations } from "@/lib/supabase/types";

export async function fetchLatestOffers(limit = 10): Promise<OfferWithRelations[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("offers")
    .select(
      `*,
        product:products(*),
        store:stores(*,
          chain:chains(*)
        )`
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to fetch offers", error);
    return [];
  }

  return (data ?? []) as OfferWithRelations[];
}
