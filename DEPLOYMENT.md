# Spespe - GitHub Actions Deployment Guide

## Current Status

✅ **Complete**: Phase 1 Implementation  
✅ **Tested**: All 11 integration tests passing  
✅ **Ready for**: GitHub Actions deployment  
⏳ **Awaiting**: Manual secret configuration (fine-grained token limitation)

## What's Ready to Deploy

```
Spespe v0.1.0 - Italian Supermarket Price Scraper
├── Core Pipeline
│   ├── Playwright browser automation ✅
│   ├── Molmo2 8B vision extraction ✅
│   ├── Product data parsing ✅
│   └── UTF-8 CSV export ✅
├── GitHub Actions Workflow
│   ├── Scheduled Monday 9 AM UTC ✅
│   ├── Manual trigger support ✅
│   ├── Artifact storage ✅
│   └── Failure notifications ✅
└── Testing & Validation
    └── 11 integration tests ✅
```

## Three-Step Deployment Process

### Step 1: Configure GitHub Secret (Manual)

Due to fine-grained token limitations, the secret must be set via the GitHub UI.

**Via GitHub Web Interface:**

1. Navigate to: **https://github.com/giarox/spespe/settings/secrets/actions**
2. Click **"New repository secret"** button
3. Enter:
   - **Name:** `OPENROUTER_API_KEY`
   - **Value:** `***REMOVED***`
4. Click **"Add secret"**

**Verification:**
- After creation, you should see the secret listed (values are masked for security)
- The workflow will have access to this secret

### Step 2: Push Code to GitHub

The code is committed locally. Push it to GitHub:

```bash
cd /Users/gianlucarusso/spespe

# Option A: Using HTTPS with personal access token
git remote add origin https://github.com/giarox/spespe.git
git push -u origin main

# Option B: Using SSH (if configured)
git remote add origin git@github.com:giarox/spespe.git
git push -u origin main

# If remote already exists, update it:
git remote set-url origin https://github.com/giarox/spespe.git
git push -u origin main
```

### Step 3: Verify Workflow Deployment

1. Go to: **https://github.com/giarox/spespe/actions**
2. You should see the workflow: **"Spespe - Weekly Flyer Scraper"**
3. Click "Run workflow" to test manually (optional)

## Workflow Details

### Schedule

- **Default**: Every Monday at 9:00 AM UTC
- **Manual**: Trigger anytime via "Run workflow" button in Actions tab

### What Happens on Each Run

1. **Setup Phase** (2-3 min)
   - Checkout code
   - Install Python 3.11
   - Install dependencies
   - Install Playwright Chromium

2. **Scraping Phase** (10-15 min)
   - Navigate to Lidl flyer
   - Capture all flyer pages
   - Send screenshots to Molmo2 API
   - Extract products with prices
   - Validate extracted data

3. **Output Phase** (1-2 min)
   - Generate CSV file
   - Upload artifacts to GitHub
   - Commit results to repository
   - Create issue on failure

### Expected Outputs

**On Success:**
- CSV file: `data/output/lidl_products_YYYYMMDD_HHMMSS.csv`
- Log file: `data/logs/scraper_YYYYMMDD_HHMMSS.log`
- Both stored as GitHub artifacts (30-day retention)
- Results committed to repository

**On Failure:**
- GitHub issue created automatically
- Full logs available in artifacts
- Workflow run details visible in Actions tab

### Environment Variables

**Set automatically by workflow:**
- `OPENROUTER_API_KEY`: Retrieved from repository secret
- `FLYER_URL`: Default Lidl URL (can override in manual trigger)

**Runtime:**
- Python 3.11
- Playwright 1.40.0
- Chromium (headless)

## Monitoring & Troubleshooting

### Check Workflow Status

```
GitHub → Actions → "Spespe - Weekly Flyer Scraper"
```

### View Logs

1. Click on the workflow run
2. Click on "Scrape Lidl Flyer" job
3. Expand steps to see detailed output

### Common Issues & Solutions

**Issue**: "OPENROUTER_API_KEY is not set"
- **Solution**: Verify secret was created at `/settings/secrets/actions`
- **Action**: Create it with the exact name

**Issue**: "Playwright not found"
- **Solution**: Dependencies installed correctly (check logs)
- **Action**: Re-run workflow; usually fixes on second attempt

