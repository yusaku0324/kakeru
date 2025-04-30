"""
Test module for User-Agent functionality
"""
import pytest
from unittest.mock import MagicMock, patch
import os

from bot.accounts import Account
from bot.services.twitter_client.driver_factory import setup_webdriver


@pytest.fixture
def mock_chrome():
    """Mock for undetected_chromedriver.Chrome"""
    with patch('undetected_chromedriver.Chrome') as mock:
        mock_driver = MagicMock()
        mock.return_value = mock_driver
        yield mock


@pytest.fixture
def mock_proxy_manager():
    """Mock for proxy_manager.get_proxy_manager"""
    with patch('bot.services.proxy_manager.get_proxy_manager') as mock:
        mock_manager = MagicMock()
        mock_manager.pick_proxy.return_value = None
        mock.return_value = mock_manager
        yield mock_manager


def test_user_agent_fixed(mock_chrome, mock_proxy_manager):
    """Test that User-Agent is fixed per account"""
    account1 = Account(
        screen_name="account1",
        cookie_path="path/to/cookie1.jar",
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/123.0.0.0"
    )
    
    account2 = Account(
        screen_name="account2",
        cookie_path="path/to/cookie2.jar",
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/123.0.0.0"
    )
    
    driver1 = setup_webdriver(account1)
    driver2 = setup_webdriver(account2)
    
    mock_chrome.assert_any_call(
        options=pytest.approx(lambda x: "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/123.0.0.0" in [arg for arg in x.arguments if arg.startswith("--user-agent=")]),
        driver_executable_path=pytest.approx(lambda x: x.endswith("/chromedriver"))
    )
    
    user_agent1 = next((arg for arg in mock_chrome.call_args_list[0][1]['options'].arguments if arg.startswith("--user-agent=")), None)
    user_agent2 = next((arg for arg in mock_chrome.call_args_list[1][1]['options'].arguments if arg.startswith("--user-agent=")), None)
    
    assert user_agent1 == user_agent2
    assert user_agent1 == f"--user-agent={account1.user_agent}"


def test_user_agent_from_account(mock_chrome, mock_proxy_manager):
    """Test that User-Agent is taken from account"""
    custom_ua = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    account = Account(
        screen_name="custom_ua",
        cookie_path="path/to/cookie.jar",
        user_agent=custom_ua
    )
    
    driver = setup_webdriver(account)
    
    mock_chrome.assert_called_with(
        options=pytest.approx(lambda x: f"--user-agent={custom_ua}" in [arg for arg in x.arguments if arg.startswith("--user-agent=")]),
        driver_executable_path=pytest.approx(lambda x: x.endswith("/chromedriver"))
    )
    
    user_agent = next((arg for arg in mock_chrome.call_args[1]['options'].arguments if arg.startswith("--user-agent=")), None)
    assert user_agent == f"--user-agent={custom_ua}"


def test_default_user_agent(mock_chrome, mock_proxy_manager):
    """Test that default User-Agent is used when not specified"""
    account = Account(
        screen_name="default_ua",
        cookie_path="path/to/cookie.jar",
        user_agent=None
    )
    
    driver = setup_webdriver(account)
    
    mock_chrome.assert_called_with(
        options=pytest.approx(lambda x: any(arg.startswith("--user-agent=") for arg in x.arguments)),
        driver_executable_path=pytest.approx(lambda x: x.endswith("/chromedriver"))
    )
    
    user_agent = next((arg for arg in mock_chrome.call_args[1]['options'].arguments if arg.startswith("--user-agent=")), None)
    assert user_agent is not None
    assert user_agent.startswith("--user-agent=Mozilla/5.0")
