"""
Integration tests for Spespe Spotter.
Tests module interactions and data flow.
"""

import json
import tempfile
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock

import pytest

from src.logger import logger
from src.extractor import ProductExtractor
from src.csv_export import CSVExporter


class TestProductExtraction:
    """Test product extraction logic."""
    
    def test_extractor_initialization(self):
        """Test ProductExtractor initializes correctly."""
        extractor = ProductExtractor("Lidl")
        assert extractor.supermarket == "Lidl"
    
    def test_price_parsing(self):
        """Test various price formats."""
        extractor = ProductExtractor()
        
        # Test Italian format
        assert extractor._parse_price("10,99€") == 10.99
        assert extractor._parse_price("€10.99") == 10.99
        assert extractor._parse_price("5,50") == 5.50
        
        # Test edge cases
        assert extractor._parse_price(None) is None
        assert extractor._parse_price("") is None
    
    def test_discount_parsing(self):
        """Test discount percentage parsing."""
        extractor = ProductExtractor()
        
        assert extractor._parse_discount("20%") == 20.0
        assert extractor._parse_discount("-15%") == 15.0
        assert extractor._parse_discount("Sconto 30%") == 30.0
        
        assert extractor._parse_discount(None) is None
        assert extractor._parse_discount("invalid") is None
    
    def test_product_record_extraction(self):
        """Test extraction of a complete product record."""
        extractor = ProductExtractor("Lidl")
        
        product_data = {
            "name": "Pasta Barilla 500g",
            "original_price": "2.50€",
            "current_price": "1.99€",
            "discount_percent": "20%",
            "confidence": 0.95
        }
        
        record = extractor.extract_product_record(product_data, page_num=1)
        
        assert record["product_name"] == "Pasta Barilla 500g"
        assert record["old_price"] == 2.50
        assert record["current_price"] == 1.99
        assert record["discount_percent"] == "-20.0%"
        assert record["supermarket"] == "Lidl"
        assert record["page_number"] == 1
        assert record["confidence"] == 0.95
    
    def test_validation_report(self):
        """Test product validation."""
        extractor = ProductExtractor()
        
        products = [
            {
                "product_name": "Product 1",
                "discounted_price": 5.99,
                "discount_percentage": 20.0,
                "confidence_score": 0.95
            },
            {
                "product_name": "Product 2",
                "discounted_price": None,
                "discount_percentage": None,
                "confidence_score": 0.3
            },
            {
                "product_name": "",
                "discounted_price": 2.50,
                "confidence_score": 0.85
            }
        ]
        
        report = extractor.validate_products(products)
        
        assert report["total"] == 3
        assert report["with_prices"] == 2
        assert report["with_discounts"] == 1
        assert 0.3 < report["avg_confidence"] < 0.95


class TestCSVExport:
    """Test CSV export functionality."""
    
    def test_csv_export(self):
        """Test CSV file creation."""
        with tempfile.TemporaryDirectory() as tmpdir:
            exporter = CSVExporter(tmpdir)
            
            products = [
                {
                    "supermarket": "Lidl",
                    "product_name": "Pasta",
                    "current_price": 1.99,
                    "old_price": 2.50,
                    "discount_percent": "-20%",
                    "confidence": 0.95,
                    "flyer_date": "2024-01-20",
                    "page_number": 1,
                    "weight_or_pack": "500g",
                    "extracted_at": "2024-01-15T10:00:00"
                }
            ]
            
            csv_path = exporter.export_to_csv(products, filename="test.csv")
            
            assert Path(csv_path).exists()
            
            # Verify content
            with open(csv_path, "r", encoding="utf-8") as f:
                content = f.read()
                assert "Pasta" in content
                assert "1.99" in content
                assert "Lidl" in content
    
    def test_utf8_encoding(self):
        """Test Italian character support."""
        with tempfile.TemporaryDirectory() as tmpdir:
            exporter = CSVExporter(tmpdir)
            
            products = [
                {
                    "supermarket": "Lidl",
                    "product_name": "Parmigiano Reggiano Garantito",
                    "current_price": 7.99,
                    "old_price": None,
                    "discount_percent": None,
                    "confidence": 0.92,
                    "flyer_date": "2024-01-20",
                    "page_number": 1,
                    "weight_or_pack": "250g - Crema",
                    "extracted_at": "2024-01-15T10:00:00"
                }
            ]
            
            csv_path = exporter.export_to_csv(products, filename="test_italian.csv")
            
            with open(csv_path, "r", encoding="utf-8") as f:
                content = f.read()
                assert "Parmigiano Reggiano Garantito" in content
                assert "Crema" in content


class TestVisionAnalyzerIntegration:
    """Test vision analyzer integration (mocked)."""
    
    def test_vision_analyzer_initialization(self):
        """Test VisionAnalyzer can be initialized."""
        from src.vision import VisionAnalyzer
        
        analyzer = VisionAnalyzer("sk-or-v1-test-key-valid-format")
        assert analyzer.model == "google/gemini-2.5-flash"
        assert analyzer.base_url == "https://openrouter.ai/api/v1/chat/completions"
    
    def test_invalid_api_key(self):
        """Test that invalid API keys are rejected."""
        from src.vision import VisionAnalyzer
        
        with pytest.raises(ValueError):
            VisionAnalyzer("invalid-key")
        
        with pytest.raises(ValueError):
            VisionAnalyzer("")


class TestBrowserAutomation:
    """Test browser automation module."""
    
    def test_flyer_browser_initialization(self):
        """Test FlyerBrowser initializes correctly."""
        from src.browser import FlyerBrowser
        
        browser = FlyerBrowser()
        assert browser.browser is None
        assert browser.context is None
        assert browser.page is None
        assert browser.screenshots_dir.exists()


class TestDataFlow:
    """Test complete data flow."""
    
    def test_vision_to_csv_flow(self):
        """Test data flow from vision analysis to CSV."""
        # Mock vision analysis results
        vision_results = {
            "total_images": 1,
            "successful_analyses": 1,
            "failed_analyses": 0,
            "total_products": 2,
            "by_page": {
                "test_image.png": {
                    "products": [
                        {
                            "name": "Mozzarella",
                            "original_price": "3.50€",
                            "current_price": "2.99€",
                            "discount_percent": "15%",
                            "confidence": 0.94,
                            "details": "250g"
                        },
                        {
                            "name": "Pane",
                            "original_price": "1.50€",
                            "current_price": "1.20€",
                            "discount_percent": "20%",
                            "confidence": 0.89,
                            "details": "500g"
                        }
                    ],
                    "total_products_found": 2,
                    "quality_notes": "Clear prices"
                }
            }
        }
        
        # Extract products
        extractor = ProductExtractor("Lidl")
        products = extractor.extract_all_products(vision_results)
        
        assert len(products) == 2
        assert products[0]["product_name"] == "Mozzarella"
        assert products[1]["product_name"] == "Pane"
        
        # Export to CSV
        with tempfile.TemporaryDirectory() as tmpdir:
            csv_path = CSVExporter(tmpdir).export_to_csv(products, "test_flow.csv")
            assert Path(csv_path).exists()
            
            # Verify all fields are present
            with open(csv_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
                assert len(lines) == 3  # Header + 2 products
                assert "Mozzarella" in lines[1]
                assert "Pane" in lines[2]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
