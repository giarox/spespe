# Spespe - Quick Start Guide

## ⚡ 3 Steps to Deploy

### Step 1: Configure GitHub Secret (2 min)

Go to: **github.com/giarox/spespe/settings/secrets/actions**

Click "New repository secret":
- **Name**: `OPENROUTER_API_KEY`
- **Value**: `***REMOVED***`

### Step 2: Push Code to GitHub (1 min)

```bash
cd /Users/gianlucarusso/spespe
git remote add origin https://github.com/giarox/spespe.git
git push -u origin main
```

### Step 3: Verify & Go (5 min)

Go to: **github.com/giarox/spespe/actions**

You should see:
- ✅ "Spespe - Weekly Flyer Scraper" workflow listed
- ✅ Ready to run every Monday 9 AM UTC
- ✅ Or click "Run workflow" to test now

---

## 🧪 Test Locally First (Optional)

```bash
# 1. Set environment variable
export OPENROUTER_API_KEY="***REMOVED***"

# 2. Run the scraper
bash run_local.sh
```

Expected output:
- `data/output/lidl_products_*.csv` - Product data
- `data/logs/scraper_*.log` - Detailed logs
- `data/screenshots/` - Flyer page images

---

## 📚 Documentation

| File | Purpose |
|------|---------|
| `README.md` | Project overview |
| `SETUP.md` | Local installation |
| `DEPLOYMENT.md` | GitHub Actions guide |
| `PROJECT_SUMMARY.md` | Complete status report |

---

## ✅ What's Ready

- ✅ 7 core modules
- ✅ 11 integration tests (all passing)
- ✅ GitHub Actions workflow
- ✅ Complete documentation
- ✅ Error handling & logging
- ✅ CSV export with UTF-8

---

## 🔧 Stack

- Python 3.11
- Playwright (browser)
- Molmo2 8B (vision AI)
- OpenRouter API (free tier)
- GitHub Actions (CI/CD)

---

## 📊 Expected Output

**CSV Format**: `lidl_products_YYYYMMDD_HHMMSS.csv`

```
supermarket,flyer_date,page_number,product_name,original_price,discounted_price,discount_percentage,details,confidence_score,extraction_timestamp
Lidl,2024-01-20,1,Pasta Barilla 500g,2.50,1.99,20.0,500g,0.95,2024-01-15T10:30:00
Lidl,2024-01-20,1,Pane Integrale,1.50,1.20,20.0,500g,0.89,2024-01-15T10:30:05
...
```

---

## 🚀 Next Steps

1. **Configure Secret** → 2 minutes
2. **Push Code** → 1 minute
3. **Verify Workflow** → 5 minutes
4. **Done!** 🎉

---

**Need help?** Check the relevant doc file above.
