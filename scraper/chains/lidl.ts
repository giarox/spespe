import type { Browser } from "playwright";
import { parseItalianRange } from "../lib/date";
import { extractPublicationIdFromImage } from "../lib/flyer";
import { hashString } from "../lib/hash";
import type { AdapterContext, CaptureResult, ChainAdapter, FlyerCandidate, PageImage } from "../lib/types";

const HUB_URL = process.env.LIDL_HUB_URL ?? "https://www.lidl.it/volantini";
const MAX_PAGES = Number(process.env.LIDL_MAX_PAGES ?? 60);
const WAIT_UPGRADE_MS = Number(process.env.LIDL_WAIT_MS ?? 500);

const USER_AGENT =
  process.env.LIDL_USER_AGENT ??
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

async function createContext(browser: Browser) {
  return browser.newContext({
    locale: "it-IT",
    userAgent: USER_AGENT,
  });
}

async function discover({ browser, logger }: AdapterContext): Promise<FlyerCandidate[]> {
  const context = await createContext(browser);
  const page = await context.newPage();
  logger.info("lidl: navigating hub", { url: HUB_URL });
  await page.goto(HUB_URL, { waitUntil: "networkidle" });

  const flyers = await page.$$eval("a[href*=\"/view/\"]", (anchors) =>
    anchors
      .map((anchor) => ({
        url: anchor.getAttribute("href") || "",
        title: anchor.textContent?.trim() || "",
      }))
      .filter((entry) => entry.url.startsWith("http"))
  );

  await page.close();
  await context.close();

  const seen = new Set<string>();
  const candidates: FlyerCandidate[] = [];

  for (const flyer of flyers) {
    if (seen.has(flyer.url)) continue;
    seen.add(flyer.url);

    const { start, end } = parseItalianRange(flyer.title);

    candidates.push({
      url: flyer.url,
      title: flyer.title,
      vendor: "schwarz_viewer",
      periodStart: start ?? undefined,
      periodEnd: end ?? undefined,
    });
  }

  return candidates;
}

async function waitForHighResImage(page: import("playwright").Page) {
  const locator = page.locator(".page--current .page__wrapper img");
  await locator.first().waitFor({ state: "visible", timeout: 15_000 });
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const src = await locator.first().getAttribute("src");
    if (src && src.includes("rs:fit:2400")) {
      return src;
    }
    await page.waitForTimeout(WAIT_UPGRADE_MS);
  }
  return locator.first().getAttribute("src");
}

async function clickNext(page: import("playwright").Page) {
  const button = page.locator(".content_navigation--right button[aria-label*=\"Pagina\"]");
  if (await button.count()) {
    await button.first().click();
    await page.waitForTimeout(600);
    return true;
  }
  return false;
}

async function capturePages(ctx: AdapterContext, flyer: FlyerCandidate): Promise<CaptureResult> {
  const context = await createContext(ctx.browser);
  const page = await context.newPage();
  ctx.logger.info("lidl: loading flyer", { url: flyer.url });
  await page.goto(flyer.url, { waitUntil: "domcontentloaded" });

  const pages: PageImage[] = [];
  const seenHashes = new Set<string>();

  for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo += 1) {
    const src = await waitForHighResImage(page);
    if (!src) break;
    const imgHash = hashString(src);
    if (seenHashes.has(imgHash)) break;
    seenHashes.add(imgHash);
    pages.push({
      pageNo,
      imageUrl: src,
      imageHash: imgHash,
    });
    const hasNext = await clickNext(page);
    if (!hasNext) {
      break;
    }
  }

  const firstPublicationId = extractPublicationIdFromImage(pages[0]?.imageUrl);
  await page.close();
  await context.close();

  return {
    pages,
    publicationId: firstPublicationId ?? flyer.publicationId,
  };
}

export const lidlAdapter: ChainAdapter = {
  id: "lidl-it",
  name: "Lidl Italia",
  vendor: "schwarz_viewer",
  discover,
  capture: capturePages,
};
