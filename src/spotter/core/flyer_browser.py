"""
Browser automation using Playwright for flyer screenshot capture.
Handles JavaScript-heavy flyer viewers and page navigation.
"""

import asyncio
from pathlib import Path
from typing import Optional, List
from datetime import datetime

from playwright.async_api import async_playwright, Page, Browser, BrowserContext, Frame
from src.spotter.core.logger import logger


class FlyerBrowser:
    """Handles browser automation for flyer capture."""
    
    def __init__(
        self,
        next_button_selectors: Optional[List[str]] = None,
        page_input_selectors: Optional[List[str]] = None,
        page_indicator_selectors: Optional[List[str]] = None,
        iframe_selector: Optional[str] = None
    ):
        """Initialize browser automation."""
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.frame: Optional[Frame] = None  # For iframe content
        self.iframe_selector = iframe_selector
        self.next_button_selectors = next_button_selectors or []
        self.page_input_selectors = page_input_selectors or []
        self.page_indicator_selectors = page_indicator_selectors or []
        self.screenshots_dir = Path(__file__).parents[3] / "data" / "screenshots"
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
    
    async def navigate_to_flyer(self, url: str, cookie_selectors: Optional[List[str]] = None) -> bool:
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
            await self.page.goto(url, wait_until="domcontentloaded", timeout=60000)
            logger.info("Page navigation completed (domcontentloaded reached)")
            
            # Dismiss cookie banner if present
            await self._dismiss_cookie_banner(cookie_selectors)
            await self._dismiss_location_prompt()
            
            logger.info("Waiting 2 seconds for flyer viewer to fully render")
            await self.page.wait_for_timeout(2000)
            
            # Switch to iframe if configured
            if self.iframe_selector:
                await self._switch_to_iframe()
            
            return True
            
        except Exception as e:
            logger.error(f"Navigation failed for {url}: {e}", exc_info=True)
            return False
    
    async def _switch_to_iframe(self) -> bool:
        """Switch to iframe context for flyer navigation."""
        if not self.page or not self.iframe_selector:
            return False
        
        try:
            logger.info(f"Looking for iframe: {self.iframe_selector}")
            iframe_el = await self.page.query_selector(self.iframe_selector)
            if iframe_el:
                self.frame = await iframe_el.content_frame()
                if self.frame:
                    await self.frame.wait_for_load_state("domcontentloaded")
                    await self.page.wait_for_timeout(2000)
                    logger.info("✓ Switched to iframe context for navigation")
                    return True
                else:
                    logger.warning("Iframe element found but content_frame() returned None")
            else:
                logger.warning(f"Iframe not found: {self.iframe_selector}")
        except Exception as e:
            logger.warning(f"Failed to switch to iframe: {e}")
        
        return False
    
    async def _dismiss_cookie_banner(self, custom_selectors: Optional[List[str]] = None) -> None:
        """
        Dismiss cookie consent banner using known selectors.
        """
        if not self.page:
            return

        selectors = custom_selectors or [
            "#onetrust-reject-all-handler",
            "button[id*='reject-all']",
            "button.ot-button-order-0",
            "#iubenda-cs-reject-btn",
            ".iubenda-cs-reject-btn",
            "button#iubenda-cs-reject-btn",
            "button.iubenda-cs-reject-btn",
            "button:has-text('CONTINUA SENZA')",
            "button:has-text('continua senza')",
            "button:has-text('rifiuta')",
            "button[id*='reject']",
            "button[class*='reject']",
            ".cookie-consent button:first-child",
        ]

        for selector in selectors:
            try:
                element = self.page.locator(selector).first
                if await element.is_visible(timeout=500):
                    logger.info(f"Found cookie banner button: {selector} - clicking it")
                    await element.click()
                    logger.info("Cookie banner dismissed successfully")
                    await self.page.wait_for_timeout(500)
                    return
            except Exception as e:
                logger.debug(f"Selector '{selector}' failed: {e}")
                continue

        logger.debug("No cookie banner detected or already dismissed")

    async def _dismiss_location_prompt(self) -> None:
        """
        Dismiss location prompt banners if present.
        """
        if not self.page:
            return

        selectors = [
            "button:has-text('Rifiuta')",
            "button:has-text('Rifiuta tutto')",
            "button:has-text('Non consentire')",
            "button:has-text('Nega')",
            "button:has-text('No')",
            "button:has-text('Annulla')",
            "button[aria-label*='rifiuta']",
            "button[aria-label*='nega']",
            "button[aria-label*='deny']",
            "button[aria-label*='block']",
        ]

        for selector in selectors:
            try:
                element = self.page.locator(selector).first
                if await element.is_visible(timeout=500):
                    logger.info(f"Found location prompt button: {selector} - clicking it")
                    await element.click()
                    logger.info("Location prompt dismissed successfully")
                    await self.page.wait_for_timeout(500)
                    return
            except Exception as e:
                logger.debug(f"Selector '{selector}' failed: {e}")
                continue

        logger.debug("No location prompt detected or already dismissed")

    def _get_next_button_selectors(self) -> List[str]:
        """Return ordered next button selectors including overrides."""
        default_selectors = [
            'button.button--navigation[aria-label="Pagina successiva"]',
            'button[aria-label*="successiva"]',
            'button[aria-label*="next"]',
            'button[class*="next"]',
            'button.button--navigation.button--navigation-lidl'
        ]

        selectors: List[str] = []
        for selector in self.next_button_selectors + default_selectors:
            if selector and selector not in selectors:
                selectors.append(selector)
        return selectors

    async def _get_indicator_total_pages(self) -> Optional[int]:
        """Detect total pages from configured indicator selectors."""
        if not self.page or not self.page_indicator_selectors:
            return None

        for selector in self.page_indicator_selectors:
            try:
                element = await self.page.query_selector(selector)
                if not element:
                    continue
                text = (await element.text_content() or "").strip()
                if not text:
                    text = (await element.get_attribute("value") or "").strip()
                if not text:
                    text = (await element.get_attribute("data-total-pages") or "").strip()
                if not text:
                    continue
                import re
                numbers = re.findall(r"\d+", text)
                if numbers:
                    total = int(numbers[-1])
                    if total > 0:
                        return total
            except Exception as e:
                logger.debug(f"Indicator selector failed ({selector}): {e}")

        return None

    async def _navigate_via_page_input(self, page_num: int) -> bool:
        """Navigate using configured page input selectors."""
        if not self.page or not self.page_input_selectors:
            return False

        for selector in self.page_input_selectors:
            try:
                input_el = await self.page.query_selector(selector)
                if not input_el:
                    continue
                await input_el.fill(str(page_num))
                await input_el.press("Enter")
                await self.page.wait_for_timeout(1500)
                return True
            except Exception as e:
                logger.debug(f"Page input selector failed ({selector}): {e}")

        return False
    
    async def get_flyer_page_count(self) -> int:
        """
        Detect the total number of pages in the flyer using multiple methods.
        
        Returns:
            Number of pages, or -1 if detection fails (signals to use button clicking method)
        """
        if not self.page:
            logger.error("Page not initialized")
            return -1

        page = self.page

        try:
            # Calameo scroll viewer: explicit total page indicator
            calameo_total = await self._get_calameo_total_pages()
            if calameo_total:
                logger.info(f"✓ Detected {calameo_total} pages via Calameo indicator")
                return calameo_total

            indicator_total = await self._get_indicator_total_pages()
            if indicator_total:
                logger.info(f"✓ Detected {indicator_total} pages via configured indicator")
                return indicator_total

            # Get all page text for pattern matching
            page_text = await page.inner_text('body')
            
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
                except Exception:
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

        page = self.page

        try:
            logger.info(f"Navigating to flyer page {page_num}")

            if "calameo.com" in page.url:
                return await self._navigate_calameo_page(page_num)

            input_nav = await self._navigate_via_page_input(page_num)
            if input_nav:
                return True
            
            # Try clicking next button multiple times if needed
            current_page = 1
            selectors = self._get_next_button_selectors()
            while current_page < page_num:
                logger.debug(f"Current page: {current_page}, Target: {page_num}, Clicking next")
                
                next_button = None
                for selector in selectors:
                    next_button = await page.query_selector(selector)
                    if next_button:
                        break
                if not next_button:
                    logger.warning("Could not find next button")
                    break
                
                await next_button.click()
                logger.debug(f"Clicked next button, waiting for page transition")
                await page.wait_for_timeout(1500)
                
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
            filename = f"spotter_page_{page_num}_{timestamp}.png"
            filepath = self.screenshots_dir / filename
            
            logger.info(f"Taking screenshot for page {page_num}")
            
            # Use iframe for screenshot if available
            screenshot_target = self.page
            if self.iframe_selector:
                iframe_el = await self.page.query_selector(self.iframe_selector)
                if iframe_el:
                    screenshot_target = iframe_el
                    logger.info("📸 Capturing screenshot from iframe element")

            await screenshot_target.screenshot(path=str(filepath))
            
            file_size = filepath.stat().st_size
            logger.info(f"Screenshot saved: {filepath} ({file_size} bytes)")
            
            return str(filepath)
            
        except Exception as e:
            logger.error(f"Failed to take screenshot for page {page_num}: {e}", exc_info=True)
            return None
    
    async def take_screenshots_all_pages(self, page_count: int, limit: Optional[int] = None) -> List[str]:
        """
        Take screenshots of all pages in the flyer using hybrid approach.
        
        Args:
            page_count: Total number of pages (-1 means unknown, use button clicking)
            
        Returns:
            List of screenshot filepaths
        """
        if self.page and "calameo.com" in self.page.url:
            logger.info("🧭 Using Calameo scroll capture")
            return await self._capture_calameo_scroll(page_count, limit=limit)

        if page_count > 1:
            # Method A: URL navigation (faster, when page count is known)
            actual_count = min(page_count, limit) if limit else page_count
            logger.info(f"📄 Using URL navigation for {actual_count} pages")
            return await self._capture_via_url_navigation(actual_count)
        else:
            # Method B: Button clicking (fallback, when page count unknown)
            logger.info("🔘 Using button clicking method (page count unknown)")
            return await self._capture_via_button_clicks(limit)
    
    async def _capture_via_url_navigation(self, page_count: int) -> List[str]:
        """Capture pages using direct URL navigation (faster)"""
        screenshots = []
        if not self.page:
            return screenshots
        page = self.page
        current_url = page.url
        
        # Extract base URL
        if '/page/' in current_url:
            base_url = current_url.rsplit('/page/', 1)[0] + '/page/'
        else:
            logger.warning("URL doesn't contain /page/ - falling back to button clicking")
            return await self._capture_via_button_clicks(limit=page_count)
        
        for page_num in range(1, page_count + 1):
            logger.info(f"📸 Capturing page {page_num}/{page_count}")
            
            # Navigate to page
            url = f"{base_url}{page_num}"
            try:
                await page.goto(url, wait_until="networkidle", timeout=30000)
                await page.wait_for_timeout(1500)  # Let flyer render
                
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
    
    async def _capture_via_button_clicks(self, limit: Optional[int] = None) -> List[str]:
        """Capture pages by clicking 'next' button until exhausted (reliable fallback)."""
        screenshots = []
        page_num = 1

        if not self.page:
            return screenshots
        
        # Use iframe context if available, otherwise main page
        nav_context = self.frame if self.frame else self.page
        page = self.page  # Always use main page for screenshots
        
        # Track captured page hashes to detect loops
        captured_hashes = set()

        selectors = self._get_next_button_selectors()
        
        while True:
            if limit and page_num > limit:
                logger.info(f"Reached capture limit ({limit} pages)")
                break

            # Capture current page (always from main page for full view)
            logger.info(f"📸 Capturing page {page_num}")
            screenshot_path = await self.take_screenshot(page_num)

            if screenshot_path:
                screenshots.append(screenshot_path)

                # Check for duplicate pages by comparing page content hash
                try:
                    if nav_context is None:
                        break
                    page_content = await nav_context.content()
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

            # Find next button in navigation context (iframe or main page)
            next_button = None
            for selector in selectors:
                if nav_context is None:
                    break
                try:
                    next_button = await nav_context.query_selector(selector)
                    if next_button:
                        logger.debug(f"Found next button with selector: {selector}")
                        break
                except Exception as e:
                    logger.debug(f"Selector {selector} failed: {e}")

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
                if page is None:
                    break
                await page.wait_for_timeout(2000)

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

    async def _get_calameo_total_pages(self) -> Optional[int]:
        """Detect Calameo total pages from the viewer UI."""
        if not self.page:
            return None

        selectors = [
            ".skin-tag.skin-pagenumber .total",
            ".skin-tag.skin-pagenumber .total-pages",
            ".skin-tag.skin-pagenumber span.total",
            ".skin-tag.skin-pagenumber span",
        ]

        for selector in selectors:
            try:
                element = await self.page.query_selector(selector)
                if not element:
                    continue
                text = (await element.text_content() or "").strip()
                if not text:
                    continue
                digits = "".join(ch for ch in text if ch.isdigit())
                if digits:
                    total = int(digits)
                    if total > 0:
                        return total
            except Exception as e:
                logger.debug(f"Calameo total selector failed ({selector}): {e}")

        return None

    async def _navigate_calameo_page(self, page_num: int) -> bool:
        """Navigate Calameo viewer to a specific page via page number input."""
        if not self.page:
            return False

        page = self.page
        selector = ".skin-tag.skin-pagenumber input[name='pageNumber']"

        try:
            input_el = await page.query_selector(selector)
            if not input_el:
                logger.warning("Calameo page input not found")
                return False

            await input_el.fill(str(page_num))
            await input_el.press("Enter")
            await page.wait_for_timeout(1500)
            return True
        except Exception as e:
            logger.warning(f"Calameo page navigation failed: {e}")
            return False

    async def _capture_calameo_scroll(self, page_count: int, limit: Optional[int] = None) -> List[str]:
        """Capture Calameo viewer by page input with scroll fallback."""
        screenshots = []
        if not self.page:
            return screenshots

        page = self.page
        total_pages = page_count if page_count and page_count > 0 else None
        segments = total_pages or 50
        if limit:
            segments = min(segments, limit)

        try:
            viewport = page.viewport_size or {"height": 2160}
            scroll_height = viewport.get("height", 2160)
        except Exception:
            scroll_height = 2160

        logger.info(f"Calameo page capture: up to {segments} pages")

        for idx in range(1, segments + 1):
            if idx > 1:
                navigated = await self._navigate_calameo_page(idx)
                if not navigated:
                    logger.warning("Calameo page input failed, falling back to scroll")
                    try:
                        await page.evaluate("(distance) => window.scrollBy(0, distance)", scroll_height)
                        await page.wait_for_timeout(1500)
                    except Exception as e:
                        logger.warning(f"Scroll failed after page {idx - 1}: {e}")
                        break

            logger.info(f"📸 Capturing Calameo page {idx}/{segments}")
            screenshot_path = await self.take_screenshot(idx)
            if screenshot_path:
                screenshots.append(screenshot_path)
            else:
                logger.warning(f"Failed to capture Calameo page {idx}")

        logger.info(f"✓ Captured {len(screenshots)} Calameo pages")
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


