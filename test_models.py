#!/usr/bin/env python3
"""
Test script to evaluate all 3 vision models independently.
This helps identify which model works best for Lidl flyer extraction.
"""

import os
import sys
import json
import tempfile
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

from src.browser import capture_flyer_sync
from src.vision import VisionAnalyzer
from src.logger import logger

def test_all_models():
    """Test all 3 models on the same screenshot."""
    
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        logger.error("OPENROUTER_API_KEY not set")
        sys.exit(1)
    
    # Default Lidl flyer URL
    flyer_url = "https://www.lidl.it/l/it/volantini/offerte-valide-dal-19-01-al-25-01-volantino-settimanale-9e63be/view/flyer/page/1"
    
    logger.info("=" * 80)
    logger.info("SPESPE MODEL COMPARISON TEST")
    logger.info("=" * 80)
    logger.info(f"Testing URL: {flyer_url}")
    logger.info("")
    
    # Step 1: Capture screenshot
    logger.info("STEP 1: Capturing flyer screenshot...")
    try:
        screenshot_paths = capture_flyer_sync(flyer_url)
        
        if not screenshot_paths:
            logger.error("✗ No screenshots captured")
            sys.exit(1)
        
        # Use first page for testing
        screenshot_path = screenshot_paths[0]
        logger.info(f"✓ Screenshot saved to: {screenshot_path}")
        
        # Verify file exists and has size
        file_size = Path(screenshot_path).stat().st_size
        logger.info(f"✓ File size: {file_size} bytes")
        
    except Exception as e:
        logger.error(f"✗ Failed to capture screenshot: {e}", exc_info=True)
        sys.exit(1)
    
    # Step 2: Test each model independently
    logger.info("")
    logger.info("=" * 80)
    logger.info("STEP 2: Testing all 3 models...")
    logger.info("=" * 80)
    
    models = [
        "allenai/molmo-2-8b:free",
        "nvidia/nemotron-nano-12b-v2-vl:free",
        "mistralai/mistral-small-3.1-24b-instruct:free",
    ]
    
    results = {}
    
    for idx, model_name in enumerate(models, 1):
        logger.info("")
        logger.info(f"[{idx}/3] Testing model: {model_name}")
        logger.info("-" * 80)
        
        try:
            # Create a custom analyzer for this model
            analyzer = VisionAnalyzer(api_key)
            analyzer.model = model_name
            analyzer.current_model_index = idx - 1
            
            # Analyze the screenshot
            result = analyzer._analyze_with_current_model(screenshot_path)
            
            if result:
                product_count = result.get("total_products_found", 0)
                logger.info(f"✓ Model returned {product_count} products")
                
                if product_count > 0:
                    logger.info("✓ Products found:")
                    for i, product in enumerate(result.get("products", [])[:5], 1):
                        logger.info(f"  {i}. {product.get('name')} - {product.get('current_price')}€ (confidence: {product.get('confidence', 'N/A')})")
                    
                    if len(result.get("products", [])) > 5:
                        logger.info(f"  ... and {len(result['products']) - 5} more")
                    
                    # Check if Broccoli is found
                    product_names = [p.get('name', '').lower() for p in result.get('products', [])]
                    if any('broccoli' in name for name in product_names):
                        logger.info("  ✓✓ BROCCOLI FOUND!")
                        results[model_name] = {
                            "count": product_count,
                            "status": "SUCCESS",
                            "found_broccoli": True,
                            "quality": "EXCELLENT"
                        }
                    else:
                        logger.info("  ✗ Broccoli NOT found (possible hallucination)")
                        results[model_name] = {
                            "count": product_count,
                            "status": "FOUND PRODUCTS",
                            "found_broccoli": False,
                            "quality": "SUSPICIOUS (hallucinating?)"
                        }
                else:
                    logger.warning(f"✗ Model found 0 products")
                    results[model_name] = {
                        "count": 0,
                        "status": "FAILED",
                        "found_broccoli": False,
                        "quality": "NO EXTRACTION"
                    }
                
                # Log quality notes
                if result.get("quality_notes"):
                    logger.info(f"  Quality notes: {result['quality_notes']}")
                
                # Store full result
                results[model_name]["full_result"] = result
                
            else:
                logger.error(f"✗ Model returned None (API error or parsing failed)")
                results[model_name] = {
                    "count": 0,
                    "status": "ERROR",
                    "found_broccoli": False,
                    "quality": "API ERROR"
                }
        
        except Exception as e:
            logger.error(f"✗ Exception while testing model: {e}", exc_info=True)
            results[model_name] = {
                "count": 0,
                "status": "EXCEPTION",
                "found_broccoli": False,
                "quality": str(e)
            }
    
    # Step 3: Summary comparison
    logger.info("")
    logger.info("=" * 80)
    logger.info("STEP 3: Model Comparison Summary")
    logger.info("=" * 80)
    
    for idx, model_name in enumerate(models, 1):
        result = results[model_name]
        status = result["status"]
        count = result["count"]
        broccoli = "✓ YES" if result["found_broccoli"] else "✗ NO"
        quality = result["quality"]
        
        logger.info(f"{idx}. {model_name}")
        logger.info(f"   Status: {status}")
        logger.info(f"   Products found: {count}")
        logger.info(f"   Broccoli found: {broccoli}")
        logger.info(f"   Quality: {quality}")
        logger.info("")
    
    # Step 4: Recommendation
    logger.info("=" * 80)
    logger.info("RECOMMENDATION")
    logger.info("=" * 80)
    
    successful_models = [m for m, r in results.items() if r["found_broccoli"]]
    
    if successful_models:
        logger.info(f"✓ Model(s) that found Broccoli (real product):")
        for model in successful_models:
            count = results[model]["count"]
            logger.info(f"  - {model} ({count} products)")
        logger.info("")
        logger.info("ACTION: Use this model as primary or fallback")
    else:
        logger.warning("✗ No model found Broccoli - all may be hallucinating")
        logger.info("")
        logger.info("Checking which model found the most products:")
        sorted_by_count = sorted(results.items(), key=lambda x: x[1]["count"], reverse=True)
        for model, result in sorted_by_count:
            logger.info(f"  - {model}: {result['count']} products")
        logger.info("")
        logger.info("ACTION: Revise prompt further to reduce hallucinations")
    
    # Save results to file
    logger.info("")
    logger.info("=" * 80)
    results_file = Path("test_results.json")
    
    # Prepare results for JSON serialization (remove full_result)
    summary_results = {}
    for model, result in results.items():
        summary_results[model] = {
            "count": result["count"],
            "status": result["status"],
            "found_broccoli": result["found_broccoli"],
            "quality": result["quality"]
        }
    
    with open(results_file, "w") as f:
        json.dump(summary_results, f, indent=2)
    
    logger.info(f"✓ Results saved to: {results_file}")


if __name__ == "__main__":
    test_all_models()
