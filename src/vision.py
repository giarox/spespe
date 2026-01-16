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
    """Handles image analysis using OpenRouter with intelligent fallback and image verification."""
    
    # Models in order of preference (tries sequentially until Broccoli found)
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
        self.model = self.MODELS[0]
        self.base_url = "https://openrouter.ai/api/v1/chat/completions"
        self.current_model_index = 0
        
        logger.info(f"VisionAnalyzer initialized with {len(self.MODELS)} models in fallback chain")
        logger.info(f"Primary model: {self.model}")
        logger.info(f"Fallback strategy: One attempt per model + one retry on API error only")
        logger.info(f"Validation: Products with 'Broccoli' trigger success and stop chain")
    
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
        
        Args:
            result: Analysis result from model
            
        Returns:
            True if extraction looks valid (has Broccoli), False if hallucinating
        """
        if not result or not result.get("products"):
            # No products found - not hallucinating, just no data
            logger.info("Validation: 0 products found (not hallucinating)")
            return True
        
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
            logger.info(f"✓ Validation PASSED: Found 'Broccoli' among {product_count} products")
            return True
        elif product_count > 0:
            logger.warning(f"✗ Validation FAILED: Found {product_count} products but NO 'Broccoli' - likely hallucinating")
            return False
        else:
            return True  # 0 products - not hallucinating
    
    def _verify_image_upload(self, image_path: str) -> Dict[str, Any]:
        """
        Verify image was received by model using 3 methods:
        A: Hash acknowledgment
        B: Content verification (colors, supermarket identification)
        C: Metadata acknowledgment (resolution)
        
        Args:
            image_path: Path to image file
            
        Returns:
            Dict with verification results and confidence score (0-3)
        """
        logger.info(f"Verifying image upload with {self.model}...")
        
        image_hash = self._calculate_image_hash(image_path)
        image_size_mb = self._get_image_size_mb(image_path)
        
        verification_results = {
            "method_a": False,
            "method_b": False,
            "method_c": False,
            "confidence": 0,
            "details": {}
        }
        
        try:
            # METHOD A: Hash verification
            logger.info("  [A] Verifying image hash...")
            prompt_a = f"""This image has a SHA256 hash of: {image_hash[:16]}... (truncated for brevity)
Can you confirm you can process and analyze images? Answer with just "YES" or "NO"."""
            
            response_a = self._call_api_for_verification(prompt_a, image_path)
            method_a_pass = response_a and "yes" in response_a.lower()
            verification_results["method_a"] = method_a_pass
            verification_results["details"]["method_a"] = response_a
            logger.info(f"    {'✓ PASS' if method_a_pass else '✗ FAIL'}: {response_a[:50] if response_a else 'No response'}")
            
            # METHOD B: Content verification (3 questions)
            logger.info("  [B] Verifying image content...")
            prompt_b = """Look at this supermarket flyer image carefully.
Answer these 3 questions:
1. What is the dominant color scheme of this flyer? (Answer: Red, Blue, Yellow, White, Black, or other)
2. Is this a supermarket flyer or something else? (Answer: Supermarket or Other)
3. What supermarket brand is this from based on logos? (Answer: Lidl, Aldi, Carrefour, Tesco, or other name)

Format your answer as: COLOR: [color] | FLYER_TYPE: [type] | SUPERMARKET: [name]"""
            
            response_b = self._call_api_for_verification(prompt_b, image_path)
            method_b_pass = False
            if response_b:
                response_b_lower = response_b.lower()
                # Check if all 3 answers are present and reasonable
                has_color = any(c in response_b_lower for c in ['red', 'blue', 'yellow', 'white', 'black', 'color'])
                has_flyer = 'supermarket' in response_b_lower
                has_brand = 'lidl' in response_b_lower or 'aldi' in response_b_lower or any(
                    brand in response_b_lower for brand in ['carrefour', 'tesco', 'coop', 'penny', 'kaufland']
                )
                method_b_pass = has_color and has_flyer and has_brand
            
            verification_results["method_b"] = method_b_pass
            verification_results["details"]["method_b"] = response_b
            logger.info(f"    {'✓ PASS' if method_b_pass else '✗ FAIL'}: {response_b[:80] if response_b else 'No response'}")
            
            # METHOD C: Metadata verification
            logger.info("  [C] Verifying image metadata...")
            prompt_c = f"""This is a high-resolution image (approximately {image_size_mb}MB, 4K resolution: 3840x2160 pixels).
