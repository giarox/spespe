# Vision Model Comparison Test Guide

## Problem

The Molmo 2 8B model is **hallucinating products** that don't exist on the Lidl flyer:
- "Organic Apples", "Whole Chicken" (not visible on actual flyer)
- Missing real products like "Broccoli" (which IS visible)

## Solution

We've created a test to compare all 3 vision models and identify which ones actually extract real products.

## How to Run

### Via GitHub Actions (Recommended)

1. Go to your GitHub repository: https://github.com/giarox/spespe
2. Click the **Actions** tab
3. Find the workflow: **"Test Vision Models"**
4. Click **"Run workflow"**
5. Select **main** branch
6. Click the green **"Run workflow"** button

The workflow will:
- Capture a screenshot of the current Lidl flyer
- Test all 3 models independently on the same screenshot
- Check if each model finds "Broccoli" (real product on flyer)
- Generate a comparison report
- Upload artifacts with results

### Via Local Terminal

If you have your OpenRouter API key available:

```bash
export OPENROUTER_API_KEY="your-api-key-here"
cd /Users/gianlucarusso/spespe
python3 test_models.py
```

This will output detailed logs and create `test_results.json` with comparison results.

## What to Look For

The test will show results like:

```
[1/3] Testing model: allenai/molmo-2-8b:free
✓ Model returned 6 products
  1. Broccoli - 0.89€ (confidence: 0.95)
  2. Filetto di pollo - 4.99€ (confidence: 0.92)
  ...
  ✓✓ BROCCOLI FOUND!

[2/3] Testing model: nvidia/nemotron-nano-12b-v2-vl:free
✓ Model returned 0 products
✗ Model found 0 products

[3/3] Testing model: mistralai/mistral-small-3.1-24b-instruct:free
✓ Model returned 8 products
  1. Broccoli - 0.89€ (confidence: 0.88)
  2. Filetto di pollo - 4.99€ (confidence: 0.85)
  ...
  ✓✓ BROCCOLI FOUND!
```

## Interpreting Results

### Success Case ✓
If a model finds "Broccoli" with a high confidence (≥0.7):
- That model is **reliable**
- The prompt is **working correctly**
- Use that model as primary or increase its priority

### Hallucination Case ✗
If a model finds many products but NOT "Broccoli":
- That model is **hallucinating**
- Skip this model or move it to end of fallback chain
- The prompt needs more specificity

### 0 Products Case ✗
If a model returns 0 products:
- Model may be too conservative
- Check logs for API errors vs. actual extraction failure
- Usually a fallback candidate

## Next Steps Based on Results

### Scenario 1: All models hallucinating
→ Revise the prompt to be more conservative (higher confidence threshold)
→ Add explicit instructions to verify each product visually

### Scenario 2: One model finding real products
→ Make that model the primary model
→ Reorder MODELS list in src/vision.py
→ Remove or deprioritize hallucinating models

### Scenario 3: Multiple models working
→ Keep the fallback strategy as-is
→ Both models are reliable

### Scenario 4: All models failing (0 products)
→ Problem is not model-specific
→ Screenshot quality issue or flyer layout changed
→ Check uploaded flyer screenshot in artifacts

## Files Involved

- `test_models.py` - Main test script
- `.github/workflows/test-models.yml` - GitHub Actions workflow
- `src/vision.py` - Vision analyzer with model definitions
- `test_results.json` - Generated comparison results
- `test_output.log` - Detailed test logs

## Important Notes

1. The test captures a **fresh screenshot** each run - the flyer may have changed
2. API calls count against your OpenRouter quota
3. Each model call takes ~15-30 seconds
4. Total test time: ~2-3 minutes (3 models × 30 seconds)
5. Screenshots and logs are saved as GitHub Actions artifacts for review

## Cleanup

After you're done with testing:
- You can delete `test_models.py` and `.github/workflows/test-models.yml`
- Or keep them for future model evaluation
- GitHub Actions artifacts auto-delete after 7-30 days based on retention policy
