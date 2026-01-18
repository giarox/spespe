"""
AI Vision integration using Google Gemini 2.5 Flash via OpenRouter.
Handles image analysis for product extraction from Italian supermarket flyers.
"""

import base64
import json
import re
from pathlib import Path
from typing import Optional, Dict, Any, List

import requests
from src.spotter.core.logger import logger


class VisionAnalyzer:
    """
    Vision analyzer using Google Gemini 2.5 Flash.
    
    Selected based on comprehensive benchmarking showing best performance
    for Italian flyer extraction across all metrics.
    """
    
    def __init__(self, api_key: str):
        """
        Initialize vision analyzer with Gemini 2.5 Flash.
        
        Args:
            api_key: OpenRouter API key
            
        Raises:
            ValueError: If API key is invalid
        """
        if not api_key or not api_key.startswith("sk-or-"):
            logger.error("Invalid or missing OpenRouter API key")
            raise ValueError("OpenRouter API key must start with 'sk-or-'")
        
        self.api_key = api_key
        self.model = "google/gemini-2.5-flash"
        self.base_url = "https://openrouter.ai/api/v1/chat/completions"
        
        logger.info(f"VisionAnalyzer initialized with {self.model}")
        logger.info("Single-model production setup (no fallbacks)")
    
    def _encode_image_to_base64(self, image_path: str) -> str:
        """
        Encode image file to base64 string.
        
        Args:
            image_path: Path to image file
            
        Returns:
            Base64 encoded image string
            
        Raises:
            FileNotFoundError: If image doesn't exist
            IOError: If image can't be read
        """
        try:
            path = Path(image_path)
            if not path.exists():
                logger.error(f"Image not found: {image_path}")
                raise FileNotFoundError(f"Image not found: {image_path}")
            
            file_size = path.stat().st_size
            logger.debug(f"Reading image: {image_path} (size: {file_size} bytes)")
            
            with open(path, "rb") as img_file:
                image_data = base64.standard_b64encode(img_file.read()).decode("utf-8")
            
            logger.debug(f"Image encoded to base64 successfully ({len(image_data)} chars)")
            return image_data
            
        except Exception as e:
            logger.error(f"Failed to encode image: {e}", exc_info=True)
            raise
    
    def analyze_flyer_page(self, image_path: str) -> Optional[Dict[str, Any]]:
        """
        Analyze a flyer page image to extract product information.
        
        Args:
            image_path: Path to flyer screenshot
            
        Returns:
            Dictionary with extracted product data, or None if analysis fails
        """
        logger.info(f"Analyzing flyer with {self.model}")
        
        try:
            result = self._analyze_image(image_path)
            
            if result:
                product_count = result.get("total_products_found", 0)
                logger.info(f"✓ Extracted {product_count} products successfully")
            else:
                logger.warning("Analysis returned no results")
            
            return result
            
        except Exception as e:
            logger.error(f"Analysis failed: {e}", exc_info=True)
            return None
    
    def _analyze_image(self, image_path: str) -> Optional[Dict[str, Any]]:
        """
        Analyze image with Gemini 2.5 Flash.
        
        Args:
            image_path: Path to flyer screenshot
            
        Returns:
            Dictionary with extracted product data, or None if analysis fails
        """
        try:
            # Encode image
            image_data = self._encode_image_to_base64(image_path)
            
            # Enhanced prompt optimized for Gemini
            prompt = """I am uploading an ITALIAN supermarket flyer screenshot as an image attachment to this message. This is a real image file that I am sending to you right now.

IMPORTANT: 
- This flyer is in ITALIAN language. Do NOT translate. Preserve all Italian text exactly as written.
- DO NOT make up or hallucinate a flyer. Extract ONLY from the actual image I attached.
- The image is attached to this message - analyze it directly.
- The flyer may be a Calameo scroll page; focus on product cards and prices.
- Ignore viewer UI headers/footers and page chrome.

Extract ALL product information from this attached flyer image.

IMPORTANT FOR COVER PAGES:
- If the page is just a cover (headline, no products), return ONLY the first line and no products.
- If product cards are visible, list them all.

FIRST LINE - GLOBAL INFO:
Retailer | Currency | ValidFrom | ValidTo

THEN LIST ALL PRODUCTS (one per line):
Brand | ProductName | Description | CurrentPrice | OldPrice | Discount | WeightPack | PricePerUnit | OfferStart | OfferEnd | Notes

RULES:
- Keep ALL text in Italian exactly as shown (e.g., "Coltivato in Italia", "confezione")
- Write "null" if field is missing or not visible
- Prices: numbers only (1.39, 0.89)
- Discount: with % sign (-31%)
- Dates: extract exactly as shown (e.g., "19/01", "da giovedì 22/01")
- Notes: any claims, badges, marketing text near product
- Separate fields with " | " (space-pipe-space)
- Extract EVERYTHING you can see, even if partially visible

EXAMPLE OUTPUT:
Supermarket | EUR | 19/01 | 25/01
null | Broccoli | null | 0.89 | 1.29 | -31% | 500 g confezione | 1 kg = 1,78 € | 19/01 | 25/01 | Coltivato in Italia
Dal Salumiere | Porchetta affettata | null | 1.59 | 2.39 | -33% | 120 g confezione | 1 kg = 13,25 € | 19/01 | 25/01 | Porchetta arrosto

Now extract from the ATTACHED IMAGE:"""
            
            logger.debug(f"Sending request to OpenRouter API")
            logger.debug(f"Prompt length: {len(prompt)} characters")
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://github.com/giarox/spespe",
                "X-Title": "Spespe Spotter",
            }
            
            payload = {
                "model": self.model,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": prompt
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/png;base64,{image_data}"
                                }
                            }
                        ]
                    }
                ],
                "max_tokens": 2000,
                "temperature": 0.2,
            }
            
            # Make API request with single retry on error
            response = None
            for attempt in range(2):
                try:
                    response = requests.post(self.base_url, headers=headers, json=payload, timeout=60)
                    if response.status_code == 200:
                        break
                    else:
                        logger.warning(f"Attempt {attempt + 1}/2 failed with status {response.status_code}")
                        if attempt == 0:
                            logger.info("Retrying once...")
                except requests.RequestException as e:
                    logger.warning(f"Attempt {attempt + 1}/2 failed: {e}")
                    if attempt == 0:
                        logger.info("Retrying once...")
            
            if not response or response.status_code != 200:
                logger.error(f"API error after retries: {response.text[:200] if response else 'No response'}")
                return None
            
            # Parse response
            response_data = response.json()
            
            if "choices" not in response_data or not response_data["choices"]:
                logger.error("Invalid API response format")
                return None
            
            content = response_data["choices"][0]["message"]["content"]
            logger.debug(f"Model response length: {len(content)} characters")
            
            # Log full model response
            logger.info(f"\n{'='*80}")
            logger.info(f"RESPONSE FROM {self.model}:")
            logger.info(f"{'='*80}")
            logger.info(content)
            logger.info(f"{'='*80}\n")
            
            # Parse plain text response
            result = self._parse_response(content)
            
            if result is None:
                logger.error("Could not parse response")
                return None
            
            product_count = result.get("total_products_found", 0)
            logger.info(f"Parsed {product_count} products from response")
            
            return result
            
        except Exception as e:
            logger.error(f"Vision analysis failed: {e}", exc_info=True)
            return None
    
    def _parse_response(self, text: str) -> Optional[Dict[str, Any]]:
        """
        Parse plain text response into structured format.
        
        Expected format:
        Line 1: Lidl | EUR | 19/01 | 25/01
        Line 2+: Brand | ProductName | Description | CurrentPrice | ... | Notes
        
        Args:
            text: Plain text response from model
            
        Returns:
            Dictionary with structured product data
        """
        try:
            lines = [l.strip() for l in text.split('\n') if l.strip()]
            
            # Find data lines (skip confirmation/instruction text)
            data_lines = []
            for line in lines:
                # Skip common non-data patterns
                if any(skip in line.lower() for skip in ['confirm', 'here are', 'extract', 'attached', 'image', 'now extract', 'important']):
                    continue
                if '|' in line:
                    data_lines.append(line)
            
            if not data_lines:
                logger.warning("No pipe-separated data found in response")
                return {"products": [], "total_products_found": 0, "quality_notes": "No data extracted"}
            
            # Parse global info (first line)
            global_info = self._parse_global_line(data_lines[0] if data_lines else "")
            
            # Parse products (remaining lines)
            products = []
            for line in data_lines[1:] if len(data_lines) > 1 else data_lines:
                product = self._parse_product_line(line)
                if product:
                    products.append(product)
            
            return {
                "retailer": global_info.get("retailer"),
                "currency": global_info.get("currency"),
                "global_validity": global_info.get("validity"),
                "products": products,
                "total_products_found": len(products),
                "extraction_quality": self._assess_quality(products)
            }
            
        except Exception as e:
            logger.error(f"Failed to parse response: {e}", exc_info=True)
            return None
    
    def _parse_global_line(self, line: str) -> Dict:
        """Parse global info: Lidl | EUR | 19/01 | 25/01"""
        parts = [p.strip() for p in line.split('|')]
        
        return {
            "retailer": parts[0] if len(parts) > 0 and parts[0].lower() != 'null' else None,
            "currency": parts[1] if len(parts) > 1 and parts[1].lower() != 'null' else None,
            "validity": {
                "start_date": parts[2] if len(parts) > 2 and parts[2].lower() != 'null' else None,
                "end_date": parts[3] if len(parts) > 3 and parts[3].lower() != 'null' else None,
                "confidence": 0.9 if len(parts) >= 4 else 0.6
            }
        }
    
    def _parse_product_line(self, line: str) -> Optional[Dict]:
        """Parse product: Brand | ProductName | Description | CurrentPrice | OldPrice | Discount | ... | Notes"""
        parts = [p.strip() for p in line.split('|')]
        
        if len(parts) < 4:
            return None
        
        def parse_field(value: str) -> Optional[str]:
            """Convert 'null' to None, strip whitespace"""
            if not value or value.lower() == 'null':
                return None
            return value.strip()
        
        def parse_price(value: str) -> Optional[float]:
            """Extract numeric price"""
            if not value or value.lower() == 'null':
                return None
            # Handle: "1.39", "1,39", "1.39 €", "€ 1.39"
            numeric = re.search(r'(\d+)[.,](\d+)', value)
            if numeric:
                return float(f"{numeric.group(1)}.{numeric.group(2)}")
            # Try integer prices
            numeric = re.search(r'(\d+)', value)
            if numeric:
                return float(numeric.group(1))
            return None
        
        # Extract fields with safe indexing
        brand = parse_field(parts[0]) if len(parts) > 0 else None
        name = parse_field(parts[1]) if len(parts) > 1 else None
        description = parse_field(parts[2]) if len(parts) > 2 else None
        current_price = parse_price(parts[3]) if len(parts) > 3 else None
        old_price = parse_price(parts[4]) if len(parts) > 4 else None
        discount = parse_field(parts[5]) if len(parts) > 5 else None
        
        # Auto-calculate discount if missing
        if not discount and old_price and current_price and old_price > current_price:
            pct = round(((old_price - current_price) / old_price) * 100)
            discount = f"-{pct}%"
        
        # Calculate saving amount
        saving_amount = None
        saving_type = None
        if old_price and current_price and old_price > current_price:
            saving_amount = round(old_price - current_price, 2)
            saving_type = "absolute"
        
        # Parse remaining fields
        weight = parse_field(parts[6]) if len(parts) > 6 else None
        price_per_unit = parse_field(parts[7]) if len(parts) > 7 else None
        offer_start = parse_field(parts[8]) if len(parts) > 8 else None
        offer_end = parse_field(parts[9]) if len(parts) > 9 else None
        
        # Collect notes
        notes = []
        if len(parts) > 10:
            for note in parts[10:]:
                cleaned = parse_field(note)
                if cleaned:
                    notes.append(cleaned)
        
        # Calculate confidence
        fields_expected = 11
        fields_filled = sum([
            1 if brand else 0,
            1 if name else 0,
            1 if description else 0,
            1 if current_price else 0,
            1 if old_price else 0,
            1 if discount else 0,
            1 if weight else 0,
            1 if price_per_unit else 0,
            1 if offer_start else 0,
            1 if offer_end else 0,
            1 if notes else 0
        ])
        
        confidence = round(0.6 + (0.35 * fields_filled / fields_expected), 2)
        
        return {
            "brand": brand,
            "name": name,
            "description": description,
            "current_price": current_price,
            "old_price": old_price,
            "discount": discount,
            "saving_amount": saving_amount,
            "saving_type": saving_type,
            "weight_or_pack": weight,
            "price_per_unit": price_per_unit,
            "offer_start_date": offer_start,
            "offer_end_date": offer_end,
            "confidence": confidence,
            "notes": notes if notes else None
        }
    
    def _assess_quality(self, products: List[Dict]) -> str:
        """Assess overall extraction quality"""
        if not products:
            return "No products extracted"
        
        avg_confidence = sum(p.get('confidence', 0) for p in products) / len(products)
        
        if avg_confidence >= 0.85:
            return "High quality - most fields complete"
        elif avg_confidence >= 0.70:
            return "Medium quality - core fields present"
        else:
            return "Low quality - many missing fields"
    
    def analyze_multiple_images(self, image_paths: List[str]) -> Dict[str, Any]:
        """
        Analyze multiple flyer page images.
        
        Args:
            image_paths: List of image file paths
            
        Returns:
            Dictionary with all extracted products organized by page
        """
        logger.info(f"Starting batch analysis of {len(image_paths)} images")
        
        results = {
            "total_images": len(image_paths),
            "successful_analyses": 0,
            "failed_analyses": 0,
            "total_products": 0,
            "by_page": {}
        }
        
        for idx, image_path in enumerate(image_paths, 1):
            logger.info(f"[{idx}/{len(image_paths)}] Analyzing image: {image_path}")
            
            analysis = self.analyze_flyer_page(image_path)
            
            if analysis:
                results["successful_analyses"] += 1
                results["by_page"][image_path] = analysis
                
                product_count = analysis.get("total_products_found", 0)
                results["total_products"] += product_count
                
                logger.info(f"Page {idx}: Successfully extracted {product_count} products")
            else:
                results["failed_analyses"] += 1
                results["by_page"][image_path] = None
                logger.warning(f"Page {idx}: Analysis failed")
        
        logger.info(f"Batch analysis complete: {results['successful_analyses']}/{len(image_paths)} successful")
        logger.info(f"Total products extracted: {results['total_products']}")
        
        return results


def analyze_screenshots(api_key: str, screenshot_paths: List[str]) -> Dict[str, Any]:
    """
    Convenience function to analyze multiple screenshots.
    
    Args:
        api_key: OpenRouter API key
        screenshot_paths: List of screenshot file paths
        
    Returns:
        Analysis results dictionary
    """
    logger.info("Initializing vision analyzer")
    analyzer = VisionAnalyzer(api_key)
    
    logger.info(f"Analyzing {len(screenshot_paths)} screenshots with Gemini 2.5 Flash")
    results = analyzer.analyze_multiple_images(screenshot_paths)
    
    return results
