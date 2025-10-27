import "dotenv/config";

import sharp from "sharp";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createServiceClient } from "./lib/supabase";
import { logger } from "./lib/logger";
import type { Database, Json } from "../src/lib/database.types";

type Supabase = SupabaseClient<Database>;

const GEN_AI_KEY = process.env.GOOGLE_GEMINI_API_KEY;
if (!GEN_AI_KEY) {
  logger.error("gemini:missing-key", { message: "Set GOOGLE_GEMINI_API_KEY in the environment." });
  process.exit(1);
}

const DEFAULT_BATCH_SIZE = Number(process.env.LIDL_GEMINI_BATCH ?? 3);
const MAX_IMAGE_WIDTH = Number(process.env.LIDL_GEMINI_WIDTH ?? 1536);
const MODEL_NAME = process.env.LIDL_GEMINI_MODEL ?? "gemini-2.5-flash-lite-preview";

type FlyerPageRecord = Database["public"]["Tables"]["flyer_pages"]["Row"] & {
  flyer: {
    id: string;
    chain_id: string | null;
    period_start: string | null;
    period_end: string | null;
    viewer_url: string | null;
    source_url: string | null;
  } | null;
};

type GeminiOffer = {
  product_name: string | null;
  price: number | null;
  raw_text: string | null;
  bbox: {
    x: number | null;
    y: number | null;
    width: number | null;
    height: number | null;
  } | null;
  notes: string | null;
};

type GeminiResponse = {
  offers: GeminiOffer[];
};

const SYSTEM_PROMPT = `You are a precise data extractor. Output only valid JSON matching the response schema.
Rules:
1) Extract each product card’s MAIN price (the big one customers pay at checkout).
2) DO NOT return unit prices like “1 kg = …”, “al kg”, “/kg”, “al litro”, “al pezzo”.
3) Prefer the largest price typography near the product image. If multiple prices exist, choose the lowest visually emphasized price unless explicitly labeled “Lidl Plus” or “-XX%” — ignore labels and return the final checkout price.
4) Product name: 3–10 words, keep brand + noun phrase (e.g., “Milbona Edam a fette”). Don’t include weight/size unless it’s part of the name.
5) For each item, also return: the raw text snippet you relied on, and a coarse bounding box of the price region as percentages of the image width/height.
6) If uncertain, set fields to null and explain briefly via the "notes" field (max 20 words). Do not invent data.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    offers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          product_name: { type: ["string", "null"], minLength: 0 },
          price: { type: ["number", "null"] },
          raw_text: { type: ["string", "null"], minLength: 0 },
          bbox: {
            type: ["object", "null"],
            properties: {
              x: { type: ["number", "null"] },
              y: { type: ["number", "null"] },
              width: { type: ["number", "null"] },
              height: { type: ["number", "null"] },
            },
            required: ["x", "y", "width", "height"],
          },
          notes: { type: ["string", "null"], maxLength: 80 },
        },
        required: ["product_name", "price", "raw_text", "bbox", "notes"],
      },
    },
  },
  required: ["offers"],
};

const genAI = new GoogleGenerativeAI(GEN_AI_KEY);
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

async function fetchPendingPages(supabase: Supabase, limit: number) {
  logger.info("gemini:fetch:start", { limit });
  const response = await supabase
    .from("flyer_pages")
    .select("id, flyer_id, page_no, image_url, flyer:flyers(id, chain_id, period_start, period_end, viewer_url, source_url)")
    .not("image_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit * 4);

  if (response.error) {
    throw response.error;
  }

  const pages = (response.data ?? []) as FlyerPageRecord[];
  if (!pages.length) {
    logger.info("gemini:fetch:empty");
    return [];
  }

  const statusResponse = await supabase
    .from("flyer_page_processing")
    .select("flyer_page_id, status")
    .in(
      "flyer_page_id",
      pages.map((page) => page.id)
    );

  if (statusResponse.error) {
    throw statusResponse.error;
  }

  const statusMap = new Map<string, string | null>();
  (statusResponse.data ?? []).forEach((row) => {
    statusMap.set(row.flyer_page_id, row.status ?? null);
  });

  const candidates = pages
    .filter((page) => {
      const status = statusMap.get(page.id) ?? null;
      return !["ok", "processing", "empty", "skipped"].includes(status ?? "");
    })
    .slice(0, limit);

  if (!candidates.length) {
    logger.info("gemini:fetch:no-candidates");
    return [];
  }

  const lockPayload = candidates.map((page) => ({
    flyer_page_id: page.id,
    status: "processing",
    processed_at: new Date().toISOString(),
  }));
  const lockResponse = await supabase
    .from("flyer_page_processing")
    .upsert(lockPayload, { onConflict: "flyer_page_id" });
  if (lockResponse.error) {
    logger.warn("gemini:fetch:lock-error", { error: lockResponse.error.message });
  }

  logger.info("gemini:fetch:ok", {
    fetched: pages.length,
    candidates: candidates.length,
    candidate_ids: candidates.map((p) => p.id),
  });

  return candidates;
}

async function downloadAndPrepareImage(url: string): Promise<string> {
  logger.info("gemini:image:download", { url });
  const response = await fetch(url, { headers: { "User-Agent": "spespe-gemini/1.0" } });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching image`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const processed = await sharp(buffer)
    .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();
  return processed.toString("base64");
}