Can you confirm you received a high-resolution/4K image? Answer with just "YES" or "NO"."""
            
            response_c = self._call_api_for_verification(prompt_c, image_path)
            method_c_pass = response_c and "yes" in response_c.lower()
            verification_results["method_c"] = method_c_pass
            verification_results["details"]["method_c"] = response_c
            logger.info(f"    {'✓ PASS' if method_c_pass else '✗ FAIL'}: {response_c[:50] if response_c else 'No response'}")
            
            # Calculate confidence score
            confidence_count = sum([method_a_pass, method_b_pass, method_c_pass])
            verification_results["confidence"] = confidence_count
            
            logger.info(f"Image Upload Confidence: {confidence_count}/3")
            logger.info(f"  A (Hash): {'PASS' if method_a_pass else 'FAIL'}")
            logger.info(f"  B (Content): {'PASS' if method_b_pass else 'FAIL'}")
            logger.info(f"  C (Metadata): {'PASS' if method_c_pass else 'FAIL'}")
            
        except Exception as e:
            logger.warning(f"Image verification failed: {e}")
            verification_results["confidence"] = 0
        
        return verification_results
    
    def _call_api_for_verification(self, verification_prompt: str, image_path: str) -> Optional[str]:
        """
        Call API with verification question and image.
        
        Args:
            verification_prompt: Verification question
            image_path: Path to image
            
        Returns:
            Model's response or None if failed
        """
        try:
            image_data = self._encode_image_to_base64(image_path)
            
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
                                "text": verification_prompt
                            }
                        ]
                    }
                ],
                "max_tokens": 100,  # Short response for verification
                "temperature": 0.3,
            }
            
            response = requests.post(self.base_url, headers=headers, json=payload, timeout=60)
            
            if response.status_code == 200:
                response_data = response.json()
                if "choices" in response_data and response_data["choices"]:
                    return response_data["choices"][0]["message"]["content"]
            
            return None
            
        except Exception as e:
            logger.debug(f"Verification API call failed: {e}")
            return None
    
    def analyze_flyer_page(self, image_path: str) -> Optional[Dict[str, Any]]:
        """
        Analyze a flyer page image to extract product information.
        
        Fallback strategy (7 models):
        - For each model: Try once
        - If API error: Retry once (2 total attempts)
        - If result found: Validate (check for Broccoli)
        - If Broccoli found: Return immediately (stop chain)
        - If no Broccoli (hallucinating): Try next model
        - If error or None: Try next model
        - Maximum 14 attempts (2 per model × 7 models)
        
        Args:
            image_path: Path to flyer screenshot
            
        Returns:
            Dictionary with extracted product data, or None if all models fail
        """
        logger.info(f"\n{'='*80}")
        logger.info(f"Starting product extraction with {len(self.MODELS)} models")
        logger.info(f"{'='*80}")
        
        # Try each model in sequence
        for model_attempt_index in range(len(self.MODELS)):
            self.model = self.MODELS[model_attempt_index]
            logger.info(f"\n[Model {model_attempt_index + 1}/{len(self.MODELS)}] {self.model}")
            logger.info(f"{'-'*80}")
            
            # Try once, with one retry on API error
            api_failures = 0
            result = None
            
            # Loop: try up to 2 times (initial try + 1 retry on API error)
            while api_failures < 2:
                attempt_num = api_failures + 1
                logger.info(f"Attempt {attempt_num}/2...")
                
                try:
                    # Call API
                    result = self._analyze_with_current_model(image_path)
                    
                    if result is not None:
                        # Got a result - stop retrying this model
                        product_count = result.get("total_products_found", len(result.get("products", [])))
                        logger.info(f"✓ API call successful: Found {product_count} products")
                        break  # Exit retry loop
                    else:
                        # None result (not API error, just model didn't return valid result)
                        logger.warning("Model returned None (not API error)")
                        break  # Exit retry loop, move to next model
                        
                except requests.exceptions.RequestException as e:
                    # API error - we can retry
                    api_failures += 1
                    logger.warning(f"API error (attempt {attempt_num}/2): {str(e)[:100]}")
                    if api_failures >= 2:
                        logger.warning("Max API retries reached for this model")
                        break
                        
                except Exception as e:
                    # Other error
                    logger.error(f"Unexpected error: {e}")
                    break
            
            # Check if we got a result
            if result is None:
                logger.info("No valid result from this model - trying next model")
                self.current_model_index += 1
                continue
            
            # Validate result (check for Broccoli)
            product_count = result.get("total_products_found", len(result.get("products", [])))
            logger.info(f"Validating extraction ({product_count} products)...")
            
            is_valid = self._validate_extraction(result)
            
            if is_valid:
                # Found Broccoli! Stop the chain
                logger.info(f"✓✓ SUCCESS: Extraction valid - stopping chain")
                logger.info(f"{'='*80}")
                return result
            else:
                # Hallucination detected - try next model
                logger.warning("Extraction invalid - trying next model")
                self.current_model_index += 1
                continue
        
        # All models exhausted
        logger.error(f"{'='*80}")
        logger.error("All models exhausted - no valid extraction found")
        logger.error(f"{'='*80}")
        return None
    
    def _analyze_with_current_model(self, image_path: str) -> Optional[Dict[str, Any]]:
        """
        Analyze with current model (no retry logic).
        
        Args:
            image_path: Path to flyer screenshot
            
        Returns:
            Dictionary with extracted product data, or None if analysis fails
        """
        try:
            # Encode image
            image_data = self._encode_image_to_base64(image_path)
            
            # Concise prompt without mentioning Broccoli
            prompt = """Extract ALL visible products from this supermarket flyer.

