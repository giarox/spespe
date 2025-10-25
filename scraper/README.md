# Scraper (alpha)

This folder will eventually host the flyer discovery + parsing pipeline. For now it
contains a single entry point so we can iterate quickly without touching the Next.js app.

## Local setup

```bash
cd scraper
pnpm install
```

Create a `.env` file in this folder with the service credentials you need:

```
SUPABASE_URL=https://jttjtsnosmptxzwfhoig.supabase.co
SUPABASE_SERVICE_ROLE=...
LOCATIONIQ_API_KEY=...
```

## Run the placeholder crawler

Right now the script just fetches a couple of tables so we can confirm credentials work.
Later we’ll plug in discovery/parsing modules per chain.

```bash
pnpm start
```

Expected output shows how many chains/stores/offers exist and how many rows the script
upserted (currently zero—just a stub).