async function callGemini(base64Image: string): Promise<GeminiResponse> {
  const prompt = `Return JSON with an "offers" array following the provided schema. ${SYSTEM_PROMPT}`;

  const generationConfig = {
    temperature: 0.2,
    topP: 0.8,
    topK: 40,
    maxOutputTokens: 2048,
    responseMimeType: "application/json",
    responseSchema: RESPONSE_SCHEMA,
  } as const;

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: base64Image,
              mimeType: "image/jpeg",
            },
          },
        ],
      },
    ],
    generationConfig,
  });

  const text = result.response?.text();
  if (!text) {
    throw new Error("Empty response from Gemini");
  }

  try {
    const json = JSON.parse(text) as GeminiResponse;
    if (!json.offers || !Array.isArray(json.offers)) {
      throw new Error("Missing offers array");
    }
    return json;
  } catch (error) {
    logger.error("gemini:parse-error", { raw: text });
    throw error;
  }
}

function normaliseOffer(raw: GeminiOffer, page: FlyerPageRecord) {
  const productName = (raw.product_name ?? "").trim();
  const price = typeof raw.price === "number" && Number.isFinite(raw.price) ? raw.price : null;
  if (!productName || price === null) {
    return null;
  }

  const bbox = raw.bbox ?? { x: null, y: null, width: null, height: null };

  return {
    flyer_id: page.flyer_id,
    flyer_page_id: page.id,
    page_no: page.page_no,
    product_name: productName,
    price,
    currency: "EUR",
    brand: null,
    metadata: {
      raw_text: raw.raw_text,
      bbox,
      notes: raw.notes,
      source: "gemini",
    } satisfies Json,
  };
}

async function upsertRawOffers(
  supabase: Supabase,
  page: FlyerPageRecord,
  offers: ReturnType<typeof normaliseOffer>[]
) {
  // remove nulls
  const payload = offers.filter((offer): offer is NonNullable<typeof offer> => offer !== null);
  if (!payload.length) {
    return 0;
  }

  const deleteResponse = await supabase
    .from("flyer_page_offers_raw")
    .delete()
    .eq("flyer_page_id", page.id);
  if (deleteResponse.error) {
    logger.warn("gemini:delete-existing-error", {
      flyer_page_id: page.id,
      error: deleteResponse.error.message,
    });
  }

  const insertResponse = await supabase
    .from("flyer_page_offers_raw")
    .insert(payload);
  if (insertResponse.error) {
    throw insertResponse.error;
  }

  return payload.length;
}

async function markProcessing(
  supabase: Supabase,
  flyerPageId: string,
  status: string,
  offersFound: number,
  notes?: string
) {
  const response = await supabase
    .from("flyer_page_processing")
    .upsert(
      [
        {
          flyer_page_id: flyerPageId,
          processed_at: new Date().toISOString(),
          status,
          offers_found: offersFound,
          notes: notes ? notes.slice(0, 500) : null,
        },
      ],
      { onConflict: "flyer_page_id" }
    );

  if (response.error) {
    logger.error("gemini:processing-log-error", { flyer_page_id: flyerPageId, error: response.error.message });
  }
}

async function processPage(supabase: Supabase, page: FlyerPageRecord) {
  if (!page.flyer_id) {
    await markProcessing(supabase, page.id, "skipped", 0, "missing_flyer_id");
    return;
  }

  try {
    logger.info("gemini:page:start", { flyer_page_id: page.id, page_no: page.page_no });
    const base64Image = await downloadAndPrepareImage(page.image_url);
    const response = await callGemini(base64Image);

    const offers = response.offers
      .map((entry) => normaliseOffer(entry, page))
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    const inserted = await upsertRawOffers(supabase, page, offers);
    await markProcessing(supabase, page.id, inserted > 0 ? "ok" : "empty", inserted);
    logger.info("gemini:page:done", {
      flyer_page_id: page.id,
      offers_found: inserted,
      sample_offers: offers.slice(0, 2).map((offer) => ({ product_name: offer.product_name, price: offer.price })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markProcessing(supabase, page.id, "failed", 0, message);
    logger.error("gemini:page:error", {
      flyer_page_id: page.id,
      error: message,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

async function main() {
  const supabase = createServiceClient();
  const cliLimitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  const limit = cliLimitArg ? Number(cliLimitArg.split("=")[1]) : DEFAULT_BATCH_SIZE;
  const batchSize = Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_BATCH_SIZE;

  try {
    while (true) {
      const pages = await fetchPendingPages(supabase, batchSize);
      if (!pages.length) {
        logger.info("gemini:queue-empty");
        break;
      }

      for (const page of pages) {
        await processPage(supabase, page);
      }
    }
  } catch (error) {
    logger.error("gemini:fatal", { error: error instanceof Error ? error.stack : String(error) });
    process.exit(1);
  }
}

main();
