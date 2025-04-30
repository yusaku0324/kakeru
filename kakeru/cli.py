"""
Command-line interface for Kakeru
"""
import os
import sys
import time
import logging
import argparse
from pathlib import Path
from typing import Optional

import yaml
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import undetected_chromedriver as uc

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger("kakeru.cli")

CONFIG_PATH = Path(__file__).parent / "config" / "accounts.yaml"
SECRETS_DIR = Path("secrets")
X_BASE_URL = "https://x.com"


def load_config() -> dict:
    """
    Load accounts configuration from YAML
    
    Returns:
        dict: Account configuration
    """
    try:
        if not CONFIG_PATH.exists():
            logger.error(f"Configuration file not found: {CONFIG_PATH}")
            return {}
        
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f)
        
        return config or {}
    
    except Exception as e:
        logger.error(f"Error loading configuration: {e}")
        return {}


def save_config(config: dict) -> bool:
    """
    Save accounts configuration to YAML
    
    Args:
        config: Account configuration
        
    Returns:
        bool: True if saved successfully, False otherwise
    """
    try:
        CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
        
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            yaml.dump(config, f, default_flow_style=False, sort_keys=False)
        
        logger.info(f"Configuration saved to {CONFIG_PATH}")
        return True
    
    except Exception as e:
        logger.error(f"Error saving configuration: {e}")
        return False


def create_driver() -> Optional[webdriver.Chrome]:
    """
    Create an undetected Chrome driver for manual login
    
    Returns:
        Optional[webdriver.Chrome]: Chrome driver or None if failed
    """
    try:
        options = uc.ChromeOptions()
        options.add_argument("--start-maximized")
        
        driver = uc.Chrome(options=options)
        driver.implicitly_wait(10)
        
        return driver
    
    except Exception as e:
        logger.error(f"Error creating Chrome driver: {e}")
        return None


def login_and_save_cookies(screen_name: str, cookie_path: str) -> bool:
    """
    Launch browser for manual login and save cookies
    
    Args:
        screen_name: X account screen name
        cookie_path: Path to save cookies
        
    Returns:
        bool: True if login and save successful, False otherwise
    """
    driver = None
    try:
        logger.info(f"Starting login process for {screen_name}")
        
        driver = create_driver()
        if not driver:
            return False
        
        driver.get(f"{X_BASE_URL}/i/flow/login")
        time.sleep(3)
        
        print("\n" + "="*80)
        print(f"Please login to X account: @{screen_name}")
        print("Complete the login process including any 2FA verification.")
        print("After successful login, press Enter to continue...")
        print("="*80 + "\n")
        
        input("Press Enter after login is complete...")
        
        try:
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "a[data-testid='SideNav_NewTweet_Button']"))
            )
            logger.info(f"Login successful for {screen_name}")
        except Exception as e:
            logger.error(f"Login verification failed: {e}")
            return False
        
        cookies = driver.get_cookies()
        
        cookie_dir = os.path.dirname(cookie_path)
        os.makedirs(cookie_dir, exist_ok=True)
        
        with open(cookie_path, "w", encoding="utf-8") as f:
            yaml.dump(cookies, f, default_flow_style=False)
        
        logger.info(f"Cookies saved to {cookie_path}")
        return True
    
    except Exception as e:
        logger.error(f"Error during login process: {e}")
        return False
    
    finally:
        if driver:
            driver.quit()


def validate_cookies(screen_name: str, cookie_path: str) -> bool:
    """
    Validate cookies for an X account
    
    Args:
        screen_name: X account screen name
        cookie_path: Path to cookie file
        
    Returns:
        bool: True if cookies are valid, False otherwise
    """
    try:
        if not os.path.exists(cookie_path):
            logger.error(f"Cookie file not found: {cookie_path}")
            return False
        
        with open(cookie_path, "r", encoding="utf-8") as f:
            cookies = yaml.safe_load(f)
        
        if not cookies:
            logger.error(f"Empty cookie file: {cookie_path}")
            return False
        
        required_cookies = ["auth_token", "ct0"]
        missing_cookies = [name for name in required_cookies if not any(c.get("name") == name for c in cookies)]
        
        if missing_cookies:
            logger.error(f"Missing required cookies: {', '.join(missing_cookies)}")
            return False
        
        expired_cookies = [c.get("name") for c in cookies if "expiry" in c and c["expiry"] < time.time()]
        
        if expired_cookies:
            logger.error(f"Expired cookies: {', '.join(expired_cookies)}")
            return False
        
        logger.info(f"Cookies are valid for {screen_name}")
        return True
    
    except Exception as e:
        logger.error(f"Error validating cookies: {e}")
        return False


def login_command(screen_name: str, validate_only: bool = False) -> int:
    """
    Handle login command
    
    Args:
        screen_name: X account screen name
        validate_only: Only validate cookies, don't perform login
        
    Returns:
        int: Exit code (0 for success, 1 for failure)
    """
    try:
        config = load_config()
        
        if screen_name not in config:
            logger.warning(f"Account {screen_name} not found in configuration")
            
            if validate_only:
                logger.error(f"Cannot validate non-existent account: {screen_name}")
                return 1
            
            response = input(f"Add {screen_name} to configuration? (y/n): ")
            if response.lower() != "y":
                logger.info("Operation cancelled")
                return 1
            
            config[screen_name] = {"cookie": f"secrets/{screen_name}.jar"}
            
            if not save_config(config):
                return 1
        
        cookie_path = config[screen_name].get("cookie")
        if not cookie_path:
            logger.error(f"No cookie path specified for {screen_name}")
            return 1
        
        if not os.path.isabs(cookie_path):
            cookie_path = os.path.abspath(cookie_path)
        
        if validate_only:
            if validate_cookies(screen_name, cookie_path):
                logger.info(f"Cookies are valid for {screen_name}")
                return 0
            else:
                logger.error(f"Cookies are invalid for {screen_name}")
                return 1
        
        if login_and_save_cookies(screen_name, cookie_path):
            logger.info(f"Login successful for {screen_name}")
            return 0
        else:
            logger.error(f"Login failed for {screen_name}")
            return 1
    
    except Exception as e:
        logger.error(f"Error in login command: {e}")
        return 1


def list_accounts_command(json_output: bool = False) -> int:
    """
    Handle list-accounts command
    
    Args:
        json_output: Whether to output as JSON
        
    Returns:
        int: Exit code (0 for success, 1 for failure)
    """
    try:
        config = load_config()
        
        if not config:
            logger.warning("No accounts found in configuration")
            return 1
        
        if json_output:
            import json
            print(json.dumps(list(config.keys())))
        else:
            for screen_name in config.keys():
                print(screen_name)
        
        return 0
    
    except Exception as e:
        logger.error(f"Error in list-accounts command: {e}")
        return 1


def main():
    """Main entry point for CLI"""
    parser = argparse.ArgumentParser(description="Kakeru X (Twitter) Automation CLI")
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")
    
    login_parser = subparsers.add_parser("login", help="Login to X account and save cookies")
    login_parser.add_argument("screen_name", help="X account screen name")
    login_parser.add_argument("--validate", action="store_true", help="Only validate cookies, don't perform login")
    
    list_accounts_parser = subparsers.add_parser("list-accounts", help="List all accounts from configuration")
    list_accounts_parser.add_argument("--json", action="store_true", help="Output as JSON")
    
    args = parser.parse_args()
    
    if args.command == "login":
        return login_command(args.screen_name, validate_only=getattr(args, "validate", False))
    elif args.command == "list-accounts":
        return list_accounts_command(json_output=getattr(args, "json", False))
    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(main())
