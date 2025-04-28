"""
X（旧Twitter）アカウントのクッキー管理スクリプト

このスクリプトは以下の機能を提供します：
1. クッキーファイルの有効期限チェック
2. 期限切れの場合、自動再ログイン
3. GitHub Secretsへのクッキーデータのアップロード
4. accounts.yamlファイルに基づく複数アカウントの管理
"""
import argparse
import base64
import json
import logging
import os
import subprocess
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any

import yaml
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("update_cookies.log", encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger("update_cookies")

load_dotenv()

GH_TOKEN = os.getenv("GH_TOKEN")
if not GH_TOKEN and not os.getenv("CI"):
    logger.warning("GH_TOKENが設定されていません。GitHub Secretsの更新はスキップされます。")

X_BASE_URL = "https://x.com"

ACCOUNTS_YAML = "accounts.yaml"


def load_accounts() -> Dict[str, Dict[str, str]]:
    """
    accounts.yamlからアカウント情報を読み込む
    
    Returns:
        Dict[str, Dict[str, str]]: アカウント情報の辞書
    """
    try:
        with open(ACCOUNTS_YAML, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        
        if not data or "accounts" not in data:
            logger.error(f"{ACCOUNTS_YAML}にaccountsセクションが見つかりません")
            return {}
        
        return data["accounts"]
    except Exception as e:
        logger.error(f"{ACCOUNTS_YAML}の読み込み中にエラーが発生しました: {e}")
        return {}



def check_cookie_expiry(cookie_file: str) -> bool:
    """
    クッキーファイルの有効期限をチェックする
    
    Args:
        cookie_file: クッキーファイルのパス
        
    Returns:
        bool: クッキーが有効な場合はTrue、期限切れの場合はFalse
    """
    try:
        if not os.path.exists(cookie_file):
            logger.warning(f"クッキーファイルが見つかりません: {cookie_file}")
            return False
        
        with open(cookie_file, "r", encoding="utf-8") as f:
            cookies = json.load(f)
        
        now = datetime.now().timestamp()
        
        for cookie in cookies:
            if cookie.get("name") == "auth_token" and "expiry" in cookie:
                expiry = cookie["expiry"]
                if expiry - now < 3 * 24 * 60 * 60:
                    logger.info(f"クッキーの期限切れが近いです: {cookie_file}")
                    return False
                else:
                    days_left = (expiry - now) / (24 * 60 * 60)
                    logger.info(f"クッキーは有効です: {cookie_file} (残り約{days_left:.1f}日)")
                    return True
        
        logger.warning(f"auth_tokenが見つからないか、有効期限が設定されていません: {cookie_file}")
        return False
    
    except Exception as e:
        logger.error(f"クッキーの有効期限チェック中にエラーが発生しました: {e}")
        return False


def create_driver(headless: bool = False) -> webdriver.Chrome:
    """
    Seleniumドライバーを作成する
    
    Args:
        headless: ヘッドレスモードで実行するかどうか
        
    Returns:
        webdriver.Chrome: Chromeドライバー
    """
    options = Options()
    if headless:
        options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1920,1080")
    
    options.add_argument("--start-maximized")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)
    
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    driver.implicitly_wait(10)
    return driver


def login_and_save_cookies(handle: str, cookie_file: str) -> bool:
    """
    X（旧Twitter）にログインしてクッキーを保存する
    
    Args:
        handle: アカウントのハンドル名
        cookie_file: クッキーファイルのパス
        
    Returns:
        bool: ログインと保存に成功した場合はTrue、失敗した場合はFalse
    """
    if os.getenv("CI"):
        logger.error("CI環境では手動ログインができません")
        return False
    
    driver = None
    try:
        driver = create_driver(headless=False)
        
        logger.info(f"{handle}アカウントのログインを開始します")
        driver.get(f"{X_BASE_URL}/i/flow/login")
        time.sleep(3)
        
        input(f"{handle}アカウントにログインしてください。完了したらEnterキーを押してください...")
        
        try:
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "a[data-testid='SideNav_NewTweet_Button']"))
            )
            logger.info(f"{handle}アカウントのログインに成功しました")
        except Exception as e:
            logger.error(f"{handle}アカウントのログイン確認中にエラーが発生しました: {e}")
            return False
        
        cookies = driver.get_cookies()
        os.makedirs(os.path.dirname(os.path.abspath(cookie_file)), exist_ok=True)
        with open(cookie_file, "w", encoding="utf-8") as f:
            json.dump(cookies, f, ensure_ascii=False, indent=2)
        
        logger.info(f"{handle}アカウントのクッキーを保存しました: {cookie_file}")
        return True
    
    except Exception as e:
        logger.error(f"{handle}アカウントのログインと保存中にエラーが発生しました: {e}")
        return False
    
    finally:
        if driver:
            driver.quit()


def encode_cookie_to_base64(cookie_file: str) -> Optional[str]:
    """
    クッキーファイルをBase64エンコードする
    
    Args:
        cookie_file: クッキーファイルのパス
        
    Returns:
        Optional[str]: Base64エンコードされたクッキーデータ、失敗した場合はNone
    """
    try:
        if not os.path.exists(cookie_file):
            logger.error(f"クッキーファイルが見つかりません: {cookie_file}")
            return None
        
        with open(cookie_file, "r", encoding="utf-8") as f:
            cookie_data = f.read()
        
        encoded_data = base64.b64encode(cookie_data.encode("utf-8")).decode("utf-8")
        return encoded_data
    
    except Exception as e:
        logger.error(f"クッキーのBase64エンコード中にエラーが発生しました: {e}")
        return None


