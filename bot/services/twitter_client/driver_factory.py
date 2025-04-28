"""
Factory for creating Selenium WebDriver instances with stealth capabilities
"""

import logging
import os
import undetected_chromedriver as uc
from selenium.webdriver.remote.webdriver import WebDriver

logger = logging.getLogger(__name__)


def create_driver(headless: bool = True) -> WebDriver:
    """
    Create a Selenium WebDriver instance with undetected-chromedriver

    Args:
        headless: Whether to run in headless mode

    Returns:
        WebDriver instance
    """
    try:
        options = uc.ChromeOptions()

        if headless:
            options.add_argument("--headless=new")

        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1920,1080")

        chrome_paths = [
            "/usr/bin/google-chrome-stable",
            "/usr/bin/google-chrome",
            "/home/ubuntu/.local/bin/google-chrome",
        ]
        for chrome_path in chrome_paths:
            if os.path.exists(chrome_path):
                options.binary_location = chrome_path
                logger.info(f"Chrome binary path set to: {chrome_path}")
                break

        logger.info("Initializing undetected-chromedriver...")
        driver = uc.Chrome(options=options)
        driver.implicitly_wait(10)

        logger.info(
            "Successfully created WebDriver instance with undetected-chromedriver"
        )
        return driver

    except Exception as e:
        logger.error(f"Error creating WebDriver: {e}")
        raise
