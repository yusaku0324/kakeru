"""
Factory for creating Selenium WebDriver instances with stealth capabilities
"""
import logging
import os
from pathlib import Path
import undetected_chromedriver as uc
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.remote.webdriver import WebDriver
from typing import Optional
from webdriver_manager.chrome import ChromeDriverManager

from bot.accounts import Account
from bot.services.proxy_manager import get_proxy_manager

logger = logging.getLogger(__name__)


def create_chrome_options(headless: bool = False, user_data_dir: Optional[str] = None) -> uc.ChromeOptions:
    """
    Create Chrome options for WebDriver
    
    Args:
        headless: Whether to run in headless mode
        user_data_dir: Path to user data directory
        
    Returns:
        ChromeOptions instance
    """
    options = uc.ChromeOptions()
    
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    
    if headless:
        options.add_argument("--headless=new")
    
    if user_data_dir:
        options.add_argument(f"--user-data-dir={user_data_dir}")
    
    return options


def setup_webdriver(account: Optional[Account] = None, headless: bool = True) -> WebDriver:
    """
    Setup a Selenium WebDriver instance with undetected-chromedriver
    
    Args:
        account: Account to use for User-Agent and proxy
        headless: Whether to run in headless mode
        
    Returns:
        WebDriver instance
    """
    try:
        user_data_dir = None
        if account and hasattr(account, 'user_data_dir'):
            user_data_dir = account.user_data_dir
        
        options = create_chrome_options(headless, user_data_dir)
        
        if account and account.user_agent:
            options.add_argument(f"--user-agent={account.user_agent}")
            logger.info(f"Using User-Agent: {account.user_agent}")
        
        proxy = None
        if account:
            proxy_manager = get_proxy_manager()
            proxy = proxy_manager.pick_proxy(account.screen_name)
            if proxy:
                options.add_argument(f"--proxy-server={proxy}")
                logger.info(f"Using proxy: {proxy}")
        
        chrome_path = os.getenv("CHROME_PATH")
        if chrome_path and os.path.exists(chrome_path):
            options.binary_location = chrome_path
            logger.info(f"Using Chrome binary from CHROME_PATH: {chrome_path}")
        else:
            chrome_paths = [
                "/usr/bin/google-chrome-stable",
                "/usr/bin/google-chrome",
                "/home/ubuntu/.local/bin/google-chrome"
            ]
            for path in chrome_paths:
                if os.path.exists(path):
                    options.binary_location = path
                    logger.info(f"Chrome binary path set to: {path}")
                    break
        
        chrome_path = os.getenv("CHROME_PATH")
        if chrome_path and Path(chrome_path).exists():
            service = Service(chrome_path)
            logger.info(f"Using Chrome service with CHROME_PATH: {chrome_path}")
        else:
            if os.getenv("SKIP_WDM"):  # ← export SKIP_WDM=1 なら download を飛ばす
                service = Service()  # dummy; uc.Chrome の mock で無視される
                logger.info("ChromeDriverManager skipped because SKIP_WDM=1")
            else:
                service = Service(ChromeDriverManager().install())
                logger.info("Using Chrome service from ChromeDriverManager")
        
        logger.info("Initializing undetected-chromedriver...")
        driver = uc.Chrome(options=options)
        driver.implicitly_wait(10)
        
        driver.delete_all_cookies()
        
        logger.info("Successfully created WebDriver instance with undetected-chromedriver")
        
        if proxy:
            driver.proxy = proxy
        
        return driver
    
    except Exception as e:
        logger.error(f"Error creating WebDriver: {e}")
        raise


def create_driver(headless: bool = True) -> WebDriver:
    """
    Create a Selenium WebDriver instance with undetected-chromedriver
    
    Args:
        headless: Whether to run in headless mode
        
    Returns:
        WebDriver instance
    """
    return setup_webdriver(account=None, headless=headless)


def release_driver(driver: WebDriver) -> None:
    """
    Release a WebDriver instance and its resources
    
    Args:
        driver: WebDriver instance to release
    """
    try:
        if hasattr(driver, 'proxy') and driver.proxy:
            proxy_manager = get_proxy_manager()
            proxy_manager.release_proxy(driver.proxy)
            logger.info(f"Released proxy: {driver.proxy}")
        
        driver.quit()
        logger.info("WebDriver instance released")
    
    except Exception as e:
        logger.error(f"Error releasing WebDriver: {e}")
