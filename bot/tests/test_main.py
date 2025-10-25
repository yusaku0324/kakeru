"""
Tests for main.py
"""
import unittest
from unittest.mock import patch, MagicMock
import sys
import os

from bot.main import main, process_queue


class TestMainFunctions(unittest.TestCase):
    """Test main module functions"""
    
    def setUp(self):
        self.test_queue_file = "test_queue.yaml"
        self.test_qa_file = "test_qa.csv"
        self.test_cookie_path = "test_cookies.json"
    
    @patch('bot.main.create_driver')
    @patch('bot.main.load_cookies')
    @patch('bot.main.PostDeduplicator')
    @patch('bot.main.logger')
    def test_process_queue_success(self, mock_logger, mock_deduplicator, mock_load_cookies, mock_create_driver):
        """Test successful process_queue execution"""
        mock_driver = MagicMock()
        mock_create_driver.return_value = mock_driver
        mock_load_cookies.return_value = True
        
        result = process_queue(self.test_queue_file, self.test_qa_file)
        
        self.assertEqual(result, 0)
        mock_create_driver.assert_called_once()
        expected_cookie_path = os.getenv("COOKIE_PATH", "niijima_cookies.json")
        mock_load_cookies.assert_called_once_with(mock_driver, expected_cookie_path)
        mock_driver.quit.assert_called_once()
    
    @patch('bot.main.create_driver')
    @patch('bot.main.load_cookies')
    @patch('bot.main.logger')
    def test_process_queue_cookie_failure(self, mock_logger, mock_load_cookies, mock_create_driver):
        """Test process_queue with cookie loading failure"""
        mock_driver = MagicMock()
        mock_create_driver.return_value = mock_driver
        mock_load_cookies.return_value = False
        
        result = process_queue(self.test_queue_file, self.test_qa_file)
        
        self.assertEqual(result, 1)
        mock_logger.error.assert_called_with("Failed to load cookies")
        mock_driver.quit.assert_called_once()
    
    @patch('bot.main.create_driver')
    @patch('bot.main.logger')
    def test_process_queue_exception(self, mock_logger, mock_create_driver):
        """Test process_queue with exception"""
        mock_create_driver.side_effect = Exception("Test error")
        
        result = process_queue(self.test_queue_file, self.test_qa_file)
        
        self.assertEqual(result, 1)
        mock_logger.error.assert_called_once()
    
    @patch('bot.main.create_driver')
    @patch('bot.main.load_cookies')
    @patch('bot.main.os.environ')
    def test_process_queue_with_env_vars(self, mock_environ, mock_load_cookies, mock_create_driver):
        """Test process_queue with environment variables"""
        mock_driver = MagicMock()
        mock_create_driver.return_value = mock_driver
        mock_load_cookies.return_value = True
        env_vars = {"TEST_VAR": "test_value"}
        
        result = process_queue(self.test_queue_file, self.test_qa_file, env_vars)
        
        self.assertEqual(result, 0)
        mock_environ.__setitem__.assert_called_with("TEST_VAR", "test_value")
    
    @patch('bot.main.process_queue')
    @patch('bot.main.os.environ')
    def test_main_with_args(self, mock_environ, mock_process_queue):
        """Test main function with command line arguments"""
        mock_process_queue.return_value = 0
        
        with patch('sys.argv', ['main.py', '--queue-file', self.test_queue_file, 
                               '--qa-file', self.test_qa_file, 
                               '--cookie-path', self.test_cookie_path]):
            result = main()
        
        self.assertEqual(result, 0)
        mock_environ.__setitem__.assert_called_with("COOKIE_PATH", self.test_cookie_path)
        mock_process_queue.assert_called_once_with(self.test_queue_file, self.test_qa_file)
    
    @patch('bot.main.process_queue')
    def test_main_without_args(self, mock_process_queue):
        """Test main function without command line arguments"""
        mock_process_queue.return_value = 0
        
        with patch('sys.argv', ['main.py']):
            result = main()
        
        self.assertEqual(result, 0)
        mock_process_queue.assert_called_once_with(None, None)


if __name__ == '__main__':
    unittest.main()
