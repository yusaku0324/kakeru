"""
バックオフユーティリティモジュール

このモジュールは、関数やメソッドに対して自動的なバックオフ機能を提供するデコレータを含みます。
ネットワークリクエストやAPIコールなど、レート制限がある操作に対して使用します。
"""
import time
import random
import logging
import functools
from typing import Any, Callable, Optional, Type, Union, Tuple

logger = logging.getLogger(__name__)

def with_backoff(
    max_attempts: int = 3,
    base_delay: float = 1.0,
    backoff_factor: float = 2.0,
    exceptions: Union[Type[Exception], Tuple[Type[Exception], ...]] = Exception,
) -> Callable:
    """
    指数バックオフを使用して関数を再試行するデコレータ

    Args:
        max_attempts: 最大試行回数（デフォルト: 3）
        base_delay: 初期遅延時間（秒）（デフォルト: 1.0）
        backoff_factor: バックオフ係数（デフォルト: 2.0）
        exceptions: キャッチする例外クラスまたは例外クラスのタプル（デフォルト: Exception）

    Returns:
        Callable: デコレートされた関数

    Example:
        @with_backoff(max_attempts=5, base_delay=1.0, backoff_factor=2.0)
        def fetch_data(url):
            return requests.get(url)
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            attempt = 1
            current_delay = base_delay

            while attempt <= max_attempts:
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    if attempt == max_attempts:
                        logger.error(
                            f"最大試行回数（{max_attempts}回）に達しました。最後のエラー: {e}"
                        )
                        raise

                    wait_time = current_delay
                    logger.warning(
                        f"試行 {attempt}/{max_attempts} が失敗しました: {e}. "
                        f"{wait_time:.2f}秒後に再試行します。"
                    )

                    time.sleep(wait_time)
                    current_delay *= backoff_factor
                    attempt += 1

        return wrapper
    return decorator

def with_jitter_backoff(
    max_attempts: int = 3,
    min_delay: float = 1.0,
    max_delay: float = 10.0,
    exceptions: Union[Type[Exception], Tuple[Type[Exception], ...]] = Exception,
) -> Callable:
    """
    ジッター（揺らぎ）を含む指数バックオフを使用して関数を再試行するデコレータ

    Args:
        max_attempts: 最大試行回数（デフォルト: 3）
        min_delay: 最小遅延時間（秒）（デフォルト: 1.0）
        max_delay: 最大遅延時間（秒）（デフォルト: 10.0）
        exceptions: キャッチする例外クラスまたは例外クラスのタプル（デフォルト: Exception）

    Returns:
        Callable: デコレートされた関数

    Example:
        @with_jitter_backoff(max_attempts=5, min_delay=1.0, max_delay=30.0)
        def fetch_data(url):
            return requests.get(url)
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            attempt = 1

            while attempt <= max_attempts:
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    if attempt == max_attempts:
                        logger.error(
                            f"最大試行回数（{max_attempts}回）に達しました。最後のエラー: {e}"
                        )
                        raise

                    base_delay = min_delay * (2 ** (attempt - 1))
                    capped_delay = min(base_delay, max_delay)
                    jitter = random.uniform(0, capped_delay)
                    wait_time = capped_delay / 2.0 + jitter / 2.0

                    logger.warning(
                        f"試行 {attempt}/{max_attempts} が失敗しました: {e}. "
                        f"{wait_time:.2f}秒後に再試行します。"
                    )

                    time.sleep(wait_time)
                    attempt += 1

        return wrapper
    return decorator
