#!/usr/bin/env python3
"""
リトライロジックの実装
exponential backoffを使用した堅牢なリトライ機能
"""

import time
import random
import logging
from functools import wraps
from typing import Callable, Any, Tuple, Type

logger = logging.getLogger(__name__)

class RetryConfig:
    """リトライ設定"""
    def __init__(
        self,
        max_attempts: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 60.0,
        exponential_base: float = 2.0,
        jitter: bool = True,
        exceptions: Tuple[Type[Exception], ...] = (Exception,)
    ):
        self.max_attempts = max_attempts
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
        self.jitter = jitter
        self.exceptions = exceptions

def calculate_delay(attempt: int, config: RetryConfig) -> float:
    """次のリトライまでの待機時間を計算"""
    delay = min(
        config.base_delay * (config.exponential_base ** (attempt - 1)),
        config.max_delay
    )
    
    if config.jitter:
        # ランダムなジッターを追加（同時リトライを避ける）
        delay *= (0.5 + random.random())
    
    return delay

def retry_with_backoff(config: RetryConfig = None):
    """デコレータ: exponential backoffでリトライ"""
    if config is None:
        config = RetryConfig()
    
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            last_exception = None
            
            for attempt in range(1, config.max_attempts + 1):
                try:
                    logger.debug(f"{func.__name__} 実行中 (試行 {attempt}/{config.max_attempts})")
                    result = func(*args, **kwargs)
                    
                    if attempt > 1:
                        logger.info(f"{func.__name__} 成功 (試行 {attempt})")
                    
                    return result
                    
                except config.exceptions as e:
                    last_exception = e
                    
                    if attempt < config.max_attempts:
                        delay = calculate_delay(attempt, config)
                        logger.warning(
                            f"{func.__name__} 失敗 (試行 {attempt}/{config.max_attempts}): "
                            f"{type(e).__name__}: {str(e)}. "
                            f"{delay:.1f}秒後にリトライします..."
                        )
                        time.sleep(delay)
                    else:
                        logger.error(
                            f"{func.__name__} 最終的に失敗しました "
                            f"({config.max_attempts}回試行): "
                            f"{type(e).__name__}: {str(e)}"
                        )
            
            raise last_exception
        
        return wrapper
    return decorator

# 使用例
@retry_with_backoff(RetryConfig(
    max_attempts=5,
    base_delay=2.0,
    exceptions=(ConnectionError, TimeoutError)
))
def post_with_retry(bot, title, content, image_path=None):
    """リトライ機能付き投稿"""
    return bot.post_diary(title, content, image_path)

# 特定の操作用のプリセット設定
NETWORK_RETRY_CONFIG = RetryConfig(
    max_attempts=5,
    base_delay=2.0,
    max_delay=30.0,
    exceptions=(ConnectionError, TimeoutError, OSError)
)

LOGIN_RETRY_CONFIG = RetryConfig(
    max_attempts=3,
    base_delay=5.0,
    max_delay=60.0,
    exceptions=(Exception,)  # ログインは全例外をキャッチ
)

UPLOAD_RETRY_CONFIG = RetryConfig(
    max_attempts=4,
    base_delay=3.0,
    max_delay=45.0,
    exceptions=(ConnectionError, TimeoutError, IOError)
)