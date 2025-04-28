"""
リトライユーティリティのテスト
"""
import time
import unittest
from unittest.mock import patch, MagicMock

import pytest

from bot.utils.retry import retry, click_element_robust, find_element_robust


class TestRetryDecorator(unittest.TestCase):
    """リトライデコレータのテストクラス"""

    def test_successful_execution(self):
        """成功する関数の実行テスト"""
        mock_func = MagicMock(return_value="success")
        decorated_func = retry()(mock_func)
        
        result = decorated_func()
        
        self.assertEqual(result, "success")
        mock_func.assert_called_once()

    def test_retry_on_exception(self):
        """例外発生時のリトライテスト"""
        mock_func = MagicMock(side_effect=[ValueError("Error"), "success"])
        decorated_func = retry(max_attempts=2)(mock_func)
        
        result = decorated_func()
        
        self.assertEqual(result, "success")
        self.assertEqual(mock_func.call_count, 2)

    def test_max_attempts_reached(self):
        """最大試行回数到達時のテスト"""
        mock_func = MagicMock(side_effect=ValueError("Error"))
        decorated_func = retry(max_attempts=3)(mock_func)
        
        with self.assertRaises(ValueError):
            decorated_func()
        
        self.assertEqual(mock_func.call_count, 3)

    def test_specific_exceptions(self):
        """特定の例外のみキャッチするテスト"""
        mock_func = MagicMock(side_effect=[ValueError("Error"), "success"])
        decorated_func = retry(exceptions=ValueError)(mock_func)
        
        result = decorated_func()
        
        self.assertEqual(result, "success")
        self.assertEqual(mock_func.call_count, 2)

    def test_ignore_other_exceptions(self):
        """指定外の例外を無視するテスト"""
        mock_func = MagicMock(side_effect=TypeError("Type Error"))
        decorated_func = retry(exceptions=ValueError)(mock_func)
        
        with self.assertRaises(TypeError):
            decorated_func()
        
        mock_func.assert_called_once()

    def test_backoff_delay(self):
        """バックオフ遅延のテスト"""
        mock_func = MagicMock(side_effect=[ValueError("Error"), "success"])
        mock_sleep = MagicMock()
        
        with patch("time.sleep", mock_sleep):
            decorated_func = retry(delay=1.0, backoff_factor=2.0)(mock_func)
            decorated_func()
        
        mock_sleep.assert_called_once_with(1.0)
        self.assertEqual(mock_func.call_count, 2)

    def test_on_retry_callback(self):
        """リトライコールバックのテスト"""
        mock_func = MagicMock(side_effect=[ValueError("Error"), "success"])
        on_retry_mock = MagicMock()
        
        decorated_func = retry(on_retry=on_retry_mock)(mock_func)
        decorated_func()
        
        on_retry_mock.assert_called_once()
        self.assertEqual(mock_func.call_count, 2)

    def test_jitter(self):
        """ジッターのテスト"""
        mock_func = MagicMock(side_effect=[ValueError("Error"), "success"])
        mock_sleep = MagicMock()
        mock_random = MagicMock(return_value=0.05)
        
        with patch("time.sleep", mock_sleep), patch("random.uniform", mock_random):
            decorated_func = retry(delay=1.0, jitter=True, jitter_factor=0.1)(mock_func)
            decorated_func()
        
        mock_random.assert_called_once()
        self.assertEqual(mock_func.call_count, 2)


class TestRobustFunctions(unittest.TestCase):
    """堅牢な関数のテストクラス"""

    def test_click_element_robust_success(self):
        """click_element_robustの成功テスト"""
        mock_driver = MagicMock()
        mock_element = MagicMock()
        
        with patch("bot.utils.retry.retry", return_value=lambda f: f):
            result = click_element_robust(mock_driver, mock_element)
        
        self.assertTrue(result)
        mock_driver.execute_script.assert_called()

    def test_find_element_robust_success(self):
        """find_element_robustの成功テスト"""
        mock_driver = MagicMock()
        mock_by = MagicMock()
        mock_value = "test_value"
        mock_element = MagicMock()
        mock_driver.find_element.return_value = mock_element
        
        with patch("bot.utils.retry.retry", return_value=lambda f: f):
            result = find_element_robust(mock_driver, mock_by, mock_value)
        
        self.assertEqual(result, mock_element)
        mock_driver.find_element.assert_called_with(mock_by, mock_value)


if __name__ == "__main__":
    unittest.main()
