"""
Script to generate videos from Figma banners and post them to X with answers
"""
import os
import sys
import json
import yaml
import time
import logging
import datetime
import requests
import csv
import io
import tempfile
import random
import pyperclip
import urllib.request
from typing import Dict, List, Any, Optional, Tuple
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    TimeoutException, 
    NoSuchElementException, 
    ElementClickInterceptedException
)
import undetected_chromedriver as uc
from webdriver_manager.chrome import ChromeDriverManager

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

FIGMA_API_KEY = os.environ.get("FIGMA_API_KEY")
FIGMA_FILE_ID = os.environ.get("FIGMA_FILE_ID", "aJ8OkMzwRoLlpjnEUdHvfN")
FIGMA_NODE_ID = os.environ.get("FIGMA_NODE_ID", "20-2")
X_COOKIE_PATH = os.environ.get("COOKIE_NIIJIMA", os.path.join(os.path.dirname(os.path.dirname(__file__)), "profiles", "niijima"))
if not os.path.exists(X_COOKIE_PATH):
    X_COOKIE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "profiles", "niijima")
QA_CSV_PATH = os.environ.get("QA_CSV_PATH", "qa_sheet_polite_fixed.csv")
QUEUE_FILE = os.environ.get("QUEUE_FILE", "queue/queue_2025-04-28.yaml")
VIDEO_DURATION = 1  # seconds per video (1 second as requested for Canva-like format)
VIDEO_OUTPUT_DIR = "videos"


def load_qa_data() -> Dict[str, Dict[str, str]]:
    """
    Load Q&A data from the CSV file
    
    Returns:
        Dict[str, Dict[str, str]]: Dictionary mapping questions to answer data (text and media_url)
    """
    qa_dict = {}
    
    try:
        with open(QA_CSV_PATH, 'r', encoding='utf-8') as f:
            csv_reader = csv.reader(f)
            headers = next(csv_reader)  # Skip header row
            
            if len(headers) >= 2:
                prompt_idx = 0  # Default to first column for prompt
                completion_idx = 1  # Default to second column for completion
                media_url_idx = None  # Look for media_url column
                
                for i, header in enumerate(headers):
                    if header.lower() == 'prompt':
                        prompt_idx = i
                    elif header.lower() == 'completion':
                        completion_idx = i
                    elif header.lower() == 'media_url' or header.lower() == 'media url':
                        media_url_idx = i
                        logger.info(f"Found media_url column at index {media_url_idx}")
                
                for row in csv_reader:
                    if len(row) > max(prompt_idx, completion_idx):
                        question = row[prompt_idx].strip('"')
                        answer_text = row[completion_idx].strip('"')
                        
                        answer_data = {
                            "text": answer_text,
                            "media_url": ""
                        }
                        
                        if media_url_idx is not None and len(row) > media_url_idx:
                            media_url = row[media_url_idx].strip('"')
                            if media_url:
                                answer_data["media_url"] = media_url
                                logger.info(f"Found media URL for question: '{question}' -> '{media_url}'")
                        
                        qa_dict[question] = answer_data
            
        logger.info(f"Loaded {len(qa_dict)} Q&A pairs from {QA_CSV_PATH}")
        
        queue_items = load_queue_questions()
        for item in queue_items:
            if 'text' in item:
                question = item['text']
                if question not in qa_dict:
                    for q in qa_dict.keys():
                        if question in q or q in question:
                            qa_dict[question] = qa_dict[q]
                            logger.info(f"Manually matched question: '{question}' to existing answer for: '{q}'")
                            break
        
        return qa_dict
    except Exception as e:
        logger.error(f"Error loading Q&A data: {e}")
        return {}


