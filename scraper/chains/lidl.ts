import type { Browser } from "playwright";
import { parseItalianRange } from "../lib/date";
import { extractPublicationIdFromImage } from "../lib/flyer";
import { hashString } from "../lib/hash";
import { HI_RES_MIN_DIMENSION, getImgProxyFitDimensions, isHighResUrl } from "../lib/image";
import type { AdapterContext, CaptureResult, ChainAdapter, FlyerCandidate, Logger, PageImage } from "../lib/types";

const HUB_URL = process.env.LIDL_HUB_URL ?? "https://www.lidl.it/c/volantino-lidl/s10018048";
const MAX_PAGES = Number(process.env.LIDL_MAX_PAGES ?? 60);
const WAIT_UPGRADE_MS = Number(process.env.LIDL_WAIT_MS ?? 500);

const USER_AGENT =
  process.env.LIDL_USER_AGENT ??
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

async function createContext(browser: Browser) {
  const storageStatePath = process.env.LIDL_STORAGE_STATE;
  const deviceScaleFactor = Number(process.env.LIDL_DEVICE_SCALE_FACTOR ?? 1);
  const options: Parameters<Browser["newContext"]>[0] = {
    locale: "it-IT",
    userAgent: USER_AGENT,
    deviceScaleFactor,
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

const PAGE_IMG_SELECTOR = "section.maincontent section.sheetgesture .sheet .sheet__list li.page.page--current .page__wrapper > img.img";

function parsePageNoFromUrl(url: string): number | null {
  const match = url.match(/page-(\d{2})_/);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  return Number.isFinite(num) ? num : null;
}

async function triggerZoom(page: import("playwright").Page, logger: Logger) {
  const zoomSelectors = [
    "button[aria-label*='Zoom']",
    "button[data-testid='zoom-in']",
    "button[class*='zoom-in']",
    "button[title*='Zoom']",
    "button[aria-label*='Ingrandisci']",
  ];
  let triggered = false;
  for (const selector of zoomSelectors) {
    const button = page.locator(selector).first();
    if (await button.isVisible().catch(() => false)) {
      logger.info("lidl: zoom button click", { selector });
      for (let i = 0; i < 3; i += 1) {
        await button.click().catch(() => undefined);
        await page.waitForTimeout(200);
      }
      triggered = true;
      break;
    }
  }

  const modifier = process.platform === "darwin" ? "Meta" : "Control";
  // Drive additional zoom-in attempts even if buttons were found.
  try {
    await page.mouse.move(600, 420);
    for (let i = 0; i < 3; i += 1) {
      await page.mouse.wheel(0, -1200);
      await page.waitForTimeout(150);
    }
    await page.keyboard.down(modifier);
    for (let i = 0; i < 4; i += 1) {
      await page.keyboard.press("+");
      await page.waitForTimeout(120);
    }
    await page.keyboard.up(modifier);
    triggered = true;
    logger.info("lidl: zoom keyboard fallback triggered");
  } catch (err) {
    logger.warn("lidl: zoom fallback failed", { error: (err as Error).message });
  }

  if (!triggered) {
    logger.warn("lidl: zoom trigger did not find any control, relying on keyboard");
  }

  try {
    const image = page.locator(PAGE_IMG_SELECTOR).first();
    await image.waitFor({ state: "visible", timeout: 20_000 });
    const box = await image.boundingBox();
    if (box) {
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y, { steps: 5 });
      await page.mouse.click(x, y, { delay: 50 });
      await page.waitForTimeout(250);
      const infoAfterSingleClick = await image.evaluate((el) => ({
        width: (el as HTMLImageElement).naturalWidth,
        height: (el as HTMLImageElement).naturalHeight,
        src: (el as HTMLImageElement).src,
      }));
      logger.info("lidl: single click zoom probe", infoAfterSingleClick);
      if (!isHighResUrl(infoAfterSingleClick.src)) {
        await page.waitForTimeout(150);
        await page.mouse.dblclick(x, y, { delay: 50 });
        await page.waitForTimeout(250);
        const infoAfterDoubleClick = await image.evaluate((el) => ({
          width: (el as HTMLImageElement).naturalWidth,
          height: (el as HTMLImageElement).naturalHeight,
          src: (el as HTMLImageElement).src,
        }));
        logger.info("lidl: double click zoom probe", infoAfterDoubleClick);
      }
    } else {
      logger.warn("lidl: unable to compute flyer bounding box for click zoom");
    }
  } catch (err) {
    logger.warn("lidl: click zoom failed", { error: (err as Error).message });
  }
}

async function waitForHighResImage(
  page: import("playwright").Page,
  pageNo: number,
  logger: Logger,
  hiResByPage: Map<number, string>
): Promise<{ src: string | null; width: number | null; height: number | null }> {
  const locator = page.locator(PAGE_IMG_SELECTOR);
  await locator.first().waitFor({ state: "visible", timeout: 30_000 });
  await page.locator(".page--current .page__wrapper .loading").first().waitFor({ state: "hidden", timeout: 10_000 }).catch(() => logger.warn("lidl: spinner still visible", { pageNo }));
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const candidateHiRes = hiResByPage.get(pageNo) ?? null;
    const info = await locator.first().evaluate((el) => ({
      src: el.getAttribute("src") ?? "",
      loaded: el.complete,
      width: el.naturalWidth,
      height: el.naturalHeight,
    }));
    logger.info("lidl: page image status", { pageNo, attempt, info, desired: candidateHiRes });
    if (candidateHiRes && isHighResUrl(candidateHiRes)) {
      if (info.src === candidateHiRes && info.loaded) {
        hiResByPage.delete(pageNo);
        logger.info("lidl: hi-res ready", { pageNo, src: candidateHiRes, width: info.width, height: info.height });
        return { src: candidateHiRes, width: info.width ?? null, height: info.height ?? null };
      }
      await page.waitForTimeout(150);
      const updated = await locator.first().evaluate((el) => ({
        src: el.getAttribute("src") ?? "",
        loaded: el.complete,
        width: el.naturalWidth,
        height: el.naturalHeight,
      }));
      if (updated.src === candidateHiRes && updated.loaded) {
        hiResByPage.delete(pageNo);
        logger.info("lidl: hi-res ready", { pageNo, src: candidateHiRes, width: updated.width, height: updated.height });
        return { src: candidateHiRes, width: updated.width ?? null, height: updated.height ?? null };
      }
      hiResByPage.delete(pageNo);
      return { src: candidateHiRes, width: updated.width ?? info.width ?? null, height: updated.height ?? info.height ?? null };
    }
    if (info.src && info.loaded && info.width > 0) {
      logger.info("lidl: page image ready", { pageNo, src: info.src });
      return { src: info.src, width: info.width ?? null, height: info.height ?? null };
    }
    await page.waitForTimeout(WAIT_UPGRADE_MS);
  }
  const fallback = await locator.first().getAttribute("src");
  logger.warn("lidl: using fallback src", { pageNo, fallback });
  return { src: fallback ?? null, width: null, height: null };
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

async function capturePages(
  ctx: AdapterContext,
  flyer: FlyerCandidate,
  maxPages = Number.POSITIVE_INFINITY
): Promise<CaptureResult> {
  const context = await createContext(ctx.browser);
  const page = await context.newPage();
  ctx.logger.info("lidl: storage", { state: process.env.LIDL_STORAGE_STATE ? "loaded" : "empty" });
  ctx.logger.info("lidl: loading flyer", { url: flyer.url });
  await page.goto(flyer.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await dismissOverlay(page);
  await page.waitForURL("**/view/**", { timeout: 60_000 });
  ctx.logger.info("lidl: viewer ready", { url: page.url() });

  const pages: PageImage[] = [];
  const seenHashes = new Set<string>();
  const hiResByPage = new Map<number, string>();
  const maxAttemptsPerPage = Number(process.env.LIDL_CAPTURE_RETRIES ?? 5);

  page.on("response", async (response) => {
    const url = response.url();
    if (!url.includes("imgproxy.leaflets.schwarz")) return;
    if (!isHighResUrl(url)) return;
    const pageNo = parsePageNoFromUrl(url);
    if (!pageNo) return;
    if (hiResByPage.has(pageNo)) return;
    hiResByPage.set(pageNo, url);
    ctx.logger.info("lidl: hi-res detected", { pageNo, url });
  });

  for (let pageNo = 1; pageNo <= Math.min(MAX_PAGES, maxPages); pageNo += 1) {
    let capture: { src: string | null; width: number | null; height: number | null } | null = null;
    for (let attempt = 0; attempt < maxAttemptsPerPage; attempt += 1) {
      await dismissOverlay(page);
      await triggerZoom(page, ctx.logger);
      capture = await waitForHighResImage(page, pageNo, ctx.logger, hiResByPage);
      if (!capture?.src) {
        continue;
      }
      if (isHighResUrl(capture.src)) {
        break;
      }
      ctx.logger.warn("lidl: low-res capture detected", { pageNo, attempt, src: capture.src, min: HI_RES_MIN_DIMENSION });
    }
    if (!capture?.src) {
      ctx.logger.warn("lidl: no image captured", { pageNo });
      break;
    }
    if (!isHighResUrl(capture.src)) {
      throw new Error(`Failed to capture hi-res image for page ${pageNo} (min ${HI_RES_MIN_DIMENSION}px)`);
    }
    const imgHash = hashString(capture.src);
    if (seenHashes.has(imgHash)) break;
    seenHashes.add(imgHash);
    const dims = getImgProxyFitDimensions(capture.src);
    pages.push({
      pageNo,
      imageUrl: capture.src,
      imageHash: imgHash,
      width: capture.width ?? dims?.width ?? null,
      height: capture.height ?? dims?.height ?? null,
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
