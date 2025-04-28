"""
Retry utilities for robust browser interactions
"""
import time
import random
import logging
import sys
import functools
from typing import Any, Callable, Optional, Union, TypeVar, cast
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    TimeoutException, 
    NoSuchElementException, 
    ElementClickInterceptedException,
    StaleElementReferenceException
)

logger = logging.getLogger(__name__)

T = TypeVar('T')
F = TypeVar('F', bound=Callable[..., Any])

def retry(max_tries: int = 3, delay: float = 2.0, jitter: float = 1.0, 
         exceptions: tuple = (Exception,), logger: Optional[logging.Logger] = None) -> Callable[[F], F]:
    """
    リトライデコレータ - 指定された例外が発生した場合に関数を再実行する
    
    Args:
        max_tries: 最大試行回数
        delay: 試行間の基本遅延（秒）
        jitter: 遅延に追加するランダムな揺らぎの最大値（秒）
        exceptions: キャッチする例外のタプル
        logger: ロガーインスタンス（Noneの場合はモジュールロガーを使用）
        
    Returns:
        Callable: デコレータ関数
    
    Example:
        @retry(max_tries=3, delay=2, jitter=1)
        def function_that_might_fail():
            pass
    """
    if logger is None:
        logger = logging.getLogger(__name__)
    
    def decorator(func: F) -> F:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            last_exception = None
            
            for attempt in range(max_tries):
                try:
                    return func(*args, **kwargs)
                
                except exceptions as e:
                    last_exception = e
                    wait_time = delay + random.uniform(0, jitter)
                    
                    if attempt < max_tries - 1:
                        logger.warning(
                            f"{func.__name__} failed on attempt {attempt+1}/{max_tries} with error: {e}. "
                            f"Retrying in {wait_time:.2f} seconds..."
                        )
                        time.sleep(wait_time)
                    else:
                        logger.error(
                            f"{func.__name__} failed on final attempt {max_tries}/{max_tries} with error: {e}. "
                            f"Giving up."
                        )
            
            if last_exception:
                raise last_exception
            
            return cast(Any, None)
        
        return cast(F, wrapper)
    
    return decorator

def random_delay(min_sec=1.0, max_sec=3.0):
    """ランダムな待機時間を返す（秒）"""
    return random.uniform(min_sec, max_sec)

def click_element_robust(driver: WebDriver, element: WebElement, logger: Optional[logging.Logger] = None, tries: int = 3) -> bool:
    """
    要素をクリックする（通常クリックが失敗した場合はJSクリックを試行）
    
    Args:
        driver: WebDriverインスタンス
        element: クリックする要素
        logger: ロガーインスタンス（Noneの場合はモジュールロガーを使用）
        tries: 試行回数
        
    Returns:
        bool: 成功したかどうか
    """
    if logger is None:
        logger = logging.getLogger(__name__)
    
    for attempt in range(tries):
        try:
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
            time.sleep(random_delay(0.5, 1.0))
            element.click()
            return True
        except ElementClickInterceptedException:
            logger.info(f"通常クリックが要素被りで失敗したため、JSクリックを試します。（試行 {attempt+1}/{tries}）")
            try:
                driver.execute_script("arguments[0].click();", element)
                return True
            except Exception as e:
                logger.warning(f"JSクリックも失敗しました: {e}")
        except StaleElementReferenceException:
            logger.warning(f"要素が古くなりました。再取得が必要です。（試行 {attempt+1}/{tries}）")
            return False
        except Exception as e:
            logger.warning(f"クリック中にエラーが発生しました: {e} （試行 {attempt+1}/{tries}）")
        
        if attempt < tries - 1:
            time.sleep(random_delay(1.0, 2.0))
    
    return False

def find_element_robust(driver: WebDriver, by: By, value: str, logger: Optional[logging.Logger] = None, 
                        timeout: int = 10, tries: int = 3) -> Optional[WebElement]:
    """
    要素を堅牢に検索する
    
    Args:
        driver: WebDriverインスタンス
        by: 検索方法（By.ID, By.CSS_SELECTOR など）
        value: 検索値
        logger: ロガーインスタンス（Noneの場合はモジュールロガーを使用）
        timeout: 各試行のタイムアウト（秒）
        tries: 試行回数
        
    Returns:
        Optional[WebElement]: 見つかった要素、見つからなかった場合はNone
    """
    if logger is None:
        logger = logging.getLogger(__name__)
    
    for attempt in range(tries):
        try:
            element = WebDriverWait(driver, timeout).until(
                EC.presence_of_element_located((by, value))
            )
            return element
        except (TimeoutException, NoSuchElementException) as e:
            logger.warning(f"要素が見つかりませんでした: {by}={value} （試行 {attempt+1}/{tries}）: {e}")
        except Exception as e:
            logger.warning(f"要素検索中にエラーが発生しました: {e} （試行 {attempt+1}/{tries}）")
        
        if attempt < tries - 1:
            time.sleep(random_delay(1.0, 2.0))
    
    return None

