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
    

    
    def analyze_flyer_page(self, image_path: str) -> Optional[Dict[str, Any]]:
        """
        Analyze a flyer page image to extract product information.
        
        Simplified fallback strategy (6 models):
        - For each model: Send ONE simple request
        - Extract plain text list of products
        - Parse and validate (check for Broccoli)
        - If Broccoli found: Return immediately (stop chain)
        - If not found or error: Try next model
        
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
            
            try:
                # Extract products with current model
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
            
            # Simple, direct prompt
            prompt = """CONFIRM: I can see the flyer screenshot and analyze it.
Here are the products with their information from this supermarket flyer:

LIST EACH PRODUCT ON A NEW LINE with format: ProductName | Price | Details/Discount

Only list products you can actually see in the image."""
            
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
                "max_tokens": 1000,
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
        Parse plain text response from model into structured format.
        
        Expected format:
        CONFIRM: I can see the flyer...
        ProductName | Price | Details/Discount
        ProductName | Price | Details/Discount
        
        Args:
            text: Plain text response from model
            
        Returns:
            Dictionary with structured product data, or None if parsing fails
        """
        try:
            products = []
            lines = text.split('\n')
            
            for line in lines:
                line = line.strip()
                
                # Skip empty lines and confirmation lines
                if not line or 'confirm' in line.lower() or 'here are' in line.lower():
                    continue
                
                # Skip lines that don't contain pipes
                if '|' not in line:
                    continue
                
                # Parse line: ProductName | Price | Details
                parts = [p.strip() for p in line.split('|')]
                
                if len(parts) < 2:
                    continue
                
                name = parts[0]
                price = parts[1]
                details = parts[2] if len(parts) > 2 else None
                
                # Try to extract numeric price
                price_match = re.search(r'[\d.,]+', price)
                if not price_match:
                    continue  # Skip lines without valid price
                
                products.append({
                    "name": name,
                    "current_price": price,
                    "details": details,
                    "confidence": 0.8
                })
            
            if not products:
                logger.warning("No products parsed from response")
                return {"products": [], "total_products_found": 0, "quality_notes": "Could not parse any products"}
            
            return {
                "products": products,
                "total_products_found": len(products),
                "quality_notes": f"Extracted {len(products)} products from plain text"
            }
            
        except Exception as e:
            logger.error(f"Failed to parse plain text response: {e}")
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
