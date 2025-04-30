import os
os.environ["SKIP_WDM"] = "1"   # ChromeDriverManager をスキップ

"""
Tests for driver_factory.py
"""
import unittest
from unittest.mock import patch, MagicMock

from bot.services.twitter_client.driver_factory import create_driver, get_driver, _apply_user_agent


class TestDriverFactory(unittest.TestCase):
    """Test driver factory functions"""

    @patch('bot.services.twitter_client.driver_factory.uc.Chrome')
    @patch('bot.services.twitter_client.driver_factory.uc.ChromeOptions')
    @patch('bot.services.twitter_client.driver_factory.os.path.exists')
    def test_create_driver_headless(self, mock_exists, mock_options_class, mock_chrome):
        """Test creating driver in headless mode"""
        # mock_options インスタンスを返す。add_argument メソッドの呼び出しを検証する
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


    @patch('bot.services.twitter_client.driver_factory.uc.Chrome')
    @patch('bot.services.twitter_client.driver_factory.uc.ChromeOptions')
    def test_get_driver_with_proxy(self, mock_options_class, mock_chrome):
        """Test get_driver with proxy"""
        mock_options = MagicMock()
        mock_options_class.return_value = mock_options
        mock_driver = MagicMock()
        mock_chrome.return_value = mock_driver

        proxy = "http://proxy.example.com:8080"
        driver = get_driver(proxy=proxy)

        self.assertEqual(driver, mock_driver)
        mock_options.add_argument.assert_any_call(f"--proxy-server={proxy}")
        self.assertEqual(driver.proxy, proxy)

    @patch('bot.services.twitter_client.driver_factory.uc.Chrome')
    @patch('bot.services.twitter_client.driver_factory.uc.ChromeOptions')
    @patch('bot.services.twitter_client.driver_factory._apply_user_agent')
    def test_get_driver_with_user_agent(self, mock_apply_user_agent, mock_options_class, mock_chrome):
        """Test get_driver with user agent"""
        mock_options = MagicMock()
        mock_options_class.return_value = mock_options
        mock_driver = MagicMock()
        mock_chrome.return_value = mock_driver

        user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/123.0.0.0"
        driver = get_driver(user_agent=user_agent)

        self.assertEqual(driver, mock_driver)
        mock_apply_user_agent.assert_called_once_with(mock_driver, user_agent)

    @patch('bot.services.twitter_client.driver_factory.WebDriver.execute_cdp_cmd')
    def test_apply_user_agent_cdp(self, mock_execute_cdp_cmd):
        """Test _apply_user_agent with CDP"""
        mock_driver = MagicMock()
        user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/123.0.0.0"
        
        mock_driver.execute_cdp_cmd = mock_execute_cdp_cmd
        
        _apply_user_agent(mock_driver, user_agent)

        mock_execute_cdp_cmd.assert_called_once_with(
            "Network.setUserAgentOverride", {"userAgent": user_agent}
        )

    @patch('bot.services.twitter_client.driver_factory.WebDriver.execute_cdp_cmd')
    @patch('bot.services.twitter_client.driver_factory.WebDriver.execute_script')
    def test_apply_user_agent_fallback(self, mock_execute_script, mock_execute_cdp_cmd):
        """Test _apply_user_agent with JavaScript fallback"""
        mock_driver = MagicMock()
        mock_driver.execute_cdp_cmd = mock_execute_cdp_cmd
        mock_driver.execute_script = mock_execute_script
        mock_execute_cdp_cmd.side_effect = Exception("CDP not available")
        user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/123.0.0.0"

        _apply_user_agent(mock_driver, user_agent)

        mock_execute_script.assert_called_once()
        self.assertEqual(mock_execute_script.call_args[0][1], user_agent)


if __name__ == '__main__':
    unittest.main()
