#!/usr/bin/env python3
"""
姫デコ (HimeDeco) スクレイパー
写メ日記プラットフォームから日記投稿に必要な情報をスクレイピング
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import random
import sys
import time
import yaml
from pathlib import Path
from typing import Dict, List, Optional
from dotenv import load_dotenv

import undetected_chromedriver as uc
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from selenium.webdriver.common.action_chains import ActionChains

# ──────────────────── 環境設定 & ログ ────────────────────
load_dotenv()
ROOT = Path(__file__).resolve().parent
CONFIG_YAML = ROOT / "accounts.yaml"
BASE_PROFILEDIR = ROOT / "profiles"
BASE_COOKIEDIR = ROOT / "cookies"
BASE_PROFILEDIR.mkdir(exist_ok=True)
BASE_COOKIEDIR.mkdir(exist_ok=True)

# 姫デコ固有の設定
HIMEDECO_URL = os.getenv("HIMEDECO_URL", "https://spgirl.cityheaven.net/")
HIMEDECO_LOGIN_URL = os.getenv("HIMEDECO_LOGIN_URL", "http://spgirl.cityheaven.net/login/")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s | %(message)s",
    handlers=[
        logging.FileHandler("himedeco_bot.log", "a", "utf-8"),
        logging.StreamHandler(sys.stdout)
    ],
)
logger = logging.getLogger("himedeco")

# ──────────────────── ユーティリティ関数 ────────────────────

def random_delay(min_sec: float = 1.0, max_sec: float = 3.0):
    """ランダムな待機時間"""
    time.sleep(random.uniform(min_sec, max_sec))

def load_config() -> dict:
    """設定ファイルの読み込み"""
    if CONFIG_YAML.exists():
        return yaml.safe_load(CONFIG_YAML.read_text())
    return {"accounts": []}

def safe_click(driver, element, max_retries: int = 5, wait: float = 0.6) -> bool:
    """
    要素を安全にクリックする（リトライ機能付き）
    """
    for attempt in range(max_retries):
        try:
            driver.execute_script("arguments[0].scrollIntoView({block:'center'});", element)
            driver.execute_script("arguments[0].click();", element)
            logger.info(f"クリック成功 (試行 {attempt + 1})")
            return True
        except Exception as e:
            logger.warning(f"クリック失敗 (試行 {attempt + 1}): {e}")
            time.sleep(wait)
    return False

# ──────────────────── ドライバー生成 ────────────────────

def create_driver(account_name: str):
    """
    アカウント設定に基づいてSeleniumドライバーを生成
    """
    config = load_config()
    account_config = None
    
    # アカウント設定を検索
    for acc in config.get("accounts", []):
        if acc.get("screen_name") == account_name:
            account_config = acc
            break
    
    if not account_config:
        raise KeyError(f"アカウント '{account_name}' が accounts.yaml に見つかりません")
    
    options = Options()
    options.add_argument(f"--user-agent={account_config.get('user_agent', 'Mozilla/5.0')}")
    options.add_argument("--disable-blink-features=AutomationControlled")
    
    # プロファイルディレクトリ
    profile_dir = BASE_PROFILEDIR / account_name
    options.add_argument(f"--user-data-dir={profile_dir}")
    
    # プロキシ設定（必要な場合）
    if account_config.get("proxy"):
        options.add_argument(f"--proxy-server={account_config['proxy']}")
    
    driver = uc.Chrome(options=options, headless=False, version_main=135)
    driver.implicitly_wait(10)
    
    # クッキーファイルのパス
    cookie_file = BASE_COOKIEDIR / f"{account_name}_himedeco.json"
    
    # 既存のクッキーがあれば読み込む
    if cookie_file.exists():
        driver.get(HIMEDECO_URL)
        cookies = json.loads(cookie_file.read_text())
        for cookie in cookies:
            if cookie.get("expiry") is None:
                cookie.pop("expiry", None)
            try:
                driver.add_cookie(cookie)
            except Exception as e:
                logger.warning(f"クッキー追加エラー: {e}")
        driver.refresh()
        logger.info("保存済みクッキーを読み込みました")
    
    return driver, cookie_file

def save_cookies(driver, cookie_file: Path):
    """クッキーをファイルに保存"""
    cookies = driver.get_cookies()
    cookie_file.write_text(json.dumps(cookies, ensure_ascii=False, indent=2))
    logger.info(f"クッキーを保存しました: {cookie_file}")

# ──────────────────── ログイン機能 ────────────────────

def login(driver, username: str, password: str) -> bool:
    """
    姫デコにログイン
    """
    try:
        driver.get(HIMEDECO_LOGIN_URL)
        random_delay(2, 4)
        
        # ログインフォームの要素を探す
        # 注意: 実際のサイトの構造に合わせて調整が必要
        username_field = WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.NAME, "username"))  # または適切なセレクタ
        )
        username_field.clear()
        username_field.send_keys(username)
        
        password_field = driver.find_element(By.NAME, "password")  # または適切なセレクタ
        password_field.clear()
        password_field.send_keys(password)
        
        # ログインボタンをクリック
        login_button = driver.find_element(By.XPATH, "//button[@type='submit']")  # または適切なセレクタ
        safe_click(driver, login_button)
        
        # ログイン成功の確認（ページ遷移やダッシュボード要素の確認）
        random_delay(3, 5)
        
        # ログイン成功の判定（サイト固有の要素で確認）
        try:
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.XPATH, "//a[contains(@href, 'diary')]"))  # 日記関連のリンク
            )
            logger.info("ログイン成功")
            return True
        except TimeoutException:
            logger.error("ログイン失敗: ダッシュボードが表示されませんでした")
            return False
            
    except Exception as e:
        logger.error(f"ログイン中にエラーが発生: {e}")
        return False

# ──────────────────── 日記投稿情報の取得 ────────────────────

def get_diary_form_info(driver) -> Dict[str, any]:
    """
    日記投稿フォームの情報を取得
    """
    diary_info = {
        "form_fields": [],
        "categories": [],
        "upload_limits": {},
        "character_limits": {}
    }
    
    try:
        # 日記投稿ページへ移動
        driver.get(f"{HIMEDECO_URL}diary/write")  # URLは実際のサイトに合わせて調整
        random_delay(2, 4)
        
        # フォームフィールドの取得
        try:
            # タイトル入力欄
            title_field = driver.find_element(By.NAME, "title")  # または適切なセレクタ
            diary_info["form_fields"].append({
                "name": "title",
                "type": "text",
                "required": title_field.get_attribute("required") is not None
            })
            
            # 本文入力欄
            content_field = driver.find_element(By.NAME, "content")  # または適切なセレクタ
            diary_info["form_fields"].append({
                "name": "content",
                "type": "textarea",
                "required": content_field.get_attribute("required") is not None
            })
            
            # カテゴリ選択
            category_elements = driver.find_elements(By.CSS_SELECTOR, "select[name='category'] option")
            diary_info["categories"] = [elem.text for elem in category_elements if elem.text]
            
            # 画像アップロード制限の確認
            upload_info = driver.find_element(By.XPATH, "//div[contains(text(), '画像')]")
            diary_info["upload_limits"]["max_images"] = 3  # サイトの仕様に合わせて調整
            diary_info["upload_limits"]["max_size_mb"] = 5  # サイトの仕様に合わせて調整
            
            # 文字数制限の確認
            diary_info["character_limits"]["title"] = 50  # サイトの仕様に合わせて調整
            diary_info["character_limits"]["content"] = 2000  # サイトの仕様に合わせて調整
            
        except NoSuchElementException as e:
            logger.warning(f"一部のフォーム要素が見つかりませんでした: {e}")
            
        logger.info(f"日記フォーム情報を取得しました: {diary_info}")
        return diary_info
        
    except Exception as e:
        logger.error(f"日記フォーム情報の取得中にエラー: {e}")
        return diary_info

def post_diary(driver, title: str, content: str, category: Optional[str] = None, images: Optional[List[str]] = None) -> bool:
    """
    日記を投稿する
    """
    try:
        # 日記投稿ページへ移動
        driver.get(f"{HIMEDECO_URL}diary/write")
        random_delay(2, 4)
        
        # タイトル入力
        title_field = WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.NAME, "title"))
        )
        title_field.clear()
        title_field.send_keys(title)
        
        # 本文入力
        content_field = driver.find_element(By.NAME, "content")
        content_field.clear()
        content_field.send_keys(content)
        
        # カテゴリ選択（オプション）
        if category:
            try:
                category_select = driver.find_element(By.NAME, "category")
                category_select.click()
                category_option = driver.find_element(By.XPATH, f"//option[text()='{category}']")
                category_option.click()
            except NoSuchElementException:
                logger.warning(f"カテゴリ '{category}' が見つかりませんでした")
        
        # 画像アップロード（オプション）
        if images:
            for i, image_path in enumerate(images[:3]):  # 最大3枚まで
                if os.path.exists(image_path):
                    try:
                        file_input = driver.find_element(By.CSS_SELECTOR, f"input[type='file'][name='image{i+1}']")
                        file_input.send_keys(os.path.abspath(image_path))
                        random_delay(1, 2)
                    except NoSuchElementException:
                        logger.warning(f"画像アップロードフィールド {i+1} が見つかりませんでした")
        
        # 投稿ボタンをクリック
        submit_button = driver.find_element(By.XPATH, "//button[@type='submit'][contains(text(), '投稿')]")
        safe_click(driver, submit_button)
        
        # 投稿成功の確認
        random_delay(3, 5)
        try:
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.XPATH, "//div[contains(text(), '投稿が完了しました')]"))
            )
            logger.info("日記の投稿に成功しました")
            return True
        except TimeoutException:
            logger.error("日記の投稿に失敗した可能性があります")
            return False
            
    except Exception as e:
        logger.error(f"日記投稿中にエラー: {e}")
        return False

# ──────────────────── メイン処理 ────────────────────

def main():
    parser = argparse.ArgumentParser(description="姫デコスクレイパー")
    parser.add_argument("--account", required=True, help="アカウント名 (accounts.yaml内の screen_name)")
    parser.add_argument("--username", help="ログインユーザー名")
    parser.add_argument("--password", help="ログインパスワード")
    parser.add_argument("--mode", choices=["login", "scrape", "post"], default="scrape", 
                       help="実行モード: login=ログインのみ, scrape=情報取得, post=日記投稿")
    parser.add_argument("--title", help="日記のタイトル (postモード用)")
    parser.add_argument("--content", help="日記の本文 (postモード用)")
    parser.add_argument("--category", help="日記のカテゴリ (postモード用)")
    parser.add_argument("--images", nargs="+", help="アップロードする画像パス (postモード用)")
    
    args = parser.parse_args()
    
    driver = None
    try:
        # ドライバー作成
        driver, cookie_file = create_driver(args.account)
        
        # ログインモード
        if args.mode == "login":
            if not args.username or not args.password:
                logger.error("ログインにはユーザー名とパスワードが必要です")
                return
            
            if login(driver, args.username, args.password):
                save_cookies(driver, cookie_file)
                logger.info("ログインに成功し、クッキーを保存しました")
            else:
                logger.error("ログインに失敗しました")
        
        # 情報取得モード
        elif args.mode == "scrape":
            diary_info = get_diary_form_info(driver)
            print(json.dumps(diary_info, ensure_ascii=False, indent=2))
        
        # 投稿モード
        elif args.mode == "post":
            if not args.title or not args.content:
                logger.error("投稿にはタイトルと本文が必要です")
                return
            
            success = post_diary(driver, args.title, args.content, args.category, args.images)
            if success:
                logger.info("日記の投稿が完了しました")
            else:
                logger.error("日記の投稿に失敗しました")
        
        # 終了前に少し待機
        random_delay(2, 4)
        
    except Exception as e:
        logger.error(f"実行中にエラーが発生: {e}")
        
    finally:
        if driver:
            driver.quit()
            logger.info("ブラウザを終了しました")

if __name__ == "__main__":
    main()