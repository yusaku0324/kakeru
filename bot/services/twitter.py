"""
Twitter/X services for posting and interacting with the platform
"""
import os
import sys
import time
import json
import logging
import tempfile
import uuid
import random
import shutil
from typing import Optional, Dict, Any, List, Union
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    TimeoutException, 
    NoSuchElementException, 
    ElementClickInterceptedException,
    StaleElementReferenceException
)
import psutil

from bot.utils.log import ensure_utf8_encoding
from bot.utils.retry import (
    click_element_robust, 
    find_element_robust, 
    find_clickable_element_robust,
    type_text_robust,
    wait_for_upload_robust,
    find_element_by_multiple_selectors
)
from bot.utils.backoff import with_backoff, with_jitter_backoff

logger = logging.getLogger(__name__)

def kill_chrome_processes(logger: Optional[logging.Logger] = None) -> bool:
    """
    すべてのChromeプロセスを強制終了する
    
    Args:
        logger: ロガーインスタンス（Noneの場合はモジュールロガーを使用）
        
    Returns:
        bool: 成功したかどうか
    """
    if logger is None:
        logger = logging.getLogger(__name__)
    
    try:
        logger.info("Killing all Chrome processes...")
        
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                if 'chrome' in proc.info['name'].lower() or (proc.info['cmdline'] and any('chrome' in cmd.lower() for cmd in proc.info['cmdline'])):
                    logger.info(f"Killing Chrome process: {proc.info['pid']} - {proc.info['name']}")
                    proc.kill()
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess) as e:
                logger.warning(f"Error killing process: {e}")
        
        time.sleep(3)  # Wait for processes to terminate
        logger.info("Chrome processes killed")
        return True
    
    except Exception as e:
        logger.error(f"Error killing Chrome processes: {e}")
        return False

def clean_chrome_profiles(logger: Optional[logging.Logger] = None) -> bool:
    """
    Chromeプロファイルディレクトリをクリーンアップする
    
    Args:
        logger: ロガーインスタンス（Noneの場合はモジュールロガーを使用）
        
    Returns:
        bool: 成功したかどうか
    """
    if logger is None:
        logger = logging.getLogger(__name__)
    
    try:
        logger.info("Cleaning up Chrome profile directories...")
        
        temp_dirs = [d for d in os.listdir(tempfile.gettempdir()) if d.startswith("chrome_profile_")]
        for temp_dir in temp_dirs:
            full_path = os.path.join(tempfile.gettempdir(), temp_dir)
            try:
                if os.path.exists(full_path):
                    shutil.rmtree(full_path)
                    logger.info(f"Removed existing Chrome profile directory: {full_path}")
            except Exception as e:
                logger.warning(f"Error removing directory {full_path}: {e}")
        
        return True
    
    except Exception as e:
        logger.error(f"Error cleaning Chrome profiles: {e}")
        return False

