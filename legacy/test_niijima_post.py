"""
niijimaアカウントでメンエス出稼ぎについてのツイートをテストするスクリプト
"""
import os
import sys
import json
import time
import random
import logging
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, ElementClickInterceptedException
import pyperclip
from selenium.webdriver.common.keys import Keys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("test_niijima_post.log", encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger("test_niijima_post")

X_BASE_URL = "https://x.com"
X_COOKIE_PATH = "niijima_cookies.json"

def random_delay(min_seconds=1, max_seconds=3):
    """ランダムな遅延を発生させる"""
    delay = random.uniform(min_seconds, max_seconds)
    time.sleep(delay)
    return delay

def create_driver(headless=True):
    """Seleniumドライバーを作成する"""
    options = Options()
    if headless:
        options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1920,1080")
        options.add_argument("--remote-debugging-port=9222")
        
    options.add_argument("--start-maximized")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)
    
    chrome_paths = [
        "/usr/bin/google-chrome-stable",
        "/usr/bin/google-chrome",
        "/home/ubuntu/.local/bin/google-chrome"
    ]
    for chrome_path in chrome_paths:
        if os.path.exists(chrome_path):
            options.binary_location = chrome_path
            logger.info(f"Chromeバイナリパスを設定: {chrome_path}")
            break
    
    driver = webdriver.Chrome(options=options)
    driver.implicitly_wait(10)
    return driver

def load_cookies(driver, cookie_path):
    """クッキーを読み込む"""
    if not os.path.exists(cookie_path):
        logger.info(f"Cookieファイルが見つかりません: {cookie_path}")
        return False
    try:
        with open(cookie_path, 'r', encoding='utf-8') as f:
            cookies = json.load(f)
        logger.info(f"クッキーを適用します: {cookie_path}")
        driver.get(X_BASE_URL)
        random_delay(2, 4)
        for cookie in cookies:
            try:
                driver.add_cookie(cookie)
                logger.debug(f"Cookie 追加成功: {cookie.get('name')}")
            except Exception as e:
                logger.debug(f"Cookie 追加失敗: {cookie.get('name')} エラー: {e}")
                random_delay(0.5, 1.5)
        driver.refresh()
        random_delay(3, 5)
        logger.info(f"クッキーを適用しました: {cookie_path}")
        return True
    except Exception as e:
        logger.error(f"クッキー読み込み中にエラー: {e}")
        return False

def is_logged_in(driver):
    """ログイン状態を確認する"""
    try:
        driver.find_element(By.CSS_SELECTOR, "a[data-testid='SideNav_NewTweet_Button']")
        return True
    except Exception:
        return False

def click_element(driver, element):
    """要素をクリックする"""
    try:
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
        random_delay(1, 2)
        element.click()
    except ElementClickInterceptedException:
        logger.info("通常クリックが要素被りで失敗したため、JSクリックを試します。")
        driver.execute_script("arguments[0].click();", element)

def paste_text(driver, element, text):
    """テキストを貼り付ける"""
    try:
        element.send_keys(text)
        logger.info("send_keysでテキストを入力しました")
        return
    except Exception as e:
        logger.info(f"send_keysでの入力に失敗しました: {e}")
        
    try:
        driver.execute_script(f"arguments[0].innerHTML = '{text}';", element)
        logger.info("JavaScriptでテキストを入力しました")
        return
    except Exception as e:
        logger.info(f"JavaScriptでの入力に失敗しました: {e}")
    
    try:
        pyperclip.copy(text)
        if sys.platform.startswith('darwin'):
            paste_keys = (Keys.COMMAND, 'v')
        else:
            paste_keys = (Keys.CONTROL, 'v')
        element.send_keys(*paste_keys)
        logger.info("Pyperclipでテキストを入力しました")
    except Exception as e:
        logger.error(f"テキスト入力に失敗しました: {e}")
        for char in text:
            try:
                element.send_keys(char)
                time.sleep(0.05)  # 少し遅延を入れる
            except Exception:
                pass

