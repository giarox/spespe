"""
AI Vision integration using OpenRouter vision models.
Handles image analysis for product extraction with intelligent fallback strategy.
"""

import base64
import json
import hashlib
import re
from pathlib import Path
from typing import Optional, Dict, Any, List

import requests
from src.logger import logger


class VisionAnalyzer:
    """Handles image analysis using OpenRouter with intelligent fallback strategy."""
    
    # Models in order of preference (tries sequentially until Broccoli found)
    # Removed Nvidia model - too slow
    MODELS = [
        "allenai/molmo-2-8b:free",                          # 1. Primary model
        "mistralai/mistral-small-3.1-24b-instruct:free",   # 2. Second fallback
        "google/gemini-2.5-flash-lite",                    # 3. Google Gemini 2.5 Flash Lite
        "x-ai/grok-4.1-fast",                              # 4. xAI Grok 4.1 Fast
        "google/gemini-2.5-flash",                         # 5. Google Gemini 2.5 Flash
        "google/gemini-3-flash-preview",                   # 6. Google Gemini 3 Flash Preview
    ]
    
    def __init__(self, api_key: str):
        """
        Initialize vision analyzer.
        
        Args:
            api_key: OpenRouter API key
            
        Raises:
            ValueError: If API key is invalid
        """
        if not api_key or not api_key.startswith("sk-or-"):
            logger.error("Invalid or missing OpenRouter API key")
            raise ValueError("OpenRouter API key must start with 'sk-or-'")
        
        self.api_key = api_key
        self.model = self.MODELS[0]
        self.base_url = "https://openrouter.ai/api/v1/chat/completions"
        self.current_model_index = 0
        
        logger.info(f"VisionAnalyzer initialized with {len(self.MODELS)} models in fallback chain")
        logger.info(f"Primary model: {self.model}")
        logger.info(f"Fallback strategy: Direct extraction, no verification steps")
        logger.info(f"Validation: Broccoli detection to confirm image received")
    
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
    
    def _calculate_image_hash(self, image_path: str) -> str:
        """
        Calculate SHA256 hash of image file.
        
        Args:
            image_path: Path to image file
            
        Returns:
            SHA256 hash string
        """
        try:
            sha256_hash = hashlib.sha256()
            with open(image_path, "rb") as f:
                for byte_block in iter(lambda: f.read(4096), b""):
                    sha256_hash.update(byte_block)
            return sha256_hash.hexdigest()
        except Exception as e:
            logger.warning(f"Failed to calculate image hash: {e}")
            return "unknown"
    
    def _get_image_size_mb(self, image_path: str) -> float:
        """Get image file size in MB."""
        try:
            size_bytes = Path(image_path).stat().st_size
            return round(size_bytes / (1024 * 1024), 2)
        except:
            return 0.0
    
    def _switch_to_fallback_model(self) -> bool:
        """
        Switch to next fallback model.
        
        Returns:
            True if fallback model available, False otherwise
        """
        if self.current_model_index < len(self.MODELS) - 1:
            self.current_model_index += 1
            self.model = self.MODELS[self.current_model_index]
            logger.warning(f"Switching to model {self.current_model_index + 1}/{len(self.MODELS)}: {self.model}")
            return True
        return False
    
    def _validate_extraction(self, result: Optional[Dict[str, Any]]) -> bool:
        """
        Validate extraction quality by checking for known products.
        
        For Lidl flyers, "Broccoli" is a known product that should be extracted
        if the model is working correctly. If extraction finds many products but NOT
        Broccoli, it indicates hallucination (model making up products).
        
        IMPORTANT: Returns True ONLY if:
        - Products found AND Broccoli is present (confirmed real extraction)
        
        Returns False if:
        - Hallucination detected (products found but NO Broccoli)
        - 0 products found (image may not have uploaded correctly, should try next model)
        
        Args:
            result: Analysis result from model
            
        Returns:
            True if Broccoli found (valid extraction), False otherwise
        """
        if not result or not result.get("products"):
            # No products found - could be image issue, return False to try next model
            product_count = result.get('total_products_found', 0) if result else 0
            logger.warning(f"Validation: {product_count} products found - trying next model (image may not have uploaded correctly)")
            return False
        
        # Get all product names (lowercase for comparison)
        product_names = [p.get('name', '').lower() for p in result.get('products', [])]
        
        # Check for known Broccoli variants (this is our secret check!)
        broccoli_keywords = ['broccoli', 'brocoli', 'broccolo']
        found_broccoli = any(
            any(keyword in name for keyword in broccoli_keywords)
            for name in product_names
        )
        
        product_count = result.get('total_products_found', len(result.get('products', [])))
        
        if found_broccoli:
            logger.info(f"✓ Validation PASSED: Found 'Broccoli' among {product_count} products - EXTRACTION VALID")
            return True
        else:
            logger.warning(f"✗ Validation FAILED: Found {product_count} products but NO 'Broccoli' - likely hallucinating, trying next model")
            return False
    

    
    def analyze_flyer_page(self, image_path: str, benchmark_mode: bool = False):
        """
        Analyze a flyer page image to extract product information.
        
        Two modes:
        1. Normal mode: Stop at first valid extraction (Broccoli found)
        2. Benchmark mode: Run ALL models regardless of validation
        
        Args:
            image_path: Path to flyer screenshot
            benchmark_mode: If True, run all models and return list of (model_name, result)
            
        Returns:
            - Normal mode: First valid result or None
            - Benchmark mode: List of (model_name, result) tuples for ALL models
        """
        logger.info(f"\n{'='*80}")
        if benchmark_mode:
            logger.info(f"🔬 BENCHMARK MODE: Running ALL {len(self.MODELS)} models")
        else:
            logger.info(f"Starting product extraction with {len(self.MODELS)} models")
        logger.info(f"{'='*80}")
        
        if benchmark_mode:
            # BENCHMARK MODE: Run ALL models, collect all results
            all_results = []
            
            for model_idx, model_name in enumerate(self.MODELS):
                self.model = model_name
                logger.info(f"\n[Benchmark {model_idx + 1}/{len(self.MODELS)}] {model_name}")
                logger.info(f"{'-'*80}")
                
                try:
                    result = self._analyze_with_current_model(image_path)
                    all_results.append((model_name, result))
                    
                    if result:
                        product_count = result.get("total_products_found", 0)
                        logger.info(f"✓ Extracted {product_count} products")
                    else:
                        logger.warning(f"✗ Extraction failed or returned None")
                        
                except Exception as e:
                    logger.error(f"✗ Error: {str(e)[:100]}")
                    all_results.append((model_name, None))
            
            logger.info(f"\n{'='*80}")
            logger.info(f"✅ Benchmark complete: Tested {len(all_results)} models")
            logger.info(f"{'='*80}\n")
            return all_results
        
        else:
            # NORMAL MODE: Stop at first Broccoli
            for model_idx in range(len(self.MODELS)):
                self.model = self.MODELS[model_idx]
                logger.info(f"\n[Model {model_idx + 1}/{len(self.MODELS)}] {self.model}")
                logger.info(f"{'-'*80}")
                
                try:
                    result = self._analyze_with_current_model(image_path)
                    
                    if result is None:
                        logger.warning("Model returned invalid response - trying next model")
                        continue
                    
                    product_count = result.get("total_products_found", 0)
                    logger.info(f"Extracted {product_count} products from image")
                    
                    # Validate extraction (check for Broccoli)
                    is_valid = self._validate_extraction(result)
                    
                    if is_valid:
                        # Found Broccoli! Image was received correctly
                        logger.info(f"✓✓ SUCCESS: Broccoli found - image received correctly, extraction valid")
                        logger.info(f"{'='*80}")
                        return result
                    else:
                        # Invalid extraction (0 products or no Broccoli)
                        logger.warning(f"Validation failed - trying next model")
                        continue
                        
                except Exception as e:
                    logger.warning(f"Error with this model: {str(e)[:100]}")
                    continue
            
            # All models exhausted
            logger.error(f"{'='*80}")
            logger.error("All models exhausted - no valid extraction found")
            logger.error(f"{'='*80}")
            return None
    
    def _analyze_with_current_model(self, image_path: str) -> Optional[Dict[str, Any]]:
        """
        Analyze with current model - extract products as plain text.
        
        Args:
            image_path: Path to flyer screenshot
            
        Returns:
            Dictionary with extracted product data, or None if analysis fails
        """
        try:
            # Encode image
            image_data = self._encode_image_to_base64(image_path)
            
            # Enhanced prompt with explicit image attachment mention
            prompt = """I am uploading an ITALIAN Lidl supermarket flyer screenshot as an image attachment to this message. This is a real image file that I am sending to you right now.

IMPORTANT: 
- This flyer is in ITALIAN language. Do NOT translate. Preserve all Italian text exactly as written.
- DO NOT make up or hallucinate a flyer. Extract ONLY from the actual image I attached.
- The image is attached to this message - analyze it directly.

Extract ALL product information from this attached flyer image.

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
Lidl | EUR | 19/01 | 25/01
null | Broccoli | null | 0.89 | 1.29 | -31% | 500 g confezione | 1 kg = 1,78 € | 19/01 | 25/01 | Coltivato in Italia
Dal Salumiere | Porchetta affettata | null | 1.59 | 2.39 | -33% | 120 g confezione | 1 kg = 13,25 € | 19/01 | 25/01 | Porchetta arrosto

Now extract from the ATTACHED IMAGE:"""
            
            logger.debug(f"Sending request to OpenRouter API")
            logger.debug(f"Prompt length: {len(prompt)} characters")
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://github.com/giarox/spespe",
                "X-Title": "Spespe Supermarket Price Scraper",
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
                "max_tokens": 2000,  # Increased for detailed extraction
                "temperature": 0.2,
            }
            
            # Make API request
            response = requests.post(self.base_url, headers=headers, json=payload, timeout=60)
            
            logger.debug(f"API response status: {response.status_code}")
            
            if response.status_code != 200:
                logger.error(f"API error {response.status_code}: {response.text[:200]}")
                return None
            
            # Parse response
            response_data = response.json()
            
            if "choices" not in response_data or not response_data["choices"]:
                logger.error("Invalid API response format")
                return None
            
            content = response_data["choices"][0]["message"]["content"]
            logger.debug(f"Model response length: {len(content)} characters")
            
            # Log full model response for debugging
            logger.info(f"\n{'='*80}")
            logger.info(f"RESPONSE FROM {self.model}:")
            logger.info(f"{'='*80}")
            logger.info(content)
            logger.info(f"{'='*80}\n")
            
            # Parse plain text response
            result = self._parse_plain_text_response(content)
            
            if result is None:
                logger.error("Could not parse response")
                return None
            
            product_count = result.get("total_products_found", 0)
            logger.info(f"Parsed {product_count} products from plain text response")
            
            return result
            
        except requests.RequestException as e:
            logger.error(f"API request failed: {e}")
            return None
            
        except Exception as e:
            logger.error(f"Vision analysis failed: {e}", exc_info=True)
            return None
    
    def _parse_plain_text_response(self, text: str) -> Optional[Dict[str, Any]]:
        """
        Parse enhanced plain text response into full structured format.
        
        Expected format:
        Line 1: Lidl | EUR | 19/01 | 25/01
        Line 2+: Brand | ProductName | Description | CurrentPrice | OldPrice | Discount | ... | Notes
        
        Args:
            text: Plain text response from model
            
        Returns:
            Dictionary matching target schema with all fields
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
            logger.error(f"Failed to parse enhanced response: {e}", exc_info=True)
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
        
        if len(parts) < 4:  # Minimum: name + price
            return None
        
        def parse_field(value: str) -> Optional[str]:
            """Convert 'null' to None, strip whitespace"""
            if not value or value.lower() == 'null':
                return None
            return value.strip()
        
        def parse_price(value: str) -> Optional[float]:
            """Extract numeric price from various formats"""
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
        
        def calculate_discount_percent(old: float, new: float) -> Optional[str]:
            """Calculate discount % if not provided"""
            if old and new and old > new:
                pct = round(((old - new) / old) * 100)
                return f"-{pct}%"
            return None
        
        # Extract fields with safe indexing
        brand = parse_field(parts[0]) if len(parts) > 0 else None
        name = parse_field(parts[1]) if len(parts) > 1 else None
        description = parse_field(parts[2]) if len(parts) > 2 else None
        current_price = parse_price(parts[3]) if len(parts) > 3 else None
        old_price = parse_price(parts[4]) if len(parts) > 4 else None
        discount = parse_field(parts[5]) if len(parts) > 5 else None
        
        # Auto-calculate discount if missing
        if not discount and old_price and current_price:
            discount = calculate_discount_percent(old_price, current_price)
        
        # Calculate saving amount and type
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
        
        # Collect notes (everything after position 10)
        notes = []
        if len(parts) > 10:
            for note in parts[10:]:
                cleaned = parse_field(note)
                if cleaned:
                    notes.append(cleaned)
        
        # Calculate field completeness for confidence
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
            
            # Reset model index for each page
            self.current_model_index = 0
            self.model = self.MODELS[0]
            
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


def analyze_screenshots(api_key: str, screenshot_paths: List[str], benchmark_mode: bool = False):
    """
    Convenience function to analyze multiple screenshots.
    
    Args:
        api_key: OpenRouter API key
        screenshot_paths: List of screenshot file paths
        benchmark_mode: If True, run all models on first image only
        
    Returns:
        - Normal mode: Analysis results dictionary
        - Benchmark mode: List of (model_name, result) tuples
    """
    logger.info("Initializing vision analyzer")
    analyzer = VisionAnalyzer(api_key)
    
    if benchmark_mode:
        # Benchmark mode: only analyze first image with all models
        if screenshot_paths:
            logger.info(f"Benchmark mode: analyzing first image with all models")
            return analyzer.analyze_flyer_page(screenshot_paths[0], benchmark_mode=True)
        return []
    else:
        # Normal mode: analyze all images
        logger.info(f"Analyzing {len(screenshot_paths)} screenshots")
        results = analyzer.analyze_multiple_images(screenshot_paths)
        return results
