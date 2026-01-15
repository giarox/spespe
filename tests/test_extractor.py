"""
Unit tests for extractor.py module.
Tests product extraction, parsing, and validation logic.
"""

import pytest
from src.extractor import ProductExtractor


class TestExtractorInitialization:
    """Test ProductExtractor initialization."""
    
    def test_initialization_with_supermarket(self):
        """Test ProductExtractor initializes with supermarket name."""
        extractor = ProductExtractor("Lidl")
        assert extractor.supermarket == "Lidl"
    
    def test_initialization_without_supermarket(self):
        """Test ProductExtractor initializes with default supermarket."""
        extractor = ProductExtractor()
        # Default is Lidl when not specified
        assert extractor.supermarket == "Lidl"


class TestPriceParsing:
    """Test price parsing logic."""
    
    def test_parse_italian_price_comma(self):
        """Test parsing Italian price format with comma."""
        extractor = ProductExtractor()
        
        assert extractor._parse_price("10,99€") == 10.99
        assert extractor._parse_price("2,50€") == 2.50
        assert extractor._parse_price("1,00€") == 1.00
    
    def test_parse_euro_prefix(self):
        """Test parsing price with euro prefix."""
        extractor = ProductExtractor()
        
        assert extractor._parse_price("€10.99") == 10.99
        assert extractor._parse_price("€5.50") == 5.50
    
    def test_parse_euro_suffix(self):
        """Test parsing price with euro suffix."""
        extractor = ProductExtractor()
        
        assert extractor._parse_price("10.99€") == 10.99
        assert extractor._parse_price("5.50€") == 5.50
    
    def test_parse_just_numbers(self):
        """Test parsing price with just numbers."""
        extractor = ProductExtractor()
        
        assert extractor._parse_price("10.99") == 10.99
        assert extractor._parse_price("5.50") == 5.50
    
    def test_parse_zero_price(self):
        """Test parsing zero price."""
        extractor = ProductExtractor()
        
        assert extractor._parse_price("0€") == 0.0
        assert extractor._parse_price("0.00") == 0.0
    
    def test_parse_none_returns_none(self):
        """Test that None input returns None."""
        extractor = ProductExtractor()
        
        assert extractor._parse_price(None) is None
    
    def test_parse_empty_string_returns_none(self):
        """Test that empty string returns None."""
        extractor = ProductExtractor()
        
        assert extractor._parse_price("") is None
    
    def test_parse_invalid_string_returns_none(self):
        """Test that invalid string returns None."""
        extractor = ProductExtractor()
        
        assert extractor._parse_price("not a price") is None
        assert extractor._parse_price("abc") is None


class TestDiscountParsing:
    """Test discount percentage parsing logic."""
    
    def test_parse_discount_with_percent_sign(self):
        """Test parsing discount with % sign."""
        extractor = ProductExtractor()
        
        assert extractor._parse_discount("20%") == 20.0
        assert extractor._parse_discount("15%") == 15.0
        assert extractor._parse_discount("50%") == 50.0
    
    def test_parse_discount_negative_sign(self):
        """Test parsing discount with negative sign."""
        extractor = ProductExtractor()
        
        assert extractor._parse_discount("-15%") == 15.0
        assert extractor._parse_discount("-20%") == 20.0
    
    def test_parse_discount_with_word(self):
        """Test parsing discount with descriptive word."""
        extractor = ProductExtractor()
        
        assert extractor._parse_discount("Sconto 30%") == 30.0
        assert extractor._parse_discount("Discount 25%") == 25.0
    
    def test_parse_discount_decimal(self):
        """Test parsing decimal discount."""
        extractor = ProductExtractor()
        
        assert extractor._parse_discount("12.5%") == 12.5
        assert extractor._parse_discount("33.33%") == 33.33
    
    def test_parse_discount_zero(self):
        """Test parsing zero discount."""
        extractor = ProductExtractor()
        
        assert extractor._parse_discount("0%") == 0.0
    
    def test_parse_discount_none_returns_none(self):
        """Test that None returns None."""
        extractor = ProductExtractor()
        
        assert extractor._parse_discount(None) is None
    
    def test_parse_discount_invalid_returns_none(self):
        """Test that invalid discount returns None."""
        extractor = ProductExtractor()
        
        assert extractor._parse_discount("invalid") is None
        assert extractor._parse_discount("abc%") is None


