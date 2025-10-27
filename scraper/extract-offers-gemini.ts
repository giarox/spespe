import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createWorker, PSM } from "tesseract.js";

import { createServiceClient } from "./lib/supabase";
import { logger } from "./lib/logger";
import type { Database, Json } from "../src/lib/database.types";

type Supabase = SupabaseClient<Database>;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  logger.error("gemini:key-missing", { message: "Set GEMINI_API_KEY to call Google Gemini." });
  process.exit(1);
}

const MAX_IMAGE_WIDTH = Number(process.env.LIDL_GEMINI_WIDTH ?? 3000);
const MODEL_NAME = process.env.LIDL_GEMINI_MODEL ?? "gemini-2.5-flash-lite-preview";
const DEFAULT_BATCH_SIZE = Number(process.env.LIDL_GEMINI_BATCH ?? 3);
const MAX_CALLS_PER_DAY = Number(process.env.LIDL_GEMINI_MAX_CALLS ?? 200);
const GEMINI_API_VERSION = process.env.LIDL_GEMINI_API_VERSION ?? "v1alpha";
const CACHE_DIR = path.join(process.cwd(), ".cache", "gemini");
const USAGE_FILE = path.join(CACHE_DIR, "usage.json");

const UNIT_PRICE_KEYWORDS = [
  " al kg",
  "/kg",
  "1 kg =",
  " al litro",
  "/l",
  "ml",
  " g ",
  " al pezzo",
];

const PRICE_REGEX = /€\s*\d{1,4}(?:[.,]\d{2})/;

const SYSTEM_PROMPT = `You are a precise data extractor. Return JSON that matches the provided schema.
- Extract the main checkout price per product card.
- Reject unit prices when evidence contains keywords like "kg", "al kg", "/kg", "al litro", "/l", "g", "ml", "al pezzo".
- Ignore discount only labels (e.g., "-33%", "Con Lidl Plus", "Da lunedì...").
- price_text must include € and two decimals.
- price_eur must be the numeric value of price_text using dot as decimal separator.
- Product name must have 3-10 words with brand + noun (e.g., "Milbona Edam a fette").
- bbox_price values are percentages between 0 and 1 inclusive.
- If uncertain, set fields to null and explain briefly in notes (<=20 words).
- Return JSON only.`;

const RESPONSE_SCHEMA = {
  type: "object",
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        required: ["name", "price_eur", "price_text", "bbox_price", "evidence_text"],
        properties: {
          name: { type: "string", nullable: true },
          price_eur: { type: "number", nullable: true },
          price_text: { type: "string", nullable: true },
          bbox_price: {
            type: "object",
            required: ["x0_pct", "y0_pct", "x1_pct", "y1_pct"],
            properties: {
              x0_pct: { type: "number" },
              y0_pct: { type: "number" },
              x1_pct: { type: "number" },
              y1_pct: { type: "number" },
            },
          },
          badges: { type: "array", items: { type: "string" }, nullable: true },
          evidence_text: { type: "string" },
          notes: { type: "string", nullable: true },
        },
      },
    },
  },
} as const;

type GeminiRawItem = {
  name: string | null;
  price_eur: number | null;
  price_text: string | null;
  bbox_price: { x0_pct: number; y0_pct: number; x1_pct: number; y1_pct: number };
  badges?: string[] | null;
  evidence_text: string;
  notes: string | null;
};

type GeminiRawResponse = {
  items: GeminiRawItem[];
};

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

type NormalisedOffer = {
  flyer_id: string;
  flyer_page_id: string;
  page_no: number;
  product_name: string;
  price: number;
  price_text: string;
  confidence: number;
  metadata: Json;
};

ensureCacheDir();

