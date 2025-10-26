import type { Browser } from "playwright";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/database.types";

export interface FlyerCandidate {
  url: string;
  title: string;
  vendor: string;
  periodStart?: string;
  periodEnd?: string;
  publicationId?: string | null;
  metadata?: Record<string, string>;
}

export interface PageImage {
  pageNo: number;
  imageUrl: string;
  imageHash?: string;
  width?: number;
  height?: number;
}

export interface CaptureResult {
  pages: PageImage[];
  publicationId?: string | null;
  discoveryHash?: string;
}

export interface ChainAdapter {
  id: string;
  name: string;
  vendor: string;
  discover(ctx: AdapterContext): Promise<FlyerCandidate[]>;
  capture(ctx: AdapterContext, flyer: FlyerCandidate, maxPages?: number): Promise<CaptureResult>;
}

export interface AdapterContext {
  browser: Browser;
  supabase: SupabaseClient<Database>;
  logger: Logger;
}

export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}
