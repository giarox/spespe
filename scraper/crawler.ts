import "dotenv/config";
import { chromium } from "playwright";
import { lidlAdapter } from "./chains/lidl";
import type { ChainAdapter } from "./lib/types";
import { logger } from "./lib/logger";
import { createServiceClient } from "./lib/supabase";
import { persistFlyerRun } from "./lib/persist";

async function runAdapter(adapter: ChainAdapter) {
  const browser = await chromium.launch({ headless: true });
  const supabase = createServiceClient();
  try {
    logger.info("adapter:start", { chain: adapter.name });
    const flyers = await adapter.discover({ browser, supabase, logger });
    logger.info("adapter:discovered", { chain: adapter.name, count: flyers.length });

    const maxFlyers = Number(process.env.LIDL_MAX_FLYERS ?? flyers.length);
    const maxPagesPerFlyer = Number(process.env.LIDL_MAX_PAGES ?? Number.POSITIVE_INFINITY);
    for (const flyer of flyers.slice(0, maxFlyers)) {
      try {
        logger.info("flyer:capture", { chain: adapter.name, url: flyer.url });
        const capture = await adapter.capture({ browser, supabase, logger }, flyer, maxPagesPerFlyer);
        if (!capture.pages.length) {
          logger.warn("flyer:no_pages", { url: flyer.url });
          continue;
        }
        const flyerWithPublication = {
          ...flyer,
          publicationId: capture.publicationId ?? flyer.publicationId,
        };
        await persistFlyerRun({
          supabase,
          chainName: adapter.name,
          flyer: flyerWithPublication,
          pages: capture.pages,
          vendor: adapter.vendor,
        });
        logger.info("flyer:stored", { url: flyer.url, pages: capture.pages.length });
      } catch (error) {
        logger.error("flyer:error", {
          url: flyer.url,
          error:
            error instanceof Error
              ? { message: error.message, stack: error.stack }
              : error,
        });
      }
    }
  } finally {
    await browser.close();
  }
}

async function main() {
  const adapters: ChainAdapter[] = [lidlAdapter];
  for (const adapter of adapters) {
    await runAdapter(adapter);
  }
}

main().catch((error) => {
  logger.error("crawler:fatal", { error: error instanceof Error ? error.stack : String(error) });
  process.exit(1);
});