class TestProductRecordExtraction:
    """Test extraction of complete product records."""
    
    def test_extract_complete_product(self):
        """Test extracting a complete product record."""
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
        assert record["original_price"] == 2.50
        assert record["discounted_price"] == 1.99
        assert record["discount_percentage"] == 20.0
        assert record["supermarket"] == "Lidl"
        assert record["page_number"] == 1
        assert record["confidence_score"] == 0.95
    
    def test_extract_product_with_missing_fields(self):
        """Test extracting product with missing optional fields."""
        extractor = ProductExtractor("Lidl")
        
        product_data = {
            "name": "Simple Product",
            "current_price": "5.99€",
        }
        
        record = extractor.extract_product_record(product_data, page_num=2)
        
        assert record["product_name"] == "Simple Product"
        assert record["discounted_price"] == 5.99
        assert record["page_number"] == 2
    
    def test_extract_product_page_number(self):
        """Test that page number is correctly set."""
        extractor = ProductExtractor()
        
        product_data = {"name": "Product", "current_price": "1.00€"}
        
        record1 = extractor.extract_product_record(product_data, page_num=1)
        record2 = extractor.extract_product_record(product_data, page_num=5)
        
        assert record1["page_number"] == 1
        assert record2["page_number"] == 5


class TestProductValidation:
    """Test product validation logic."""
    
    def test_validate_empty_list(self):
        """Test validation of empty product list."""
        extractor = ProductExtractor()
        
        report = extractor.validate_products([])
        
        assert report["total"] == 0
    
    def test_validate_products_with_prices(self):
        """Test validation counts products with prices."""
        extractor = ProductExtractor()
        
        products = [
            {"product_name": "P1", "discounted_price": 5.99},
            {"product_name": "P2", "discounted_price": None},
            {"product_name": "P3", "discounted_price": 10.00},
        ]
        
        report = extractor.validate_products(products)
        
        assert report["total"] == 3
        assert report["with_prices"] == 2
    
    def test_validate_products_with_discounts(self):
        """Test validation counts products with discounts."""
        extractor = ProductExtractor()
        
        products = [
            {"product_name": "P1", "discount_percentage": 20.0},
            {"product_name": "P2", "discount_percentage": None},
            {"product_name": "P3", "discount_percentage": 15.0},
        ]
        
        report = extractor.validate_products(products)
        
        assert report["with_discounts"] == 2
    
    def test_validate_average_confidence(self):
        """Test validation calculates average confidence."""
        extractor = ProductExtractor()
        
        products = [
            {"product_name": "P1", "confidence_score": 0.90},
            {"product_name": "P2", "confidence_score": 0.80},
            {"product_name": "P3", "confidence_score": 0.95},
        ]
        
        report = extractor.validate_products(products)
        
        # Average should be around 0.883
        assert 0.88 < report["avg_confidence"] < 0.90


class TestEdgeCases:
    """Test edge cases and boundary conditions."""
    
    def test_very_large_price(self):
        """Test parsing very large price."""
        extractor = ProductExtractor()
        
        assert extractor._parse_price("999999.99€") == 999999.99
    
    def test_very_small_price(self):
        """Test parsing very small price."""
        extractor = ProductExtractor()
        
        assert extractor._parse_price("0.01€") == 0.01
    
    def test_discount_over_100_percent(self):
        """Test parsing discount over 100% (edge case)."""
        extractor = ProductExtractor()
        
        # Should parse without error
        result = extractor._parse_discount("150%")
        assert result == 150.0
    
    def test_unicode_product_names(self):
        """Test handling unicode in product names."""
        extractor = ProductExtractor()
        
        product_data = {
            "name": "Parmigiano Reggiano Garantito",
            "current_price": "8.50€"
        }
        
        record = extractor.extract_product_record(product_data, page_num=1)
        assert "Parmigiano" in record["product_name"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