def load_queue_questions() -> List[Dict[str, Any]]:
    """
    Load questions from the queue file
    
    Returns:
        List[Dict[str, Any]]: List of question items
    """
    try:
        with open(QUEUE_FILE, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        if not data:
            logger.warning(f"Queue file is empty: {QUEUE_FILE}")
            return []
        
        logger.info(f"Loaded {len(data)} questions from {QUEUE_FILE}")
        return data
    except Exception as e:
        logger.error(f"Error loading queue file: {e}")
        return []


def create_video_from_image(image_path: str, output_path: str) -> bool:
    """
    Create a video from an image URL or local file path in Canva-like format
    
    Args:
        image_path: URL or local path of the image
        output_path: Path to save the video
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        temp_image_path = f"{output_path}.png"
        
        if image_path.startswith(('http://', 'https://')):
            # Download the image from URL
            response = requests.get(image_path)
            response.raise_for_status()
            
            with open(temp_image_path, 'wb') as f:
                f.write(response.content)
        else:
            if os.path.exists(image_path):
                import shutil
                shutil.copy(image_path, temp_image_path)
            else:
                logger.error(f"Local image file not found: {image_path}")
                return False
        
        # Use ffmpeg to create a 1-second video from the image
        ffmpeg_cmd = (
            f"ffmpeg -y -loop 1 -i {temp_image_path} -c:v libx264 -t {VIDEO_DURATION} "
            f"-pix_fmt yuv420p -vf \"scale=1920:1080,format=yuv420p\" "
            f"-profile:v high -level:v 4.0 -crf 18 -r 30 -movflags +faststart {output_path}"
        )
        
        logger.info(f"Running ffmpeg command: {ffmpeg_cmd}")
        result = os.system(ffmpeg_cmd)
        
        if result == 0 and os.path.exists(output_path):
            logger.info(f"Created video: {output_path}")
            return True
        else:
            logger.error(f"Failed to create video: {output_path}")
            return False
    except Exception as e:
        logger.error(f"Error creating video: {e}")
        return False


def random_delay(min_sec=1.0, max_sec=3.0):
    """ランダムな待機時間を返す（秒）"""
    return random.uniform(min_sec, max_sec)


def ensure_utf8_encoding():
    """
    標準出力のエンコーディングをUTF-8に設定する
    
    Returns:
        bool: 設定に成功したかどうか
    """
    try:
        old_stdout = sys.stdout
        
        if hasattr(sys.stdout, "encoding") and sys.stdout.encoding.lower() != "utf-8":
            sys.stdout = io.TextIOWrapper(
                sys.stdout.buffer, encoding="utf-8", line_buffering=True
            )
            logger.info(
                f"stdoutのエンコーディングを{old_stdout.encoding}からutf-8に変更しました"
            )
        
        return True
    except Exception as e:
        logger.error(f"stdoutのエンコーディング変更中にエラーが発生しました: {e}")
        return False


def setup_webdriver() -> Optional[webdriver.Chrome]:
    """
    Set up Chrome WebDriver with X cookies using ChromeDriverManager
    
    Returns:
        webdriver.Chrome: Chrome WebDriver instance
    """
    try:
        ensure_utf8_encoding()
        
        # Set up Chrome options
        options = Options()
        # options.add_argument("--headless=new")  # Disable headless mode for debugging
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1920,1080")
        options.add_argument("--start-maximized")
        options.add_argument("--disable-extensions")
        options.add_argument("--disable-infobars")
        options.add_argument("--disable-notifications")
        options.add_argument("--disable-popup-blocking")
        options.add_argument("--disable-translate")
        options.add_argument("--disable-features=TranslateUI")
        options.add_argument("--disable-features=Translate")
        options.add_argument("--disable-features=PasswordManager")
        options.add_argument("--disable-features=ChromeWhatsNewUI")
        options.add_argument("--disable-features=PrivacySandboxSettings4")
        options.add_argument("--disable-features=AutofillEnableAccountWalletStorage")
        options.add_argument("--disable-features=AutofillServerCommunication")
        options.add_argument("--disable-features=ImprovedCookieControls")
        options.add_argument("--disable-features=OptimizationHints")
        options.add_argument("--disable-features=OptimizationHintsFetching")
        options.add_argument("--disable-features=OptimizationTargetPrediction")
        options.add_argument("--disable-features=OptimizationHintsFetchingAnonymousDataConsent")
        options.add_argument("--disable-features=PrivacySandboxSettings3")
        options.add_argument("--disable-features=PrivacySandboxAdsAPIsOverride")
        options.add_argument("--disable-features=PrivacySandboxSettings")
        options.add_argument("--disable-features=PrivacyGuide3")
        options.add_argument("--disable-features=PrivacyGuide")
        options.add_argument("--disable-features=PrivacyReview")
        options.add_argument("--disable-features=PrivacySandboxPromptV2")
        options.add_argument("--disable-features=PrivacySandboxPrompt")
        
        import tempfile
        import uuid
        import shutil
        import time
        import psutil
        
        for proc in psutil.process_iter(['pid', 'name']):
            try:
                if 'chrome' in proc.info['name'].lower():
                    proc.kill()
                    logger.info(f"Killed existing Chrome process: {proc.info['pid']}")
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                pass
        
        time.sleep(2)
        
        # Create a completely fresh Chrome profile
        temp_dir = os.path.join(tempfile.gettempdir(), f"chrome_profile_{uuid.uuid4().hex}")
        
        if os.path.exists(temp_dir):
            import shutil
            try:
                shutil.rmtree(temp_dir)
                logger.info(f"Removed existing directory: {temp_dir}")
            except Exception as e:
                logger.warning(f"Error removing directory {temp_dir}: {e}")
        
        options.add_argument("--incognito")
        options.add_argument("--disable-application-cache")
        options.add_argument("--disable-extensions")
        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option("useAutomationExtension", False)
        
        logger.info("Running Chrome in incognito mode without user data directory to avoid conflicts")
        
        # options.add_argument("--headless=new")  # Disable headless mode for debugging
        
        try:
            service = Service(ChromeDriverManager(driver_version="135.0.7049.114").install())
            driver = webdriver.Chrome(service=service, options=options)
            driver.implicitly_wait(10)
        except Exception as e:
            logger.error(f"Error creating WebDriver: {e}")
            
            try:
                logger.info("Trying alternative WebDriver setup...")
                options = Options()
                options.add_argument("--no-sandbox")
                options.add_argument("--disable-dev-shm-usage")
                options.add_argument("--disable-gpu")
                options.add_argument("--window-size=1920,1080")
                options.add_argument("--start-maximized")
                options.add_experimental_option("excludeSwitches", ["enable-automation"])
                options.add_experimental_option("useAutomationExtension", False)
                
                driver = webdriver.Chrome(service=service, options=options)
                driver.implicitly_wait(10)
            except Exception as e2:
                logger.error(f"Alternative WebDriver setup also failed: {e2}")
                return None
        
        driver.get("https://x.com")
        time.sleep(2)
        
        cookies_loaded = False
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
                
                cookies_loaded = True
                logger.info(f"Loaded {len(cookies)} cookies from environment variable")
            except Exception as e:
                logger.warning(f"Error loading cookies from environment variable: {e}")
        else:
            logger.warning("COOKIE_NIIJIMA not found in environment variables")
        
        driver.refresh()
        time.sleep(3)
        
        driver.get("https://x.com/home")
        time.sleep(random_delay(3, 5))
        
        WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "body"))
        )
        
        try:
            compose_button = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "a[data-testid='SideNav_NewTweet_Button']"))
            )
            logger.info("Successfully logged in to X using cookies")
        except (NoSuchElementException, TimeoutException):
            logger.warning("Could not verify login status, but continuing anyway")
        
        logger.info("WebDriver set up successfully")
        return driver
    except Exception as e:
        logger.error(f"Error setting up WebDriver: {e}")
        return None


def click_element(driver, element):
    """
    要素をクリックする（通常クリックが失敗した場合はJSクリックを試行）
    
    Args:
        driver: WebDriverインスタンス
        element: クリックする要素
    """
    try:
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
        time.sleep(random_delay(1, 2))
        element.click()
    except ElementClickInterceptedException:
        logger.info("通常クリックが要素被りで失敗したため、JSクリックを試します。")
        driver.execute_script("arguments[0].click();", element)


def paste_text(driver, element, text):
    """
    テキストを貼り付ける（クリップボード経由）
    
    Args:
        driver: WebDriverインスタンス
        element: テキストを入力する要素
        text: 入力するテキスト
    """
    pyperclip.copy(text)
    if sys.platform.startswith('darwin'):
        paste_keys = (Keys.COMMAND, 'v')
    else:
        paste_keys = (Keys.CONTROL, 'v')
    element.send_keys(*paste_keys)


def post_to_twitter(driver: webdriver.Chrome, text: str, video_path: str) -> Optional[str]:
    """
    Post to X (formerly Twitter) with video
    
    Args:
        driver: Chrome WebDriver instance
        text: Text to post
        video_path: Path to video file
        
    Returns:
        Optional[str]: Tweet URL if successful, None otherwise
    """
    try:
        driver.get("https://x.com/home")
        time.sleep(3)
        
        compose_button_selectors = [
            "a[data-testid='SideNav_NewTweet_Button']",
            "a[href='/compose/tweet']",
            "div[aria-label='ツイートする']",
            "div[aria-label='Post']",
            "div[aria-label='Tweet']",
            "div[data-testid='tweetButtonInline']",
            "a[aria-label='ツイートする']",
            "a[aria-label='Post']",
            "a[aria-label='Tweet']",
            "div[role='button'][data-testid='tweetButtonInline']",
            "a[role='link'][href='/compose/tweet']",
            "div[role='button'][aria-label='ツイートする']",
            "div[role='button'][aria-label='Post']",
            "div[role='button'][aria-label='Tweet']",
            "div[role='button'][data-testid='SideNav_NewTweet_Button']",
            "a[role='link'][data-testid='SideNav_NewTweet_Button']",
            "div[role='button'][data-testid='tweetButton']",
            "a[role='link'][data-testid='tweetButton']",
            "div[role='button'][data-testid='toolBar_tweet_button']",
            "a[role='link'][data-testid='toolBar_tweet_button']",
            "div[role='button'][data-testid='tweetButtonInHeader']",
            "a[role='link'][data-testid='tweetButtonInHeader']",
            "div[role='button'][data-testid='SideNav_NewPost_Button']",
            "a[role='link'][data-testid='SideNav_NewPost_Button']"
        ]
        
        compose_button = None
        for selector in compose_button_selectors:
            try:
                compose_button = WebDriverWait(driver, 5).until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, selector))
                )
                logger.info(f"Found compose button with selector: {selector}")
                compose_button.click()
                break
            except Exception:
                continue
        
        if not compose_button:
            logger.error("Could not find compose button")
            driver.save_screenshot("compose_button_error.png")
            logger.info("Saved screenshot to compose_button_error.png")
            return None
        
        time.sleep(2)
        
        TEXTBOX_SEL = "div[role='textbox'],[data-testid='tweetTextarea_0']"
        text_area = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, TEXTBOX_SEL))
        )
        
        text_area.click()
        time.sleep(0.2)
        
        try:
            driver.execute_cdp_cmd("Input.insertText", {"text": text})
            time.sleep(0.3)
            if text_area.text.strip():  # Success check
                logger.info("Text entered using CDP insertText")
            else:
                raise Exception("CDP insertText failed")
        except Exception as e:
            logger.warning(f"CDP insert failed: {e}")
            
            try:
                import pyperclip
                pyperclip.copy(text)
                if sys.platform.startswith("darwin"):
                    text_area.send_keys(Keys.COMMAND, "v")
                else:
                    text_area.send_keys(Keys.CONTROL, "v")
                time.sleep(0.3)
                if text_area.text.strip():
                    logger.info("Text entered using clipboard paste")
                else:
                    raise Exception("Clipboard paste failed")
            except Exception as e:
                logger.warning(f"Paste fallback failed: {e}")
                
                try:
                    for ch in text:
                        text_area.send_keys(ch)
                        time.sleep(random.uniform(0.02, 0.05))
                    logger.info("Text entered using character-by-character send_keys")
                except Exception as e:
                    logger.error(f"send_keys fallback failed: {e}")
                    return None
        
        try:
            file_input_selectors = [
                "input[type='file']",
                "[data-testid='fileInput']",
                "[accept='image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime']"
            ]
            
            file_input = None
            for selector in file_input_selectors:
                try:
                    file_input = driver.find_element(By.CSS_SELECTOR, selector)
                    break
                except Exception:
                    continue
            
            if not file_input:
                media_button = driver.find_element(By.CSS_SELECTOR, "[data-testid='imageOrGifIcon']")
                media_button.click()
                time.sleep(1)
                file_input = driver.find_element(By.CSS_SELECTOR, "input[type='file']")
            
            video_abs_path = os.path.abspath(video_path)
            if not os.path.exists(video_abs_path):
                logger.error(f"Video file does not exist: {video_abs_path}")
                return None
            
            logger.info(f"Uploading video: {video_abs_path}")
            file_input.send_keys(video_abs_path)
            
            logger.info("Waiting for video to upload and process...")
            WebDriverWait(driver, 120).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "[data-testid='videoPlayer']"))
            )
            logger.info("Video uploaded successfully")
            
        except Exception as e:
            logger.error(f"Error uploading video: {e}")
            driver.save_screenshot("video_upload_error.png")
            logger.info("Saved screenshot to video_upload_error.png")
            return None
        
        post_button_selectors = [
            "[data-testid$='tweetButton']",
            "[data-testid$='tweetButtonInline']",
            "[data-testid$='postButton']",
            "[aria-label='Post']",
            "[aria-label='Tweet']",
            "div[role='button'][data-testid$='tweetButton']",
            "div[role='button'][data-testid$='postButton']",
            "div[role='button'][aria-label='Post']",
            "div[role='button'][aria-label='Tweet']"
        ]
        
        post_button = None
        for selector in post_button_selectors:
            try:
                post_button = WebDriverWait(driver, 10).until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, selector))
                )
                logger.info(f"Found post button with selector: {selector}")
                break
            except Exception:
                continue
        
        if not post_button:
            try:
                xpath_selectors = [
                    "//div[@role='button' and contains(text(), 'Post')]",
                    "//div[@role='button' and contains(text(), 'Tweet')]",
                    "//span[contains(text(), 'Post')]/ancestor::div[@role='button']",
                    "//span[contains(text(), 'Tweet')]/ancestor::div[@role='button']",
                    "//div[@role='button' and contains(text(), 'ポストする')]",
                    "//span[contains(text(), 'ポストする')]/ancestor::div[@role='button']"
                ]
                
                for xpath in xpath_selectors:
                    try:
                        post_button = driver.find_element(By.XPATH, xpath)
                        logger.info(f"Found post button with XPath: {xpath}")
                        break
                    except Exception:
                        continue
            except Exception as e:
                logger.error(f"Error finding post button with XPath: {e}")
        
        if not post_button:
            logger.error("Could not find post button")
            driver.save_screenshot("post_button_error.png")
            logger.info("Saved screenshot to post_button_error.png")
            
            try:
                buttons = driver.find_elements(By.CSS_SELECTOR, "div[role='button']")
                logger.info(f"Found {len(buttons)} potential buttons")
                
                for i, button in enumerate(buttons):
                    try:
                        text = button.text
                        logger.info(f"Button {i}: text='{text}'")
                        
                        if text.lower() in ['post', 'tweet', 'send'] or text == 'ポストする':
                            logger.info(f"Found potential post button with text: {text}")
                            button.click()
                            logger.info(f"Clicked button with text: {text}")
                            time.sleep(5)
                            
                            if not driver.find_elements(By.CSS_SELECTOR, "[data-testid='tweetTextarea_0']"):
                                tweet_url = driver.current_url
                                logger.info(f"Posted to X: {tweet_url}")
                                return tweet_url
                    except Exception as e:
                        logger.warning(f"Error getting text for button {i}: {e}")
            except Exception as e:
                logger.error(f"Error finding potential buttons: {e}")
            
            return None
        
        post_button.click()
        logger.info("Clicked post button")
        
        time.sleep(10)
        
        try:
            time.sleep(5)
            tweet_url = driver.current_url
            
            if "home" in tweet_url:
                logger.info("Still on home page, trying to find the tweet")
                
                tweet_selectors = [
                    "[data-testid='tweet']",
                    "[data-testid='tweetText']",
                    "[data-testid='cellInnerDiv']"
                ]
                
                for selector in tweet_selectors:
                    try:
                        tweet_elements = driver.find_elements(By.CSS_SELECTOR, selector)
                        if tweet_elements:
                            logger.info(f"Found {len(tweet_elements)} tweet elements with selector: {selector}")
                            
                            timestamp_selectors = [
                                "[data-testid='timestamp']",
                                "time",
                                "a[href*='/status/']"
                            ]
                            
                            for ts_selector in timestamp_selectors:
                                try:
                                    for i in range(min(3, len(tweet_elements))):
                                        try:
                                            timestamp = tweet_elements[i].find_element(By.CSS_SELECTOR, ts_selector)
                                            timestamp.click()
                                            time.sleep(3)
                                            tweet_url = driver.current_url
                                            if "/status/" in tweet_url:
                                                logger.info(f"Found tweet URL via {selector} and {ts_selector}: {tweet_url}")
                                                return tweet_url
                                        except Exception as e:
                                            logger.warning(f"Error clicking timestamp in tweet {i}: {e}")
                                except Exception as e:
                                    logger.warning(f"Error finding timestamp with selector {ts_selector}: {e}")
                    except Exception as e:
                        logger.warning(f"Error finding tweets with selector {selector}: {e}")
                
                try:
                    status_links = driver.find_elements(By.CSS_SELECTOR, "a[href*='/status/']")
                    if status_links:
                        for link in status_links:
                            try:
                                href = link.get_attribute("href")
                                if href and "/status/" in href:
                                    logger.info(f"Found tweet URL via status link: {href}")
                                    return href
                            except Exception as e:
                                logger.warning(f"Error getting href from status link: {e}")
                except Exception as e:
                    logger.warning(f"Error finding status links: {e}")
            
            logger.info(f"Posted to X, but couldn't find specific tweet URL. Current URL: {tweet_url}")
            return tweet_url
        except Exception as e:
            logger.error(f"Error getting tweet URL: {e}")
            return None
    except Exception as e:
        logger.error(f"Error posting to X: {e}")
        driver.save_screenshot("post_error.png")
        logger.info("Saved screenshot to post_error.png")
        return None


def create_combined_video(video_paths: List[str], output_path: str) -> bool:
    """
    Create a combined video from multiple video files
    
    Args:
        video_paths: List of video file paths
        output_path: Path to save the combined video
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        list_file = f"{output_path}.txt"
        with open(list_file, 'w') as f:
            for video_path in video_paths:
                f.write(f"file '{os.path.abspath(video_path)}'\n")
        
        # Use ffmpeg to concatenate videos
        ffmpeg_cmd = (
            f"ffmpeg -y -f concat -safe 0 -i {list_file} -c copy {output_path}"
        )
        
        logger.info(f"Running ffmpeg command: {ffmpeg_cmd}")
        result = os.system(ffmpeg_cmd)
        
        if result == 0 and os.path.exists(output_path):
            logger.info(f"Created combined video: {output_path}")
            return True
        else:
            logger.error(f"Failed to create combined video: {output_path}")
            return False
    except Exception as e:
        logger.error(f"Error creating combined video: {e}")
        return False


def reply_to_tweet(driver: webdriver.Chrome, tweet_url: str, text: str, media_path: Optional[str] = None) -> Optional[str]:
    """
    Reply to a tweet with text and optional media
    
    Args:
        driver: Chrome WebDriver instance
        tweet_url: URL of the tweet to reply to
        text: Text to post
        media_path: Optional path to media file to attach
        
    Returns:
        Optional[str]: Reply URL if successful, None otherwise
    """
    try:
        logger.info(f"Navigating to tweet: {tweet_url}")
        driver.get(tweet_url)
        time.sleep(3)
        
        WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "body"))
        )
        
        reply_selectors = [
            "[data-testid='reply']",
            "[aria-label='Reply']",
            "[data-testid='replyButton']"
        ]
        
        reply_button = None
        for selector in reply_selectors:
            try:
                reply_button = WebDriverWait(driver, 10).until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, selector))
                )
                logger.info(f"Found reply button with selector: {selector}")
                break
            except Exception:
                continue
        
        if not reply_button:
            logger.error("Could not find reply button")
            driver.save_screenshot("reply_button_error.png")
            logger.info("Saved screenshot to reply_button_error.png")
            return None
        
        reply_button.click()
        logger.info("Clicked reply button")
        
        text_area = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "[data-testid='tweetTextarea_0']"))
        )
        
        text_area.clear()
        click_element(driver, text_area)
        time.sleep(random_delay(0.5, 1.0))
        
        paste_text(driver, text_area, text)
        time.sleep(random_delay(1.0, 2.0))
        
        logger.info("Entered reply text")
        
        if media_path and os.path.exists(media_path):
            try:
                logger.info(f"Attaching media to reply: {media_path}")
                
                media_input_selectors = [
                    "input[type='file']",
                    "input[data-testid='fileInput']",
                    "input[accept='image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime']"
                ]
                
                media_input = None
                for selector in media_input_selectors:
                    try:
                        media_input = driver.find_element(By.CSS_SELECTOR, selector)
                        logger.info(f"Found media input with selector: {selector}")
                        break
                    except Exception:
                        continue
                
                if not media_input:
                    logger.warning("Could not find media input element")
                else:
                    media_input.send_keys(os.path.abspath(media_path))
                    
                    try:
                        WebDriverWait(driver, 30).until(
                            EC.presence_of_element_located((By.CSS_SELECTOR, "div[data-testid='attachments']"))
                        )
                        logger.info("Media uploaded successfully")
                    except TimeoutException:
                        logger.warning("Timed out waiting for media upload confirmation, but continuing anyway")
                    
                    time.sleep(random_delay(2, 4))
            except Exception as e:
                logger.error(f"Error attaching media: {e}")
                driver.save_screenshot("media_attachment_error.png")
                logger.info("Saved screenshot to media_attachment_error.png")
        
        reply_button_selectors = [
            "[data-testid='tweetButton']",
            "[data-testid='postButton']",
            "[aria-label='Reply']"
        ]
        
        post_button = None
        for selector in reply_button_selectors:
            try:
                post_button = WebDriverWait(driver, 10).until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, selector))
                )
                logger.info(f"Found post button with selector: {selector}")
                break
            except Exception:
                continue
        
        if not post_button:
            logger.error("Could not find post button for reply")
            driver.save_screenshot("reply_post_button_error.png")
            logger.info("Saved screenshot to reply_post_button_error.png")
            return None
        
        post_button.click()
        logger.info("Clicked post button for reply")
        
        time.sleep(10)
        
        try:
            reply_url = driver.current_url
            
            if reply_url == tweet_url:
                reply_elements = driver.find_elements(By.CSS_SELECTOR, "[data-testid='tweet']")
                if len(reply_elements) > 1:  # First one is the original tweet
                    timestamp = reply_elements[1].find_element(By.CSS_SELECTOR, "[data-testid='timestamp']")
                    timestamp.click()
                    time.sleep(3)
                    reply_url = driver.current_url
            
            logger.info(f"Replied to tweet: {reply_url}")
            return reply_url
        except Exception as e:
            logger.error(f"Error getting reply URL: {e}")
            return None
    except Exception as e:
        logger.error(f"Error replying to tweet: {e}")
        driver.save_screenshot("reply_error.png")
        logger.info("Saved screenshot to reply_error.png")
        return None


