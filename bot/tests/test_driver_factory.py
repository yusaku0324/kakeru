"""
Tests for driver factory with undetected-chromedriver
"""

import unittest
from unittest.mock import MagicMock, patch
import pytest

from bot.services.twitter_client.driver_factory import create_driver


class TestDriverFactory(unittest.TestCase):
    """Test driver factory with undetected-chromedriver"""

    @patch("bot.services.twitter_client.driver_factory.uc.Chrome")
    @patch("bot.services.twitter_client.driver_factory.uc.ChromeOptions")
    @patch("bot.services.twitter_client.driver_factory.os.path.exists")
    def test_create_driver_headless(self, mock_exists, mock_options_class, mock_chrome):
        """Test creating a headless driver"""
        mock_exists.side_effect = [False, True, False]  # Second path exists

        mock_options = MagicMock()
        mock_options_class.return_value = mock_options

        mock_driver = MagicMock()
        mock_chrome.return_value = mock_driver

        driver = create_driver(headless=True)

        mock_options.add_argument.assert_any_call("--headless=new")
        mock_options.add_argument.assert_any_call("--no-sandbox")
        mock_options.add_argument.assert_any_call("--disable-dev-shm-usage")
        mock_options.add_argument.assert_any_call("--disable-gpu")
        mock_options.add_argument.assert_any_call("--window-size=1920,1080")

        self.assertEqual(mock_options.binary_location, "/usr/bin/google-chrome")

        mock_chrome.assert_called_once_with(options=mock_options)

        mock_driver.implicitly_wait.assert_called_once_with(10)

        self.assertEqual(driver, mock_driver)

    @patch("bot.services.twitter_client.driver_factory.uc.Chrome")
    @patch("bot.services.twitter_client.driver_factory.uc.ChromeOptions")
    @patch("bot.services.twitter_client.driver_factory.os.path.exists")
    def test_create_driver_non_headless(
        self, mock_exists, mock_options_class, mock_chrome
    ):
        """Test creating a non-headless driver"""
        mock_exists.side_effect = [True, False, False]  # First path exists

        mock_options = MagicMock()
        mock_options_class.return_value = mock_options

        mock_driver = MagicMock()
        mock_chrome.return_value = mock_driver

        driver = create_driver(headless=False)

        mock_options.add_argument.assert_any_call("--no-sandbox")
        mock_options.add_argument.assert_any_call("--disable-dev-shm-usage")
        mock_options.add_argument.assert_any_call("--disable-gpu")
        mock_options.add_argument.assert_any_call("--window-size=1920,1080")

        for call in mock_options.add_argument.call_args_list:
            self.assertNotIn("--headless=new", call[0])

        self.assertEqual(mock_options.binary_location, "/usr/bin/google-chrome-stable")

        mock_chrome.assert_called_once_with(options=mock_options)

        mock_driver.implicitly_wait.assert_called_once_with(10)

        self.assertEqual(driver, mock_driver)

    @patch("bot.services.twitter_client.driver_factory.uc.Chrome")
    @patch("bot.services.twitter_client.driver_factory.uc.ChromeOptions")
    @patch("bot.services.twitter_client.driver_factory.os.path.exists")
    def test_create_driver_no_chrome_binary(
        self, mock_exists, mock_options_class, mock_chrome
    ):
        """Test creating a driver when no Chrome binary is found"""
        mock_exists.return_value = False

        mock_options = MagicMock()
        mock_options_class.return_value = mock_options

        mock_driver = MagicMock()
        mock_chrome.return_value = mock_driver

        driver = create_driver()

        self.assertNotIn("binary_location", mock_options.__dict__)

        mock_chrome.assert_called_once_with(options=mock_options)

        self.assertEqual(driver, mock_driver)

    @patch("bot.services.twitter_client.driver_factory.uc.Chrome")
    @patch("bot.services.twitter_client.driver_factory.uc.ChromeOptions")
    def test_create_driver_error(self, mock_options_class, mock_chrome):
        """Test error handling when creating driver fails"""
        mock_options = MagicMock()
        mock_options_class.return_value = mock_options

        mock_chrome.side_effect = Exception("Failed to create driver")

        with self.assertRaises(Exception) as context:
            create_driver()

        self.assertEqual(str(context.exception), "Failed to create driver")


if __name__ == "__main__":
    unittest.main()