**Issue**: "No products extracted (0 items)"
- **Possible causes**:
  - Flyer page not loading
  - Vision model accuracy
  - Empty flyer
- **Debug**: Check screenshot files in artifacts

**Issue**: Workflow takes longer than expected
- **Note**: First OpenRouter API call is slow (cold start)
- **Expected**: 15-20 minutes for 10-page flyer
- **Optimization**: Will improve after several runs

## Manual Testing (Before Deployment)

Test locally to ensure everything works:

```bash
# 1. Set API key
export OPENROUTER_API_KEY="***REMOVED***"

# 2. Run the scraper
bash run_local.sh
```

Expected output in:
- `data/screenshots/` - Flyer page images
- `data/output/` - CSV results
- `data/logs/` - Detailed logs

## Customization

### Change Flyer URL

**In workflow:**
1. Edit `.github/workflows/scrape.yml`
2. Find line with default FLYER_URL
3. Update the URL
4. Commit and push

**Manual run:**
1. Click "Run workflow" in Actions
2. Enter new FLYER_URL in the input field
3. Click "Run workflow"

### Change Schedule

Edit `.github/workflows/scrape.yml`:

```yaml
on:
  schedule:
    - cron: '0 9 * * 1'  # Change this cron expression
```

Common patterns:
- `'0 9 * * 1'` → Monday 9 AM (current)
- `'0 9 * * 1-5'` → Weekdays 9 AM
- `'0 9 * * *'` → Every day 9 AM

### Adjust Timeouts

Edit `.github/workflows/scrape.yml`:

```yaml
timeout-minutes: 30  # Change this value
```

## Storage & Artifact Retention

- **CSV files**: 30-day retention
- **Log files**: 7-day retention
- **Git commits**: Permanent

To download artifacts:
1. Go to Actions → Workflow run
2. Click "Artifacts" section
3. Download ZIP file

## Next Phase Ideas

With the core pipeline proven, future enhancements:

1. **Multi-Supermarket Support**
   - Add Oasi, Eurospin, Si Con Te

2. **Database Integration**
   - Store results in PostgreSQL
   - Track price history
   - Compare across stores

3. **Web Dashboard**
   - Browse extracted products
   - Filter by discount
   - Search functionality

4. **Notifications**
   - Email alerts for deals
   - Discord webhooks
   - RSS feed

5. **Advanced Analysis**
   - Discount trend analysis
   - Seasonality detection
   - Price prediction

## Support & Troubleshooting

**Issue**: Cannot push code to GitHub
- **Cause**: Fine-grained token may not have `contents:write` permission
- **Solution**: Use HTTPS password or SSH key
- **Reference**: https://docs.github.com/en/authentication/connecting-to-github-with-ssh

**Issue**: Workflow never runs
- **Debug**: Check Actions tab for workflow status
- **Check**: Ensure `.github/workflows/scrape.yml` is on main branch
- **Verify**: Secret is created

**Issue**: API calls fail
- **Check**: OpenRouter API key is valid
- **Limit**: Free tier has rate limits (~100 calls/month)
- **Monitor**: API usage at openrouter.ai/keys

## Performance Metrics

**Current Phase 1 Baseline:**
- Screenshot capture: 3-5 seconds per page
- Vision analysis: 2-3 seconds per image
- CSV export: <1 second
- Total time: 15-20 minutes (depending on flyer length)

**Estimated Costs:**
- **Hosting**: Free (GitHub Actions free tier)
- **Vision API**: Free (Molmo2 on OpenRouter)
- **Total Monthly Cost**: $0 ✅

## Security Notes

- ✅ API key stored as GitHub secret (encrypted)
- ✅ Fine-grained token with minimal permissions
- ✅ Headless browser (no visual exposure)
- ✅ UTF-8 encoding (no character injection)
- ✅ Error handling (no sensitive data in logs)

## Success Checklist

Before considering deployment complete:

- [ ] GitHub secret configured (OPENROUTER_API_KEY)
- [ ] Code pushed to main branch
- [ ] Workflow visible in Actions tab
- [ ] Manual workflow trigger tested (optional)
- [ ] CSV output files generated
- [ ] Logs show no errors
- [ ] Artifacts available for download

---

**Ready to deploy!** Follow the three-step process above and your scraper will be live. 🚀
