"""
Main entry point for the Spespe Spotter pipeline.
Orchestrates flyer capture, vision analysis, and data export.
"""

import argparse
import os
import sys
from typing import Optional

from src.spotter.core.logger import logger
from src.spotter.core.flyer_browser import capture_flyer_sync
from src.spotter.core.vision import analyze_screenshots
from src.spotter.core.extractor import ProductExtractor
from src.spotter.core.csv_export import export_products
from src.spotter.core.run_registry import record_run, should_skip_run
from src.spotter.config import STORE_CONFIGS


def run_spotter(
    flyer_url: str,
    openrouter_api_key: str,
    flyer_date: Optional[str] = None,
    output_dir: Optional[str] = None,
    supermarket: str = "Lidl"
) -> tuple[bool, dict]:
    """
    Main Spotter pipeline.

    Args:
        flyer_url: URL of the flyer
        openrouter_api_key: OpenRouter API key
        flyer_date: Optional flyer date (YYYY-MM-DD)
        output_dir: Optional output directory
        supermarket: Supermarket name

    Returns:
        True if successful, False otherwise
    """
    logger.info("=" * 80)
    logger.info("SPESPE - Spotter Pipeline")
    logger.info("=" * 80)

    try:
        logger.info("\n[STEP 1] Flyer Capture")
        logger.info("-" * 80)

        logger.info(f"Target flyer URL: {flyer_url}")
        screenshots = capture_flyer_sync(flyer_url, store_config.get("cookie_selectors"))
        page_count = len(screenshots)

        if not screenshots:
            logger.error("No screenshots captured. Aborting.")
            return False, {}

        logger.info(f"Successfully captured {len(screenshots)} screenshots")

        logger.info("\n[STEP 2] Vision Analysis")
        logger.info("-" * 80)

        logger.info(f"Analyzing {len(screenshots)} screenshots...")
        vision_results = analyze_screenshots(openrouter_api_key, screenshots)

        logger.info("Vision analysis complete:")
        logger.info(f"  - Total images analyzed: {vision_results['total_images']}")
        logger.info(f"  - Successful analyses: {vision_results['successful_analyses']}")
        logger.info(f"  - Failed analyses: {vision_results['failed_analyses']}")
        logger.info(f"  - Total products extracted: {vision_results['total_products']}")

        if vision_results["total_products"] == 0:
            logger.warning("No products found. This might indicate:")
            logger.warning("  1. Flyer not loading correctly")
            logger.warning("  2. Vision model accuracy issue")
            logger.warning("  3. Empty or invalid flyer")

        logger.info("\n[STEP 3] Product Extraction")
        logger.info("-" * 80)

        extractor = ProductExtractor(supermarket=supermarket)
        products = extractor.extract_all_products(vision_results, flyer_date)

        logger.info(f"Extracted {len(products)} structured product records")

        logger.info("\n[STEP 4] Validation")
        logger.info("-" * 80)

        validation_report = extractor.validate_products(products)

        logger.info("Validation Report:")
        logger.info(f"  - Total products: {validation_report['total']}")
        logger.info(f"  - With prices: {validation_report['with_prices']}")
        logger.info(f"  - With discounts: {validation_report['with_discounts']}")
        logger.info(f"  - Avg confidence: {validation_report['avg_confidence']}")

        logger.info("\n[STEP 5] CSV Export")
        logger.info("-" * 80)

        csv_path = export_products(products, output_dir if output_dir else "data/output")
        logger.info(f"CSV file exported: {csv_path}")

        logger.info("\n" + "=" * 80)
        logger.info("SPOTTER COMPLETE - SUMMARY")
        logger.info("=" * 80)
        logger.info(f"Flyer URL:           {flyer_url}")
        logger.info(f"Screenshots:         {len(screenshots)}")
        logger.info(f"Products Extracted:  {validation_report['total']}")
        logger.info(f"With Prices:         {validation_report['with_prices']}")
        logger.info(f"With Discounts:      {validation_report['with_discounts']}")
        logger.info(f"Avg Confidence:      {validation_report['avg_confidence']}")
        logger.info(f"Output CSV:          {csv_path}")
        logger.info("=" * 80)

        return True, {
            "page_count": page_count,
            "screenshot_paths": screenshots,
            "product_count": validation_report["total"]
        }

    except Exception as e:
        logger.error(f"Pipeline failed with error: {e}", exc_info=True)
        logger.error("=" * 80)
        logger.error("SPOTTER FAILED")
        logger.error("=" * 80)
        return False, {}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run Spespe Spotter")
    parser.add_argument("--store", default="lidl", help="Store key (lidl, oasi_tigre)")
    parser.add_argument("--flyer-url", dest="flyer_url", help="Flyer URL override")
    parser.add_argument("--flyer-date", dest="flyer_date", help="Flyer date YYYY-MM-DD")
    parser.add_argument("--output-dir", dest="output_dir", help="Output directory")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    store_key = args.store.lower()
    store_config = STORE_CONFIGS.get(store_key, STORE_CONFIGS["lidl"])
    store_label = store_config["retailer"]

    api_key = os.getenv("OPENROUTER_API_KEY")
    flyer_url = args.flyer_url or os.getenv("SPOTTER_FLYER_URL", store_config["flyer_url"])
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")

    if not api_key:
        logger.error("OPENROUTER_API_KEY environment variable not set")
        sys.exit(1)

    logger.info("Configuration loaded from environment variables")
    logger.info(f"Spotter store: {store_key}")
    logger.info(f"Flyer URL: {flyer_url}")

    if supabase_url and supabase_key:
        if should_skip_run(supabase_url, supabase_key, store_key, flyer_url):
            logger.info("Spotter run skipped (recent run detected)")
            sys.exit(0)

    success, run_meta = run_spotter(
        flyer_url=flyer_url,
        openrouter_api_key=api_key,
        flyer_date=args.flyer_date,
        output_dir=args.output_dir,
        supermarket=store_label
    )

    if success and supabase_url and supabase_key:
        record_run(
            supabase_url,
            supabase_key,
            store_key,
            flyer_url,
            page_count=run_meta.get("page_count", 0),
            screenshot_paths=run_meta.get("screenshot_paths", []),
            product_count=run_meta.get("product_count", 0)
        )

    sys.exit(0 if success else 1)
