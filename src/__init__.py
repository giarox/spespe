"""
Spespe - Italian Supermarket Spotter
Phase 1: Concept Validation
"""

__version__ = "0.1.0"
__author__ = "giarox"

from src.logger import logger
from src.browser import capture_flyer_sync
from src.vision import analyze_screenshots
from src.extractor import ProductExtractor
from src.csv_export import export_products

__all__ = [
    "logger",
    "capture_flyer_sync",
    "analyze_screenshots",
    "ProductExtractor",
    "export_products",
]
