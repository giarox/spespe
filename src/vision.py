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
    
    # Models in order of preference
    MODELS = [
        "allenai/molmo-2-8b:free",  # Primary model
        "black-forest-labs/flux.2-klein-4b",  # Fallback model
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
        
        logger.info(f"VisionAnalyzer initialized with model: {self.model}")
        logger.info(f"API endpoint: {self.base_url}")
        logger.info(f"Retry policy: {self.max_retries} retries + {len(self.MODELS)-1} fallback models")
    
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
    
    def analyze_flyer_page(self, image_path: str) -> Optional[Dict[str, Any]]:
        """
        Analyze a flyer page image to extract product information.
        With retry logic and fallback models.
        
        Args:
            image_path: Path to flyer screenshot
            
        Returns:
            Dictionary with extracted product data, or None if analysis fails
        """
        for attempt in range(self.max_retries + 1):
            try:
                logger.info(f"Starting vision analysis on image: {image_path} (attempt {attempt + 1}/{self.max_retries + 1})")
                logger.info(f"Using model: {self.model}")
                
                result = self._analyze_with_current_model(image_path)
                if result is not None:
                    return result
                
            except Exception as e:
                logger.error(f"Analysis attempt {attempt + 1} failed: {e}")
                
                # After max retries with current model, try fallback
                if attempt == self.max_retries:
                    if self._switch_to_fallback_model():
                        logger.info(f"Max retries reached, trying fallback model: {self.model}")
                        try:
                            result = self._analyze_with_current_model(image_path)
                            if result is not None:
                                return result
                        except Exception as fallback_error:
                            logger.error(f"Fallback model also failed: {fallback_error}")
                            return None
                    else:
                        logger.error("No more fallback models available")
                        return None
        
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
            prompt = """Analyze this supermarket flyer image and extract ALL visible products with their prices.

For each product found, provide:
1. Product name (exact as shown)
2. Original price (if visible)
3. Current/discounted price (if different)
4. Discount percentage (if visible)
5. Any additional details (quantity, unit, etc.)

Return ONLY valid JSON in this format:
{
    "products": [
        {
            "name": "Product Name",
            "original_price": "10.99",
            "current_price": "7.99",
            "discount_percent": "27%",
            "details": "250g",
            "confidence": 0.95
        }
    ],
    "total_products_found": 5,
    "quality_notes": "Clear prices visible"
}

If no products are found or image is unclear, return:
{"products": [], "total_products_found": 0, "quality_notes": "reason"}
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