def find_answer_for_question(qa_dict: Dict[str, Dict[str, str]], question: str) -> Dict[str, str]:
    """
    Find the answer for a question in the Q&A dictionary
    
    Args:
        qa_dict: Dictionary mapping questions to answer data (text and media_url)
        question: Question to find the answer for
        
    Returns:
        Dict[str, str]: Dictionary with 'text' and 'media_url' keys
    """
    manual_matches = {
        "メンズエステで働くメリットは何でしょうか？": "メンズエステで働くメリットは何でしょうか？",
        "未経験でも稼げるのでしょうか？": "未経験でも稼げるのでしょうか？",
        "出稼ぎの交通費は支給されるのでしょうか？": "出稼ぎの交通費は支給されるのでしょうか？",
        "本指名率を上げるコツはありますか？": "本指名率を上げるコツはありますか？"
    }
    
    default_response = {
        "text": "申し訳ございませんが、この質問に対する回答は現在準備中です。",
        "media_url": ""
    }
    
    if question in manual_matches:
        matched_question = manual_matches[question]
        if matched_question in qa_dict:
            logger.info(f"Found manual match: '{question}' -> '{matched_question}'")
            return qa_dict[matched_question]
    
    if question in qa_dict:
        logger.info(f"Found exact match for question: '{question}'")
        return qa_dict[question]
    
    for q, a in qa_dict.items():
        if question in q or q in question:
            logger.info(f"Found partial match: '{question}' matches with '{q}'")
            return a
    
    # Fuzzy match based on common words
    question_words = set(question.replace('？', '').replace('?', '').split())
    best_match = None
    best_match_score = 0
    
    for q, a in qa_dict.items():
        q_words = set(q.replace('？', '').replace('?', '').split())
        common_words = question_words.intersection(q_words)
        
        if len(common_words) > best_match_score:
            best_match_score = len(common_words)
            best_match = q
    
    if best_match and best_match_score >= 2:  # At least 2 common words
        logger.info(f"Found fuzzy match: '{question}' matches with '{best_match}' (score: {best_match_score})")
        return qa_dict[best_match]
    
    logger.warning(f"No answer found for question: '{question}'")
    return default_response


