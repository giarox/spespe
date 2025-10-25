import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/database.types";
import type { FlyerCandidate, PageImage } from "./types";
import { hashString } from "./hash";

type Supabase = SupabaseClient<Database>;

const chainCache = new Map<string, string>();

async function ensureChainId(supabase: Supabase, chainName: string) {
  if (chainCache.has(chainName)) {
    return chainCache.get(chainName)!;
  }
  const { data, error } = await supabase
    .from("chains")
    .select("id")
    .eq("name", chainName)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    const { data: inserted, error: insertError } = await supabase
      .from("chains")
      .insert({ name: chainName })
      .select("id")
      .single();
    if (insertError) {
      throw insertError;
    }
    chainCache.set(chainName, inserted.id);
    return inserted.id;
  }
  chainCache.set(chainName, data.id);
  return data.id;
}

export async function persistFlyerRun(options: {
  supabase: Supabase;
  chainName: string;
  flyer: FlyerCandidate;
  pages: PageImage[];
  vendor: string;
}) {
  const { supabase, chainName, flyer, pages, vendor } = options;
  const chainId = await ensureChainId(supabase, chainName);
  const publicationId = flyer.publicationId ?? hashString(flyer.url);
  const nowIso = new Date().toISOString();

  const flyerPayload = {
    chain_id: chainId,
    vendor,
    viewer_url: flyer.url,
    source_url: flyer.url,
    fetched_at: nowIso,
    period_start: flyer.periodStart ?? null,
    period_end: flyer.periodEnd ?? null,
    publication_id: publicationId,
  };

  const { data: flyerRow, error: flyerError } = await supabase
    .from("flyers")
    .upsert(flyerPayload, { onConflict: "publication_id" })
    .select("id")
    .single();
  if (flyerError) {
    throw flyerError;
  }

  if (pages.length > 0) {
    const pageRows = pages.map((page) => ({
      flyer_id: flyerRow.id,
      page_no: page.pageNo,
      image_url: page.imageUrl,
      image_hash: page.imageHash ?? hashString(page.imageUrl),
      width: page.width ?? null,
      height: page.height ?? null,
    }));
    const { error: pagesError } = await supabase
      .from("flyer_pages")
      .upsert(pageRows, { onConflict: "flyer_id,page_no" });
    if (pagesError) {
      throw pagesError;
    }
  }

  const { error: runError } = await supabase.from("flyer_runs").insert({
    chain_id: chainId,
    flyer_id: flyerRow.id,
    vendor,
    status: "completed",
    pages_processed: pages.length,
    offers_detected: 0,
    finished_at: nowIso,
  });
  if (runError) {
    throw runError;
  }
}
