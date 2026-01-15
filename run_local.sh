#!/bin/bash

set -e

echo "=========================================="
echo "Spespe - Local Scraper Test"
echo "=========================================="
echo ""

# Check if API key is set
if [ -z "$OPENROUTER_API_KEY" ]; then
    echo "❌ ERROR: OPENROUTER_API_KEY environment variable not set"
    echo ""
    echo "Set it with:"
    echo "  export OPENROUTER_API_KEY='***REMOVED***'"
    echo ""
    exit 1
fi

echo "✅ API key configured"
echo ""

# Check Python
echo "[1/5] Checking Python..."
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found"
    exit 1
fi
python_version=$(python3 --version 2>&1 | awk '{print $2}')
echo "✅ Python $python_version"
echo ""

# Check/install dependencies
echo "[2/5] Installing dependencies..."
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate
pip install -q -r requirements.txt
echo "✅ Dependencies installed"
echo ""

# Install Playwright browsers
echo "[3/5] Installing Playwright browsers..."
python3 -m playwright install chromium --with-deps > /dev/null 2>&1 || true
echo "✅ Chromium ready"
echo ""

# Create data directories
echo "[4/5] Setting up directories..."
mkdir -p data/{screenshots,output,logs}
echo "✅ Data directories ready"
echo ""

# Run the scraper
echo "[5/5] Running Spespe scraper..."
echo ""
echo "=========================================="
python3 -m src.main
scraper_exit_code=$?
echo "=========================================="
echo ""

if [ $scraper_exit_code -eq 0 ]; then
    echo "✅ Scraper completed successfully!"
    echo ""
    echo "Output files:"
    if [ -d "data/output" ] && [ "$(ls -A data/output)" ]; then
        ls -lh data/output/
    else
        echo "  (No CSV files generated - this might indicate no products were extracted)"
    fi
    echo ""
    echo "Logs:"
    if [ -d "data/logs" ] && [ "$(ls -A data/logs)" ]; then
        tail -20 data/logs/*.log
    fi
else
    echo "❌ Scraper failed with exit code $scraper_exit_code"
    echo ""
    echo "Check logs in data/logs/ for details"
    exit $scraper_exit_code
fi