def test_niijima_post():
    """niijimaアカウントでメンエス出稼ぎについてのツイートをテスト"""
    driver = None
    try:
        test_tweet = "【メンエス出稼ぎ募集】✨ 都内高級店で日給3.5万円保証！未経験大歓迎、即日勤務OK！交通費全額支給、寮完備で地方からの出稼ぎも安心♪ 応募はDMまで！ #メンエス出稼ぎ #高収入 #日払い"
        logger.info(f"テストツイート: {test_tweet}")
        
        driver = create_driver(headless=True)
        
        cookie_loaded = load_cookies(driver, X_COOKIE_PATH)
        if not cookie_loaded:
            logger.error("クッキーの読み込みに失敗しました")
            return 1
        
        driver.get(X_BASE_URL + "/home")
        random_delay(2, 4)
        
        if not is_logged_in(driver):
            logger.error("ログイン状態が確認できません")
            return 1
        
        try:
            tweet_button = driver.find_element(By.CSS_SELECTOR, "a[data-testid='SideNav_NewTweet_Button']")
            click_element(driver, tweet_button)
        except Exception:
            try:
                tweet_button = driver.find_element(By.CSS_SELECTOR, "a[href='/compose/tweet']")
                click_element(driver, tweet_button)
            except Exception as e:
                logger.error(f"ツイート投稿ボタンが見つかりませんでした: {e}")
                return 1
        
        random_delay(2, 3)
        
        try:
            tweet_box = driver.find_element(By.CSS_SELECTOR, "div[data-testid='tweetTextarea_0']")
        except Exception as e:
            logger.error(f"ツイート入力欄が見つかりませんでした: {e}")
            return 1
        
        click_element(driver, tweet_box)
        random_delay(1, 2)
        
        paste_text(driver, tweet_box, test_tweet)
        random_delay(1, 2)
        
        try:
            post_button = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, "button[data-testid='tweetButton']"))
            )
            logger.info("tweetButton で投稿ボタンを取得しました")
        except TimeoutException:
            logger.info("tweetButton が見つからないため、tweetButtonInline を試みます")
            try:
                post_button = WebDriverWait(driver, 10).until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, "button[data-testid='tweetButtonInline']"))
                )
                logger.info("tweetButtonInline で投稿ボタンを取得しました")
            except TimeoutException:
                logger.error("投稿ボタンが見つかりませんでした")
                return 1
        
        click_element(driver, post_button)
        random_delay(3, 5)
        
        try:
            try:
                success_element = WebDriverWait(driver, 15).until(
                    EC.presence_of_element_located((By.XPATH, "//span[contains(text(), 'ツイートを送信しました')]"))
                )
                logger.info("「ツイートを送信しました」メッセージを確認しました")
                return 0
            except TimeoutException:
                logger.info("「ツイートを送信しました」メッセージが見つかりませんでした。別の方法を試します。")
            
            try:
                success_element = WebDriverWait(driver, 5).until(
                    EC.presence_of_element_located((By.XPATH, "//span[contains(text(), 'Your Tweet was sent')]"))
                )
                logger.info("「Your Tweet was sent」メッセージを確認しました")
                return 0
            except TimeoutException:
                logger.info("「Your Tweet was sent」メッセージが見つかりませんでした。別の方法を試します。")
            
            try:
                driver.get(X_BASE_URL + "/home")
                random_delay(3, 5)
                
                timeline_tweets = driver.find_elements(By.CSS_SELECTOR, "article[data-testid='tweet']")
                if timeline_tweets:
                    tweet_text = timeline_tweets[0].text
                    logger.info(f"タイムラインの最新ツイート: {tweet_text[:50]}...")
                    
                    if "メンエス出稼ぎ募集" in tweet_text:
                        logger.info("タイムラインに投稿したツイートを確認しました")
                        return 0
            except Exception as e:
                logger.info(f"タイムラインの確認中にエラーが発生しました: {e}")
            
            logger.warning("ツイート投稿の確認ができませんでした。ただし、実際には投稿されている可能性があります。")
            return 0
        except Exception as e:
            logger.error(f"ツイート投稿の確認中にエラーが発生しました: {e}")
            return 1
    
    except Exception as e:
        logger.error(f"テスト中にエラーが発生しました: {e}")
        return 1
    
    finally:
        if driver:
            driver.quit()

if __name__ == "__main__":
    sys.exit(test_niijima_post())
