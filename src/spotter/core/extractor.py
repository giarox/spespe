"""
Product extraction logic from vision analysis results.
Transforms raw vision data into structured product records.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
import re

from src.spotter.core.logger import logger


class ProductExtractor:
    """Extracts and structures product data from vision analysis."""
    
    def __init__(self, supermarket: str = "Lidl"):
        """
        Initialize extractor.
        
        Args:
            supermarket: Name of supermarket
        """
        self.supermarket = self._to_title_case(supermarket)
        logger.info(f"ProductExtractor initialized for: {self.supermarket}")
    
    def _to_title_case(self, text: Optional[str]) -> Optional[str]:
        """
        Convert ALL CAPS strings to Title Case, while preserving mixed-case.
        
        Args:
            text: Input text string
            
        Returns:
            Title Cased string or original if mixed case
        """
        if not text or not isinstance(text, str):
            return text
            
        # If it's all uppercase and has letters, convert to Title Case
        if text.isupper():
            return text.title()
            
        return text
    
    def _parse_price(self, price_str: Optional[str]) -> Optional[float]:
        """
        Parse price string to float.
        
        Args:
            price_str: Price string (e.g., "1,99", "€1.99", "1.99€") or float
            
        Returns:
            Float price or None if parsing fails
        """
        if not price_str:
            return None
        
        # Handle if already a float (from vision.py parser)
        if isinstance(price_str, (float, int)):
            return float(price_str)
        
        try:
            # Remove currency symbols and whitespace
            cleaned = str(price_str).replace("€", "").replace(",", ".").strip()
            # If there's multiple numbers or something, try to just get the first decimal
            match = re.search(r'(\d+\.\d+)', cleaned)
            if match:
                price = float(match.group(1))
            else:
                price = float(cleaned)
            logger.debug(f"Parsed price: {price_str} -> {price}")
            return price
        except (ValueError, AttributeError, IndexError) as e:
            logger.warning(f"Failed to parse price: '{price_str}' - {e}")
            return None
    
    def _parse_discount(self, discount_str: Optional[str]) -> Optional[float]:
        """
        Parse discount percentage.
        
        Args:
            discount_str: Discount string (e.g., "20%", "-20%")
            
        Returns:
            Float discount percentage (0-100), or None if parsing fails
        """
        if not discount_str:
            return None
        
        try:
            # Extract numbers
            match = re.search(r'(-?\d+\.?\d*)', discount_str)
            if match:
                discount = float(match.group(1))
                logger.debug(f"Parsed discount: {discount_str} -> {discount}%")
                return abs(discount)
        except ValueError:
            logger.debug(f"Failed to parse discount: {discount_str}")
        
        return None
    
    def extract_product_record(
        self,
        product_data: Dict[str, Any],
        page_num: int,
        flyer_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Transform raw vision data into a complete product record.
        
        Args:
            product_data: Raw product data from vision model
            page_num: Page number in flyer
            flyer_date: Flyer valid date
            
        Returns:
            Structured product record
        """
        try:
            # Parse prices (handle both old and new field names)
            old_price = self._parse_price(
                product_data.get("old_price") or product_data.get("original_price")
            )
            current_price = self._parse_price(
                product_data.get("current_price") or product_data.get("discounted_price")
            )
            
            # Get discount (from vision or calculate)
            discount_percent_str = product_data.get("discount_percent") or product_data.get("discount")
            discount_percent = self._parse_discount(discount_percent_str) if discount_percent_str else None
            
            # Calculate discount if not provided
            if old_price and current_price and not discount_percent:
                discount_percent = round(
                    ((old_price - current_price) / old_price) * 100,
                    2
                )
                logger.debug(f"Calculated discount: {discount_percent}%")
            
            # Build complete record with ALL fields from vision parser
            record = {
                # Supermarket info
                "supermarket": self.supermarket,
                "retailer": self._to_title_case(product_data.get("retailer")),
                
                # Product details
                "product_name": self._to_title_case((product_data.get("name") or "").strip()),
                "brand": self._to_title_case(product_data.get("brand")),
                "description": product_data.get("description"),
                
                # Pricing
                "current_price": current_price,
                "old_price": old_price,
                "discount_percent": f"-{discount_percent}%" if discount_percent else None,
                "saving_amount": product_data.get("saving_amount"),
                "saving_type": product_data.get("saving_type"),
                
                # Measurements
                "weight_or_pack": product_data.get("weight_or_pack") or product_data.get("details"),
                "price_per_unit": product_data.get("price_per_unit"),
                
                # Dates
                "offer_start_date": product_data.get("offer_start_date"),
                "offer_end_date": product_data.get("offer_end_date"),
                "global_validity_start": product_data.get("global_validity", {}).get("start_date") if isinstance(product_data.get("global_validity"), dict) else None,
                "global_validity_end": product_data.get("global_validity", {}).get("end_date") if isinstance(product_data.get("global_validity"), dict) else None,
                
                # Metadata
                "confidence": product_data.get("confidence", 0.0),
                "notes": product_data.get("notes"),
                "extraction_quality": product_data.get("extraction_quality"),
                "extracted_at": datetime.now().isoformat(),
                
                # Legacy fields for backward compatibility
                "page_number": page_num,
                "flyer_date": flyer_date or datetime.now().strftime("%Y-%m-%d"),
            }
            
            logger.debug(f"Extracted product: {record['product_name']} - €{record['current_price']}")
            
            return record
            
        except Exception as e:
            logger.error(f"Failed to extract product record: {e}", exc_info=True)
            return {}
    
    def extract_all_products(
        self,
        vision_results: Dict[str, Any],
        flyer_date: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Extract all products from vision analysis results.
        
        Args:
            vision_results: Results from vision analyzer
            flyer_date: Flyer valid date
            
        Returns:
            List of product records
        """
        products = []
        
        logger.info("Starting product extraction from vision results")
        
        by_page = vision_results.get("by_page", {})
        logger.info(f"Processing {len(by_page)} pages")
        
        for page_idx, (image_path, page_data) in enumerate(by_page.items(), 1):
            logger.debug(f"Processing page {page_idx}: {image_path}")
            
            if not page_data:
                logger.warning(f"Page {page_idx} has no data, skipping")
                continue
            
            page_products = page_data.get("products", [])
            logger.info(f"Page {page_idx}: Found {len(page_products)} products")
            
            for product_data in page_products:
                record = self.extract_product_record(product_data, page_idx, flyer_date)
                if record and record.get("product_name"):
                    products.append(record)
                else:
                    logger.warning(f"Skipped invalid product record on page {page_idx}")
        
        logger.info(f"Extraction complete. Total products: {len(products)}")
        
        return products
    
    def validate_products(self, products: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Validate extracted products and report statistics.
        
        Args:
            products: List of product records
            
        Returns:
            Validation report
        """
        logger.info(f"Validating {len(products)} products")
        
        report = {
            "total": len(products),
            "with_prices": 0,
            "with_discounts": 0,
            "avg_confidence": 0.0,
            "issues": []
        }
        
        confidence_scores = []
        
        for product in products:
            if product.get("current_price"):
                report["with_prices"] += 1
            
            if product.get("discount_percent"):
                report["with_discounts"] += 1
            
            confidence = product.get("confidence", 0.0)
            confidence_scores.append(confidence)
            
            # Check for potential issues
            if not product.get("product_name"):
                report["issues"].append(f"Product missing name: {product}")
            
            if confidence < 0.5:
                report["issues"].append(
                    f"Low confidence ({confidence}): {product.get('product_name')}"
                )
        
        if confidence_scores:
            report["avg_confidence"] = round(sum(confidence_scores) / len(confidence_scores), 3)
        
        logger.info(f"Validation report: {report['with_prices']}/{report['total']} with prices")
        logger.info(f"Average confidence score: {report['avg_confidence']}")
        
        if report["issues"]:
            logger.warning(f"Found {len(report['issues'])} validation issues")
            for issue in report["issues"][:5]:  # Log first 5
                logger.warning(f"  - {issue}")
        
        return report
