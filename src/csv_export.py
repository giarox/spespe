"""
CSV export functionality for extracted product data.
Handles UTF-8 encoding for Italian characters.
"""

import csv
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime

from src.logger import logger


class CSVExporter:
    """Handles CSV export of product data."""
    
    # CSV columns in order
    FIELDNAMES = [
        "supermarket",
        "flyer_date",
        "page_number",
        "product_name",
        "original_price",
        "discounted_price",
        "discount_percentage",
        "details",
        "confidence_score",
        "extraction_timestamp",
    ]
    
    def __init__(self, output_dir: str = None):
        """
        Initialize exporter.
        
        Args:
            output_dir: Directory for CSV output (defaults to data/output)
        """
        if output_dir:
            self.output_dir = Path(output_dir)
        else:
            self.output_dir = Path(__file__).parent.parent / "data" / "output"
        
        self.output_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"CSVExporter initialized. Output dir: {self.output_dir}")
    
    def export_to_csv(
        self,
        products: List[Dict[str, Any]],
        filename: str = None
    ) -> str:
        """
        Export products to CSV file.
        
        Args:
            products: List of product records
            filename: Output filename (auto-generated if not provided)
            
        Returns:
            Path to exported CSV file
            
        Raises:
            IOError: If file write fails
        """
        try:
            # Generate filename if not provided
            if not filename:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"lidl_products_{timestamp}.csv"
            
            filepath = self.output_dir / filename
            logger.info(f"Exporting {len(products)} products to CSV: {filepath}")
            
            # Write CSV with UTF-8 encoding
            with open(filepath, "w", newline="", encoding="utf-8") as csvfile:
                writer = csv.DictWriter(csvfile, fieldnames=self.FIELDNAMES)
                
                logger.debug("Writing CSV header")
                writer.writeheader()
                
                # Write product rows
                for idx, product in enumerate(products, 1):
                    # Ensure all required fields exist
                    row = {}
                    for field in self.FIELDNAMES:
                        value = product.get(field)
                        # Format numeric values appropriately
                        if value is not None and isinstance(value, float):
                            row[field] = f"{value:.2f}" if "price" in field else str(value)
                        else:
                            row[field] = value or ""
                    
                    writer.writerow(row)
                    
                    if idx % 10 == 0:
                        logger.debug(f"Wrote {idx}/{len(products)} rows")
            
            file_size = filepath.stat().st_size
            logger.info(f"CSV export successful: {filepath} ({file_size} bytes)")
            logger.info(f"Total records: {len(products)}")
            
            return str(filepath)
            
        except IOError as e:
            logger.error(f"Failed to write CSV file: {e}", exc_info=True)
            raise
        except Exception as e:
            logger.error(f"CSV export failed: {e}", exc_info=True)
            raise
    
    def export_multiple_flyers(
        self,
        flyer_results: Dict[str, List[Dict[str, Any]]],
        base_filename: str = None
    ) -> Dict[str, str]:
        """
        Export products from multiple flyers to separate CSV files.
        
        Args:
            flyer_results: Dictionary mapping flyer name to product list
            base_filename: Base filename for output (supermarket name)
            
        Returns:
            Dictionary mapping flyer name to CSV file path
        """
        logger.info(f"Exporting data from {len(flyer_results)} flyers")
        
        results = {}
        
        for flyer_name, products in flyer_results.items():
            logger.info(f"Processing flyer: {flyer_name} ({len(products)} products)")
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{base_filename or flyer_name}_{timestamp}.csv"
            
            try:
                csv_path = self.export_to_csv(products, filename)
                results[flyer_name] = csv_path
            except Exception as e:
                logger.error(f"Failed to export {flyer_name}: {e}")
                results[flyer_name] = None
        
        logger.info(f"Flyer export complete: {len([r for r in results.values() if r])} successful")
        
        return results


def export_products(
    products: List[Dict[str, Any]],
    output_dir: str = None,
    filename: str = None
) -> str:
    """
    Convenience function to export products to CSV.
    
    Args:
        products: List of product records
        output_dir: Output directory
        filename: Output filename
        
    Returns:
        Path to CSV file
    """
    logger.info(f"Exporting {len(products)} products to CSV")
    exporter = CSVExporter(output_dir)
    csv_path = exporter.export_to_csv(products, filename)
    return csv_path