const genAI = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
  apiVersion: GEMINI_API_VERSION,
});

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function getUsage(): { date: string; count: number } {
  try {
    const raw = fs.readFileSync(USAGE_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return { date: new Date().toISOString().slice(0, 10), count: 0 };
  }
}

function saveUsage(usage: { date: string; count: number }) {
  fs.writeFileSync(USAGE_FILE, JSON.stringify(usage));
}

function checkQuota() {
  const usage = getUsage();
  const today = new Date().toISOString().slice(0, 10);
  if (usage.date !== today) {
    usage.date = today;
    usage.count = 0;
  }
  if (usage.count >= MAX_CALLS_PER_DAY) {
    throw new Error("MAX_CALLS_PER_DAY reached");
  }
  usage.count += 1;
  saveUsage(usage);
}

function cacheKey(base64: string): string {
  const hash = crypto
    .createHash("sha256")
    .update(MODEL_NAME)
    .update(SYSTEM_PROMPT)
    .update(JSON.stringify(RESPONSE_SCHEMA))
    .update(base64)
    .digest("hex");
  return path.join(CACHE_DIR, `${hash}.json`);
}

async function readCache(base64: string): Promise<GeminiRawResponse | null> {
  const file = cacheKey(base64);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw) as GeminiRawResponse;
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(base64: string, data: GeminiRawResponse) {
  const file = cacheKey(base64);
  try {
    fs.writeFileSync(file, JSON.stringify(data));
  } catch (error) {
    logger.warn("gemini:cache-write-error", { error: error instanceof Error ? error.message : String(error) });
  }
}

function containsUnitPrice(evidence: string): boolean {
  const lower = evidence.toLowerCase();
  return UNIT_PRICE_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function isPriceTextValid(priceText: string | null, priceEur: number | null): boolean {
  if (!priceText || !priceEur) return false;
  if (!PRICE_REGEX.test(priceText)) return false;
  const normalized = parseFloat(priceText.replace(/[^\d,.-]/g, "").replace(",", "."));
  return Number.isFinite(normalized);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function bboxIoU(a: GeminiRawItem["bbox_price"], b: GeminiRawItem["bbox_price"]): number {
  const ax0 = Math.min(a.x0_pct, a.x1_pct);
  const ay0 = Math.min(a.y0_pct, a.y1_pct);
  const ax1 = Math.max(a.x0_pct, a.x1_pct);
  const ay1 = Math.max(a.y0_pct, a.y1_pct);

  const bx0 = Math.min(b.x0_pct, b.x1_pct);
  const by0 = Math.min(b.y0_pct, b.y1_pct);
  const bx1 = Math.max(b.x0_pct, b.x1_pct);
  const by1 = Math.max(b.y0_pct, b.y1_pct);

  const ix0 = Math.max(ax0, bx0);
  const iy0 = Math.max(ay0, by0);
  const ix1 = Math.min(ax1, bx1);
  const iy1 = Math.min(ay1, by1);

  const iw = Math.max(0, ix1 - ix0);
  const ih = Math.max(0, iy1 - iy0);
  const intersection = iw * ih;
  const areaA = (ax1 - ax0) * (ay1 - ay0);
  const areaB = (bx1 - bx0) * (by1 - by0);
  const union = areaA + areaB - intersection;
  if (union <= 0) return 0;
  return intersection / union;
}

function computeConfidence(item: GeminiRawItem, issues: string[]): number {
  let score = 0.9;
  if (!item.price_text || !item.price_eur) score -= 0.4;
  if (!item.name) score -= 0.2;
  if (containsUnitPrice(item.evidence_text)) score -= 0.3;
  if (issues.length) score -= Math.min(0.5, issues.length * 0.1);
  if (!item.notes) score += 0.05;
  return Math.max(0, Math.min(1, score));
}

function validateAndFilter(raw: GeminiRawResponse): GeminiRawItem[] {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.items)) {
    throw new Error("Invalid Gemini response format");
  }
  const accepted: GeminiRawItem[] = [];
  for (const item of raw.items) {
    const issues: string[] = [];
    if (!item) continue;
    const name = item.name?.trim() ?? "";
    const priceText = item.price_text ?? "";
    const priceEur = item.price_eur ?? null;

    if (name) {
      const words = name.split(/\s+/);
      if (words.length < 3 || words.length > 10) issues.push("name-length");
    } else {
      issues.push("name-missing");
    }

    if (!isPriceTextValid(priceText, priceEur)) issues.push("price-invalid");

    if (!item.evidence_text || !item.evidence_text.trim()) issues.push("missing-evidence");
    if (containsUnitPrice(item.evidence_text)) issues.push("unit-price");

    const bbox = item.bbox_price;
    const coords = [bbox?.x0_pct, bbox?.y0_pct, bbox?.x1_pct, bbox?.y1_pct];
    if (coords.some((value) => typeof value !== "number" || value < 0 || value > 1)) {
      issues.push("bbox-invalid");
    }

    if (issues.includes("unit-price")) continue;
    if (issues.includes("price-invalid")) continue;

    (item as GeminiRawItem).notes = issues.length ? `${issues.join(", ")}` : item.notes;
    accepted.push(item);
  }

  const deduped: GeminiRawItem[] = [];
  for (const item of accepted) {
    if (deduped.some((previous) => bboxIoU(previous.bbox_price, item.bbox_price) > 0.5)) {
      continue;
    }
    deduped.push(item);
  }

  return deduped;
}

async function downloadAndPrepareImage(url: string): Promise<Buffer> {
  logger.info("gemini:image:download", { url });
  const response = await fetch(url, { headers: { "User-Agent": "spespe-gemini/1.0" } });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching ${url}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const processed = await sharp(buffer)
    .resize({ width: MAX_IMAGE_WIDTH, height: MAX_IMAGE_WIDTH, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();
  return processed;
}

async function callGemini(base64: string): Promise<GeminiRawResponse> {
  const cached = await readCache(base64);
  if (cached) {
    return cached;
  }

  checkQuota();

  const result = await genAI.models.generateContent({
    model: MODEL_NAME,
    contents: [
      {
        role: "user",
        parts: [{ inlineData: { mimeType: "image/jpeg", data: base64 } }],
      },
    ],
    config: {
      systemInstruction: {
        role: "system",
        parts: [{ text: SYSTEM_PROMPT }],
      },
      temperature: 0.1,
      topP: 0.8,
      topK: 32,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  const text = result.text;
  if (!text) {
    throw new Error("Empty response from Gemini");
  }

  let parsed: GeminiRawResponse;
  try {
    parsed = JSON.parse(text) as GeminiRawResponse;
  } catch {
    logger.error("gemini:parse-error", { raw: text });
    throw new Error("Failed to parse Gemini JSON");
  }

  await writeCache(base64, parsed);
  return parsed;
}

async function tesseractFallback(buffer: Buffer): Promise<GeminiRawItem[]> {
  const worker = await createWorker();
  await worker.load();
  await worker.loadLanguage("eng");
  await worker.initialize("eng");
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.AUTO,
    preserve_interword_spaces: "1",
  });
  const result = await worker.recognize(buffer);
  await worker.terminate();

  const offers: GeminiRawItem[] = [];
  const seen = new Set<string>();
  for (const line of result.data.lines ?? []) {
    const text = line.text.trim();
    if (!PRICE_REGEX.test(text)) continue;
    if (containsUnitPrice(text)) continue;

    const priceMatch = text.match(/\d{1,4}(?:[.,]\d{2})/);
    if (!priceMatch) continue;
    const priceValue = parseFloat(priceMatch[0].replace(",", "."));
    if (!Number.isFinite(priceValue)) continue;

    const key = `${priceValue}-${line.bbox.x0}-${line.bbox.y0}`;
    if (seen.has(key)) continue;
    seen.add(key);

    offers.push({
      name: null,
      price_eur: priceValue,
      price_text: `€${priceMatch[0].replace(".", ",")}`,
      bbox_price: {
        x0_pct: 0,
        y0_pct: 0,
        x1_pct: 1,
        y1_pct: 1,
      },
      badges: null,
      evidence_text: text,
      notes: "tesseract-fallback",
    });
  }

  return offers;
}

function normaliseOffers(items: GeminiRawItem[], page: FlyerPageRecord): NormalisedOffer[] {
  const offers: NormalisedOffer[] = [];
  for (const item of items) {
    const issues: string[] = [];
    const name = item.name?.trim() ?? "";
    if (!name) {
      issues.push("missing-name");
    }
    const priceText = item.price_text ?? "";
    const priceValue = item.price_eur ?? NaN;
    if (!isPriceTextValid(priceText, priceValue)) {
      issues.push("invalid-price");
      continue;
    }

    const words = name.split(/\s+/);
    if (words.length < 3 || words.length > 10) {
      issues.push("name-length");
    }

    const confidence = computeConfidence(item, issues);
    const priceNumeric = parseFloat(priceText.replace(/[^0-9.,-]/g, "").replace(/,/g, "."));

    offers.push({
      flyer_id: page.flyer_id!,
      flyer_page_id: page.id,
      page_no: page.page_no,
      product_name: name || "Prodotto",
      price: priceNumeric,
      price_text: priceText,
      confidence,
      metadata: {
        badges: item.badges ?? [],
        evidence_text: item.evidence_text,
        notes: item.notes,
        bbox_price: {
          x0_pct: clamp01(item.bbox_price.x0_pct),
          y0_pct: clamp01(item.bbox_price.y0_pct),
          x1_pct: clamp01(item.bbox_price.x1_pct),
          y1_pct: clamp01(item.bbox_price.y1_pct),
        },
        source: "gemini",
        issues,
        price_text: item.price_text,
        confidence,
      },
    });
  }

  return offers;
}

async function fetchPendingPages(supabase: Supabase, batchSize: number) {
  logger.info("gemini:fetch:start", { batchSize });
  const response = await supabase
    .from("flyer_pages")
    .select("id, flyer_id, page_no, image_url, flyer:flyers(id, chain_id, period_start, period_end, viewer_url, source_url)")
    .not("image_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(batchSize * 4);

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
    .in("flyer_page_id", pages.map((page) => page.id));
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
    .slice(0, batchSize);

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

async function upsertRawOffers(
  supabase: Supabase,
  page: FlyerPageRecord,
  offers: NormalisedOffer[]
) {
  if (!offers.length) {
    const response = await supabase
      .from("flyer_page_offers_raw")
      .delete()
      .eq("flyer_page_id", page.id);
    if (response.error) {
      logger.warn("gemini:delete-existing-error", { flyer_page_id: page.id, error: response.error.message });
    }
    return;
  }

  const payload = offers.map((offer) => ({
    flyer_id: offer.flyer_id,
    flyer_page_id: offer.flyer_page_id,
    page_no: offer.page_no,
    product_name: offer.product_name,
    price: offer.price,
    currency: "EUR",
    brand: null,
    metadata: offer.metadata,
  }));

  const deleteResponse = await supabase
    .from("flyer_page_offers_raw")
    .delete()
    .eq("flyer_page_id", page.id);
  if (deleteResponse.error) {
    logger.warn("gemini:delete-existing-error", { flyer_page_id: page.id, error: deleteResponse.error.message });
  }

  const insertResponse = await supabase
    .from("flyer_page_offers_raw")
    .insert(payload);
  if (insertResponse.error) {
    throw insertResponse.error;
  }
}

async function processPage(supabase: Supabase, page: FlyerPageRecord) {
  if (!page.flyer_id) {
    await markProcessing(supabase, page.id, "skipped", 0, "missing_flyer");
    return;
  }

  try {
    const imageBuffer = await downloadAndPrepareImage(page.image_url);
    const base64 = imageBuffer.toString("base64");
    let response: GeminiRawResponse;

    try {
      response = await callGemini(base64);
    } catch (error) {
      logger.error("gemini:api-error", { flyer_page_id: page.id, error: error instanceof Error ? error.message : String(error) });
      logger.info("gemini:fallback:tesseract", { flyer_page_id: page.id });
      const fallbackItems = await tesseractFallback(imageBuffer);
      response = { items: fallbackItems };
    }

    const filtered = validateAndFilter(response);
    const normalised = normaliseOffers(filtered, page);
    await upsertRawOffers(supabase, page, normalised);
    await markProcessing(supabase, page.id, normalised.length ? "ok" : "empty", normalised.length);
    logger.info("gemini:page:done", {
      flyer_page_id: page.id,
      offers_found: normalised.length,
      sample_offers: normalised.slice(0, 2).map((offer) => ({
        product_name: offer.product_name,
        price: offer.price,
        confidence: offer.confidence,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markProcessing(supabase, page.id, "failed", 0, message);
    logger.error("gemini:page:error", { flyer_page_id: page.id, error: message });
  }
}

async function main() {
  const supabase = createServiceClient();
  const cliLimitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  const limit = cliLimitArg ? Number(cliLimitArg.split("=")[1]) : DEFAULT_BATCH_SIZE;
  const batchSize = Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_BATCH_SIZE;

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
}

main().catch((error) => {
  logger.error("gemini:fatal", { error: error instanceof Error ? error.stack : String(error) });
  process.exit(1);
});
