import type { Browser } from "playwright";
import { parseItalianRange } from "../lib/date";
import { extractPublicationIdFromImage } from "../lib/flyer";
import { hashString } from "../lib/hash";
import type { AdapterContext, CaptureResult, ChainAdapter, FlyerCandidate, PageImage } from "../lib/types";

const HUB_URL = process.env.LIDL_HUB_URL ?? "https://www.lidl.it/c/volantino-lidl/s10018048";
const MAX_PAGES = Number(process.env.LIDL_MAX_PAGES ?? 60);
const WAIT_UPGRADE_MS = Number(process.env.LIDL_WAIT_MS ?? 500);

const USER_AGENT =
  process.env.LIDL_USER_AGENT ??
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

async function createContext(browser: Browser) {
  const storageStatePath = process.env.LIDL_STORAGE_STATE;
  const options: Parameters<Browser["newContext"]>[0] = {
    locale: "it-IT",
    userAgent: USER_AGENT,
  };
  if (storageStatePath) {
    options.storageState = storageStatePath;
  }
  return browser.newContext(options);
}

async function discover({ browser, logger }: AdapterContext): Promise<FlyerCandidate[]> {
  const context = await createContext(browser);
  const page = await context.newPage();
  logger.info("lidl: navigating hub", { url: HUB_URL });
  await page.goto(HUB_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector("a.flyer", { timeout: 30_000 });

  const flyers = await page.$$eval("a.flyer", (anchors) =>
    anchors
      .map((anchor) => ({
        url: anchor.getAttribute("href") || "",
        title: anchor.querySelector(".flyer__name")?.textContent?.trim() || anchor.textContent?.trim() || "",
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
  await locator.first().waitFor({ state: "visible", timeout: 30_000 });
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const src = await locator.first().getAttribute("src");
    if (src && src.includes("rs:fit:2400")) {
      return src;
    }
    const dataSrc = await locator.first().getAttribute("data-src");
    if (dataSrc) {
      const handle = await locator.first().elementHandle();
      if (handle) {
        await page.evaluate((el, desired) => {
          const img = el as HTMLImageElement;
          if (img.dataset.src) {
            img.src = img.dataset.src.replace("rs:fit:1200", desired);
          }
        }, handle, "rs:fit:2400");
      }
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
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(600);
  return true;
}

async function dismissOverlay(page: import("playwright").Page) {
  const consentButton = page.locator("#onetrust-accept-btn-handler, button[aria-label*='Accetta']");
  if (await consentButton.count()) {
    try {
      const elementHandle = await consentButton.first().elementHandle();
      if (elementHandle) {
        await page.evaluate((el) => (el as HTMLElement).click(), elementHandle);
        await page.waitForTimeout(300);
      }
    } catch {
      // ignore
    }
  }
  await page.addStyleTag({ content: "#onetrust-consent-sdk, .onetrust-pc-dark-filter { display: none !important; pointer-events: none !important; }" });
  await page.evaluate(() => {
    document.querySelectorAll("#onetrust-consent-sdk, .onetrust-pc-dark-filter").forEach((el) => el.remove());
  });
}

async function capturePages(ctx: AdapterContext, flyer: FlyerCandidate): Promise<CaptureResult> {
const context = await createContext(ctx.browser);
const page = await context.newPage();
ctx.logger.info("lidl: storage", { state: process.env.LIDL_STORAGE_STATE ? "loaded" : "empty" });
  ctx.logger.info("lidl: loading flyer", { url: flyer.url });
  await page.goto(flyer.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await dismissOverlay(page);

  const pages: PageImage[] = [];
  const seenHashes = new Set<string>();

  for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo += 1) {
    await dismissOverlay(page);
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
