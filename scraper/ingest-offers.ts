import "dotenv/config";

import { createServiceClient } from "./lib/supabase";
import { logger } from "./lib/logger";
import type { Database } from "../src/lib/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type Supabase = SupabaseClient<Database>;

type RawOfferRow = Database["public"]["Tables"]["flyer_page_offers_raw"]["Row"] & {
  flyer: {
    id: string;
    chain_id: string | null;
    viewer_url: string | null;
    source_url: string | null;
    period_start: string | null;
    period_end: string | null;
  } | null;
  flyer_page: {
    image_url: string;
  } | null;
};

const DEFAULT_BATCH_SIZE = Number(process.env.LIDL_INGEST_BATCH ?? 50);

function cleanProductName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

function parseDiscount(metadata: RawOfferRow["metadata"]): {
  discount_type: string | null;
} {
  if (!metadata || typeof metadata !== "object") return { discount_type: null };
  const discountText = (metadata as Record<string, unknown>)["discount_text"];
  if (typeof discountText === "string" && discountText.trim()) {
    return { discount_type: discountText.trim().slice(0, 120) };
  }
  return { discount_type: null };
}

async function fetchPendingOffers(supabase: Supabase, limit: number) {
  const response = await supabase
    .from("flyer_page_offers_raw")
    .select(
      `
      *,
      flyer:flyers(id, chain_id, viewer_url, source_url, period_start, period_end),
      flyer_page:flyer_pages(image_url)
    `
    )
    .is("ingested_offer_id", null)
    .order("detected_at", { ascending: true })
    .limit(limit);

  if (response.error) {
    throw response.error;
  }

  return (response.data ?? []) as RawOfferRow[];
}

async function markIngested(
  supabase: Supabase,
  rawId: string,
  offerId: string | null,
  notes: { status: string; reason?: string } = { status: "ok" }
) {
  const updateResponse = await supabase
    .from("flyer_page_offers_raw")
    .update({
      ingested_offer_id: offerId,
      ingested_at: new Date().toISOString(),
    })
    .eq("id", rawId);

  if (updateResponse.error) {
    logger.error("ingest:update-error", { raw_offer_id: rawId, error: updateResponse.error.message });
  }
}

async function upsertOffer(
  supabase: Supabase,
  raw: RawOfferRow
): Promise<string | null> {
  if (!raw.flyer_id || !raw.flyer) {
    await markIngested(supabase, raw.id, null, { status: "skipped", reason: "missing_flyer" });
    logger.warn("ingest:skip:no-flyer", { raw_offer_id: raw.id });
    return null;
  }

  const productName = cleanProductName(raw.product_name);
  if (!productName) {
    await markIngested(supabase, raw.id, null, { status: "skipped", reason: "empty_name" });
    logger.warn("ingest:skip:empty-name", { raw_offer_id: raw.id });
    return null;
  }

  const discount = parseDiscount(raw.metadata);

  const payload = {
    flyer_id: raw.flyer_id,
    chain_id: raw.flyer.chain_id,
    product_name: productName,
    brand: raw.brand,
    price: raw.price,
    original_price: null,
    discount_type: discount.discount_type,
    discount_value: null,
    valid_from: raw.flyer.period_start,
    valid_to: raw.flyer.period_end,
    source_url: raw.flyer.viewer_url ?? raw.flyer.source_url,
    image_url: raw.flyer_page?.image_url ?? null,
    store_id: null,
  };

  const upsertResponse = await supabase
    .from("offers")
    .upsert([payload], { onConflict: "flyer_id,product_name,price" })
    .select("id")
    .single();

  if (upsertResponse.error) {
    logger.error("ingest:upsert-error", {
      raw_offer_id: raw.id,
      error: upsertResponse.error.message,
    });
    throw upsertResponse.error;
  }

  return upsertResponse.data?.id ?? null;
}

async function main() {
  const supabase = createServiceClient();
  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  const batchSize = limitArg ? Number(limitArg.split("=")[1]) : DEFAULT_BATCH_SIZE;
  const limit = Number.isFinite(batchSize) && batchSize > 0 ? batchSize : DEFAULT_BATCH_SIZE;

  logger.info("ingest:start", { limit });

  const rows = await fetchPendingOffers(supabase, limit);
  if (!rows.length) {
    logger.info("ingest:queue-empty");
    return;
  }

  let ingested = 0;
  for (const row of rows) {
    logger.info("ingest:row", { raw_offer_id: row.id, product_name: row.product_name, flyer_id: row.flyer_id });
    try {
      const offerId = await upsertOffer(supabase, row);
      await markIngested(supabase, row.id, offerId, { status: "ok" });
      if (offerId) {
        ingested += 1;
        logger.info("ingest:row:ok", { raw_offer_id: row.id, offer_id: offerId });
      }
    } catch (error) {
      await markIngested(supabase, row.id, null, {
        status: "failed",
        reason: error instanceof Error ? error.message : String(error),
      });
      logger.error("ingest:row:error", {
        raw_offer_id: row.id,
        error: error instanceof Error ? error.stack : String(error),
      });
    }
  }

  logger.info("ingest:completed", { processed: rows.length, ingested });
}

main().catch((error) => {
  logger.error("ingest:fatal", { error: error instanceof Error ? error.stack : String(error) });
  process.exit(1);
});
