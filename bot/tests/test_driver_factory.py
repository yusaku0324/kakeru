"""
Tests for driver_factory.py
"""
import unittest
from unittest.mock import patch, MagicMock
import os

from bot.services.twitter_client.driver_factory import create_driver


class TestDriverFactory(unittest.TestCase):
    """Test driver factory functions"""
    
    @patch('bot.services.twitter_client.driver_factory.uc.Chrome')
    @patch('bot.services.twitter_client.driver_factory.uc.ChromeOptions')
    @patch('bot.services.twitter_client.driver_factory.os.path.exists')
    def test_create_driver_headless(self, mock_exists, mock_options_class, mock_chrome):
        """Test creating driver in headless mode"""
        mock_exists.return_value = True
        mock_options = MagicMock()
        mock_options_class.return_value = mock_options
        mock_driver = MagicMock()
        mock_chrome.return_value = mock_driver
        
        driver = create_driver(headless=True)
        
        self.assertEqual(driver, mock_driver)
        mock_options.add_argument.assert_any_call("--headless=new")
        mock_options.add_argument.assert_any_call("--no-sandbox")
        mock_options.add_argument.assert_any_call("--disable-dev-shm-usage")
        mock_options.add_argument.assert_any_call("--disable-gpu")
        mock_options.add_argument.assert_any_call("--window-size=1920,1080")
        mock_chrome.assert_called_once_with(options=mock_options)
        mock_driver.implicitly_wait.assert_called_once_with(10)
    
    @patch('bot.services.twitter_client.driver_factory.uc.Chrome')
    @patch('bot.services.twitter_client.driver_factory.uc.ChromeOptions')
    @patch('bot.services.twitter_client.driver_factory.os.path.exists')
    def test_create_driver_non_headless(self, mock_exists, mock_options_class, mock_chrome):
        """Test creating driver in non-headless mode"""
        mock_exists.return_value = True
        mock_options = MagicMock()
        mock_options_class.return_value = mock_options
        mock_driver = MagicMock()
        mock_chrome.return_value = mock_driver
        
        driver = create_driver(headless=False)
        
        self.assertEqual(driver, mock_driver)
        headless_calls = [call for call in mock_options.add_argument.call_args_list if call[0][0] == "--headless=new"]
        self.assertEqual(len(headless_calls), 0)
        mock_chrome.assert_called_once_with(options=mock_options)
    
    @patch('bot.services.twitter_client.driver_factory.uc.Chrome')
    @patch('bot.services.twitter_client.driver_factory.uc.ChromeOptions')
    @patch('bot.services.twitter_client.driver_factory.os.path.exists')
    @patch('bot.services.twitter_client.driver_factory.ChromeDriverManager')
    def test_create_driver_chrome_path_found(self, mock_chromedriver_manager, mock_exists, mock_options_class, mock_chrome):
        """Test creating driver with chrome path found"""
        mock_exists.side_effect = lambda path: path == "/usr/bin/google-chrome-stable" or path == os.getenv("CHROME_PATH")
        
        mock_options = MagicMock()
        mock_options_class.return_value = mock_options
        mock_driver = MagicMock()
        mock_chrome.return_value = mock_driver
        
        driver = create_driver()
        
        self.assertEqual(driver, mock_driver)
        self.assertEqual(mock_options.binary_location, "/usr/bin/google-chrome-stable")
    
    @patch('bot.services.twitter_client.driver_factory.uc.Chrome')
    @patch('bot.services.twitter_client.driver_factory.uc.ChromeOptions')
    @patch('bot.services.twitter_client.driver_factory.os.path.exists')
    def test_create_driver_chrome_path_not_found(self, mock_exists, mock_options_class, mock_chrome):
        """Test creating driver with no chrome path found"""
        mock_exists.return_value = False  # No paths exist
        mock_options = MagicMock()
        mock_options_class.return_value = mock_options
        mock_driver = MagicMock()
        mock_chrome.return_value = mock_driver
        
        driver = create_driver()
        
        self.assertEqual(driver, mock_driver)
        self.assertNotIn('binary_location', mock_options.__dict__)
    
    @patch('bot.services.twitter_client.driver_factory.uc.Chrome')
    @patch('bot.services.twitter_client.driver_factory.uc.ChromeOptions')
    @patch('bot.services.twitter_client.driver_factory.logger')
    def test_create_driver_exception(self, mock_logger, mock_options_class, mock_chrome):
        """Test creating driver with exception"""
        mock_options = MagicMock()
        mock_options_class.return_value = mock_options
        mock_chrome.side_effect = Exception("Chrome error")
        
        with self.assertRaises(Exception):
            create_driver()
        
        mock_logger.error.assert_called_once()


if __name__ == '__main__':
    unittest.main()
