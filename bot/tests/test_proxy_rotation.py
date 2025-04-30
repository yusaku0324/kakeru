import os
os.environ["SKIP_WDM"] = "1"   # ChromeDriverManager をスキップ

"""
Test module for proxy rotation functionality
"""
import pytest
from unittest.mock import MagicMock, patch

from bot.accounts import Account
from bot.services.proxy_manager import ProxyManager, get_proxy_manager
from bot.services.twitter_client.driver_factory import setup_webdriver, release_driver


@pytest.fixture
def mock_chrome():
    """Mock for undetected_chromedriver.Chrome"""
    with patch("undetected_chromedriver.Chrome") as mock_cls:
        mock_cls.side_effect = lambda *a, **kw: MagicMock()
        yield mock_cls


@pytest.fixture
def proxy_manager():
    """Create a ProxyManager with test proxies"""
    manager = ProxyManager()
    manager.enabled = True
    manager.proxies = {
        "test1": "http://proxy1.example.com:8080",
        "test2": "http://proxy2.example.com:8080",
        "test3": "http://proxy3.example.com:8080",
    }
    return manager


@pytest.fixture
def mock_proxy_manager(proxy_manager):
    """Mock for proxy_manager.get_proxy_manager"""
    with patch('bot.services.twitter_client.driver_factory.get_proxy_manager') as mock:
        mock.return_value = proxy_manager
        yield proxy_manager


def test_proxy_rotation(mock_chrome, mock_proxy_manager):
    """Test that proxies are rotated between sessions"""
    account = Account(
        screen_name="test_account",
        cookie_path="path/to/cookie.jar"
    )
    
    proxy1 = "http://user:pass@192.168.1.1:8080"
    proxy2 = "http://user:pass@192.168.1.2:8080"
    
    mock_proxy_manager.pick_proxy = MagicMock(side_effect=[proxy1, proxy2])
    
    driver1 = setup_webdriver(account)
    first_proxy = driver1.proxy
    
    driver2 = setup_webdriver(account)
    second_proxy = driver2.proxy
    
    assert mock_proxy_manager.pick_proxy.call_count == 2
    
    assert first_proxy != second_proxy


def test_proxy_manager_pick_and_release():
    """Test ProxyManager pick_proxy and release_proxy methods"""
    manager = ProxyManager()
    manager.enabled = True
    manager.proxies = {
        "test1": "http://proxy1.example.com:8080",
        "test2": "http://proxy2.example.com:8080",
    }
    
    proxy = manager.pick_proxy("test_account")
    
    assert proxy in manager.in_use_proxies
    
    assert manager.account_proxy_map["test_account"] == proxy
    
    manager.release_proxy(proxy)
    
    assert proxy not in manager.in_use_proxies
    
    assert manager.account_proxy_map["test_account"] == proxy
    
    manager.sticky_session = False
    
    proxy = manager.pick_proxy("test_account")
    
    manager.release_proxy(proxy)
    
    assert "test_account" not in manager.account_proxy_map


def test_proxy_manager_load_config():
    """Test ProxyManager _load_config method"""
    with patch('os.path.exists') as mock_exists, \
         patch('builtins.open') as mock_open:
        
        mock_exists.return_value = True
        
        mock_file = MagicMock()
        mock_file.__enter__.return_value = mock_file
        mock_file.read.return_value = """
        proxy_pool_size: 10
        ip_rotation_strategy: per_request
        sticky_session: false
        
        proxies:
          test1:
            host: proxy1.example.com
            port: 8080
            username: user1
            password: pass1
          test2: http://proxy2.example.com:8080
        """
        mock_open.return_value = mock_file
        
        manager = ProxyManager()
        
        assert manager.proxy_pool_size == 10
        assert manager.ip_rotation_strategy == "per_request"
        assert manager.sticky_session is False
        assert len(manager.proxies) == 2
        assert manager.proxies["test1"] == "http://user1:pass1@proxy1.example.com:8080"
        assert manager.proxies["test2"] == "http://proxy2.example.com:8080"


def test_driver_factory_with_proxy(mock_chrome, mock_proxy_manager):
    """Test that driver_factory sets up proxy correctly"""
    account = Account(
        screen_name="test_account",
        cookie_path="path/to/cookie.jar"
    )
    
    proxy = "http://proxy.example.com:8080"
    mock_proxy_manager.pick_proxy.return_value = proxy
    
    driver = setup_webdriver(account)
    
    mock_chrome.assert_called_with(
        options=pytest.approx(lambda x: f"--proxy-server={proxy}" in [arg for arg in x.arguments if arg.startswith("--proxy-server=")]),
        driver_executable_path=pytest.approx(lambda x: x.endswith("/chromedriver"))
    )
    
    assert hasattr(driver, 'proxy')
    assert driver.proxy == proxy
    
    release_driver(driver)
    
    mock_proxy_manager.release_proxy.assert_called_with(proxy)