A product has:
- Name/description (visible text)
- Current price (required: format like 0.89, 4.99)
- Optional: weight, discount, old price

PRICES: Numbers like 0.89, 4.99. Decimals use dot or comma (both OK).
Discounts shown as -30% or -€2.00. Old prices may be struck through.

LAYOUT: Products in grid/rows. Prices below or beside images.
Weight: 500g, 650g. Discounts near prices. Unit pricing: (1 kg = 1.78€)

Only include products you're highly confident about (≥0.7 confidence).

For each product, extract:
- name: Product name (string)
- current_price: Current price as "X.XX" (required)
- original_price: Old price if visible (null otherwise)
- discount_percent: "-30%" or null
- details: Weight/quantity or null
- confidence: 0.0-1.0 confidence score

Return ONLY valid JSON (no markdown, no text):
{
    "products": [
        {
            "name": "Product Name",
            "current_price": "X.XX",
            "original_price": null,
            "discount_percent": null,
            "details": "500g",
            "confidence": 0.9
        }
    ],
    "total_products_found": 1,
    "quality_notes": "Description of image quality"
}"""
            
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
                "temperature": 0.3,
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
            
            # Extract JSON from response
            try:
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
            logger.info(f"Extracted {product_count} products from image")
            
            if product_count > 0:
                logger.debug(f"First 2 products: {json.dumps(result['products'][:2], indent=2)}")
            
            return result
            
        except requests.RequestException as e:
            logger.error(f"API request failed: {e}")
            raise  # Re-raise to let analyze_flyer_page handle retries
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse API response as JSON: {e}")
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