@with_backoff(max_attempts=3, base_delay=2.0)
def setup_webdriver(cookie_path: Optional[str] = None, 
                   headless: bool = False, 
                   logger: Optional[logging.Logger] = None) -> Optional[webdriver.Chrome]:
    """
    WebDriverをセットアップする
    
    Args:
        cookie_path: クッキーファイルのパス
        headless: ヘッドレスモードで実行するかどうか
        logger: ロガーインスタンス（Noneの場合はモジュールロガーを使用）
        
    Returns:
        Optional[webdriver.Chrome]: WebDriverインスタンス、失敗した場合はNone
    """
    if logger is None:
        logger = logging.getLogger(__name__)
    
    try:
        ensure_utf8_encoding(logger)
        
        kill_chrome_processes(logger)
        clean_chrome_profiles(logger)
        
        random_suffix = f"{uuid.uuid4().hex}_{random.randint(10000, 99999)}"
        temp_dir = os.path.join(tempfile.gettempdir(), f"chrome_profile_{random_suffix}")
        
        if os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir)
                logger.info(f"Removed existing directory: {temp_dir}")
            except Exception as e:
                logger.warning(f"Error removing directory {temp_dir}: {e}")
        
        os.makedirs(temp_dir, exist_ok=True)
        logger.info(f"Created fresh Chrome profile directory: {temp_dir}")
        
        options = Options()
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36")
        
        if headless:
            options.add_argument("--headless")
        
        options.add_argument(f"--user-data-dir={temp_dir}")
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option("useAutomationExtension", False)
        
        try:
            from webdriver_manager.chrome import ChromeDriverManager
            service = Service(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=options)
        except Exception as e:
            logger.warning(f"Error using ChromeDriverManager: {e}, falling back to default ChromeDriver")
            driver = webdriver.Chrome(options=options)
        
        driver.implicitly_wait(10)
        
        driver.get("https://x.com")
        time.sleep(2)
        
        if cookie_path and os.path.exists(cookie_path):
            try:
                logger.info(f"Loading cookies from {cookie_path}")
                with open(cookie_path, 'r') as f:
                    cookies = json.load(f)
                
                for cookie in cookies:
                    if 'name' in cookie and 'value' in cookie:
                        try:
                            cookie_dict = {
                                'name': cookie['name'],
                                'value': cookie['value'],
                                'domain': cookie.get('domain', '.x.com'),
                                'path': cookie.get('path', '/'),
                                'secure': True,
                                'httpOnly': cookie.get('httpOnly', False),
                                'sameSite': 'None'
                            }
                            if 'expiry' in cookie:
                                cookie_dict['expiry'] = cookie['expiry']
                            driver.add_cookie(cookie_dict)
                        except Exception as e:
                            logger.warning(f"Error setting cookie {cookie.get('name')}: {e}")
                
                logger.info(f"Loaded {len(cookies)} cookies from {cookie_path}")
            except Exception as e:
                logger.warning(f"Error loading cookies from {cookie_path}: {e}")
        elif os.getenv("COOKIE_NIIJIMA"):
            try:
                logger.info("Setting cookies from COOKIE_NIIJIMA environment variable")
                cookies = json.loads(os.getenv("COOKIE_NIIJIMA"))
                
                for cookie in cookies:
                    if 'name' in cookie and 'value' in cookie:
                        try:
                            cookie_dict = {
                                'name': cookie['name'],
                                'value': cookie['value'],
                                'domain': cookie.get('domain', '.x.com'),
                                'path': cookie.get('path', '/'),
                                'secure': True,
                                'httpOnly': cookie.get('httpOnly', False),
                                'sameSite': 'None'
                            }
                            if 'expiry' in cookie:
                                cookie_dict['expiry'] = cookie['expiry']
                            driver.add_cookie(cookie_dict)
                        except Exception as e:
                            logger.warning(f"Error setting cookie {cookie.get('name')}: {e}")
                
                logger.info("Loaded cookies from environment variable")
            except Exception as e:
                logger.warning(f"Error loading cookies from environment variable: {e}")
        else:
            logger.warning("No cookies provided, user will need to log in manually")
        
        driver.refresh()
        time.sleep(3)
        driver.get("https://x.com/home")
        time.sleep(3)
        
        return driver
    
    except Exception as e:
        logger.error(f"Error setting up WebDriver: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return None

@with_jitter_backoff(max_attempts=3, min_delay=1.0, max_delay=10.0)
def post_to_twitter(driver: webdriver.Chrome, post_text: str, media_path: Optional[str] = None, 
                   logger: Optional[logging.Logger] = None) -> Optional[str]:
    """
    Xに投稿する
    
    Args:
        driver: WebDriverインスタンス
        post_text: 投稿するテキスト
        media_path: 添付するメディアのパス（オプション）
        logger: ロガーインスタンス（Noneの場合はモジュールロガーを使用）
        
    Returns:
        Optional[str]: 投稿URL、失敗した場合はNone
    """
    if logger is None:
        logger = logging.getLogger(__name__)
    
    try:
        driver.get("https://x.com/compose/tweet")
        time.sleep(5)
        
        textbox_selector = "div[role='textbox'],[data-testid='tweetTextarea_0']"
        textbox = find_clickable_element_robust(driver, By.CSS_SELECTOR, textbox_selector, logger)
        
        if not textbox:
            logger.error("Could not find tweet textbox")
            driver.save_screenshot("tweet_textbox_error.png")
            logger.info("Saved screenshot to tweet_textbox_error.png")
            return None
        
        logger.info(f"Typing tweet text: {post_text}")
        if not type_text_robust(driver, textbox, post_text, logger):
            logger.error("Failed to enter tweet text")
            return None
        
        if media_path and os.path.exists(media_path):
            logger.info(f"Uploading media: {media_path}")
            
            media_button_selector = "[data-testid='fileInput']"
            media_button = find_element_robust(driver, By.CSS_SELECTOR, media_button_selector, logger)
            
            if not media_button:
                logger.error("Could not find media upload button")
                return None
            
            media_button.send_keys(os.path.abspath(media_path))
            
            if not wait_for_upload_robust(driver, "[data-testid='attachments']", logger, timeout=60):
                logger.error("Media upload timed out")
                return None
            
            logger.info("Media uploaded successfully")
        
        tweet_button_selector = "[data-testid$='tweetButton'],[data-testid$='tweetButtonInline']"
        tweet_button = find_clickable_element_robust(driver, By.CSS_SELECTOR, tweet_button_selector, logger)
        
        if not tweet_button:
            logger.error("Could not find tweet button")
            driver.save_screenshot("tweet_button_error.png")
            logger.info("Saved screenshot to tweet_button_error.png")
            return None
        
        logger.info("Clicking tweet button...")
        if not click_element_robust(driver, tweet_button, logger):
            logger.error("Failed to click tweet button")
            return None
        
        logger.info("Waiting for tweet to be posted...")
        try:
            WebDriverWait(driver, 20).until(
                lambda d: "/status/" in d.current_url
            )
            tweet_url = driver.current_url
            logger.info(f"Tweet posted successfully: {tweet_url}")
            return tweet_url
        except TimeoutException:
            logger.warning("Timeout waiting for tweet URL, checking alternative methods...")
            
            try:
                tweet_link = driver.find_element(By.CSS_SELECTOR, "a[href*='/status/']")
                tweet_url = tweet_link.get_attribute("href")
                logger.info(f"Found tweet URL: {tweet_url}")
                return tweet_url
            except Exception as e:
                logger.error(f"Could not find tweet URL: {e}")
                driver.save_screenshot("tweet_url_error.png")
                logger.info("Saved screenshot to tweet_url_error.png")
                return None
    
    except Exception as e:
        logger.error(f"Error posting tweet: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return None

@with_jitter_backoff(max_attempts=3, min_delay=1.0, max_delay=10.0)
def reply_to_tweet(driver: webdriver.Chrome, tweet_url: str, reply_text: str, 
                  media_path: Optional[str] = None, logger: Optional[logging.Logger] = None) -> Optional[str]:
    """
    ツイートに返信する
    
    Args:
        driver: WebDriverインスタンス
        tweet_url: 返信先ツイートのURL
        reply_text: 返信テキスト
        media_path: 添付するメディアのパス（オプション）
        logger: ロガーインスタンス（Noneの場合はモジュールロガーを使用）
        
    Returns:
        Optional[str]: 返信URL、失敗した場合はNone
    """
    if logger is None:
        logger = logging.getLogger(__name__)
    
    try:
        logger.info(f"Navigating to tweet: {tweet_url}")
        driver.get(tweet_url)
        time.sleep(5)
        
        reply_button_selector = "[data-testid='reply']"
        reply_button = find_clickable_element_robust(driver, By.CSS_SELECTOR, reply_button_selector, logger)
        
        if not reply_button:
            logger.error("Could not find reply button")
            driver.save_screenshot("reply_button_error.png")
            logger.info("Saved screenshot to reply_button_error.png")
            return None
        
        logger.info("Clicking reply button...")
        if not click_element_robust(driver, reply_button, logger):
            logger.error("Failed to click reply button")
            return None
        
        time.sleep(2)
        
        textbox_selector = "div[role='textbox'],[data-testid='tweetTextarea_0']"
        textbox = find_clickable_element_robust(driver, By.CSS_SELECTOR, textbox_selector, logger)
        
        if not textbox:
            logger.error("Could not find reply textbox")
            driver.save_screenshot("reply_textbox_error.png")
            logger.info("Saved screenshot to reply_textbox_error.png")
            return None
        
        logger.info(f"Typing reply text: {reply_text}")
        if not type_text_robust(driver, textbox, reply_text, logger):
            logger.error("Failed to enter reply text")
            return None
        
        if media_path and os.path.exists(media_path):
            logger.info(f"Uploading media: {media_path}")
            
            media_button_selector = "[data-testid='fileInput']"
            media_button = find_element_robust(driver, By.CSS_SELECTOR, media_button_selector, logger)
            
            if not media_button:
                logger.error("Could not find media upload button")
                return None
            
            media_button.send_keys(os.path.abspath(media_path))
            
            if not wait_for_upload_robust(driver, "[data-testid='attachments']", logger, timeout=60):
                logger.error("Media upload timed out")
                return None
            
            logger.info("Media uploaded successfully")
        
        reply_submit_selector = "[data-testid='tweetButton']"
        reply_submit = find_clickable_element_robust(driver, By.CSS_SELECTOR, reply_submit_selector, logger)
        
        if not reply_submit:
            logger.error("Could not find reply submit button")
            driver.save_screenshot("reply_submit_error.png")
            logger.info("Saved screenshot to reply_submit_error.png")
            return None
        
        logger.info("Clicking reply submit button...")
        if not click_element_robust(driver, reply_submit, logger):
            logger.error("Failed to click reply submit button")
            return None
        
        logger.info("Waiting for reply to be posted...")
        try:
            WebDriverWait(driver, 20).until(
                lambda d: "/status/" in d.current_url and d.current_url != tweet_url
            )
            reply_url = driver.current_url
            logger.info(f"Reply posted successfully: {reply_url}")
            return reply_url
        except TimeoutException:
            logger.warning("Timeout waiting for reply URL, checking alternative methods...")
            
            try:
                time.sleep(5)
                driver.get(tweet_url)
                time.sleep(3)
                
                reply_links = driver.find_elements(By.CSS_SELECTOR, "a[href*='/status/']")
                for link in reply_links:
                    href = link.get_attribute("href")
                    if href and href != tweet_url and "/status/" in href:
                        logger.info(f"Found reply URL: {href}")
                        return href
                
                logger.error("Could not find reply URL")
                return None
            except Exception as e:
                logger.error(f"Could not find reply URL: {e}")
                driver.save_screenshot("reply_url_error.png")
                logger.info("Saved screenshot to reply_url_error.png")
                return None
    
    except Exception as e:
        logger.error(f"Error replying to tweet: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return None

def save_cookies(driver: webdriver.Chrome, cookie_path: str, logger: Optional[logging.Logger] = None) -> bool:
    """
    クッキーを保存する
    
    Args:
        driver: WebDriverインスタンス
        cookie_path: 保存先パス
        logger: ロガーインスタンス（Noneの場合はモジュールロガーを使用）
        
    Returns:
        bool: 成功したかどうか
    """
    if logger is None:
        logger = logging.getLogger(__name__)
    
    try:
        cookies = driver.get_cookies()
        
        os.makedirs(os.path.dirname(os.path.abspath(cookie_path)), exist_ok=True)
        
        with open(cookie_path, 'w') as f:
            json.dump(cookies, f, indent=2)
        
        logger.info(f"Saved {len(cookies)} cookies to {cookie_path}")
        return True
    
    except Exception as e:
        logger.error(f"Error saving cookies: {e}")
        return False
