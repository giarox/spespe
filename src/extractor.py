"""
Product extraction logic from vision analysis results.
Transforms raw vision data into structured product records.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
import re

from src.logger import logger


class ProductExtractor:
    """Extracts and structures product data from vision analysis."""
    
    def __init__(self, supermarket: str = "Lidl"):
        """
        Initialize extractor.
        
        Args:
            supermarket: Name of supermarket
        """
        self.supermarket = supermarket
        logger.info(f"ProductExtractor initialized for: {supermarket}")
    
    def _parse_price(self, price_str: Optional[str]) -> Optional[float]:
        """
        Parse price string to float.
        Handles various Italian price formats.
        
        Args:
            price_str: Price string (e.g., "10,99€", "€10.99", "10.99")
            
        Returns:
            Float price, or None if parsing fails
        """
        if not price_str:
            return None
        
        try:
            # Remove currency symbols and whitespace
            cleaned = price_str.replace("€", "").replace(",", ".").strip()
            price = float(cleaned)
            logger.debug(f"Parsed price: {price_str} -> {price}")
            return price
        except ValueError:
            logger.debug(f"Failed to parse price: {price_str}")
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
            original_price = self._parse_price(product_data.get("original_price"))
            current_price = self._parse_price(product_data.get("current_price"))
            discount_percent = self._parse_discount(product_data.get("discount_percent"))
            
            # Calculate discount if not provided
            if original_price and current_price and not discount_percent:
                discount_percent = round(
                    ((original_price - current_price) / original_price) * 100,
                    2
                )
                logger.debug(f"Calculated discount: {discount_percent}%")
            
            record = {
                "supermarket": self.supermarket,
                "flyer_date": flyer_date or datetime.now().strftime("%Y-%m-%d"),
                "page_number": page_num,
                "product_name": product_data.get("name", "").strip(),
                "original_price": original_price,
                "discounted_price": current_price,
                "discount_percentage": discount_percent,
                "extraction_timestamp": datetime.now().isoformat(),
                "confidence_score": product_data.get("confidence", 0.0),
                "details": product_data.get("details", "")
            }
            
            logger.debug(f"Extracted product: {record['product_name']} - {record['discounted_price']}€")
            
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
            if product.get("discounted_price"):
                report["with_prices"] += 1
            
            if product.get("discount_percentage"):
                report["with_discounts"] += 1
            
            confidence = product.get("confidence_score", 0.0)
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