def find_clickable_element_robust(driver: WebDriver, by: By, value: str, logger: Optional[logging.Logger] = None, 
                                 timeout: int = 10, tries: int = 3) -> Optional[WebElement]:
    """
    クリック可能な要素を堅牢に検索する
    
    Args:
        driver: WebDriverインスタンス
        by: 検索方法（By.ID, By.CSS_SELECTOR など）
        value: 検索値
        logger: ロガーインスタンス（Noneの場合はモジュールロガーを使用）
        timeout: 各試行のタイムアウト（秒）
        tries: 試行回数
        
    Returns:
        Optional[WebElement]: 見つかった要素、見つからなかった場合はNone
    """
    if logger is None:
        logger = logging.getLogger(__name__)
    
    for attempt in range(tries):
        try:
            element = WebDriverWait(driver, timeout).until(
                EC.element_to_be_clickable((by, value))
            )
            return element
        except (TimeoutException, NoSuchElementException) as e:
            logger.warning(f"クリック可能な要素が見つかりませんでした: {by}={value} （試行 {attempt+1}/{tries}）: {e}")
        except Exception as e:
            logger.warning(f"要素検索中にエラーが発生しました: {e} （試行 {attempt+1}/{tries}）")
        
        if attempt < tries - 1:
            time.sleep(random_delay(1.0, 2.0))
    
    return None

def type_text_robust(driver: WebDriver, element: WebElement, text: str, logger: Optional[logging.Logger] = None, 
                    use_cdp: bool = True, use_clipboard: bool = True, tries: int = 3) -> bool:
    """
    テキストを堅牢に入力する（CDP → クリップボード → 文字ごと）
    
    Args:
        driver: WebDriverインスタンス
        element: テキストを入力する要素
        text: 入力するテキスト
        logger: ロガーインスタンス（Noneの場合はモジュールロガーを使用）
        use_cdp: CDPを使用するかどうか
        use_clipboard: クリップボードを使用するかどうか
        tries: 試行回数
        
    Returns:
        bool: 成功したかどうか
    """
    if logger is None:
        logger = logging.getLogger(__name__)
    
    element.click()
    time.sleep(0.2)
    
    if use_cdp:
        try:
            driver.execute_cdp_cmd("Input.insertText", {"text": text})
            time.sleep(0.3)
            if element.text.strip():  # Success check
                logger.info("Text entered using CDP insertText")
                return True
        except Exception as e:
            logger.warning(f"CDP insert failed: {e}")
    
    if use_clipboard:
        try:
            import pyperclip
            pyperclip.copy(text)
            from selenium.webdriver.common.keys import Keys
            if sys.platform.startswith("darwin"):
                element.send_keys(Keys.COMMAND, "v")
            else:
                element.send_keys(Keys.CONTROL, "v")
            time.sleep(0.3)
            if element.text.strip():
                logger.info("Text entered using clipboard paste")
                return True
        except Exception as e:
            logger.warning(f"Paste fallback failed: {e}")
    
    try:
        for ch in text:
            element.send_keys(ch)
            time.sleep(random.uniform(0.02, 0.05))
        logger.info("Text entered using character-by-character send_keys")
        return True
    except Exception as e:
        logger.error(f"send_keys fallback failed: {e}")
        return False

def wait_for_upload_robust(driver: WebDriver, selector: str, logger: Optional[logging.Logger] = None, 
                          timeout: int = 120, tries: int = 3) -> bool:
    """
    アップロード完了を堅牢に待機する
    
    Args:
        driver: WebDriverインスタンス
        selector: 完了を示す要素のCSSセレクタ
        logger: ロガーインスタンス（Noneの場合はモジュールロガーを使用）
        timeout: タイムアウト（秒）
        tries: 試行回数
        
    Returns:
        bool: 成功したかどうか
    """
    if logger is None:
        logger = logging.getLogger(__name__)
    
    for attempt in range(tries):
        try:
            WebDriverWait(driver, timeout).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, selector))
            )
            logger.info(f"Upload completed successfully (attempt {attempt+1}/{tries})")
            return True
        except TimeoutException:
            logger.warning(f"Timed out waiting for upload to complete (attempt {attempt+1}/{tries})")
        except Exception as e:
            logger.warning(f"Error waiting for upload: {e} (attempt {attempt+1}/{tries})")
        
        if attempt < tries - 1:
            time.sleep(random_delay(2.0, 5.0))
    
    return False

def find_element_by_multiple_selectors(driver: WebDriver, selectors: list, by: By = By.CSS_SELECTOR, 
                                      logger: Optional[logging.Logger] = None, timeout: int = 10) -> Optional[WebElement]:
    """
    複数のセレクタから要素を検索する
    
    Args:
        driver: WebDriverインスタンス
        selectors: セレクタのリスト
        by: 検索方法（デフォルトはBy.CSS_SELECTOR）
        logger: ロガーインスタンス（Noneの場合はモジュールロガーを使用）
        timeout: タイムアウト（秒）
        
    Returns:
        Optional[WebElement]: 見つかった要素、見つからなかった場合はNone
    """
    if logger is None:
        logger = logging.getLogger(__name__)
    
    for selector in selectors:
        try:
            element = WebDriverWait(driver, timeout).until(
                EC.element_to_be_clickable((by, selector))
            )
            logger.info(f"Found element with selector: {selector}")
            return element
        except Exception:
            continue
    
    logger.warning(f"Could not find element with any of the provided selectors: {selectors}")
    return None
