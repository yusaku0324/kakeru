"""
Test module for cookie loading functionality
"""
import os
import json
import tempfile
import pytest
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from services.twitter_client.driver_factory import load_cookies, setup_driver

@pytest.fixture
def sample_cookies():
    """サンプルCookieデータを提供するフィクスチャ"""
    return [
        {
            "name": "test_cookie1",
            "value": "test_value1",
            "domain": "example.com",
            "path": "/",
            "secure": False,
            "httpOnly": False,
            "sameSite": "Lax"
        },
        {
            "name": "test_cookie2",
            "value": "test_value2",
            "domain": "example.com",
            "path": "/",
            "secure": False,
            "httpOnly": True,
            "sameSite": "None"
        }
    ]

@pytest.fixture
def cookie_file(sample_cookies):
    """一時的なCookieファイルを作成するフィクスチャ"""
    with tempfile.NamedTemporaryFile(suffix='.json', delete=False) as temp:
        json.dump(sample_cookies, temp)
        temp_path = temp.name
    
    yield temp_path
    
    if os.path.exists(temp_path):
        os.unlink(temp_path)

@pytest.fixture
def driver():
    """WebDriverインスタンスを提供するフィクスチャ"""
    options = webdriver.ChromeOptions()
    options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    
    try:
        yield driver
    finally:
        driver.quit()

def test_cookie_load(driver, cookie_file):
    """
    Cookie読み込み機能のテスト
    
    sameSite='None'の場合はsecure=Trueが強制されることを確認
    """
    driver.get("https://example.com")
    
    load_cookies(driver, cookie_file)
    
    browser_cookies = driver.get_cookies()
    
    assert len(browser_cookies) == 2
    
    cookie1 = next((c for c in browser_cookies if c["name"] == "test_cookie1"), None)
    cookie2 = next((c for c in browser_cookies if c["name"] == "test_cookie2"), None)
    
    assert cookie1 is not None
    assert cookie1["value"] == "test_value1"
    assert cookie1["domain"] == "example.com"
    assert cookie1["secure"] is False
    
    assert cookie2 is not None
    assert cookie2["value"] == "test_value2"
    assert cookie2["domain"] == "example.com"
    assert cookie2["secure"] is True  # sameSite='None'の場合はsecure=Trueが強制される
    assert cookie2["httpOnly"] is True

def test_setup_driver_with_cookies(cookie_file):
    """
    setup_driver関数のテスト
    
    Cookieファイルを指定してドライバーが正しく設定されることを確認
    """
    try:
        driver = setup_driver(cookie_path=cookie_file, headless=True)
        
        assert driver is not None
        
        driver.get("https://example.com")
        
        browser_cookies = driver.get_cookies()
        
        assert len(browser_cookies) == 2
        
        cookie1 = next((c for c in browser_cookies if c["name"] == "test_cookie1"), None)
        cookie2 = next((c for c in browser_cookies if c["name"] == "test_cookie2"), None)
        
        assert cookie1 is not None
        assert cookie1["value"] == "test_value1"
        
        assert cookie2 is not None
        assert cookie2["value"] == "test_value2"
        assert cookie2["secure"] is True  # sameSite='None'の場合はsecure=Trueが強制される
    
    finally:
        if 'driver' in locals() and driver is not None:
            driver.quit()
