# Spespe Setup Guide - Phase 1

## Status

✅ **Code Implementation**: Complete
✅ **Project Structure**: Complete  
✅ **GitHub Actions Workflow**: Ready for deployment
⏳ **GitHub Secrets Configuration**: Requires manual setup (token permissions issue)

## What's Been Built

```
spespe/
├── src/
│   ├── logger.py           # Verbose logging to stdout + file
│   ├── browser.py          # Playwright automation for screenshots
│   ├── vision.py           # Molmo2 8B integration via OpenRouter
│   ├── extractor.py        # Product data extraction & structuring
│   ├── csv_export.py       # UTF-8 CSV export with Italian chars
│   └── main.py             # Main orchestration pipeline
├── .github/workflows/
│   └── scrape.yml          # Weekly scheduled + manual trigger workflow
├── requirements.txt        # All dependencies
├── README.md              # Project documentation
└── SETUP.md               # This file
```

## Next Steps: Configure GitHub Secrets

The scraper is ready to run but needs the OpenRouter API key configured as a GitHub Actions secret.

### Manual Setup (via GitHub UI)

1. Go to: **github.com/giarox/spespe/settings/secrets/actions**

2. Click **"New repository secret"**

3. Create this secret:
   - **Name**: `OPENROUTER_API_KEY`
   - **Value**: `***REMOVED***`

4. Click **"Add secret"**

After this, the GitHub Actions workflow will be able to run!

### Alternative: Use gh CLI

If you have the GitHub CLI installed:

```bash
gh secret set OPENROUTER_API_KEY --body "***REMOVED***" -R giarox/spespe
```

## Push Code to GitHub

The code is committed locally but not yet pushed. Once you configure the secret, push it:

```bash
# If using HTTPS with the fine-grained token
git remote add origin https://github.com/giarox/spespe.git
git push -u origin main

# Or if using SSH (recommended)
git remote add origin git@github.com:giarox/spespe.git
git push -u origin main
```

## Local Testing

You can test the scraper locally before deploying to GitHub Actions:

```bash
# 1. Install dependencies
pip install -r requirements.txt
playwright install chromium

# 2. Set environment variable
export OPENROUTER_API_KEY="***REMOVED***"

# 3. Run the scraper
python -m src.main
```

Expected output:
- Screenshots in `data/screenshots/`
- CSV results in `data/output/`
- Detailed logs in `data/logs/`

## GitHub Actions Workflow

Once secrets are configured, the workflow will:

1. **Scheduled Runs**: Every Monday at 9 AM UTC
2. **Manual Trigger**: Available via "Run workflow" button

Each run will:
- Capture all flyer pages
- Extract products with Molmo2 vision model
- Generate CSV with extracted data
- Upload artifacts (CSV + logs)
- Create issues on failure
- Commit results to repository

## Flyer URL Configuration

Default Lidl flyer:
```
https://www.lidl.it/l/it/volantini/offerte-valide-dal-19-01-al-25-01-volantino-settimanale-9e63be/view/flyer/page/1
```

To use a different flyer:
- Modify `FLYER_URL` in workflow dispatch inputs
- Or update the default in `.github/workflows/scrape.yml`

## Features Implemented

### 🌐 Browser Automation (Playwright)
- Headless Chromium for flyer navigation
- Automatic page detection
- Screenshot capture with full page support
- Verbose logging of all browser actions

### 👁️ Vision Analysis (Molmo2 8B)
- Free tier via OpenRouter API
- Product name extraction
- Price detection (original + discounted)
- Discount percentage calculation
- Confidence scoring

### 📊 Data Processing
- Italian character support (UTF-8)
- Price parsing (€10,99 format)
- Metadata capture (page, date, supermarket)
- Validation & quality checks

### 📁 Output
- CSV files with all product data
- Detailed execution logs
- Artifact storage in GitHub
- Automatic issue creation on failures

## Project Statistics

- **Lines of Code**: ~1,450
- **Modules**: 7 core + 1 main
- **Dependencies**: 4 primary (Playwright, requests, pytest, python-dotenv)
- **Logging Verbosity**: DEBUG level throughout
- **Error Handling**: Comprehensive with stack traces

## Next Phase Ideas

- [ ] Multi-supermarket support (Oasi, Eurospin, Si Con Te)
- [ ] Database storage (PostgreSQL for historical tracking)
- [ ] Web UI for browsing results
- [ ] Price comparison across supermarkets
- [ ] Discount trend analysis
- [ ] Scheduled notifications for best deals
- [ ] Mobile app integration

---

**Ready to go!** Configure the GitHub secret and watch the magic happen. 🚀
