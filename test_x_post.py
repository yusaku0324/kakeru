import os
import sys
import json
import time
import logging
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def setup_webdriver():
    """
    Set up Chrome WebDriver with X cookies
    
    Returns:
        webdriver.Chrome: Chrome WebDriver instance
    """
    try:
        chrome_options = Options()
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36")
        
        import tempfile
        temp_dir = tempfile.mkdtemp()
        chrome_options.add_argument(f"--user-data-dir={temp_dir}")
        
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option("useAutomationExtension", False)
        
        driver = webdriver.Chrome(options=chrome_options)
        
        driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
            "source": """
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined
                });
            """
        })
        
        # Load cookies from niijima_cookies.json
        cookie_path = os.getenv('COOKIE_NIIJIMA', 'niijima_cookies.json')
        if os.path.exists(cookie_path):
            logger.info(f"Loading cookies from {cookie_path}")
            driver.get("https://x.com")
            time.sleep(3)
            
            with open(cookie_path, 'r') as f:
                cookies = json.load(f)
                for cookie in cookies:
                    # Remove problematic fields
                    if 'sameSite' in cookie:
                        del cookie['sameSite']
                    if 'expiry' in cookie:
                        del cookie['expiry']
                    try:
                        driver.add_cookie(cookie)
                    except Exception as e:
                        logger.warning(f"Could not add cookie: {e}")
            
            # Refresh to apply cookies
            driver.refresh()
            time.sleep(3)
            
            # Check if logged in
            if "x.com/home" in driver.current_url:
                logger.info("Successfully logged in to X")
            else:
                logger.warning(f"Not logged in to X. Current URL: {driver.current_url}")
                driver.save_screenshot("login_error.png")
        else:
            logger.warning(f"Cookie file not found: {cookie_path}")
        
        return driver
    
    except Exception as e:
        logger.error(f"Error setting up WebDriver: {e}")
        return None

def post_to_twitter(driver, text="Test post from Selenium"):
    """
    Post to X (formerly Twitter)
    
    Args:
        driver: Chrome WebDriver instance
        text: Text to post
    """
    try:
        # Navigate to compose tweet page
        driver.get("https://x.com/compose/tweet")
        time.sleep(5)
        driver.save_screenshot("compose_page.png")
        logger.info(f"Current URL: {driver.current_url}")
        
        # Find the tweet text area
        text_area_selectors = [
            "[data-testid='tweetTextarea_0']",
            "div[role='textbox']",
            "div.public-DraftEditor-content",
            "div[aria-label='Tweet text']",
            "div[aria-label='Post text']"
        ]
        
        text_area = None
        for selector in text_area_selectors:
            try:
                text_area = WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, selector))
                )
                logger.info(f"Found text area with selector: {selector}")
                break
            except Exception as e:
                logger.warning(f"Could not find text area with selector {selector}: {e}")
        
        if not text_area:
            logger.error("Could not find text area")
            driver.save_screenshot("text_area_error.png")
            return
        
        # Enter text
        text_area.click()
        time.sleep(1)
        text_area.send_keys(text)
        time.sleep(2)
        logger.info("Entered text")
        
        # Find and click the post button
        post_button_selectors = [
            "[data-testid='tweetButton']",
            "[data-testid='tweetButtonInline']",
            "div[role='button'][tabindex='0']",
            "div[aria-label='Tweet']",
            "div[aria-label='Post']",
            "button[data-testid='tweetButton']",
            "button[data-testid='tweetButtonInline']"
        ]
        
        post_button = None
        for selector in post_button_selectors:
            try:
                post_button = WebDriverWait(driver, 10).until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, selector))
                )
                if post_button.text.strip() in ["Tweet", "Post", "ポストする", "ツイートする", "ポスト"]:
                    logger.info(f"Found post button with selector: {selector}")
                    driver.save_screenshot("before_post.png")
                    break
            except Exception as e:
                logger.warning(f"Could not find post button with selector {selector}: {e}")
        
        if not post_button:
            logger.error("Could not find post button")
            driver.save_screenshot("post_button_error.png")
            return
        
        # Click the post button
        post_button.click()
        time.sleep(5)
        logger.info("Clicked post button")
        
        # Check if post was successful
        if "/status/" in driver.current_url:
            logger.info(f"Successfully posted: {driver.current_url}")
        else:
            logger.warning(f"Post may not have been successful. Current URL: {driver.current_url}")
            driver.save_screenshot("post_error.png")
    
    except Exception as e:
        logger.error(f"Error posting to X: {e}")
        driver.save_screenshot("error.png")

def main():
    driver = setup_webdriver()
    if not driver:
        logger.error("Failed to set up WebDriver")
        return 1
    
    try:
        post_to_twitter(driver, "テストポスト from Selenium " + time.strftime("%Y-%m-%d %H:%M:%S"))
    finally:
        driver.quit()
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
