import "dotenv/config";

import sharp from "sharp";
import { createWorker, PSM, type Line, type RecognizeResult } from "tesseract.js";
import { SupabaseClient } from "@supabase/supabase-js";

function withTimeout<T>(promise: Promise<T>, ms: number, context: Record<string, unknown>): Promise<T> {
  let timer: NodeJS.Timeout;
  return Promise.race([
    promise.finally(() => clearTimeout(timer))
  , new Promise<T>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Timeout after ${ms}ms`));
      }, ms);
    })
  ]).catch((error) => {
    logger.error("ocr:timeout", { ...context, error: error instanceof Error ? error.message : String(error) });
    throw error;
  });
}

import { createServiceClient } from "./lib/supabase";
import { logger } from "./lib/logger";
import type { Database, Json } from "../src/lib/database.types";

type Supabase = SupabaseClient<Database>;

type FlyerPageRecord = {
  id: string;
  flyer_id: string | null;
  page_no: number;
  image_url: string;
  flyer: { id: string; chain_id: string | null } | null;
};

type ExtractedOffer = {
  productName: string;
  price: number;
  brand: string | null;
  lines: string[];
  priceLine: string;
  bbox: Line["bbox"];
  discountText: string | null;
};

const OCR_LANGS = process.env.LIDL_OCR_LANGS ?? "eng";

const PRICE_REGEX = /(?:€|\b)\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\b/;
const DISCOUNT_REGEX = /\b(sconto|offerta|risparmio|promo|-\d{1,2}%|\d{1,2}%|\d+x\d+)\b/i;
const DEFAULT_BATCH_SIZE = Number(process.env.LIDL_OCR_BATCH ?? 3);

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function parsePrice(raw: string): number | null {
  if (!raw) return null;
  const sanitized = raw.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
  const value = Number.parseFloat(sanitized);
  return Number.isFinite(value) ? value : null;
}

function deriveBrand(line: string | undefined): string | null {
  if (!line) return null;
  const tokens = line.split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  const candidate = tokens[0]!;
  if (candidate.length >= 2 && candidate === candidate.toUpperCase()) {
    return candidate;
  }
  return null;
}

function normalizeProductName(name: string): string {
  return normalizeWhitespace(
    name
      .replace(/\s*€[\d.,]+\s*/g, " ")
      .replace(/\b(OFFERTA|SCONTO|RISPARMIO|PROMO)\b/gi, " ")
  );
}

function offerKey(name: string, price: number): string {
  return `${name.toLowerCase()}|${price.toFixed(2)}`;
}

async function downloadImage(url: string): Promise<Buffer> {
  logger.info("ocr:download:start", { url });
  const response = await withTimeout(
    fetch(url, { headers: { "User-Agent": "spespe-ocr/1.0" } }),
    30_000,
    { stage: "download", url }
  );
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching ${url}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  logger.info("ocr:download:ok", { url, size: arrayBuffer.byteLength });
  return Buffer.from(arrayBuffer);
}

async function preprocessImage(buffer: Buffer): Promise<Buffer> {
  logger.info("ocr:preprocess:start", { size: buffer.length });
  const out = await sharp(buffer)
    .resize({ width: 1600, withoutEnlargement: true })
    .greyscale()
    .normalise()
    .sharpen()
    .toBuffer();
  logger.info("ocr:preprocess:ok", { size: out.length });
  return out;
}

async function createOcrWorker() {
  const worker = await createWorker();
  logger.info("ocr:worker:reinitialize", { langs: OCR_LANGS });
  await withTimeout(worker.reinitialize(OCR_LANGS), 60_000, { stage: "reinitialize", langs: OCR_LANGS });
  logger.info("ocr:worker:reinitialize:ok", { langs: OCR_LANGS });
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.AUTO,
    preserve_interword_spaces: "1",
  });
  return worker;
}

function extractOffers(data: RecognizeResult["data"]): ExtractedOffer[] {
  const groups = new Map<string, Line[]>();
  for (const line of data.lines ?? []) {
    const key = `${line.block_num}-${line.par_num ?? line.paragraph_num ?? 0}`;
    const arr = groups.get(key) ?? [];
    arr.push(line);
    groups.set(key, arr);
  }

  const results: ExtractedOffer[] = [];
  const seen = new Set<string>();

  for (const group of groups.values()) {
    group.sort((a, b) => a.line_num - b.line_num);

    for (let index = 0; index < group.length; index += 1) {
      const line = group[index]!;
      const text = normalizeWhitespace(line.text);
      if (!text) continue;

      const priceMatch = PRICE_REGEX.exec(text.replace(/\s€/g, "€ "));
      if (!priceMatch) continue;

      const priceValue = parsePrice(priceMatch[1]);
      if (priceValue === null || priceValue <= 0 || priceValue > 500) {
        continue;
      }

      const descriptionSegments: string[] = [];
      for (let offset = Math.max(0, index - 4); offset < index; offset += 1) {
        const candidate = normalizeWhitespace(group[offset]!.text);
        if (!candidate) continue;
        if (PRICE_REGEX.test(candidate)) continue;
        descriptionSegments.push(candidate);
      }
      if (!descriptionSegments.length) continue;

      const productName = normalizeProductName(descriptionSegments.join(" "));
      if (productName.length < 4) continue;

      const key = offerKey(productName, priceValue);
      if (seen.has(key)) continue;
      seen.add(key);

      const discountCandidate =
        descriptionSegments.find((segment) => DISCOUNT_REGEX.test(segment)) ??
        (DISCOUNT_REGEX.test(text) ? text : null);

      results.push({
        productName,
        price: priceValue,
        brand: deriveBrand(descriptionSegments[0]),
        lines: [...descriptionSegments, text],
        priceLine: text,
        bbox: line.bbox,
        discountText: discountCandidate,
      });
    }
  }

  return results;
}

async function fetchCandidatePages(supabase: Supabase, batchSize: number): Promise<FlyerPageRecord[]> {
  logger.info("ocr:fetch:start", { batchSize });
  const pageResponse = await supabase
    .from("flyer_pages")
    .select("id, flyer_id, page_no, image_url, flyer:flyers(id, chain_id), processing:flyer_page_processing(status)")
    .not("image_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(batchSize * 5);

  if (pageResponse.error) {
    logger.error("ocr:fetch:error", { error: pageResponse.error.message });
    throw pageResponse.error;
  }

  const pages = (pageResponse.data ?? []) as Array<
    FlyerPageRecord & { processing: { status: string | null }[] | null }
  >;
  if (!pages.length) {
    logger.info("ocr:fetch:empty");
    return [];
  }

  const candidates = pages
    .map((page) => {
      const status = page.processing?.[0]?.status ?? null;
      return { ...page, status };
    })
    .filter((page) => page.status !== "ok" && page.status !== "processing")
    .slice(0, batchSize);

  if (candidates.length) {
    logger.info("ocr:fetch:lock", { candidate_ids: candidates.map((p) => p.id) });
    const lockPayload = candidates.map((page) => ({
      flyer_page_id: page.id,
      status: "processing",
      processed_at: new Date().toISOString(),
    }));
    const lockResponse = await supabase
      .from("flyer_page_processing")
      .upsert(lockPayload, { onConflict: "flyer_page_id" });
    if (lockResponse.error) {
      logger.error("ocr:fetch:lock-error", { error: lockResponse.error.message });
    }
  }

  logger.info("ocr:fetch:ok", {
    fetched: pages.length,
    candidates: candidates.length,
    candidate_ids: candidates.map((p) => p.id),
  });

  return candidates;
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
    logger.error("ocr:processing-log-error", { flyer_page_id: flyerPageId, error: response.error.message });
  }
}

async function processFlyerPage(
  supabase: Supabase,
  worker: Awaited<ReturnType<typeof createOcrWorker>>,
  page: FlyerPageRecord
) {
  if (!page.flyer_id) {
    await markProcessing(supabase, page.id, "skipped", 0, "Missing flyer_id");
    return;
  }

  try {
    logger.info("ocr:page:start", {
      flyer_page_id: page.id,
      page_no: page.page_no,
      image_url: page.image_url,
      flyer_id: page.flyer_id,
    });

    const originalImage = await downloadImage(page.image_url);
    const processedImage = await preprocessImage(originalImage);

    logger.info("ocr:recognize:start", { flyer_page_id: page.id });
    const result = await withTimeout(worker.recognize(processedImage), 5 * 60_000, {
      stage: "recognize",
      flyer_page_id: page.id,
    });
    logger.info("ocr:recognize:ok", {
      flyer_page_id: page.id,
      text_snippet: result.data?.text?.slice(0, 120) ?? "",
      lines: result.data?.lines?.length ?? 0,
      confidence: result.data?.confidence ?? 0,
    });

    const offers = extractOffers(result.data);

    if (offers.length) {
      // remove previous detections for this page before inserting the fresh batch
      const deleteResponse = await supabase.from("flyer_page_offers_raw").delete().eq("flyer_page_id", page.id);
      if (deleteResponse.error) {
        logger.warn("ocr:delete-existing-error", {
          flyer_page_id: page.id,
          error: deleteResponse.error.message,
        });
      }

      const insertPayload = offers.map((offer) => ({
        flyer_id: page.flyer_id,
        flyer_page_id: page.id,
        page_no: page.page_no,
        product_name: offer.productName,
        price: offer.price,
        currency: "EUR",
        brand: offer.brand,
        metadata: {
          lines: offer.lines,
          price_line: offer.priceLine,
          bbox: offer.bbox,
          discount_text: offer.discountText,
        } satisfies Json,
      }));

      const insertResponse = await supabase.from("flyer_page_offers_raw").insert(insertPayload);
      if (insertResponse.error) {
        throw insertResponse.error;
      }
    }

    await markProcessing(supabase, page.id, offers.length ? "ok" : "empty", offers.length);
    logger.info("ocr:page:done", {
      flyer_page_id: page.id,
      offers_found: offers.length,
      sample_offers: offers.slice(0, 2).map((offer) => ({
        product_name: offer.productName,
        price: offer.price,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markProcessing(supabase, page.id, "failed", 0, message);
    logger.error("ocr:page:error", {
      flyer_page_id: page.id,
      error: message,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

async function main() {
  const supabase = createServiceClient();
  const worker = await createOcrWorker();
  const cliLimitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  const limit = cliLimitArg ? Number(cliLimitArg.split("=")[1]) : DEFAULT_BATCH_SIZE;
  const batchSize = Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_BATCH_SIZE;

  try {
    while (true) {
      const pages = await fetchCandidatePages(supabase, batchSize);
      if (!pages.length) {
        logger.info("ocr:queue:empty");
        break;
      }

      for (const page of pages) {
        await processFlyerPage(supabase, worker, page);
      }
    }
  } finally {
    await worker.terminate();
  }
}

main().catch((error) => {
  logger.error("ocr:fatal", {
    error: error instanceof Error ? error.stack : JSON.stringify(error),
  });
  process.exit(1);
});
