"""
Main entry point for the Spespe scraper.
Orchestrates browser automation, vision analysis, and data export.
"""

import os
import sys
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
    
    # Run pipeline
    success = main(
        flyer_url=flyer_url,
        openrouter_api_key=api_key,
        output_dir=None
    )
    
    sys.exit(0 if success else 1)