async def capture_flyer_screenshots(
    url: str,
    cookie_selectors: Optional[List[str]] = None,
    next_button_selectors: Optional[List[str]] = None,
    page_input_selectors: Optional[List[str]] = None,
    page_indicator_selectors: Optional[List[str]] = None,
    page_limit: Optional[int] = None,
    iframe_selector: Optional[str] = None
) -> List[str]:
    """
    Convenience function to capture all flyer pages.
    
    Args:
        url: Flyer URL
        
    Returns:
        List of screenshot filepaths
    """
    browser = FlyerBrowser(
        next_button_selectors=next_button_selectors,
        page_input_selectors=page_input_selectors,
        page_indicator_selectors=page_indicator_selectors,
        iframe_selector=iframe_selector
    )
    screenshots = []
    
    try:
        await browser.launch()
        logger.info(f"Starting flyer capture for: {url}")
        
        if await browser.navigate_to_flyer(url, cookie_selectors):
            page_count = await browser.get_flyer_page_count()
            screenshots = await browser.take_screenshots_all_pages(page_count, limit=page_limit)
        
    finally:
        await browser.close()
    
    return screenshots


def capture_flyer_sync(
    url: str,
    cookie_selectors: Optional[List[str]] = None,
    next_button_selectors: Optional[List[str]] = None,
    page_input_selectors: Optional[List[str]] = None,
    page_indicator_selectors: Optional[List[str]] = None,
    page_limit: Optional[int] = None,
    iframe_selector: Optional[str] = None
) -> List[str]:
    """
    Synchronous wrapper for flyer screenshot capture.
    
    Args:
        url: Flyer URL
        
    Returns:
        List of screenshot filepaths
    """
    logger.info("Starting async event loop for browser automation")
    return asyncio.run(
        capture_flyer_screenshots(
            url,
            cookie_selectors=cookie_selectors,
            next_button_selectors=next_button_selectors,
            page_input_selectors=page_input_selectors,
            page_indicator_selectors=page_indicator_selectors,
            page_limit=page_limit,
            iframe_selector=iframe_selector
        )
    )