def update_github_secret(repo: str, secret_name: str, secret_value: str) -> bool:
    """
    GitHub Secretsを更新する
    
    Args:
        repo: リポジトリ名（owner/repo形式）
        secret_name: シークレット名
        secret_value: シークレット値
        
    Returns:
        bool: 更新に成功した場合はTrue、失敗した場合はFalse
    """
    if not GH_TOKEN and not os.getenv("CI"):
        logger.warning("GH_TOKENが設定されていないため、GitHub Secretsの更新をスキップします")
        return False
    
    try:
        cmd = ["gh", "secret", "set", secret_name, "--body", secret_value, "--repo", repo]
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            logger.info(f"GitHub Secret {secret_name}を更新しました: {repo}")
            return True
        else:
            logger.error(f"GitHub Secret {secret_name}の更新に失敗しました: {result.stderr}")
            return False
    
    except Exception as e:
        logger.error(f"GitHub Secretの更新中にエラーが発生しました: {e}")
        return False


def process_account(account: Dict[str, str], repo: str, validate_only: bool = False) -> bool:
    """
    アカウントの処理を行う
    
    Args:
        account: アカウント情報
        repo: リポジトリ名（owner/repo形式）
        validate_only: 検証のみを行うかどうか
        
    Returns:
        bool: 処理に成功した場合はTrue、失敗した場合はFalse
    """
    handle = account.get("handle")
    cookie_file = account.get("cookie_file")
    cookie_secret = account.get("cookie_secret")
    
    if not handle or not cookie_file or not cookie_secret:
        logger.error(f"アカウント情報が不完全です: {account}")
        return False
    
    logger.info(f"{handle}アカウントの処理を開始します")
    
    is_valid = check_cookie_expiry(cookie_file)
    
    if not is_valid and not validate_only:
        logger.info(f"{handle}アカウントのクッキーが無効です。再ログインを試みます。")
        if not login_and_save_cookies(handle, cookie_file):
            logger.error(f"{handle}アカウントの再ログインに失敗しました")
            return False
    
    if validate_only and not is_valid:
        logger.warning(f"{handle}アカウントのクッキーが無効ですが、検証のみモードのため再ログインをスキップします")
        return False
    
    encoded_cookie = encode_cookie_to_base64(cookie_file)
    if not encoded_cookie:
        logger.error(f"{handle}アカウントのクッキーのエンコードに失敗しました")
        return False
    
    if not update_github_secret(repo, cookie_secret, encoded_cookie):
        logger.error(f"{handle}アカウントのGitHub Secret {cookie_secret}の更新に失敗しました")
        return False
    
    logger.info(f"{handle}アカウントの処理が完了しました")
    return True


def main():
    """メイン関数"""
    parser = argparse.ArgumentParser(description="X（旧Twitter）アカウントのクッキー管理スクリプト")
    parser.add_argument("--repo", type=str, help="リポジトリ名（owner/repo形式）")
    parser.add_argument("--handle", type=str, help="処理するアカウントのハンドル名")
    parser.add_argument("--file", type=str, help="クッキーファイルのパス")
    parser.add_argument("--secret", type=str, help="GitHub Secretの名前")
    parser.add_argument("--all", action="store_true", help="すべてのアカウントを処理する")
    parser.add_argument("--validate", action="store_true", help="クッキーの検証のみを行う")
    
    args = parser.parse_args()
    
    repo = args.repo
    if not repo:
        try:
            cmd = ["git", "config", "--get", "remote.origin.url"]
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode == 0:
                url = result.stdout.strip()
                if "github.com" in url:
                    if url.startswith("https://"):
                        repo = url.split("github.com/")[1].split(".git")[0]
                    elif url.startswith("git@"):
                        repo = url.split("github.com:")[1].split(".git")[0]
            
            if not repo:
                logger.error("リポジトリ名を自動検出できませんでした。--repoオプションで指定してください。")
                return 1
            
            logger.info(f"リポジトリ名を自動検出しました: {repo}")
        
        except Exception as e:
            logger.error(f"リポジトリ名の自動検出中にエラーが発生しました: {e}")
            logger.error("--repoオプションでリポジトリ名を指定してください。")
            return 1
    
    if args.handle and args.file and args.secret:
        account = {
            "handle": args.handle,
            "cookie_file": args.file,
            "cookie_secret": args.secret
        }
        
        if process_account(account, repo, args.validate):
            logger.info(f"{args.handle}アカウントの処理が成功しました")
            return 0
        else:
            logger.error(f"{args.handle}アカウントの処理に失敗しました")
            return 1
    
    elif args.all:
        accounts_dict = load_accounts()
        if not accounts_dict:
            logger.error("アカウントが見つかりませんでした")
            return 1
        
        success_count = 0
        total_accounts = len(accounts_dict)
        
        for handle, account_info in accounts_dict.items():
            account = {
                "handle": handle,
                "cookie_file": f"{handle}_cookies.json",
                "cookie_secret": f"X_{handle.upper()}_COOKIES"
            }
            
            if process_account(account, repo, args.validate):
                success_count += 1
        
        logger.info(f"{total_accounts}アカウント中{success_count}アカウントの処理に成功しました")
        return 0 if success_count == total_accounts else 1
    
    else:
        logger.error("--handle, --file, --secretオプションをすべて指定するか、--allオプションを指定してください")
        return 1


if __name__ == "__main__":
    sys.exit(main())
