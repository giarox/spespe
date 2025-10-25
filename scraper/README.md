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

## Run locally

```bash
cd scraper
pnpm start
```

Logs are JSON lines. Look for:

- `adapter:discovered` — how many flyers were found
- `flyer:stored` — pages written to `flyer_pages`

## Next steps (tracked in code TODOs)

- Extract offers via OCR/heuristics per page
- Add store locator ingestion for Lidl
- Wire GitHub Action (`.github/workflows/scrape.yml`) once the pipeline is stable
