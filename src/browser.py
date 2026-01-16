"""
Browser automation using Playwright for flyer screenshot capture.
Handles JavaScript-heavy flyer viewers and page navigation.
"""

import asyncio
from pathlib import Path
from typing import Optional, List
from datetime import datetime

from playwright.async_api import async_playwright, Page, Browser, BrowserContext
from src.logger import logger


class FlyerBrowser:
    """Handles browser automation for flyer capture."""
    
    def __init__(self):
        """Initialize browser automation."""
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.screenshots_dir = Path(__file__).parent.parent / "data" / "screenshots"
        self.screenshots_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"FlyerBrowser initialized. Screenshots dir: {self.screenshots_dir}")
    
    async def launch(self) -> None:
        """
        Launch Chromium browser in headless mode.
        
        Raises:
            RuntimeError: If browser launch fails
        """
        try:
            logger.info("Launching Playwright with Chromium (headless mode)")
            playwright = await async_playwright().start()
            
            logger.info("Starting Chromium browser process")
            self.browser = await playwright.chromium.launch(headless=True)
            logger.info("Browser launched successfully")
            
            logger.info("Creating browser context with high-resolution viewport")
            self.context = await self.browser.new_context(
                viewport={"width": 3840, "height": 2160},  # 4K resolution for better detail
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            )
            logger.info("Browser context created with viewport 3840x2160 (4K)")
            
            logger.info("Creating new page")
            self.page = await self.context.new_page()
            logger.info("Page created successfully")
            
        except Exception as e:
            logger.error(f"Failed to launch browser: {e}", exc_info=True)
            raise RuntimeError(f"Browser launch failed: {e}")
    
    async def navigate_to_flyer(self, url: str) -> bool:
        """
        Navigate to the flyer URL and wait for it to load.
        
        Args:
            url: Flyer URL
            
        Returns:
            True if navigation successful, False otherwise
        """
        if not self.page:
            logger.error("Page not initialized. Call launch() first.")
            return False
        
        try:
            logger.info(f"Navigating to flyer URL: {url}")
            await self.page.goto(url, wait_until="networkidle", timeout=30000)
            logger.info("Page navigation completed (networkidle reached)")
            
            # Dismiss cookie banner if present
            await self._dismiss_cookie_banner()
            
            logger.info("Waiting 2 seconds for flyer viewer to fully render")
            await self.page.wait_for_timeout(2000)
            
            return True
            
        except Exception as e:
            logger.error(f"Navigation failed for {url}: {e}", exc_info=True)
            return False
    
    async def _dismiss_cookie_banner(self) -> None:
        """
        Dismiss OneTrust cookie consent banner.
        Prioritizes the "Continua senza accettare" (Continue without accepting) button.
        Falls back to other rejection options if primary button not found.
        """
        if not self.page:
            return
        
        # Priority selectors - ordered by preference
        selectors = [
            # OneTrust banner - primary reject button (Lidl uses this)
            ("#onetrust-reject-all-handler", "OneTrust reject all"),
            
            # OneTrust banner - alternative selectors
            ("button[id*='reject-all']", "OneTrust reject pattern"),
            ("button.ot-button-order-0", "OneTrust first button"),
            
            # Text-based fallback (case-insensitive)
            ("button:has-text('CONTINUA SENZA')", "Continue without accepting"),
            ("button:has-text('continua senza')", "Continue (lowercase)"),
            ("button:has-text('rifiuta')", "Reject (Italian)"),
            
            # Generic cookie banner selectors
            ("button[id*='reject']", "Reject button pattern"),
            ("button[class*='reject']", "Reject class pattern"),
            (".cookie-consent button:first-child", "Cookie consent first button"),
        ]
        
        for selector, description in selectors:
            try:
                element = self.page.locator(selector).first
                if await element.is_visible(timeout=500):
                    logger.info(f"Found cookie banner button: {description} - clicking it")
                    await element.click()
                    logger.info("Cookie banner dismissed successfully")
                    await self.page.wait_for_timeout(500)  # Wait for banner to disappear
                    return
            except Exception as e:
                logger.debug(f"Selector '{description}' failed: {e}")
                continue
        
        logger.debug("No cookie banner detected or already dismissed")
    
    async def get_flyer_page_count(self) -> int:
        """
        Detect the total number of pages in the flyer using multiple methods.
        
        Returns:
            Number of pages, or -1 if detection fails (signals to use button clicking method)
        """
        if not self.page:
            logger.error("Page not initialized")
            return -1
        
        try:
            # Get all page text for pattern matching
            page_text = await self.page.inner_text('body')
            
            # Method 1: Look for Italian pagination patterns
            import re
            patterns = [
                r'Pagina\s+\d+\s+di\s+(\d+)',  # "Pagina 1 di 8"
                r'\d+\s+di\s+(\d+)',            # "1 di 8"
                r'\d+\s*/\s*(\d+)',             # "1 / 8" or "1/8"
                r'(\d+)\s+pagine?',             # "8 pagine"
            ]
            
            for pattern in patterns:
                match = re.search(pattern, page_text, re.IGNORECASE)
                if match:
                    count = int(match.group(1))
                    logger.info(f"✓ Detected {count} pages via text pattern: {pattern}")
                    return count
            
            # Method 2: Count pagination indicators/dots
            pagination_selectors = [
                '.pagination-item',
                '.page-indicator',
                '[role="tab"]',
                'button[aria-label*="Pagina"]',
                '.flyer-page-indicator'
            ]
            
            for selector in pagination_selectors:
                elements = await self.page.query_selector_all(selector)
                if elements and len(elements) > 1:
                    logger.info(f"✓ Detected {len(elements)} pages via pagination indicators")
                    return len(elements)
            
            # Method 3: Check URL structure for page parameter
            url = self.page.url
            if '/page/' in url:
                # Try to detect max page by checking multiple URLs
                logger.info("Attempting to detect page count via URL probing")
                base_url = url.rsplit('/page/', 1)[0] + '/page/'
                
                # Quick check: does page 2 exist?
                try:
                    test_response = await self.page.goto(f"{base_url}2", wait_until="domcontentloaded", timeout=5000)
                    if test_response and test_response.ok:
                        # Go back to page 1
                        await self.page.goto(f"{base_url}1", wait_until="networkidle")
                        # At least 2 pages exist, but we don't know the max
                        # Return -1 to signal button clicking method
                        logger.info("Multiple pages detected via URL probing - will use button clicking")
                        return -1
                except:
                    # Page 2 doesn't exist, only 1 page
                    await self.page.goto(f"{base_url}1", wait_until="networkidle")
                    logger.info("Only 1 page exists (URL probe failed)")
                    return 1
            
            # Could not detect page count
            logger.info("⚠️  Could not detect page count - will use button clicking method")
            return -1
            
        except Exception as e:
            logger.error(f"Page count detection failed: {e}", exc_info=True)
            return -1
        
        try:
            # Try common page count indicators
            selectors = [
                'div[class*="page-count"]',
                'span[class*="page"]',
                '[class*="total-pages"]',
                'div[data-total-pages]',
            ]
            
            page_count = 1
            
            for selector in selectors:
                try:
                    logger.debug(f"Attempting to detect page count with selector: {selector}")
                    element = await self.page.query_selector(selector)
                    if element:
                        text = await element.text_content()
                        logger.debug(f"Found element with text: {text}")
                except Exception as e:
                    logger.debug(f"Selector {selector} failed: {e}")
                    continue
            
            # Fallback: check for navigation buttons to estimate pages
            logger.info("Attempting to detect page count via pagination controls")
            next_buttons = await self.page.query_selector_all('button[aria-label*="next"], button[class*="next"]')
            
            if next_buttons:
                # Click through to estimate page count
                logger.debug(f"Found {len(next_buttons)} navigation buttons")
                page_count = 1  # Start with page 1
            
            logger.info(f"Detected page count: {page_count}")
            return page_count
            
        except Exception as e:
            logger.error(f"Page count detection failed: {e}", exc_info=True)
            return 1
    
    async def navigate_to_page(self, page_num: int) -> bool:
        """
        Navigate to a specific page in the flyer.
        
        Args:
            page_num: Page number (1-indexed)
            
        Returns:
            True if navigation successful
        """
        if not self.page:
            logger.error("Page not initialized")
            return False
        
        try:
            logger.info(f"Navigating to flyer page {page_num}")
            
            # Try clicking next button multiple times if needed
            current_page = 1
            while current_page < page_num:
                logger.debug(f"Current page: {current_page}, Target: {page_num}, Clicking next")
                
                next_button = await self.page.query_selector('button[aria-label*="next"], button[class*="next"]')
                if not next_button:
                    logger.warning("Could not find next button")
                    break
                
                await next_button.click()
                logger.debug(f"Clicked next button, waiting for page transition")
                await self.page.wait_for_timeout(1500)
                
                current_page += 1
            
            logger.info(f"Successfully navigated to page {page_num}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to navigate to page {page_num}: {e}", exc_info=True)
            return False
    
    async def take_screenshot(self, page_num: int) -> Optional[str]:
        """
        Take a screenshot of the current page.
        
        Args:
            page_num: Page number for filename
            
        Returns:
            Path to screenshot file, or None if failed
        """
        if not self.page:
            logger.error("Page not initialized")
            return None
        
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"lidl_page_{page_num}_{timestamp}.png"
            filepath = self.screenshots_dir / filename
            
            logger.info(f"Taking screenshot for page {page_num}")
            await self.page.screenshot(path=str(filepath), full_page=False)
            
            file_size = filepath.stat().st_size
            logger.info(f"Screenshot saved: {filepath} ({file_size} bytes)")
            
            return str(filepath)
            
        except Exception as e:
            logger.error(f"Failed to take screenshot for page {page_num}: {e}", exc_info=True)
            return None
    
    async def take_screenshots_all_pages(self, page_count: int) -> List[str]:
        """
        Take screenshots of all pages in the flyer using hybrid approach.
        
        Args:
            page_count: Total number of pages (-1 means unknown, use button clicking)
            
        Returns:
            List of screenshot filepaths
        """
        if page_count > 1:
            # Method A: URL navigation (faster, when page count is known)
            logger.info(f"📄 Using URL navigation for {page_count} pages")
            return await self._capture_via_url_navigation(page_count)
        else:
            # Method B: Button clicking (fallback, when page count unknown)
            logger.info(f"🔘 Using button clicking method (page count unknown)")
            return await self._capture_via_button_clicks()
    
    async def _capture_via_url_navigation(self, page_count: int) -> List[str]:
        """Capture pages using direct URL navigation (faster)"""
        screenshots = []
        current_url = self.page.url
        
        # Extract base URL
        if '/page/' in current_url:
            base_url = current_url.rsplit('/page/', 1)[0] + '/page/'
        else:
            logger.warning("URL doesn't contain /page/ - falling back to button clicking")
            return await self._capture_via_button_clicks()
        
        for page_num in range(1, page_count + 1):
            logger.info(f"📸 Capturing page {page_num}/{page_count}")
            
            # Navigate to page
            url = f"{base_url}{page_num}"
            try:
                await self.page.goto(url, wait_until="networkidle", timeout=30000)
                await self.page.wait_for_timeout(1500)  # Let flyer render
                
                # Take screenshot
                screenshot_path = await self.take_screenshot(page_num)
                if screenshot_path:
                    screenshots.append(screenshot_path)
                else:
                    logger.warning(f"Failed to capture page {page_num}")
                    
            except Exception as e:
                logger.warning(f"Error capturing page {page_num}: {e}")
                continue
        
        logger.info(f"✓ Captured {len(screenshots)}/{page_count} pages via URL navigation")
        return screenshots
    
    async def _capture_via_button_clicks(self) -> List[str]:
        """Capture pages by clicking 'next' button until exhausted (reliable fallback)"""
        screenshots = []
        page_num = 1
        
        # Track captured page hashes to detect loops
        captured_hashes = set()
        
        # Next button selectors (from Lidl HTML)
        NEXT_BUTTON_SELECTORS = [
            'button.button--navigation[aria-label="Pagina successiva"]',  # Specific Lidl
            'button[aria-label*="successiva"]',  # Generic "next" in Italian
            'button[aria-label*="next"]',         # English fallback
            'button.button--navigation.button--navigation-lidl'  # Class-based
        ]
        
        while True:
            # Capture current page
            logger.info(f"📸 Capturing page {page_num}")
            screenshot_path = await self.take_screenshot(page_num)
            
            if screenshot_path:
                screenshots.append(screenshot_path)
                
                # Check for duplicate pages by comparing page content hash
                try:
                    page_content = await self.page.content()
                    content_hash = hash(page_content)
                    
                    if content_hash in captured_hashes:
                        logger.warning(f"⚠️  Loop detected! Page {page_num} is a duplicate of a previous page")
                        logger.info(f"✓ Captured {len(screenshots)} unique pages before loop detected")
                        break
                    
                    captured_hashes.add(content_hash)
                except Exception as e:
                    logger.debug(f"Could not hash page content: {e}")
            else:
                logger.warning(f"Failed to capture page {page_num}")
                break
            
            # Find next button (try all selectors)
            next_button = None
            for selector in NEXT_BUTTON_SELECTORS:
                next_button = await self.page.query_selector(selector)
                if next_button:
                    logger.debug(f"Found next button with selector: {selector}")
                    break
            
            if not next_button:
                logger.info(f"✓ No next button found - captured all {page_num} pages")
                break
            
            # Check if button is disabled or hidden
            try:
                is_disabled = await next_button.get_attribute('disabled')
                is_hidden = await next_button.is_hidden()
                
                if is_disabled or is_hidden:
                    logger.info(f"✓ Next button disabled - captured all {page_num} pages")
                    break
                
                # Click next button
                await next_button.click()
                logger.debug(f"Clicked next button → page {page_num + 1}")
                
                # Wait for page transition
                await self.page.wait_for_timeout(2000)
                
                page_num += 1
                
                # Safety limit to prevent infinite loops
                if page_num > 50:
                    logger.warning("⚠️  Reached 50 page safety limit")
                    break
                    
            except Exception as e:
                logger.warning(f"Error clicking next button: {e}")
                break
        
        logger.info(f"✓ Captured {len(screenshots)} pages via button clicking")
        return screenshots
    
    async def close(self) -> None:
        """Close browser and cleanup resources."""
        try:
            logger.info("Closing browser and cleaning up resources")
            
            if self.context:
                await self.context.close()
                logger.info("Browser context closed")
            
            if self.browser:
                await self.browser.close()
                logger.info("Browser process terminated")
                
        except Exception as e:
            logger.error(f"Error during browser cleanup: {e}", exc_info=True)


async def capture_flyer_screenshots(url: str) -> List[str]:
    """
    Convenience function to capture all flyer pages.
    
    Args:
        url: Flyer URL
        
    Returns:
        List of screenshot filepaths
    """
    browser = FlyerBrowser()
    screenshots = []
    
    try:
        await browser.launch()
        logger.info(f"Starting flyer capture for: {url}")
        
        if await browser.navigate_to_flyer(url):
            page_count = await browser.get_flyer_page_count()
            screenshots = await browser.take_screenshots_all_pages(page_count)
        
    finally:
        await browser.close()
    
    return screenshots


def capture_flyer_sync(url: str) -> List[str]:
    """
    Synchronous wrapper for flyer screenshot capture.
    
    Args:
        url: Flyer URL
        
    Returns:
        List of screenshot filepaths
    """
    logger.info("Starting async event loop for browser automation")
    return asyncio.run(capture_flyer_screenshots(url))
