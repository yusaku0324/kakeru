"""
Final test script for X posting with undetected_chromedriver and aggressive process management
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
import subprocess
import psutil

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

def kill_all_chrome_processes():
    """Kill all Chrome processes aggressively"""
    logger.info("Killing all Chrome processes...")
    
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            proc_name = proc.info['name'].lower() if proc.info['name'] else ""
            proc_cmdline = proc.info['cmdline'] if proc.info['cmdline'] else []
            
            if ('chrome' in proc_name or 
                'chromium' in proc_name or 
                any('chrome' in cmd.lower() for cmd in proc_cmdline) or
                any('chromium' in cmd.lower() for cmd in proc_cmdline)):
                
                logger.info(f"Killing Chrome process: {proc.info['pid']} - {proc_name}")
                try:
                    proc.kill()
                except Exception as e:
                    logger.warning(f"Failed to kill process with psutil: {e}")
                    try:
                        import signal
                        os.kill(proc.info['pid'], signal.SIGKILL)
                        logger.info(f"Killed process {proc.info['pid']} with os.kill")
                    except Exception as e2:
                        logger.warning(f"Failed to kill with os.kill: {e2}")
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess) as e:
            logger.warning(f"Error accessing process: {e}")
    
    try:
        logger.info("Using shell commands to kill Chrome processes")
        subprocess.run("pkill -9 -f chrome", shell=True)
        subprocess.run("pkill -9 -f chromium", shell=True)
        subprocess.run("pkill -9 -f chromedriver", shell=True)
    except Exception as e:
        logger.warning(f"Error killing processes with shell commands: {e}")
    
    time.sleep(3)  # Wait for processes to terminate

def clean_chrome_profiles():
    """Clean up Chrome profile directories"""
    logger.info("Cleaning up Chrome profile directories...")
    
    temp_dir = tempfile.gettempdir()
    for item in os.listdir(temp_dir):
        if item.startswith("chrome_profile_"):
            full_path = os.path.join(temp_dir, item)
            try:
                if os.path.isdir(full_path):
                    shutil.rmtree(full_path)
                    logger.info(f"Removed Chrome profile directory: {full_path}")
            except Exception as e:
                logger.warning(f"Error removing directory {full_path}: {e}")
    
    try:
        subprocess.run("rm -rf /tmp/.org.chromium.Chromium*", shell=True)
        subprocess.run("rm -rf /tmp/.com.google.Chrome*", shell=True)
    except Exception as e:
        logger.warning(f"Error removing chromium directories: {e}")

def setup_webdriver():
    """Set up undetected_chromedriver with aggressive process management"""
    try:
        ensure_utf8_encoding()
        
        kill_all_chrome_processes()
        
        clean_chrome_profiles()
        
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
        
        try:
            import undetected_chromedriver as uc
            from selenium.webdriver.chrome.options import Options
            from selenium.webdriver.common.by import By
            from selenium.webdriver.support.ui import WebDriverWait
            from selenium.webdriver.support import expected_conditions as EC
            from selenium.webdriver.common.keys import Keys
            
            logger.info("Successfully imported undetected_chromedriver")
        except ImportError:
            logger.error("Failed to import undetected_chromedriver. Installing...")
            os.system("pip install undetected-chromedriver")
            import undetected_chromedriver as uc
            from selenium.webdriver.chrome.options import Options
            from selenium.webdriver.common.by import By
            from selenium.webdriver.support.ui import WebDriverWait
            from selenium.webdriver.support import expected_conditions as EC
            
            logger.info("Successfully installed and imported undetected_chromedriver")
        
        options = uc.ChromeOptions()
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1920,1080")
        
        logger.info("Creating undetected_chromedriver instance...")
        driver = uc.Chrome(options=options, user_data_dir=temp_dir)
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
                box.send_keys(Keys.COMMAND, "v")
            else:
                box.send_keys(Keys.CONTROL, "v")
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
        
        screenshot_path = "compose_tweet_page.png"
        driver.save_screenshot(screenshot_path)
        logger.info(f"Saved screenshot to {screenshot_path}")
        
        logger.info(f"Typing tweet text: {post_text}")
        if not type_tweet_text(driver, post_text):
            logger.error("Failed to enter tweet text")
            return None
        
        screenshot_path = "after_typing.png"
        driver.save_screenshot(screenshot_path)
        logger.info(f"Saved screenshot to {screenshot_path}")
        
        logger.info("Looking for tweet button...")
        BTN_SEL = "[data-testid$='tweetButton'],[data-testid$='tweetButtonInline']"
        tweet_button = WebDriverWait(driver, 15).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, BTN_SEL))
        )
        
        logger.info("Clicking tweet button...")
        tweet_button.click()
        time.sleep(5)
        
        screenshot_path = "after_clicking.png"
        driver.save_screenshot(screenshot_path)
        logger.info(f"Saved screenshot to {screenshot_path}")
        
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
    """Test X posting with undetected_chromedriver and aggressive process management"""
    try:
        driver = setup_webdriver()
        if not driver:
            logger.error("Failed to set up WebDriver")
            return 1
        
        post_text = "テスト投稿 - undetected_chromedriver テスト " + str(uuid.uuid4())[:8]
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
