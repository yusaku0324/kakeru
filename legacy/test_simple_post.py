"""
Simple test script for X posting with minimal dependencies
"""
import os
import sys
import time
import json
import logging
import tempfile
import uuid
import random
import subprocess

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

def kill_chrome_processes():
    """Kill all Chrome processes using shell commands"""
    logger.info("Killing all Chrome processes...")
    
    try:
        subprocess.run("pkill -9 -f chrome", shell=True)
        subprocess.run("pkill -9 -f chromium", shell=True)
        subprocess.run("pkill -9 -f chromedriver", shell=True)
        time.sleep(3)  # Wait for processes to terminate
        logger.info("Chrome processes killed")
    except Exception as e:
        logger.warning(f"Error killing processes: {e}")

def main():
    """Simple test for X posting"""
    try:
        ensure_utf8_encoding()
        
        kill_chrome_processes()
        
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.chrome.service import Service
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC
        from webdriver_manager.chrome import ChromeDriverManager
        
        options = Options()
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1920,1080")
        
        random_suffix = f"{uuid.uuid4().hex}_{random.randint(10000, 99999)}"
        temp_dir = os.path.join(tempfile.gettempdir(), f"chrome_profile_{random_suffix}")
        
        os.makedirs(temp_dir, exist_ok=True)
        logger.info(f"Created fresh Chrome profile directory: {temp_dir}")
        
        options.add_argument(f"--user-data-dir={temp_dir}")
        
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        driver.implicitly_wait(10)
        
        driver.get("https://x.com")
        time.sleep(2)
        
        screenshot_path = "x_home.png"
        driver.save_screenshot(screenshot_path)
        logger.info(f"Saved screenshot to {screenshot_path}")
        
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
        
        screenshot_path = "x_logged_in.png"
        driver.save_screenshot(screenshot_path)
        logger.info(f"Saved screenshot to {screenshot_path}")
        
        driver.get("https://x.com/compose/tweet")
        time.sleep(5)
        
        screenshot_path = "x_compose.png"
        driver.save_screenshot(screenshot_path)
        logger.info(f"Saved screenshot to {screenshot_path}")
        
        textbox_selector = "div[role='textbox'],[data-testid='tweetTextarea_0']"
        try:
            textbox = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, textbox_selector))
            )
            textbox.click()
            time.sleep(0.5)
            
            post_text = f"Simple test post {uuid.uuid4().hex[:8]}"
            logger.info(f"Typing tweet text: {post_text}")
            
            try:
                driver.execute_cdp_cmd("Input.insertText", {"text": post_text})
                time.sleep(1)
                logger.info(f"Text entered: {textbox.text}")
            except Exception as e:
                logger.error(f"Error using CDP: {e}")
                textbox.send_keys(post_text)
            
            screenshot_path = "x_after_typing.png"
            driver.save_screenshot(screenshot_path)
            logger.info(f"Saved screenshot to {screenshot_path}")
            
            button_selector = "[data-testid$='tweetButton'],[data-testid$='tweetButtonInline']"
            tweet_button = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, button_selector))
            )
            logger.info("Clicking tweet button")
            tweet_button.click()
            time.sleep(5)
            
            screenshot_path = "x_after_clicking.png"
            driver.save_screenshot(screenshot_path)
            logger.info(f"Saved screenshot to {screenshot_path}")
            
            if "/status/" in driver.current_url:
                tweet_url = driver.current_url
                logger.info(f"Tweet posted successfully: {tweet_url}")
            else:
                logger.warning("Tweet URL not found in current URL")
                
                try:
                    tweet_link = driver.find_element(By.CSS_SELECTOR, "a[href*='/status/']")
                    tweet_url = tweet_link.get_attribute("href")
                    logger.info(f"Found tweet URL: {tweet_url}")
                except Exception as e:
                    logger.error(f"Could not find tweet URL: {e}")
        
        except Exception as e:
            logger.error(f"Error in tweet process: {e}")
            import traceback
            logger.error(traceback.format_exc())
        
        driver.quit()
        logger.info("Test completed")
        return 0
    
    except Exception as e:
        logger.error(f"Error in test script: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return 1

if __name__ == "__main__":
    sys.exit(main())
