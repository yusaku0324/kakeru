"""
WebDriver factory for X (Twitter) automation
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
from typing import Dict, List, Optional, Any

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

logger = logging.getLogger(__name__)

def ensure_utf8_encoding(logger: Optional[logging.Logger] = None) -> bool:
    """
    標準出力のエンコーディングをUTF-8に設定する
    
    Args:
        logger: ロガーインスタンス（Noneの場合はモジュールロガーを使用）
        
    Returns:
        bool: 設定に成功したかどうか
    """
    if logger is None:
        logger = logging.getLogger(__name__)
    
    try:
        import io
        if hasattr(sys.stdout, 'encoding') and sys.stdout.encoding.lower() != 'utf-8':
            sys.stdout = io.TextIOWrapper(
                sys.stdout.buffer, encoding='utf-8', line_buffering=True
            )
            logger.info(f"stdoutのエンコーディングをutf-8に変更しました")
        return True
    except Exception as e:
        logger.error(f"stdoutのエンコーディング変更中にエラーが発生しました: {e}")
        return False

def create_chrome_options(headless: bool = False, user_data_dir: Optional[str] = None) -> Options:
    """
    Chrome WebDriverのオプションを作成する
    
    Args:
        headless: ヘッドレスモードを使用するかどうか
        user_data_dir: ユーザーデータディレクトリのパス
        
    Returns:
        Options: Chrome WebDriverのオプション
    """
    options = Options()
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    
    if headless:
        options.add_argument("--headless=new")
    
    if user_data_dir:
        options.add_argument(f"--user-data-dir={user_data_dir}")
    
    return options

def create_temp_profile_dir() -> str:
    """
    一時的なChromeプロファイルディレクトリを作成する
    
    Returns:
        str: 作成されたディレクトリのパス
    """
    random_suffix = f"{uuid.uuid4().hex}_{random.randint(10000, 99999)}"
    temp_dir = os.path.join(tempfile.gettempdir(), f"chrome_profile_{random_suffix}")
    
    if os.path.exists(temp_dir):
        try:
            shutil.rmtree(temp_dir)
            logger.info(f"既存のディレクトリを削除しました: {temp_dir}")
        except Exception as e:
            logger.warning(f"ディレクトリ {temp_dir} の削除中にエラーが発生しました: {e}")
    
    os.makedirs(temp_dir, exist_ok=True)
    logger.info(f"新しいChromeプロファイルディレクトリを作成しました: {temp_dir}")
    
    return temp_dir

def fix_cookie(cookie: Dict[str, Any]) -> Dict[str, Any]:
    """
    Cookieを修正する（secure=True, sameSite='None'）
    
    Args:
        cookie: 修正するCookie
        
    Returns:
        Dict[str, Any]: 修正されたCookie
    """
    if 'name' not in cookie or 'value' not in cookie:
        return cookie
    
    same_site = cookie.get('sameSite', 'None')
    secure = True if same_site == 'None' else cookie.get('secure', False)
    
    cookie_dict = {
        'name': cookie['name'],
        'value': cookie['value'],
        'domain': cookie.get('domain', '.x.com'),
        'path': cookie.get('path', '/'),
        'secure': secure,  # sameSite='None'の場合はsecure=Trueを強制
        'httpOnly': cookie.get('httpOnly', False),
        'sameSite': same_site  # 元のsameSite値を保持
    }
    
    if 'expiry' in cookie:
        cookie_dict['expiry'] = cookie['expiry']
    
    return cookie_dict

def load_cookies_from_json(file_path: str, logger: Optional[logging.Logger] = None) -> List[Dict[str, Any]]:
    """
    JSONファイルからCookieを読み込む
    
    Args:
        file_path: JSONファイルのパス
        logger: ロガーインスタンス（Noneの場合はモジュールロガーを使用）
        
    Returns:
        List[Dict[str, Any]]: Cookieのリスト
    """
    if logger is None:
        logger = logging.getLogger(__name__)
    
    try:
        if not os.path.exists(file_path):
            logger.error(f"Cookieファイルが見つかりません: {file_path}")
            return []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            cookies = json.load(f)
        
        if not isinstance(cookies, list):
            logger.error(f"無効なCookie形式: {file_path}")
            return []
        
        logger.info(f"{len(cookies)}個のCookieを読み込みました: {file_path}")
        return cookies
    
    except Exception as e:
        logger.error(f"Cookieの読み込み中にエラーが発生しました: {e}")
        return []

def load_cookies_from_env(env_var: str, logger: Optional[logging.Logger] = None) -> List[Dict[str, Any]]:
    """
    環境変数からCookieを読み込む
    
    Args:
        env_var: 環境変数名
        logger: ロガーインスタンス（Noneの場合はモジュールロガーを使用）
        
    Returns:
        List[Dict[str, Any]]: Cookieのリスト
    """
    if logger is None:
        logger = logging.getLogger(__name__)
    
    try:
        cookie_json = os.getenv(env_var)
        if not cookie_json:
            logger.warning(f"環境変数 {env_var} が見つかりません")
            return []
        
        cookies = json.loads(cookie_json)
        
        if not isinstance(cookies, list):
            logger.error(f"環境変数 {env_var} に無効なCookie形式が含まれています")
            return []
        
        logger.info(f"環境変数から{len(cookies)}個のCookieを読み込みました")
        return cookies
    
    except Exception as e:
        logger.error(f"環境変数からのCookie読み込み中にエラーが発生しました: {e}")
        return []

def apply_cookies(driver: webdriver.Chrome, cookies: List[Dict[str, Any]], 
                 logger: Optional[logging.Logger] = None) -> bool:
    """
    WebDriverにCookieを適用する
    
    Args:
        driver: WebDriverインスタンス
        cookies: 適用するCookieのリスト
        logger: ロガーインスタンス（Noneの場合はモジュールロガーを使用）
        
    Returns:
        bool: 成功したかどうか
    """
    if logger is None:
        logger = logging.getLogger(__name__)
    
    try:
        success_count = 0
        
        for cookie in cookies:
            if 'name' in cookie and 'value' in cookie:
                try:
                    cookie_dict = fix_cookie(cookie)
                    driver.add_cookie(cookie_dict)
                    success_count += 1
                except Exception as e:
                    logger.warning(f"Cookie {cookie.get('name')} の設定中にエラーが発生しました: {e}")
        
        logger.info(f"{success_count}/{len(cookies)}個のCookieを正常に適用しました")
        return success_count > 0
    
    except Exception as e:
        logger.error(f"Cookieの適用中にエラーが発生しました: {e}")
        return False

def setup_webdriver(cookie_path: Optional[str] = None, cookie_env: Optional[str] = None, 
                   headless: bool = False, logger: Optional[logging.Logger] = None) -> Optional[webdriver.Chrome]:
    """
    X用のChrome WebDriverをセットアップする
    
    Args:
        cookie_path: Cookieファイルのパス
        cookie_env: Cookie環境変数名
        headless: ヘッドレスモードを使用するかどうか
        logger: ロガーインスタンス（Noneの場合はモジュールロガーを使用）
        
    Returns:
        Optional[webdriver.Chrome]: WebDriverインスタンス、失敗した場合はNone
    """
    if logger is None:
        logger = logging.getLogger(__name__)
    
    try:
        ensure_utf8_encoding(logger)
        
        temp_dir = create_temp_profile_dir()
        
        options = create_chrome_options(headless, temp_dir)
        
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        driver.implicitly_wait(10)
        
        driver.get("https://x.com")
        time.sleep(2)
        
        cookies = []
        
        if cookie_path:
            cookies = load_cookies_from_json(cookie_path, logger)
        
        if not cookies and cookie_env:
            cookies = load_cookies_from_env(cookie_env, logger)
        
        if not cookies:
            logger.warning("Cookieが見つかりません")
        
        if cookies:
            apply_cookies(driver, cookies, logger)
        
        driver.refresh()
        time.sleep(3)
        driver.get("https://x.com/home")
        time.sleep(3)
        
        return driver
    
    except Exception as e:
        logger.error(f"WebDriverのセットアップ中にエラーが発生しました: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return None
