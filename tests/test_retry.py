"""
Test module for retry utility
"""
import time
import logging
import pytest
from utils.retry import retry

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

class TestCounter:
    def __init__(self):
        self.count = 0
    
    def reset(self):
        self.count = 0
    
    def increment(self):
        self.count += 1
        return self.count

counter = TestCounter()

@retry(max_tries=3, delay=0.1, jitter=0.05)
def function_that_fails_twice():
    """
    2回失敗して3回目で成功する関数
    
    Returns:
        str: 成功メッセージ
    
    Raises:
        ValueError: 1回目と2回目の呼び出しで発生
    """
    count = counter.increment()
    
    if count < 3:
        raise ValueError(f"意図的な失敗 {count}/2")
    
    return "3回目で成功"

def test_retry_success():
    """
    リトライが成功するケースをテスト
    """
    counter.reset()
    
    result = function_that_fails_twice()
    
    assert result == "3回目で成功"
    assert counter.count == 3

@retry(max_tries=2, delay=0.1, jitter=0.05)
def function_that_always_fails():
    """
    常に失敗する関数
    
    Raises:
        RuntimeError: 常に発生
    """
    counter.increment()
    raise RuntimeError("常に失敗")

def test_retry_failure():
    """
    リトライが失敗するケースをテスト
    """
    counter.reset()
    
    with pytest.raises(RuntimeError):
        function_that_always_fails()
    
    assert counter.count == 2

@retry(max_tries=3, delay=0.1, jitter=0.05, exceptions=(ValueError,))
def function_with_specific_exceptions():
    """
    特定の例外のみをキャッチする関数
    
    Raises:
        ValueError: 1回目の呼び出しで発生
        RuntimeError: 2回目の呼び出しで発生（キャッチされない）
    """
    count = counter.increment()
    
    if count == 1:
        raise ValueError("キャッチされる例外")
    elif count == 2:
        raise RuntimeError("キャッチされない例外")
    
    return "成功"

def test_retry_specific_exceptions():
    """
    特定の例外のみをキャッチするケースをテスト
    """
    counter.reset()
    
    with pytest.raises(RuntimeError):
        function_with_specific_exceptions()
    
    assert counter.count == 2

def test_retry_with_custom_logger():
    """
    カスタムロガーを使用するケースをテスト
    """
    custom_logger = logging.getLogger("custom")
    handler = logging.StreamHandler()
    custom_logger.addHandler(handler)
    custom_logger.setLevel(logging.INFO)
    
    counter.reset()
    
    @retry(max_tries=3, delay=0.1, jitter=0.05, logger=custom_logger)
    def function_with_custom_logger():
        count = counter.increment()
        
        if count < 3:
            raise ValueError(f"意図的な失敗 {count}/2")
        
        return "3回目で成功"
    
    result = function_with_custom_logger()
    
    assert result == "3回目で成功"
    assert counter.count == 3

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    print("=== test_retry_success ===")
    test_retry_success()
    
    print("=== test_retry_failure ===")
    try:
        test_retry_failure()
    except RuntimeError:
        print("期待通りの例外が発生しました")
    
    print("=== test_retry_specific_exceptions ===")
    try:
        test_retry_specific_exceptions()
    except RuntimeError:
        print("期待通りの例外が発生しました")
    
    print("=== test_retry_with_custom_logger ===")
    test_retry_with_custom_logger()
    
    print("すべてのテストが成功しました")
