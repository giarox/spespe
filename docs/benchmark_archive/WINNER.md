# 🏆 Model Benchmark Results - Winner Selection

**Date:** January 16, 2026  
**Benchmark Run:** Single-page Lidl flyer analysis  
**Models Tested:** 6 vision models via OpenRouter  

---

## Winner: Google Gemini 2.5 Flash

**Selected for production use based on comprehensive benchmark testing.**

---

## Benchmark Summary

### Models Tested
1. ✅ **google/gemini-2.5-flash** ← WINNER
2. allenai/molmo-2-8b:free
3. mistralai/mistral-small-3.1-24b-instruct:free
4. google/gemini-2.5-flash-lite
5. x-ai/grok-4.1-fast
6. google/gemini-3-flash-preview

### Test Criteria
- **Product Count (30%)**: Extracted 6/6 expected products
- **Price Accuracy (25%)**: Correct current_price values
- **Field Completeness (15%)**: % of fields filled (brand, dates, notes, etc.)
- **Discount Accuracy (15%)**: Correct discount percentages
- **Date Accuracy (10%)**: Correct offer start/end dates
- **Italian Text Preservation (5%)**: Preserved "Coltivato in Italia" etc.

### Ground Truth Products
1. Broccoli (€0.89, -31%)
2. Filetto di petto di pollo a fette (€4.99, -28%)
3. Porchetta affettata (€1.59, -33%)
4. Frollini fior di grano (€1.39, -30%)
5. Chiocciole di pasta fillo (€2.99)
6. Macchina da cucire (€119.00)

---

## Why Gemini 2.5 Flash Won

### Strengths
✅ **Highest Overall Score** - Best weighted performance across all metrics  
✅ **Excellent Price Accuracy** - Correctly identified all product prices  
✅ **Complete Field Extraction** - Extracted brand, dates, notes consistently  
✅ **Italian Text Preservation** - Maintained "Coltivato in Italia" and other Italian text  
✅ **Reliable Performance** - Consistent results across test runs  
✅ **Good Speed** - Fast response times compared to other models  

### Production Advantages
- **No Hallucination**: Did not invent fake products
- **Image Recognition**: Properly received and analyzed attached images
- **Structured Output**: Followed pipe-separated format reliably
- **Date Parsing**: Correctly extracted offer validity dates

---

## Implementation

### Before (Benchmark Mode)
- 6-model fallback chain
- Broccoli validation checks
- Complex verification system
- ~1,100 lines of code

### After (Production Mode)
- Single model: Gemini 2.5 Flash
- Direct extraction → CSV
- Simplified codebase
- ~500 lines of code (55% reduction)

---

## Benchmark Files Archived

Original benchmark system files moved to this archive:
- `ground_truth.json` - Expected output for validation
- `score_models.py` - Scoring system (no longer needed)

These are kept for historical reference and future model re-evaluation if needed.

---

## Future Considerations

If Gemini 2.5 Flash performance degrades:
1. Re-run benchmark with new models
2. Compare against this baseline
3. Switch to new winner if justified

For now, Gemini 2.5 Flash is the clear choice for production.

---

**Status:** Production deployment completed  
**Next Review:** As needed based on extraction quality monitoring
