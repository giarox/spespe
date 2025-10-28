import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import sharp from "sharp";
import { GoogleGenAI, Type } from "@google/genai";
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
const GEMINI_API_VERSION = process.env.LIDL_GEMINI_API_VERSION ?? "v1beta";
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

const SYSTEM_PROMPT = `You are an expert data extractor for grocery store flyers. Carefully analyze the flyer image and return JSON that strictly matches the provided schema.

Rules:
- Extract the main customer-facing checkout price for each product card as price_now (numeric EUR).
- Capture detailed attributes: product_name, optional brand, variant, pack count, and net quantity (value + unit).
- price_was is the original higher price if displayed; discount_percent is any percentage discount badge.
- unit_price_value/unit capture per-unit pricing when available.
- loyalty must indicate if Lidl Plus (or other program) is required.
- badges include short promotional labels; category_hint reflects the section title common to the page.
- evidence_text must include nearby text supporting the extraction; bbox_price must contain the bounding box (0..1) of the main price.
- If information is missing, return null—never invent data.
- Output valid JSON only, with no markdown or commentary.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  required: ["category_hint", "offers"],
  properties: {
    category_hint: { type: Type.STRING, nullable: true },
    offers: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["product_name", "price_now", "evidence_text", "loyalty"],
        properties: {
          product_name: { type: Type.STRING, nullable: true },
          brand: { type: Type.STRING, nullable: true },
          variant: { type: Type.STRING, nullable: true },
          pack_count: { type: Type.NUMBER, nullable: true },
          net_quantity_value: { type: Type.NUMBER, nullable: true },
          net_quantity_unit: { type: Type.STRING, nullable: true },
          price_now: { type: Type.NUMBER, nullable: true },
          price_was: { type: Type.NUMBER, nullable: true },
          price_text: { type: Type.STRING, nullable: true },
          discount_percent: { type: Type.NUMBER, nullable: true },
          unit_price_value: { type: Type.NUMBER, nullable: true },
          unit_price_unit: { type: Type.STRING, nullable: true },
          loyalty: {
            type: Type.OBJECT,
            required: ["required", "program"],
            properties: {
              required: { type: Type.BOOLEAN },
              program: { type: Type.STRING, nullable: true },
            },
          },
          badges: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
          evidence_text: { type: Type.STRING },
          notes: { type: Type.STRING, nullable: true },
          bbox_price: {
            type: Type.OBJECT,
            nullable: true,
            properties: {
              x0_pct: { type: Type.NUMBER },
              y0_pct: { type: Type.NUMBER },
              x1_pct: { type: Type.NUMBER },
              y1_pct: { type: Type.NUMBER },
            },
          },
        },
      },
    },
  },
} as const;

type RawLoyalty = { required?: boolean | null; program?: string | null } | null;

type GeminiRawOffer = {
  product_name: string | null;
  brand: string | null;
  variant: string | null;
  pack_count: number | null;
  net_quantity_value: number | null;
  net_quantity_unit: string | null;
  price_now: number | null;
  price_was: number | null;
  price_text: string | null;
  discount_percent: number | null;
  unit_price_value: number | null;
  unit_price_unit: string | null;
  loyalty: { required: boolean; program: string | null };
  badges: string[] | null;
  evidence_text: string;
  notes: string | null;
  bbox_price: { x0_pct: number; y0_pct: number; x1_pct: number; y1_pct: number } | null;
};

type GeminiRawResponse = {
  category_hint: string | null;
  offers: GeminiRawOffer[];
};

type ValidatedOffer = {
  item: GeminiRawOffer;
  confidence: number;
  issues: string[];
};

type ValidatedResponse = {
  category_hint: string | null;
  offers: ValidatedOffer[];
  source: "gemini" | "tesseract";
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
  brand: string | null;
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
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "offers" in parsed) {
      return normalizeGeminiResponse(parsed);
    }
    if (parsed && typeof parsed === "object" && "items" in parsed) {
      const migrated = {
        category_hint: (parsed as Record<string, unknown>).category_hint ?? null,
        offers: (parsed as Record<string, unknown>).items,
      };
      return normalizeGeminiResponse(migrated);
    }
    return normalizeGeminiResponse(parsed);
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

function isPriceTextValid(priceText: string | null, priceValue: number | null): boolean {
  if (priceValue === null || !Number.isFinite(priceValue)) {
    return false;
  }
  if (!priceText) return true;
  if (!PRICE_REGEX.test(priceText)) return false;
  const normalized = parseFloat(priceText.replace(/[^\d,.-]/g, "").replace(",", "."));
  return Number.isFinite(normalized);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function formatEuro(value: number): string {
  return `€${value.toFixed(2).replace(".", ",")}`;
}

function bboxIoU(
  a: GeminiRawOffer["bbox_price"] | null | undefined,
  b: GeminiRawOffer["bbox_price"] | null | undefined
): number {
  if (!a || !b) return 0;
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

function asNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function asNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const normalized = parseFloat(value.replace(/[^0-9.,-]/g, "").replace(",", "."));
    return Number.isFinite(normalized) ? normalized : null;
  }
  return null;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const entries = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : null))
    .filter((entry): entry is string => Boolean(entry && entry.length));
  return entries.length ? entries : null;
}

function normalizeLoyalty(loyalty: RawLoyalty): { required: boolean; program: string | null } {
  if (!loyalty || typeof loyalty !== "object") {
    return { required: false, program: null };
  }
  const record = loyalty as Record<string, unknown>;
  const requiredValue = record.required;
  const required = typeof requiredValue === "boolean" ? requiredValue : Boolean(requiredValue);
  const program = asNullableString(record.program ?? null);
  return { required, program };
}

function coerceOffer(raw: unknown): GeminiRawOffer {
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const loyalty = normalizeLoyalty(record.loyalty as RawLoyalty);
  const bboxSource = record.bbox_price && typeof record.bbox_price === "object"
    ? (record.bbox_price as Record<string, unknown>)
    : null;
  let bbox: GeminiRawOffer["bbox_price"] = null;
  if (bboxSource) {
    const x0 = asNullableNumber(bboxSource.x0_pct);
    const y0 = asNullableNumber(bboxSource.y0_pct);
    const x1 = asNullableNumber(bboxSource.x1_pct);
    const y1 = asNullableNumber(bboxSource.y1_pct);
    if ([x0, y0, x1, y1].every((value) => value !== null)) {
      bbox = {
        x0_pct: clamp01(x0!),
        y0_pct: clamp01(y0!),
        x1_pct: clamp01(x1!),
        y1_pct: clamp01(y1!),
      };
    }
  }

  return {
    product_name: asNullableString(record.product_name),
    brand: asNullableString(record.brand),
    variant: asNullableString(record.variant),
    pack_count: asNullableNumber(record.pack_count),
    net_quantity_value: asNullableNumber(record.net_quantity_value),
    net_quantity_unit: asNullableString(record.net_quantity_unit),
    price_now: asNullableNumber(record.price_now),
    price_was: asNullableNumber(record.price_was),
    price_text: asNullableString(record.price_text),
    discount_percent: asNullableNumber(record.discount_percent),
    unit_price_value: asNullableNumber(record.unit_price_value),
    unit_price_unit: asNullableString(record.unit_price_unit),
    loyalty,
    badges: asStringArray(record.badges),
    evidence_text: asNullableString(record.evidence_text) ?? "",
    notes: asNullableString(record.notes),
    bbox_price: bbox,
  };
}

function computeConfidence(item: GeminiRawOffer, issues: string[]): number {
  let score = 1;
  if (item.price_now === null) score -= 0.6;
  if (!item.product_name) score -= 0.25;
  if (!item.evidence_text) score -= 0.15;
  if (!item.bbox_price) score -= 0.1;
  if (!item.price_text) score -= 0.05;
  if (containsUnitPrice(item.evidence_text)) score -= 0.05;
  if (issues.includes("unit-price-evidence")) score -= 0.1;
  score -= Math.min(0.4, issues.length * 0.05);
  return clamp01(score);
}

function normalizeGeminiResponse(payload: unknown): GeminiRawResponse {
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const offersInput = Array.isArray(record.offers) ? record.offers : [];
  const offers = offersInput.map((entry) => coerceOffer(entry));
  return {
    category_hint: asNullableString(record.category_hint) ?? null,
    offers,
  };
}

function validateAndFilter(raw: GeminiRawResponse, source: "gemini" | "tesseract"): ValidatedResponse {
  const accepted: ValidatedOffer[] = [];
  for (const rawOffer of raw.offers ?? []) {
    const offer: GeminiRawOffer = {
      ...rawOffer,
      badges: rawOffer.badges ? [...rawOffer.badges] : null,
      loyalty: rawOffer.loyalty ? { ...rawOffer.loyalty } : { required: false, program: null },
      bbox_price: rawOffer.bbox_price
        ? {
            x0_pct: clamp01(rawOffer.bbox_price.x0_pct),
            y0_pct: clamp01(rawOffer.bbox_price.y0_pct),
            x1_pct: clamp01(rawOffer.bbox_price.x1_pct),
            y1_pct: clamp01(rawOffer.bbox_price.y1_pct),
          }
        : null,
    };

    const issues: string[] = [];
    if (!offer.product_name || offer.product_name.trim().length < 3) {
      issues.push("name-invalid");
    }

    if (offer.price_now === null || offer.price_now <= 0) {
      issues.push("price-missing");
      continue;
    }

    if (!isPriceTextValid(offer.price_text, offer.price_now)) {
      issues.push("price-text");
    }

    const evidence = offer.evidence_text?.trim() ?? "";
    if (!evidence) {
      issues.push("missing-evidence");
    } else if (containsUnitPrice(evidence) && !offer.price_text) {
      issues.push("unit-price-evidence");
    }

    const confidence = computeConfidence(offer, issues);
    if (confidence <= 0) continue;

    accepted.push({ item: offer, confidence, issues });
  }

  const deduped: ValidatedOffer[] = [];
  for (const entry of accepted) {
    const bbox = entry.item.bbox_price;
    if (bbox && deduped.some((previous) => bboxIoU(previous.item.bbox_price, bbox) > 0.5)) {
      continue;
    }
    deduped.push(entry);
  }

  return {
    category_hint: raw.category_hint ?? null,
    offers: deduped,
    source,
  };
}

function normaliseOffers(validated: ValidatedResponse, page: FlyerPageRecord): NormalisedOffer[] {
  const offers: NormalisedOffer[] = [];
  for (const entry of validated.offers) {
    const { item, confidence, issues } = entry;
    if (item.price_now === null) continue;
    const productName = item.product_name?.trim() || "Offerta Lidl";
    const priceText = item.price_text ?? formatEuro(item.price_now);
    const loyalty = normalizeLoyalty(item.loyalty);

    const metadata = {
      brand: item.brand ?? null,
      variant: item.variant ?? null,
      pack_count: item.pack_count ?? null,
      net_quantity_value: item.net_quantity_value ?? null,
      net_quantity_unit: item.net_quantity_unit ?? null,
      price_now: item.price_now,
      price_was: item.price_was ?? null,
      price_text,
      discount_percent: item.discount_percent ?? null,
      discount_text:
        item.discount_percent !== null && item.discount_percent !== undefined
          ? `${item.discount_percent}%`
          : null,
      unit_price_value: item.unit_price_value ?? null,
      unit_price_unit: item.unit_price_unit ?? null,
      loyalty,
      badges: item.badges ?? [],
      evidence_text: item.evidence_text,
      notes: item.notes ?? null,
      bbox_price: item.bbox_price
        ? {
            x0_pct: clamp01(item.bbox_price.x0_pct),
            y0_pct: clamp01(item.bbox_price.y0_pct),
            x1_pct: clamp01(item.bbox_price.x1_pct),
            y1_pct: clamp01(item.bbox_price.y1_pct),
          }
        : null,
      issues,
      confidence,
      source: validated.source,
      category_hint: validated.category_hint,
    } satisfies Record<string, unknown>;

    offers.push({
      flyer_id: page.flyer_id!,
      flyer_page_id: page.id,
      page_no: page.page_no,
      product_name: productName,
      brand: item.brand ?? null,
      price: item.price_now,
      price_text,
      confidence,
      metadata: metadata as Json,
    });
  }
  return offers;
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

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    logger.error("gemini:parse-error", { raw: text });
    throw new Error("Failed to parse Gemini JSON");
  }

  const normalised = normalizeGeminiResponse(parsed);
  await writeCache(base64, normalised);
  return normalised;
}

async function tesseractFallback(buffer: Buffer): Promise<GeminiRawResponse> {
  const worker = await createWorker();
  if (typeof (worker as { load?: () => Promise<void> }).load === "function") {
    try {
      await (worker as { load: () => Promise<void> }).load();
    } catch (error) {
      logger.warn("tesseract:load-skip", { error: error instanceof Error ? error.message : String(error) });
    }
  }
  if (typeof (worker as { loadLanguage?: (lang: string) => Promise<void> }).loadLanguage === "function") {
    try {
      await (worker as { loadLanguage: (lang: string) => Promise<void> }).loadLanguage("ita+eng");
    } catch (error) {
      logger.warn("tesseract:loadLanguage-skip", { error: error instanceof Error ? error.message : String(error) });
    }
  }
  if (typeof (worker as { initialize?: (lang: string) => Promise<void> }).initialize === "function") {
    try {
      await (worker as { initialize: (lang: string) => Promise<void> }).initialize("ita+eng");
    } catch (error) {
      logger.warn("tesseract:initialize-skip", { error: error instanceof Error ? error.message : String(error) });
    }
  }
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.AUTO,
    preserve_interword_spaces: "1",
  });
  const result = await worker.recognize(buffer);
  await worker.terminate();

  const offers: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const line of result.data.lines ?? []) {
    const text = line.text.trim();
    if (!PRICE_REGEX.test(text)) continue;
    const priceMatch = text.match(/\d{1,4}(?:[.,]\d{2})/);
    if (!priceMatch) continue;
    const priceValue = parseFloat(priceMatch[0].replace(",", "."));
    if (!Number.isFinite(priceValue)) continue;

    const key = `${priceValue}-${line.bbox.x0}-${line.bbox.y0}`;
    if (seen.has(key)) continue;
    seen.add(key);

    offers.push({
      product_name: `Offerta ${text.split(priceMatch[0])[0].trim() || "Lidl"}`,
      price_now: priceValue,
      price_text: formatEuro(priceValue),
      price_was: null,
      discount_percent: null,
      unit_price_value: null,
      unit_price_unit: null,
      brand: null,
      variant: null,
      pack_count: null,
      net_quantity_value: null,
      net_quantity_unit: null,
      loyalty: { required: false, program: null },
      badges: null,
      evidence_text: text,
      notes: "tesseract-fallback",
      bbox_price: null,
    });
  }

  return normalizeGeminiResponse({ category_hint: null, offers });
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
    brand: offer.brand,
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
    let source: "gemini" | "tesseract" = "gemini";

    try {
      response = await callGemini(base64);
    } catch (error) {
      logger.error("gemini:api-error", { flyer_page_id: page.id, error: error instanceof Error ? error.message : String(error) });
      logger.info("gemini:fallback:tesseract", { flyer_page_id: page.id });
      response = await tesseractFallback(imageBuffer);
      source = "tesseract";
    }

    const validated = validateAndFilter(response, source);
    const normalised = normaliseOffers(validated, page);
    await upsertRawOffers(supabase, page, normalised);
    await markProcessing(supabase, page.id, normalised.length ? "ok" : "empty", normalised.length);
    logger.info("gemini:page:done", {
      flyer_page_id: page.id,
      source,
      category_hint: validated.category_hint,
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
