"""
AI Vision integration using OpenRouter Molmo2 8B model.
Handles image analysis for product extraction.
"""

import base64
import json
from pathlib import Path
from typing import Optional, Dict, Any, List

import requests
from src.logger import logger


class VisionAnalyzer:
    """Handles image analysis using OpenRouter with retry logic and fallback models."""
    
    # Models in order of preference (will try sequentially if previous fails validation)
    # Fallback triggered if: API error, None result, 0 products, OR no "Broccoli" found
    MODELS = [
        "allenai/molmo-2-8b:free",                          # 1. Primary model
        "nvidia/nemotron-nano-12b-v2-vl:free",             # 2. First fallback
        "mistralai/mistral-small-3.1-24b-instruct:free",   # 3. Second fallback
        "google/gemini-2.5-flash-lite",                    # 4. Google Gemini 2.5 Flash Lite
        "x-ai/grok-4.1-fast",                              # 5. xAI Grok 4.1 Fast
        "google/gemini-2.5-flash",                         # 6. Google Gemini 2.5 Flash
        "google/gemini-3-flash-preview",                   # 7. Google Gemini 3 Flash Preview
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
        self.model = self.MODELS[0]  # Start with primary model
        self.base_url = "https://openrouter.ai/api/v1/chat/completions"
        self.current_model_index = 0
        self.max_retries = 2
        
        logger.info(f"VisionAnalyzer initialized with {len(self.MODELS)} models in fallback chain")
        logger.info(f"Primary model: {self.model}")
        logger.info(f"Fallback models: {len(self.MODELS)-1}")
        logger.info(f"  1. {self.MODELS[0]}")
        logger.info(f"  2. {self.MODELS[1]}")
        logger.info(f"  3. {self.MODELS[2]}")
        logger.info(f"  4. {self.MODELS[3]}")
        logger.info(f"  5. {self.MODELS[4]}")
        logger.info(f"  6. {self.MODELS[5]}")
        logger.info(f"  7. {self.MODELS[6]}")
        logger.info(f"API endpoint: {self.base_url}")
        logger.info(f"Retry policy: {self.max_retries} retries per model + validation-based fallback")
    
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
    
    def _switch_to_fallback_model(self) -> bool:
        """
        Switch to next fallback model.
        
        Returns:
            True if fallback model available, False otherwise
        """
        if self.current_model_index < len(self.MODELS) - 1:
            self.current_model_index += 1
            self.model = self.MODELS[self.current_model_index]
            logger.warning(f"Switching to fallback model: {self.model}")
            return True
        return False
    
    def _validate_extraction(self, result: Optional[Dict[str, Any]]) -> bool:
        """
        Validate extraction quality by checking for known products.
        
        For Lidl flyers, "Broccoli" is a known reliable product that should
        be extracted if the model is working correctly. If extraction finds
        many products but NOT Broccoli, it indicates hallucination.
        
        Args:
            result: Analysis result from model
            
        Returns:
            True if extraction looks valid, False if likely hallucinating
        """
        if not result or not result.get("products"):
            # No products found - could be 0 products or error
            return True  # Let other logic handle this
        
        # Get all product names (lowercase for comparison)
        product_names = [p.get('name', '').lower() for p in result.get('products', [])]
        
        # Check for known Broccoli variants
        broccoli_keywords = ['broccoli', 'brocoli', 'broccolo']
        found_broccoli = any(
            any(keyword in name for keyword in broccoli_keywords)
            for name in product_names
        )
        
        product_count = result.get('total_products_found', len(result.get('products', [])))
        
        if found_broccoli:
            logger.info(f"✓ Validation PASSED: Found 'Broccoli' among {product_count} products - extraction is valid")
            return True
        elif product_count > 0:
            logger.warning(f"⚠ Validation FAILED: Found {product_count} products but NO 'Broccoli' - likely hallucinating")
            return False
        else:
            logger.info(f"Validation: 0 products found (not hallucinating, but no data)")
            return True  # Not hallucinating, just no products
    
    def analyze_flyer_page(self, image_path: str) -> Optional[Dict[str, Any]]:
        """
        Analyze a flyer page image to extract product information.
        Robust retry and fallback strategy with 7 models:
        - 2 retries ONLY on actual failures (errors, None results)
        - If model works but finds 0 products → immediately switch to fallback
        - If model finds products but NO "Broccoli" → hallucination detected, switch
        - Auto-switches to next model after 2 failed attempts
        - Maximum 14 total attempts (2 per model × 7 models)
        - Will keep trying until valid extraction found or all models exhausted
        
        Args:
            image_path: Path to flyer screenshot
            
        Returns:
            Dictionary with extracted product data, or None if all models fail
        """
        # Try each model with retries
        while self.current_model_index < len(self.MODELS):
            logger.info(f"\n{'='*80}")
            logger.info(f"Trying model {self.current_model_index + 1}/{len(self.MODELS)}: {self.model}")
            logger.info(f"{'='*80}")
            
            failure_count = 0
            
            for attempt in range(self.max_retries + 1):
                try:
                    logger.info(f"Attempt {attempt + 1}/{self.max_retries + 1} with {self.model}")
                    
                    result = self._analyze_with_current_model(image_path)
                    
                    # Model worked - got a result
                    if result is not None:
                        product_count = result.get("total_products_found", 0)
                        logger.info(f"✓ Model analyzed successfully, found {product_count} products")
                        
                        # Validate extraction quality
                        is_valid = self._validate_extraction(result)
                        
                        # If extraction is valid, success!
                        if is_valid:
                            logger.info(f"✓✓ SUCCESS: Extracted {product_count} valid products with {self.model}")
                            return result
                        
                        # Validation failed (likely hallucinating) - go to next model
                        logger.warning(f"Extraction validation failed (hallucination detected) - switching to fallback immediately")
                        break  # Break retry loop, go to next model
                    else:
                        # Result is None - this is a failure, count it
                        failure_count += 1
                        logger.warning(f"Model returned None (failure {failure_count}/{self.max_retries + 1})")
                        
                except Exception as e:
                    failure_count += 1
                    logger.error(f"Attempt {attempt + 1} failed with error: {e} (failure {failure_count}/{self.max_retries + 1})")
                
                # If we reached max failures with this model, move to fallback
                if failure_count >= self.max_retries + 1:
                    logger.warning(f"Max failures ({self.max_retries + 1}) reached for {self.model}, trying fallback")
                    break
            
            # After current model exhausted (either 0 products or max failures), try fallback
            if self._switch_to_fallback_model():
                logger.info(f"Switching to fallback model: {self.model}")
                continue
            else:
                logger.error("No more fallback models available")
                break
        
        logger.error("All models exhausted - returning None")
        return None
    
    def _analyze_with_current_model(self, image_path: str) -> Optional[Dict[str, Any]]:
        """
        Internal method to analyze with current model (no retry logic).
        
        Args:
            image_path: Path to flyer screenshot
            
        Returns:
            Dictionary with extracted product data, or None if analysis fails
        """
        try:
            # Encode image
            image_data = self._encode_image_to_base64(image_path)
            
            # Create prompt for product extraction
            prompt = """You are analyzing a supermarket flyer image (typically Lidl). Extract ALL visible products with their prices.

IMPORTANT: A "product" is a distinct item with:
- A product name/description (visible as text)
- A current price (required - numbers like 0.89, 4.99, 119.00)
- Product details (quantity, weight, units - may be optional)

PRICE FORMAT NOTES:
- Prices shown as numbers: 0.89, 4.99, etc. (NO € symbol usually shown separately)
- Decimal separator may be comma (0,89) or dot (0.89) - normalize both to dots
- Old/original prices often smaller, struck through, or in different color
- Discounts shown as "-30%", "-€2.00", etc. near the product

PRODUCT LAYOUT CLUES (Lidl flyers):
- Products arranged in grid/rows with product images
- Price positioned below or beside product image
- Quantity/weight info: "500g confezione", "4 x 170g", "650g"
- Discount badges near price: "-31%", "-2.00€", "-30%"
- Some products have unit pricing: "(1 kg = 1.78€)"
- Valid date info may be present: "da giovedì 22/01"
- Ignore: marketing text, logos, decorative elements, text NOT associated with a product

CONFIDENCE THRESHOLD:
- Only include products where you are confident (≥0.7) about:
  * Product name is clearly readable
  * Current price is clearly visible and numeric
- Skip fuzzy/low-confidence extractions

FOR EACH PRODUCT, extract:
1. "name": Exact product name/description as shown (string)
2. "current_price": Current/sale price as number string "X.XX" (required)
3. "original_price": Original price if visible, else null (optional)
4. "discount_percent": Discount as shown "-30%" or null if not visible (optional)
5. "discount_amount": Discount as "€X.XX" if shown, else null (optional)
6. "details": Weight, quantity, units "500g", "4x170g", "650g" (optional)
7. "description": Any extra info like unit price "(1 kg = 1.78€)" or validity date (optional)
8. "confidence": Your confidence 0.0-1.0 that extraction is accurate (required)

EXAMPLES from typical Lidl flyer:
- "Broccoli 500g", current_price: "0.89", discount_percent: "-31%", details: "500g"
- "Filetto di petto di pollo a fette 650g", current_price: "4.99", discount_amount: "-€2.00", details: "650g"
- "Realforno Frollini 700g", current_price: "1.39", discount_percent: "-30%", original_price: "1.99"
- "Macchina da cucire Singer", current_price: "119.00", discount_percent: null, description: "MEGA AFFARE!"

Return ONLY valid JSON (no extra text):
{
    "products": [
        {
            "name": "Product Name",
            "current_price": "X.XX",
            "original_price": null,
            "discount_percent": null,
            "discount_amount": null,
            "details": "500g",
            "description": null,
            "confidence": 0.95
        }
    ],
    "total_products_found": 5,
    "quality_notes": "Clear, readable flyer with visible prices"
}

If no products found or image is unclear, return:
{"products": [], "total_products_found": 0, "quality_notes": "No readable products visible"}

CRITICAL: Return ONLY the JSON object, nothing else. Do not add markdown or text around the JSON.
"""
            
            logger.debug(f"Sending request to OpenRouter API (model: {self.model})")
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
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/png",
                                    "data": image_data,
                                }
                            },
                            {
                                "type": "text",
                                "text": prompt
                            }
                        ]
                    }
                ],
                "max_tokens": 2000,
                "temperature": 0.3,  # Low temperature for consistent extraction
            }
            
            logger.debug(f"Request payload size: {len(json.dumps(payload))} bytes")
            
            # Make API request
            logger.info("Sending request to OpenRouter API...")
            response = requests.post(self.base_url, headers=headers, json=payload, timeout=60)
            
            logger.info(f"API response status: {response.status_code}")
            logger.debug(f"Response headers: {dict(response.headers)}")
            
            if response.status_code != 200:
                logger.error(f"API error {response.status_code}: {response.text}")
                return None
            
            # Parse response
            response_data = response.json()
            logger.debug(f"Response JSON size: {len(json.dumps(response_data))} bytes")
            
            if "choices" not in response_data or not response_data["choices"]:
                logger.error("Invalid API response format: no choices")
                return None
            
            content = response_data["choices"][0]["message"]["content"]
            logger.debug(f"Model response length: {len(content)} characters")
            
            # Extract JSON from response
            logger.info("Parsing model response as JSON...")
            try:
                # Try direct JSON parse first
                result = json.loads(content)
            except json.JSONDecodeError:
                # Try to extract JSON from text
                logger.debug("Direct JSON parse failed, attempting to extract JSON from text")
                start = content.find('{')
                end = content.rfind('}') + 1
                if start >= 0 and end > start:
                    json_str = content[start:end]
                    result = json.loads(json_str)
                else:
                    logger.error("Could not find JSON in response")
                    return None
            
            product_count = result.get("total_products_found", len(result.get("products", [])))
            logger.info(f"Successfully extracted {product_count} products from image")
            
            if product_count > 0:
                logger.debug(f"Product details: {json.dumps(result['products'][:2], indent=2)}...")
            
            return result
            
        except requests.RequestException as e:
            logger.error(f"API request failed: {e}", exc_info=True)
            return None
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse API response as JSON: {e}", exc_info=True)
            return None
        except Exception as e:
            logger.error(f"Vision analysis failed: {e}", exc_info=True)
            return None
    
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
    
    logger.info(f"Analyzing {len(screenshot_paths)} screenshots")
    results = analyzer.analyze_multiple_images(screenshot_paths)
    
    return results