def main():
    """Main function"""
    try:
        os.makedirs(VIDEO_OUTPUT_DIR, exist_ok=True)
        
        # Load Q&A data with improved CSV parsing
        logger.info(f"Loading Q&A data from {QA_CSV_PATH}")
        qa_dict = load_qa_data()
        
        if not qa_dict:
            logger.warning("No Q&A data loaded, will use default answers")
        else:
            logger.info(f"Loaded {len(qa_dict)} Q&A pairs")
        
        # Load questions from queue file
        logger.info(f"Loading questions from {QUEUE_FILE}")
        queue_items = load_queue_questions()
        
        if not queue_items:
            logger.error(f"No questions found in queue file: {QUEUE_FILE}")
            return 1
        
        logger.info(f"Loaded {len(queue_items)} questions from queue")
        
        video_paths = []
        questions = []
        
        for i, item in enumerate(queue_items):
            if 'text' not in item:
                logger.warning(f"Item missing 'text' field: {item}")
                continue
            
            if 'png_url' not in item:
                logger.warning(f"Item missing 'png_url' field: {item}")
                continue
            
            question = item['text']
            questions.append(question)
            image_url = item['png_url']
            
            logger.info(f"Processing question {i+1}: {question}")
            
            video_path = f"{VIDEO_OUTPUT_DIR}/question_{i+1}.mp4"
            if create_video_from_image(image_url, video_path):
                video_paths.append(video_path)
                logger.info(f"Created video for question {i+1}: {video_path}")
            else:
                logger.error(f"Failed to create video for question {i+1}")
        
        if not video_paths:
            logger.error("No videos created, cannot continue")
            return 1
        
        # Create combined video
        combined_video_path = f"{VIDEO_OUTPUT_DIR}/combined_questions.mp4"
        logger.info(f"Creating combined video: {combined_video_path}")
        
        if not create_combined_video(video_paths, combined_video_path):
            logger.error("Failed to create combined video")
            return 1
        
        logger.info("Video generation completed successfully!")
        logger.info(f"Individual videos: {video_paths}")
        logger.info(f"Combined video: {combined_video_path}")
        
        logger.info("Starting X posting process...")
        
        driver = setup_webdriver()
        if not driver:
            logger.error("Failed to set up WebDriver")
            return 1
        
        try:
            # Post main tweet with combined video
            tweet_text = "メンズエステに関する4つの質問と回答をお届けします。\n\n#メンエス #メンズエステ #求人"
            tweet_url = post_to_twitter(driver, tweet_text, combined_video_path)
            
            if not tweet_url:
                logger.error("Failed to post main tweet")
                return 1
            
            logger.info(f"Posted main tweet: {tweet_url}")
            
            # Post replies with answers
            for i, question in enumerate(questions):
                answer_data = find_answer_for_question(qa_dict, question)
                
                if isinstance(answer_data, dict):
                    answer_text = answer_data.get('text', '')
                    media_url = answer_data.get('media_url', '')
                else:
                    answer_text = answer_data
                    media_url = ''
                
                reply_text = f"Q{i+1}: {question}\n\nA: {answer_text}"
                
                if media_url:
                    reply_url = reply_to_tweet(driver, tweet_url, reply_text, media_url)
                else:
                    reply_url = reply_to_tweet(driver, tweet_url, reply_text)
                
                if reply_url:
                    logger.info(f"Posted reply {i+1}: {reply_url}")
                else:
                    logger.warning(f"Failed to post reply {i+1}")
            
            logger.info("X posting completed successfully!")
            return 0
        
        except Exception as e:
            logger.error(f"Error during X posting: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return 1
        
        finally:
            if driver:
                driver.quit()
                logger.info("WebDriver closed")
        
        logger.info("Setting up WebDriver for X posting")
        driver = setup_webdriver()
        if not driver:
            logger.error("Failed to set up WebDriver")
            return 1
        
        try:
            first_question = questions[0]
            logger.info(f"Finding answer for first question: {first_question}")
            first_answer_data = find_answer_for_question(qa_dict, first_question)
            
            main_post_text = f"【質問と回答】\n\n質問1: {first_question}\n\n回答: {first_answer_data['text']}"
            logger.info("Prepared main post text")
            
            # Post main post with combined video
            logger.info(f"Posting main post with combined video: {combined_video_path}")
            tweet_url = post_to_twitter(driver, main_post_text, combined_video_path)
            
            if not tweet_url:
                logger.error("Failed to post main tweet")
                driver.save_screenshot("main_post_error.png")
                logger.info("Saved screenshot to main_post_error.png")
                return 1
            
            logger.info(f"Successfully posted main tweet: {tweet_url}")
            
            for i in range(1, len(questions)):
                question = questions[i]
                logger.info(f"Finding answer for question {i+1}: {question}")
                answer_data = find_answer_for_question(qa_dict, question)
                
                reply_text = f"質問{i+1}: {question}\n\n回答: {answer_data['text']}"
                logger.info(f"Posting reply {i} with text: {reply_text[:50]}...")
                
                media_path = None
                if answer_data.get('media_url'):
                    media_url = answer_data['media_url']
                    logger.info(f"Found media URL for question {i+1}: {media_url}")
                    
                    if os.path.exists(media_url):
                        media_path = media_url
                        logger.info(f"Using local media path: {media_path}")
                    elif media_url.startswith(('http://', 'https://')):
                        try:
                            media_filename = f"answer_{i+1}.png"
                            urllib.request.urlretrieve(media_url, media_filename)
                            media_path = media_filename
                            logger.info(f"Downloaded media from {media_url} to {media_path}")
                        except Exception as e:
                            logger.error(f"Failed to download media from {media_url}: {e}")
                    else:
                        logger.warning(f"Unrecognized media URL format: {media_url}")
                else:
                    logger.info(f"No media URL found for question {i+1}")
                
                
                time.sleep(10)
                
                reply_url = reply_to_tweet(driver, tweet_url, reply_text, media_path)
                
                if not reply_url:
                    logger.warning(f"Failed to reply with answer {i+1}")
                    driver.save_screenshot(f"reply_{i+1}_error.png")
                    logger.info(f"Saved screenshot to reply_{i+1}_error.png")
                    continue
                
                logger.info(f"Successfully posted reply {i}: {reply_url}")
                
                time.sleep(15)
            
            logger.info("Successfully posted all questions and answers")
            return 0
        finally:
            logger.info("Quitting WebDriver")
            driver.quit()
    
    except Exception as e:
        logger.error(f"Unexpected error in main function: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return 1


if __name__ == "__main__":
    sys.exit(main())
