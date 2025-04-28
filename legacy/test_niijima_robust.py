"""
niijimaアカウントでメンエス出稼ぎについてのツイートをテストするスクリプト
より堅牢なChromeドライバー設定を使用
"""
import io
import json
import logging
import os
import random
import sys
import time
from pathlib import Path
from typing import Dict, Any

import pyperclip
from selenium import webdriver
from selenium.common.exceptions import (
    ElementClickInterceptedException,
    NoSuchElementException,
    TimeoutException,
)
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("test_niijima_robust.log", encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger("test_niijima_robust")

X_COOKIE_PATH = "niijima_cookies.json"
X_BASE_URL = "https://x.com"


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


def random_delay(min_sec=1.0, max_sec=3.0):
    """ランダムな待機時間を返す（秒）"""
    return random.uniform(min_sec, max_sec)


def get_random_emojis(n=2):
    """UTF-8で使える多くの絵文字からランダムにn個選んで連結して返す"""
    emoji_list = [
        "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇",
        "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚",
        "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩",
        "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣",
        "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬",
        "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗",
        "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯",
        "😦", "😧", "😮", "😲", "😴", "🤤", "😪", "😵", "🤐", "🥴",
        "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "🤑", "🤠", "😈", "👿",
        "👹", "👺", "🤡", "💩", "👻", "💀", "☠️", "👽", "👾", "🤖",
        "🎃", "✨", "💫", "💰", "💎", "🌟", "⭐", "🔥", "💯", "🎯",
        "🚀", "💪", "👑", "🌈", "🍀", "💝", "💖", "💕", "💓", "💘",
        "💞"
    ]
    return ''.join(random.sample(emoji_list, n))


def create_robust_driver():
    """より堅牢なSeleniumドライバーを作成する"""
    options = Options()
    
    options.add_argument("--headless=new")  # 新しいヘッドレスモード
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--remote-debugging-port=9222")
    
    options.add_argument("--start-maximized")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)
    
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    driver.implicitly_wait(10)
    return driver


def load_cookies(driver, cookie_path, base_url):
    """クッキーを読み込む"""
    if not os.path.exists(cookie_path):
        logger.info(f"Cookieファイルが見つかりません: {cookie_path}")
        return False
    try:
        with open(cookie_path, 'r', encoding='utf-8') as f:
            cookies = json.load(f)
        logger.info(f"クッキーを適用します: {cookie_path}")
        driver.get(base_url)
        time.sleep(random_delay(2, 4))
        for cookie in cookies:
            try:
                driver.add_cookie(cookie)
                logger.debug(f"Cookie 追加成功: {cookie.get('name')}")
            except Exception as e:
                logger.debug(f"Cookie 追加失敗: {cookie.get('name')} エラー: {e}")
                time.sleep(random_delay(0.5, 1.5))
        driver.refresh()
        time.sleep(random_delay(3, 5))
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
        time.sleep(random_delay(1, 2))
        element.click()
    except ElementClickInterceptedException:
        logger.info("通常クリックが要素被りで失敗したため、JSクリックを試します。")
        driver.execute_script("arguments[0].click();", element)


def paste_text(driver, element, text):
    """テキストを貼り付ける"""
    pyperclip.copy(text)
    if sys.platform.startswith('darwin'):
        paste_keys = (Keys.COMMAND, 'v')
    else:
        paste_keys = (Keys.CONTROL, 'v')
    element.send_keys(*paste_keys)


def post_to_twitter(post_text: str) -> Dict[str, Any]:
    """
    X（旧Twitter）に投稿する
    
    Args:
        post_text: 投稿するテキスト
        
    Returns:
        Dict[str, Any]: 投稿結果
    """
    driver = None
    try:
        driver = create_robust_driver()
        
        cookie_loaded = load_cookies(driver, X_COOKIE_PATH, X_BASE_URL)
        
        if not cookie_loaded or not is_logged_in(driver):
            raise Exception("ログインに失敗しました")
        
        driver.get(X_BASE_URL + "/home")
        time.sleep(random_delay(2, 4))
        
        try:
            tweet_button = driver.find_element(By.CSS_SELECTOR, "a[data-testid='SideNav_NewTweet_Button']")
            click_element(driver, tweet_button)
        except NoSuchElementException:
            try:
                tweet_button = driver.find_element(By.CSS_SELECTOR, "a[href='/compose/tweet']")
                click_element(driver, tweet_button)
            except NoSuchElementException:
                raise Exception("ツイート投稿ボタンが見つかりませんでした")
        
        time.sleep(random_delay(2, 3))
        
        try:
            tweet_box = driver.find_element(By.CSS_SELECTOR, "div[data-testid='tweetTextarea_0']")
        except NoSuchElementException:
            raise Exception("ツイート入力欄が見つかりませんでした")
        
        click_element(driver, tweet_box)
        time.sleep(random_delay(1, 2))
        
        final_text = f"{post_text}\n{get_random_emojis(2)}"
        paste_text(driver, tweet_box, final_text)
        time.sleep(random_delay(1, 2))
        
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
                raise Exception("投稿ボタンが見つかりませんでした")
        
        click_element(driver, post_button)
        time.sleep(random_delay(3, 5))
        
        try:
            success_element = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.XPATH, "//span[contains(text(), 'ツイートを送信しました')]"))
            )
            logger.info("ツイートを投稿しました")
            
            tweet_url = f"{X_BASE_URL}/status/dummy_id"
            logger.info(f"ツイートURL: {tweet_url}")
            
            return {
                "success": True,
                "tweet_id": "dummy_id",
                "tweet_url": tweet_url
            }
        except TimeoutException:
            raise Exception("ツイート投稿の確認ができませんでした")

    except Exception as e:
        logger.error(f"ツイート投稿中にエラーが発生しました: {e}")
        return {"success": False, "error": str(e)}
    
    finally:
        if driver:
            driver.quit()


def test_niijima_post():
    """niijimaアカウントでメンエス出稼ぎについてのツイートをテスト"""
    try:
        ensure_utf8_encoding()
        
        test_tweet = "【メンエス出稼ぎ募集】✨ 都内高級店で日給3.5万円保証！未経験大歓迎、即日勤務OK！交通費全額支給、寮完備で地方からの出稼ぎも安心♪ 応募はDMまで！ #メンエス出稼ぎ #高収入 #日払い"
        
        logger.info(f"テストツイート: {test_tweet}")
        
        if not os.path.exists(X_COOKIE_PATH):
            logger.error(f"クッキーファイルが見つかりません: {X_COOKIE_PATH}")
            return 1
        
        logger.info(f"クッキーファイルを使用します: {X_COOKIE_PATH}")
        
        result = post_to_twitter(test_tweet)
        
        if result["success"]:
            logger.info(f"テスト投稿が成功しました: {result.get('tweet_url', 'URL不明')}")
            return 0
        else:
            logger.error(f"テスト投稿が失敗しました: {result.get('error', '不明なエラー')}")
            return 1
    
    except Exception as e:
        logger.error(f"テスト中にエラーが発生しました: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(test_niijima_post())
