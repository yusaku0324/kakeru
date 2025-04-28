"""
リトライユーティリティモジュール

このモジュールは、関数やメソッドに対して自動的なリトライ機能を提供するデコレータを含みます。
ネットワークリクエストやブラウザ操作など、一時的な障害が発生する可能性のある操作に対して使用します。
"""
import time
import random
import logging
import functools
import pyperclip
from typing import Any, Callable, Optional, Type, Union, List, Tuple

logger = logging.getLogger(__name__)

def retry(
    max_attempts: int = 3,
    delay: float = 1.0,
    backoff_factor: float = 2.0,
    exceptions: Union[Type[Exception], Tuple[Type[Exception], ...]] = Exception,
    on_retry: Optional[Callable[[Exception, int], None]] = None,
    jitter: bool = False,
    jitter_factor: float = 0.1,
) -> Callable:
    """
    指定された例外が発生した場合に関数を再試行するデコレータ

    Args:
        max_attempts: 最大試行回数（デフォルト: 3）
        delay: 初期遅延時間（秒）（デフォルト: 1.0）
        backoff_factor: バックオフ係数（デフォルト: 2.0）
        exceptions: キャッチする例外クラスまたは例外クラスのタプル（デフォルト: Exception）
        on_retry: リトライ時に呼び出されるコールバック関数（デフォルト: None）
        jitter: ランダムなジッター（揺らぎ）を追加するかどうか（デフォルト: False）
        jitter_factor: ジッターの最大係数（デフォルト: 0.1）

    Returns:
        Callable: デコレートされた関数

    Example:
        @retry(max_attempts=5, delay=1.0, backoff_factor=2.0, exceptions=(ConnectionError, TimeoutError))
        def fetch_data(url):
            return requests.get(url)
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            attempt = 1
            current_delay = delay

            while attempt <= max_attempts:
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    if attempt == max_attempts:
                        logger.error(
                            f"最大試行回数（{max_attempts}回）に達しました。最後のエラー: {e}"
                        )
                        raise

                    if on_retry:
                        on_retry(e, attempt)

                    wait_time = current_delay
                    if jitter:
                        jitter_range = wait_time * jitter_factor
                        wait_time += random.uniform(-jitter_range, jitter_range)

                    logger.warning(
                        f"試行 {attempt}/{max_attempts} が失敗しました: {e}. "
                        f"{wait_time:.2f}秒後に再試行します。"
                    )

                    time.sleep(wait_time)
                    current_delay *= backoff_factor
                    attempt += 1

        return wrapper
    return decorator

def click_element_robust(
    driver, element, max_attempts: int = 3, delay: float = 1.0
) -> bool:
    """
    要素をクリックする堅牢な関数

    Args:
        driver: WebDriverインスタンス
        element: クリックする要素
        max_attempts: 最大試行回数（デフォルト: 3）
        delay: リトライ間の遅延時間（秒）（デフォルト: 1.0）

    Returns:
        bool: 成功したかどうか
    """
    @retry(max_attempts=max_attempts, delay=delay)
    def _click():
        try:
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
            driver.execute_script("arguments[0].click();", element)
            return True
        except Exception as e:
            logger.warning(f"JavaScriptクリックに失敗しました: {e}")
            
            try:
                element.click()
                return True
            except Exception as e:
                logger.warning(f"通常のクリックに失敗しました: {e}")
                raise

    try:
        return _click()
    except Exception as e:
        logger.error(f"要素のクリックに失敗しました: {e}")
        return False

def find_element_robust(
    driver, by, value, max_attempts: int = 3, delay: float = 1.0
) -> Optional[Any]:
    """
    要素を堅牢に検索する関数

    Args:
        driver: WebDriverインスタンス
        by: 検索方法（例: By.ID, By.XPATH）
        value: 検索値
        max_attempts: 最大試行回数（デフォルト: 3）
        delay: リトライ間の遅延時間（秒）（デフォルト: 1.0）

    Returns:
        Optional[Any]: 見つかった要素、見つからない場合はNone
    """
    @retry(max_attempts=max_attempts, delay=delay)
    def _find_element():
        return driver.find_element(by, value)

    try:
        return _find_element()
    except Exception as e:
        logger.error(f"要素の検索に失敗しました: {e}")
        return None

def find_clickable_element_robust(
    driver, by, value, max_attempts: int = 3, delay: float = 1.0
) -> Optional[Any]:
    """
    クリック可能な要素を堅牢に検索する関数

    Args:
        driver: WebDriverインスタンス
        by: 検索方法（例: By.ID, By.XPATH）
        value: 検索値
        max_attempts: 最大試行回数（デフォルト: 3）
        delay: リトライ間の遅延時間（秒）（デフォルト: 1.0）

    Returns:
        Optional[Any]: 見つかった要素、見つからない場合はNone
    """
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC

    @retry(max_attempts=max_attempts, delay=delay)
    def _find_clickable_element():
        return WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((by, value))
        )

    try:
        return _find_clickable_element()
    except Exception as e:
        logger.error(f"クリック可能な要素の検索に失敗しました: {e}")
        return None

def wait_for_element_robust(
    driver, by, value, max_attempts: int = 3, delay: float = 1.0, timeout: float = 10.0
) -> Optional[Any]:
    """
    要素が表示されるまで堅牢に待機する関数

    Args:
        driver: WebDriverインスタンス
        by: 検索方法（例: By.ID, By.XPATH）
        value: 検索値
        max_attempts: 最大試行回数（デフォルト: 3）
        delay: リトライ間の遅延時間（秒）（デフォルト: 1.0）
        timeout: 各試行のタイムアウト時間（秒）（デフォルト: 10.0）

    Returns:
        Optional[Any]: 見つかった要素、見つからない場合はNone
    """
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC

    @retry(max_attempts=max_attempts, delay=delay)
    def _wait_for_element():
        return WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located((by, value))
        )

    try:
        return _wait_for_element()
    except Exception as e:
        logger.error(f"要素の待機に失敗しました: {e}")
        return None

def wait_for_upload_robust(
    driver, by, value, max_attempts: int = 3, delay: float = 1.0, timeout: float = 30.0
) -> bool:
    """
    アップロードが完了するまで堅牢に待機する関数

    Args:
        driver: WebDriverインスタンス
        by: 検索方法（例: By.ID, By.XPATH）
        value: 検索値
        max_attempts: 最大試行回数（デフォルト: 3）
        delay: リトライ間の遅延時間（秒）（デフォルト: 1.0）
        timeout: 各試行のタイムアウト時間（秒）（デフォルト: 30.0）

    Returns:
        bool: 成功したかどうか
    """
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC

    @retry(max_attempts=max_attempts, delay=delay)
    def _wait_for_upload():
        WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located((by, value))
        )
        return True

    try:
        return _wait_for_upload()
    except Exception as e:
        logger.error(f"アップロードの待機に失敗しました: {e}")
        return False

def find_element_by_multiple_selectors(
    driver, selectors: List[Tuple], max_attempts: int = 3, delay: float = 1.0
) -> Optional[Any]:
    """
    複数のセレクタを使用して要素を検索する関数

    Args:
        driver: WebDriverインスタンス
        selectors: (by, value)のタプルのリスト
        max_attempts: 最大試行回数（デフォルト: 3）
        delay: リトライ間の遅延時間（秒）（デフォルト: 1.0）

    Returns:
        Optional[Any]: 見つかった要素、見つからない場合はNone
    """
    for by, value in selectors:
        element = find_element_robust(driver, by, value, max_attempts, delay)
        if element:
            return element
    
    logger.error(f"どのセレクタでも要素が見つかりませんでした: {selectors}")
    return None

def type_text_robust(
    driver, element, text: str, logger: Optional[logging.Logger] = None,
    max_attempts: int = 3, delay: float = 1.0
) -> bool:
    """
    テキストを堅牢に入力する関数

    Args:
        driver: WebDriverインスタンス
        element: テキストを入力する要素
        text: 入力するテキスト
        logger: ロガーインスタンス（Noneの場合はモジュールロガーを使用）
        max_attempts: 最大試行回数（デフォルト: 3）
        delay: リトライ間の遅延時間（秒）（デフォルト: 1.0）

    Returns:
        bool: 成功したかどうか
    """
    if logger is None:
        logger = logging.getLogger(__name__)
    
    @retry(max_attempts=max_attempts, delay=delay)
    def _type_text():
        try:
            try:
                driver.execute_script(
                    "arguments[0].value = arguments[1];", element, text
                )
                return True
            except Exception as e:
                logger.warning(f"JavaScriptによるテキスト入力に失敗しました: {e}")
            
            try:
                element.clear()
                pyperclip.copy(text)
                element.send_keys(Keys.CONTROL + 'v')  # Windows/Linux
                return True
            except Exception as e:
                logger.warning(f"クリップボードによるテキスト入力に失敗しました: {e}")
            
            element.clear()
            element.send_keys(text)
            return True
        
        except Exception as e:
            logger.warning(f"テキスト入力に失敗しました: {e}")
            raise

    try:
        from selenium.webdriver.common.keys import Keys
        return _type_text()
    except Exception as e:
        logger.error(f"テキスト入力に失敗しました: {e}")
        return False
