# Scraper

Lidl-first implementation of the crawling pipeline described in the roadmap.

## Prerequisites

- Node 18+
- `pnpm install` run at the repo root (installs shared deps)
- Playwright browser binaries:

  ```bash
  cd scraper
  pnpm install
  npx playwright install chromium
  ```

- `.env` file inside `scraper/` with at least:

  ```
  SUPABASE_URL=https://jttjtsnosmptxzwfhoig.supabase.co
  SUPABASE_SERVICE_ROLE=service-role-key
  ```

  (The service role key never ships to the frontend; keep it in GitHub/Vercel secrets.)

Optional overrides:

```
LIDL_HUB_URL=https://www.lidl.it/volantini
LIDL_MAX_PAGES=60
LIDL_WAIT_MS=500
```

## What it does now

- Discovers Lidl Italy flyers from the public hub (`chains/lidl.ts`)
- Drives the Schwarz viewer via Playwright, capturing high-res image URLs page by page
- Stores/upserts flyers, flyer pages, and run metadata through the Supabase service role
- (New) Runs an OCR pass on the captured pages (`process-flyer-pages.ts`) to extract offer candidates into `flyer_page_offers_raw`

## Run locally

### Capture the latest flyers

```bash
cd scraper
pnpm start
```

Logs are JSON lines. Look for:

- `adapter:discovered` — how many flyers were found
- `flyer:stored` — pages written to `flyer_pages`

### Extract offers from freshly captured pages (OCR)

```bash
cd scraper
# Optional: limit pages per run with --limit=N
pnpm process:lidl -- --limit=3
```

- Uses Tesseract (ita+eng) via `tesseract.js` and `sharp` to normalise images.
- Results are inserted into `flyer_page_offers_raw` and the processing status is logged in `flyer_page_processing`.
- Runs are idempotent: each page is processed once unless you delete/reset the log table.

### Ingest extracted offers into the main catalog

```bash
cd scraper
pnpm ingest:lidl
```

- Reads pending rows from `flyer_page_offers_raw`.
- Upserts deduplicated offers into `offers` (unique on `flyer_id + product_name + price`).
- Marks each raw row as ingested so subsequent runs only process new data.

## Next steps (tracked in code TODOs)

- Improve OCR segmentation (box detection, multi-line grouping) to raise precision/recall.
- Map extracted products to known stores/SKUs and hydrate the primary `offers` table.
- Add store locator ingestion for Lidl and other chains.
- Wire GitHub Action (`.github/workflows/scrape.yml`) to run the OCR step after the capture job stabilises.
