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
            
            logger.info("Creating browser context with typical viewport")
            self.context = await self.browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            )
            logger.info("Browser context created with viewport 1920x1080")
            
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
        Attempt to dismiss cookie consent banners.
        Tries multiple common selectors and button text patterns (case-insensitive).
        Prioritizes "Continua senza accettare" (Continue without accepting) for Lidl.
        """
        if not self.page:
            return
        
        # Button text patterns to look for (case-insensitive)
        # Priority order: "continue without accepting" > other reject options > accept
        button_texts = [
            "Continua senza accettare",  # Italian: "Continue without accepting" (PREFERRED)
            "continua senza",  # Partial match
            "rifiuta",  # Italian: "Reject"
            "reject",  # English: "Reject"
            "decline",  # English: "Decline"
            "Personalizza",  # Italian: "Customize" (to avoid broad acceptance)
        ]
        
        # Try text-based selectors first (more reliable)
        for button_text in button_texts:
            try:
                # Case-insensitive button search
                element = self.page.locator(f"button:has-text('{button_text}')").first
                if await element.is_visible(timeout=1000):
                    logger.info(f"Found cookie banner button: '{button_text}' - clicking it")
                    await element.click()
                    logger.info("Cookie banner dismissed via text match")
                    await self.page.wait_for_timeout(500)
                    return
            except Exception as e:
                logger.debug(f"Button text '{button_text}' not found: {e}")
                continue
        
        # Fallback to common CSS selectors if text matching fails
        selectors = [
            "button[id*='cookie']",
            "button[class*='cookie']",
            "button[class*='reject']",
            "[data-testid='cookie-accept']",
            "#onetrust-accept-btn-handler",
            ".cookie-consent button",
            ".cookie-banner button[type='button']:first-child",
        ]
        
        for selector in selectors:
            try:
                element = self.page.locator(selector).first
                if await element.is_visible(timeout=1000):
                    logger.debug(f"Found cookie banner via selector: {selector}")
                    await element.click()
                    logger.info("Cookie banner dismissed via CSS selector")
                    await self.page.wait_for_timeout(500)
                    return
            except Exception:
                continue
        
        logger.debug("No cookie banner found or already dismissed")
    
    async def get_flyer_page_count(self) -> int:
        """
        Detect number of pages in the flyer.
        Attempts multiple selectors for different flyer viewers.
        
        Returns:
            Number of pages, or 1 if detection fails
        """
        if not self.page:
            logger.error("Page not initialized")
            return 1
        
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
        Take screenshots of all pages in the flyer.
        
        Args:
            page_count: Total number of pages
            
        Returns:
            List of screenshot filepaths
        """
        screenshots = []
        
        logger.info(f"Starting to capture all {page_count} pages")
        
        for page_num in range(1, page_count + 1):
            logger.info(f"Processing page {page_num}/{page_count}")
            
            # Navigate to page if not first page
            if page_num > 1:
                if not await self.navigate_to_page(page_num):
                    logger.warning(f"Failed to navigate to page {page_num}, skipping")
                    continue
            
            # Take screenshot
            screenshot_path = await self.take_screenshot(page_num)
            if screenshot_path:
                screenshots.append(screenshot_path)
            else:
                logger.warning(f"Failed to capture screenshot for page {page_num}")
        
        logger.info(f"Captured {len(screenshots)}/{page_count} pages successfully")
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
