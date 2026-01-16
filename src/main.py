"""
Main entry point for the Spespe scraper.
Orchestrates browser automation, vision analysis, and data export.
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

from src.logger import logger
from src.browser import capture_flyer_sync
from src.vision import analyze_screenshots
from src.extractor import ProductExtractor
from src.csv_export import export_products


def main(
    flyer_url: str,
    openrouter_api_key: str,
    flyer_date: Optional[str] = None,
    output_dir: Optional[str] = None
) -> bool:
    """
    Main scraper pipeline.
    
    Args:
        flyer_url: URL of the Lidl flyer
        openrouter_api_key: OpenRouter API key
        flyer_date: Optional flyer date (YYYY-MM-DD)
        output_dir: Optional output directory
        
    Returns:
        True if successful, False otherwise
    """
    logger.info("=" * 80)
    logger.info("SPESPE - Italian Supermarket Price Scraper - Phase 1")
    logger.info("=" * 80)
    
    try:
        # Step 1: Browser Automation - Capture Screenshots
        logger.info("\n[STEP 1] Browser Automation - Capturing Flyer Screenshots")
        logger.info("-" * 80)
        
        logger.info(f"Target flyer URL: {flyer_url}")
        screenshots = capture_flyer_sync(flyer_url)
        
        if not screenshots:
            logger.error("No screenshots captured. Aborting.")
            return False
        
        logger.info(f"Successfully captured {len(screenshots)} screenshots")
        
        # Step 2: Vision Analysis - Extract Product Data
        logger.info("\n[STEP 2] Vision Analysis - Extracting Products with Molmo2 8B")
        logger.info("-" * 80)
        
        logger.info(f"Analyzing {len(screenshots)} screenshots with OpenRouter Molmo2...")
        vision_results = analyze_screenshots(openrouter_api_key, screenshots)
        
        logger.info(f"Vision analysis complete:")
        logger.info(f"  - Total images analyzed: {vision_results['total_images']}")
        logger.info(f"  - Successful analyses: {vision_results['successful_analyses']}")
        logger.info(f"  - Failed analyses: {vision_results['failed_analyses']}")
        logger.info(f"  - Total products extracted: {vision_results['total_products']}")
        
        if vision_results["total_products"] == 0:
            logger.warning("No products found. This might indicate:")
            logger.warning("  1. Flyer not loading correctly")
            logger.warning("  2. Vision model accuracy issue")
            logger.warning("  3. Empty or invalid flyer")
        
        # Step 3: Product Extraction - Structure Data
        logger.info("\n[STEP 3] Product Extraction - Structuring Data")
        logger.info("-" * 80)
        
        extractor = ProductExtractor(supermarket="Lidl")
        products = extractor.extract_all_products(vision_results, flyer_date)
        
        logger.info(f"Extracted {len(products)} structured product records")
        
        # Step 4: Validation - Quality Check
        logger.info("\n[STEP 4] Validation - Quality Assurance")
        logger.info("-" * 80)
        
        validation_report = extractor.validate_products(products)
        
        logger.info(f"Validation Report:")
        logger.info(f"  - Total products: {validation_report['total']}")
        logger.info(f"  - With prices: {validation_report['with_prices']}")
        logger.info(f"  - With discounts: {validation_report['with_discounts']}")
        logger.info(f"  - Avg confidence: {validation_report['avg_confidence']}")
        
        if validation_report["issues"]:
            logger.warning(f"Found {len(validation_report['issues'])} validation issues")
        
        # Step 5: CSV Export - Save Results
        logger.info("\n[STEP 5] CSV Export - Saving Results")
        logger.info("-" * 80)
        
        csv_path = export_products(products, output_dir=output_dir)
        logger.info(f"CSV file exported: {csv_path}")
        
        # Final Summary
        logger.info("\n" + "=" * 80)
        logger.info("SCRAPING COMPLETE - SUMMARY")
        logger.info("=" * 80)
        logger.info(f"Flyer URL:           {flyer_url}")
        logger.info(f"Screenshots:         {len(screenshots)}")
        logger.info(f"Products Extracted:  {len(products)}")
        logger.info(f"With Prices:         {validation_report['with_prices']}")
        logger.info(f"With Discounts:      {validation_report['with_discounts']}")
        logger.info(f"Avg Confidence:      {validation_report['avg_confidence']}")
        logger.info(f"Output CSV:          {csv_path}")
        logger.info("=" * 80)
        
        return True
        
    except Exception as e:
        logger.error(f"Pipeline failed with error: {e}", exc_info=True)
        logger.error("=" * 80)
        logger.error("SCRAPING FAILED")
        logger.error("=" * 80)
        return False


if __name__ == "__main__":
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Spespe - Supermarket Price Scraper')
    parser.add_argument('--benchmark', action='store_true',
                        help='Benchmark mode: run ALL models and save outputs for comparison')
    args = parser.parse_args()
    
    # Get configuration from environment variables
    api_key = os.getenv("OPENROUTER_API_KEY")
    flyer_url = os.getenv(
        "FLYER_URL",
        "https://www.lidl.it/l/it/volantini/offerte-valide-dal-19-01-al-25-01-volantino-settimanale-9e63be/view/flyer/page/1"
    )
    
    if not api_key:
        logger.error("OPENROUTER_API_KEY environment variable not set")
        sys.exit(1)
    
    logger.info(f"Configuration loaded from environment variables")
    logger.info(f"Flyer URL: {flyer_url}")
    
    # BENCHMARK MODE
    if args.benchmark:
        logger.info("\n" + "=" * 80)
        logger.info("🔬 BENCHMARK MODE ACTIVATED")
        logger.info("=" * 80)
        logger.info("Running ALL models for comparison\n")
        
        try:
            # Step 1: Capture screenshot
            logger.info("[STEP 1] Capturing flyer screenshot")
            logger.info("-" * 80)
            screenshots = capture_flyer_sync(flyer_url)
            
            if not screenshots:
                logger.error("No screenshots captured. Aborting.")
                sys.exit(1)
            
            logger.info(f"✓ Captured {len(screenshots)} screenshot(s)")
            
            # Step 2: Run benchmark - all models
            logger.info("\n[STEP 2] Running benchmark on all models")
            logger.info("-" * 80)
            
            all_results = analyze_screenshots(api_key, screenshots, benchmark_mode=True)
            
            if not all_results:
                logger.error("Benchmark returned no results")
                sys.exit(1)
            
            # Step 3: Save results
            logger.info("\n[STEP 3] Saving benchmark results")
            logger.info("-" * 80)
            
            benchmark_dir = Path("data/benchmark")
            benchmark_dir.mkdir(parents=True, exist_ok=True)
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            
            # Save each model's output
            saved_files = []
            for model_name, result in all_results:
                safe_name = model_name.replace('/', '_').replace(':', '_')
                output_file = benchmark_dir / f"{safe_name}_{timestamp}.json"
                
                with open(output_file, 'w', encoding='utf-8') as f:
                    json.dump(result, f, indent=2, ensure_ascii=False)
                
                saved_files.append(output_file)
                
                product_count = result.get('total_products_found', 0) if result else 0
                logger.info(f"💾 {model_name}: {product_count} products → {output_file.name}")
            
            # Save metadata
            metadata = {
                "timestamp": timestamp,
                "flyer_url": flyer_url,
                "models_tested": [m for m, _ in all_results],
                "screenshot_count": len(screenshots),
                "output_files": [str(f) for f in saved_files]
            }
            
            metadata_file = benchmark_dir / f"metadata_{timestamp}.json"
            with open(metadata_file, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2, ensure_ascii=False)
            
            logger.info(f"\n💾 Metadata saved: {metadata_file}")
            
            # Summary
            logger.info("\n" + "=" * 80)
            logger.info("✅ BENCHMARK COMPLETE")
            logger.info("=" * 80)
            logger.info(f"Results directory: {benchmark_dir}")
            logger.info(f"Total models tested: {len(all_results)}")
            logger.info(f"\nNext steps:")
            logger.info(f"1. Run scoring: python scripts/score_models.py {metadata_file}")
            logger.info(f"2. Review outputs in: {benchmark_dir}/")
            logger.info("=" * 80)
            
            sys.exit(0)
            
        except Exception as e:
            logger.error(f"Benchmark failed: {e}", exc_info=True)
            sys.exit(1)
    
    # NORMAL MODE - Run pipeline
    success = main(
        flyer_url=flyer_url,
        openrouter_api_key=api_key,
        output_dir=None
    )
    
    sys.exit(0 if success else 1)
