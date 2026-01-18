"""
Verbose logging configuration for the Spotter pipeline.
Logs to both stdout and file with detailed information.
"""

import logging
import sys
from pathlib import Path
from datetime import datetime


def setup_logger(name: str = "spespe") -> logging.Logger:
    """
    Configure verbose logging to stdout and file.
    
    Args:
        name: Logger name
        
    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)
    
    # Set to DEBUG for maximum verbosity
    logger.setLevel(logging.DEBUG)
    
    # Create logs directory at repo root
    logs_dir = Path(__file__).parents[3] / "data" / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    
    # Detailed format with timestamps and function names
    detailed_format = (
        "[%(asctime)s] [%(levelname)-8s] [%(name)s:%(funcName)s:%(lineno)d] "
        "%(message)s"
    )
    formatter = logging.Formatter(detailed_format, datefmt="%Y-%m-%d %H:%M:%S")
    
    # Console handler (STDOUT)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.DEBUG)
    console_handler.setFormatter(formatter)
    
    # File handler
    log_file = logs_dir / f"spotter_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
    file_handler = logging.FileHandler(log_file)
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)
    
    # Add handlers
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)
    
    logger.info(f"Logger initialized. Log file: {log_file}")
    
    return logger


# Module-level logger
logger = setup_logger()
