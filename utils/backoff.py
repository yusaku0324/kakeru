"""
Backoff utilities for retry logic
"""
import time
import random
import logging
import functools
from typing import Any, Callable, Optional, TypeVar, cast

logger = logging.getLogger(__name__)

T = TypeVar('T')

def with_backoff(max_attempts: int = 3, base_delay: float = 1.0, 
                logger: Optional[logging.Logger] = None) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """
    指数バックオフを使用した再試行デコレータ
    
    Args:
        max_attempts: 最大試行回数
        base_delay: 基本遅延時間（秒）
        logger: ロガーインスタンス（Noneの場合はモジュールロガーを使用）
        
    Returns:
        Callable: デコレータ関数
    """
    if logger is None:
        logger = logging.getLogger(__name__)
    
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> T:
            last_exception = None
            
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    delay = base_delay * (2 ** attempt) + random.random()
                    
                    logger.warning(
                        f"関数 {func.__name__} の実行に失敗しました（試行 {attempt+1}/{max_attempts}）: {e}"
                    )
                    
                    if attempt < max_attempts - 1:
                        logger.info(f"{delay:.2f}秒後に再試行します...")
                        time.sleep(delay)
                    else:
                        logger.error(f"関数 {func.__name__} の実行が {max_attempts} 回失敗しました")
            
            if last_exception:
                raise last_exception
            
            return cast(T, None)
        
        return wrapper
    
    return decorator

def with_jitter_backoff(max_attempts: int = 3, min_delay: float = 1.0, max_delay: float = 30.0, 
                       factor: float = 2.0, logger: Optional[logging.Logger] = None) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """
    ジッター付き指数バックオフを使用した再試行デコレータ
    
    Args:
        max_attempts: 最大試行回数
        min_delay: 最小遅延時間（秒）
        max_delay: 最大遅延時間（秒）
        factor: 遅延時間の乗数
        logger: ロガーインスタンス（Noneの場合はモジュールロガーを使用）
        
    Returns:
        Callable: デコレータ関数
    """
    if logger is None:
        logger = logging.getLogger(__name__)
    
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> T:
            last_exception = None
            delay = min_delay
            
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    
                    logger.warning(
                        f"関数 {func.__name__} の実行に失敗しました（試行 {attempt+1}/{max_attempts}）: {e}"
                    )
                    
                    if attempt < max_attempts - 1:
                        jitter = random.random() * delay
                        sleep_time = min(delay + jitter, max_delay)
                        logger.info(f"{sleep_time:.2f}秒後に再試行します...")
                        time.sleep(sleep_time)
                        delay = min(delay * factor, max_delay)
                    else:
                        logger.error(f"関数 {func.__name__} の実行が {max_attempts} 回失敗しました")
            
            if last_exception:
                raise last_exception
            
            return cast(T, None)
        
        return wrapper
    
    return decorator

def retry_on_exception(exceptions: tuple, max_attempts: int = 3, base_delay: float = 1.0, 
                      logger: Optional[logging.Logger] = None) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """
    特定の例外に対してのみ再試行するデコレータ
    
    Args:
        exceptions: 再試行する例外のタプル
        max_attempts: 最大試行回数
        base_delay: 基本遅延時間（秒）
        logger: ロガーインスタンス（Noneの場合はモジュールロガーを使用）
        
    Returns:
        Callable: デコレータ関数
    """
    if logger is None:
        logger = logging.getLogger(__name__)
    
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> T:
            last_exception = None
            
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    delay = base_delay * (2 ** attempt) + random.random()
                    
                    logger.warning(
                        f"関数 {func.__name__} の実行に失敗しました（試行 {attempt+1}/{max_attempts}）: {e}"
                    )
                    
                    if attempt < max_attempts - 1:
                        logger.info(f"{delay:.2f}秒後に再試行します...")
                        time.sleep(delay)
                    else:
                        logger.error(f"関数 {func.__name__} の実行が {max_attempts} 回失敗しました")
                except Exception as e:
                    logger.error(f"関数 {func.__name__} の実行中に再試行対象外の例外が発生しました: {e}")
                    raise
            
            if last_exception:
                raise last_exception
            
            return cast(T, None)
        
        return wrapper
    
    return decorator
