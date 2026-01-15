# Spespe: Italian Supermarket Price Scraper

A Python-based web scraper that extracts product data from Italian supermarket flyers using browser automation and AI vision.

## Phase 1: Concept Validation

- **Target Supermarket**: Lidl (expand to Oasi, Eurospin, Si Con Te in later phases)
- **AI Vision Model**: Molmo2 8B via OpenRouter API (free tier)
- **Browser Automation**: Playwright with Chromium
- **Output Format**: CSV files with UTF-8 encoding
- **Execution**: GitHub Actions (scheduled + manual trigger)

## Features

- Automated flyer screenshot capture
- AI-powered product extraction with vision model
- Structured CSV export with metadata (supermarket, page, date, prices)
- Verbose logging for debugging
- GitHub Actions workflow for scheduled runs (Mondays 9 AM UTC)

## Project Structure

```
spespe/
├── src/
│   ├── __init__.py
│   ├── browser.py          # Playwright automation
│   ├── vision.py           # OpenRouter Molmo2 integration
│   ├── extractor.py        # Product extraction logic
│   ├── csv_export.py       # CSV output generation
│   └── logger.py           # Verbose logging setup
├── tests/
│   ├── __init__.py
│   └── test_integration.py
├── data/
│   └── output/             # CSV files go here
├── .github/workflows/
│   └── scrape.yml          # GitHub Actions workflow
├── requirements.txt
├── .env.example
└── README.md
```

## Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and add your OpenRouter API key
3. Install dependencies: `pip install -r requirements.txt`
4. Run: `python -m src.main`

## Environment Variables

- `OPENROUTER_API_KEY`: Your OpenRouter API key (free tier)

## Output

Product data is exported to `data/output/lidl_products_YYYYMMDD_HHMMSS.csv`

CSV columns:
- supermarket
- flyer_date
- page_number
- product_name
- original_price
- discounted_price
- discount_percentage
- extraction_timestamp
- confidence_score

## Testing

```bash
pytest tests/
```

## Logging

All operations produce verbose logs to stdout and `data/logs/scraper.log`

---

**Status**: Phase 1 - Concept Validation
