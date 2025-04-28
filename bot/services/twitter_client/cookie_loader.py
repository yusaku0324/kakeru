"""
Cookie loader for Twitter client
"""
import json
import logging
import os
from typing import Dict, List, Optional
from selenium.webdriver.remote.webdriver import WebDriver

logger = logging.getLogger(__name__)


def load_cookies(driver: WebDriver, cookie_path: str) -> bool:
    """
    Load cookies from file with enhanced security settings
    
    Args:
        driver: Selenium WebDriver instance
        cookie_path: Path to cookie file
        
    Returns:
        bool: True if cookies loaded successfully, False otherwise
    """
    try:
        if not os.path.exists(cookie_path):
            logger.error(f"Cookie file not found: {cookie_path}")
            return False
        
        with open(cookie_path, 'r', encoding='utf-8') as f:
            cookies = json.load(f)
        
        driver.get("https://x.com")
        
        driver.delete_all_cookies()
        
        for cookie in cookies:
            cookie['sameSite'] = 'None'
            cookie['secure'] = True
            
            if 'expiry' in cookie:
                del cookie['expiry']
            
            try:
                driver.add_cookie(cookie)
                logger.debug(f"Added cookie: {cookie.get('name', 'unknown')}")
            except Exception as e:
                logger.warning(f"Failed to add cookie {cookie.get('name', 'unknown')}: {e}")
        
        driver.refresh()
        logger.info(f"Successfully loaded cookies from {cookie_path}")
        return True
    
    except Exception as e:
        logger.error(f"Error loading cookies: {e}")
        return False


def save_cookies(driver: WebDriver, cookie_path: str) -> bool:
    """
    Save cookies to file
    
    Args:
        driver: Selenium WebDriver instance
        cookie_path: Path to save cookie file
        
    Returns:
        bool: True if cookies saved successfully, False otherwise
    """
    try:
        cookies = driver.get_cookies()
        
        os.makedirs(os.path.dirname(cookie_path), exist_ok=True)
        
        with open(cookie_path, 'w', encoding='utf-8') as f:
            json.dump(cookies, f, indent=2)
        
        logger.info(f"Successfully saved cookies to {cookie_path}")
        return True
    
    except Exception as e:
        logger.error(f"Error saving cookies: {e}")
        return False


def validate_cookies(cookies: List[Dict]) -> bool:
    """
    Validate cookie format and required fields
    
    Args:
        cookies: List of cookie dictionaries
        
    Returns:
        bool: True if cookies are valid, False otherwise
    """
    required_fields = ['name', 'value', 'domain']
    
    for cookie in cookies:
        for field in required_fields:
            if field not in cookie:
                logger.error(f"Cookie missing required field: {field}")
                return False
    
    return True
