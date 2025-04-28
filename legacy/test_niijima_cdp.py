"""
Test script for X posting with CDP Input.insertText and cookie handling
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
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def ensure_utf8_encoding():
    """Ensure stdout is using UTF-8 encoding"""
    import io
    if hasattr(sys.stdout, 'encoding') and sys.stdout.encoding.lower() != 'utf-8':
        sys.stdout = io.TextIOWrapper(
            sys.stdout.buffer, encoding='utf-8', line_buffering=True
        )
        logger.info(f"Changed stdout encoding to utf-8")
    return True

def setup_webdriver():
    """Set up Chrome WebDriver with X cookies"""
    try:
        ensure_utf8_encoding()
        
        options = Options()
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1920,1080")
        
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
        
        options.add_argument(f"--user-data-dir={temp_dir}")
        
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        driver.implicitly_wait(10)
        
        driver.get("https://x.com")
        time.sleep(2)
        
        cookie_niijima = os.getenv("COOKIE_NIIJIMA")
        if cookie_niijima:
            try:
                logger.info("Setting cookies from COOKIE_NIIJIMA environment variable")
                cookies = json.loads(cookie_niijima)
                
                for cookie in cookies:
                    if 'name' in cookie and 'value' in cookie:
                        try:
                            cookie_dict = {
                                'name': cookie['name'],
                                'value': cookie['value'],
                                'domain': cookie.get('domain', '.x.com'),
                                'path': cookie.get('path', '/'),
                                'secure': True,  # Force secure=True
                                'httpOnly': cookie.get('httpOnly', False),
                                'sameSite': 'None'  # Force sameSite='None'
                            }
                            if 'expiry' in cookie:
                                cookie_dict['expiry'] = cookie['expiry']
                            driver.add_cookie(cookie_dict)
                        except Exception as e:
                            logger.warning(f"Error setting cookie {cookie.get('name')}: {e}")
                
                logger.info(f"Loaded {len(cookies)} cookies from environment variable")
            except Exception as e:
                logger.warning(f"Error loading cookies from environment variable: {e}")
        else:
            logger.warning("COOKIE_NIIJIMA not found in environment variables")
        
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

def type_tweet_text(driver, text, timeout=10):
    """Robust text input → ①CDP ②clipboard paste ③character-by-character"""
    TEXTBOX_SEL = "div[role='textbox'],[data-testid='tweetTextarea_0']"
    
    try:
        box = WebDriverWait(driver, timeout).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, TEXTBOX_SEL))
        )
        box.click()  # フォーカスだけ合わせる
        time.sleep(0.2)
        
        try:
            driver.execute_cdp_cmd("Input.insertText", {"text": text})
            time.sleep(0.3)
            if box.text.strip():  # 成功確認
                logger.info("Successfully entered text using CDP")
                return True
        except Exception as e:
            logger.warning(f"CDP insert failed: {e}")
        
        try:
            import pyperclip
            pyperclip.copy(text)
            if sys.platform.startswith("darwin"):
                box.send_keys(webdriver.Keys.COMMAND, "v")
            else:
                box.send_keys(webdriver.Keys.CONTROL, "v")
            time.sleep(0.3)
            if box.text.strip():
                logger.info("Successfully entered text using clipboard")
                return True
        except Exception as e:
            logger.warning(f"Paste fallback failed: {e}")
        
        try:
            for ch in text:
                box.send_keys(ch)
                time.sleep(random.uniform(0.02, 0.05))
            logger.info("Successfully entered text using character-by-character input")
            return True
        except Exception as e:
            logger.error(f"send_keys fallback failed: {e}")
            return False
    
    except Exception as e:
        logger.error(f"Error in type_tweet_text: {e}")
        return False

def post_to_twitter(driver, post_text):
    """Post to X with robust text input"""
    try:
        driver.get("https://x.com/compose/tweet")
        time.sleep(5)
        
        logger.info(f"Typing tweet text: {post_text}")
        if not type_tweet_text(driver, post_text):
            logger.error("Failed to enter tweet text")
            return None
        
        logger.info("Looking for tweet button...")
        BTN_SEL = "[data-testid$='tweetButton'],[data-testid$='tweetButtonInline']"
        tweet_button = WebDriverWait(driver, 15).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, BTN_SEL))
        )
        
        logger.info("Clicking tweet button...")
        tweet_button.click()
        time.sleep(5)
        
        logger.info("Waiting for tweet to be posted...")
        try:
            WebDriverWait(driver, 20).until(
                lambda d: "/status/" in d.current_url
            )
            tweet_url = driver.current_url
            logger.info(f"Tweet posted successfully: {tweet_url}")
            return tweet_url
        except Exception:
            logger.warning("Timeout waiting for tweet URL, checking alternative methods...")
            
            try:
                tweet_link = driver.find_element(By.CSS_SELECTOR, "a[href*='/status/']")
                tweet_url = tweet_link.get_attribute("href")
                logger.info(f"Found tweet URL: {tweet_url}")
                return tweet_url
            except Exception as e:
                logger.error(f"Could not find tweet URL: {e}")
                return None
    
    except Exception as e:
        logger.error(f"Error posting tweet: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return None

def main():
    """Test X posting with CDP Input.insertText and cookie handling"""
    try:
        driver = setup_webdriver()
        if not driver:
            logger.error("Failed to set up WebDriver")
            return 1
        
        post_text = "テスト投稿 - CDP Input.insertText テスト " + str(uuid.uuid4())[:8]
        tweet_url = post_to_twitter(driver, post_text)
        
        if tweet_url:
            logger.info(f"Test successful! Tweet URL: {tweet_url}")
            driver.quit()
            return 0
        else:
            logger.error("Test failed: Could not post tweet")
            driver.quit()
            return 1
    
    except Exception as e:
        logger.error(f"Error in test script: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return 1

if __name__ == "__main__":
    sys.exit(main())
