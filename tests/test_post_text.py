"""
Test module for text input functionality
"""
import time
import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from services.twitter_client.composer import type_tweet_text
from services.twitter_client.driver_factory import setup_driver

@pytest.fixture
def driver():
    """WebDriverインスタンスを提供するフィクスチャ"""
    options = webdriver.ChromeOptions()
    options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1920,1080")
    
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    
    try:
        yield driver
    finally:
        driver.quit()

@pytest.fixture
def test_page(driver):
    """テスト用のHTMLページを作成して読み込む"""
    html_content = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Text Input Test</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            textarea { width: 400px; height: 100px; margin: 10px 0; }
        </style>
    </head>
    <body>
        <h1>Text Input Test</h1>
        <div>
            <label for="textInput">Input Field:</label>
            <textarea id="textInput" role="textbox" placeholder="Type here..."></textarea>
        </div>
        <div>
            <button id="checkButton">Check Input</button>
        </div>
        <div id="output"></div>
        
        <script>
            document.getElementById('checkButton').addEventListener('click', function() {
                const input = document.getElementById('textInput').value;
                document.getElementById('output').textContent = input;
            });
        </script>
    </body>
    </html>
    """
    
    with open("/tmp/text_input_test.html", "w", encoding="utf-8") as f:
        f.write(html_content)
    
    driver.get("file:///tmp/text_input_test.html")
    
    return driver

def test_text_input(test_page):
    """
    テキスト入力機能のテスト
    
    以下の3段階フォールバックをテスト:
    1. CDP Input.insertText
    2. クリップボード貼り付け
    3. 1文字ずつsend_keys
    """
    driver = test_page
    
    test_text = "こんにちは、世界！😊 Hello, World! 12345 #テスト"
    
    text_area = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, "textarea[role='textbox']"))
    )
    
    assert type_tweet_text(driver, test_text)
    
    check_button = driver.find_element(By.ID, "checkButton")
    check_button.click()
    
    output_div = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.ID, "output"))
    )
    
    time.sleep(1)
    
    output_text = output_div.text
    
    assert output_text == test_text, f"期待: '{test_text}', 実際: '{output_text}'"
    
    text_area.clear()
    
    short_text = "Simple test"
    assert type_tweet_text(driver, short_text)
    
    check_button.click()
    
    time.sleep(1)
    
    output_text = output_div.text
    
    assert output_text == short_text, f"期待: '{short_text}', 実際: '{output_text}'"
