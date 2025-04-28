"""
CDP Input.insertText functionality for X (Twitter) automation
"""
import logging
import time
from typing import Optional

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.remote.webelement import WebElement

logger = logging.getLogger(__name__)

def cdp_insert_text(driver: webdriver.Chrome, element: WebElement, text: str) -> bool:
    """
    CDP Input.insertTextを使用してテキストを入力する
    
    Args:
        driver: WebDriverインスタンス
        element: 入力対象の要素
        text: 入力するテキスト
        
    Returns:
        bool: 成功したかどうか
    """
    try:
        driver.execute_script("arguments[0].focus();", element)
        time.sleep(0.5)
        
        driver.execute_cdp_cmd('Input.insertText', {'text': text})
        
        logger.info(f"CDP Input.insertTextでテキストを入力しました: {text[:20]}...")
        return True
    
    except Exception as e:
        logger.error(f"CDP Input.insertTextでのテキスト入力中にエラーが発生しました: {e}")
        return False

def clipboard_paste(driver: webdriver.Chrome, element: WebElement, text: str) -> bool:
    """
    クリップボード経由でテキストを貼り付ける
    
    Args:
        driver: WebDriverインスタンス
        element: 入力対象の要素
        text: 入力するテキスト
        
    Returns:
        bool: 成功したかどうか
    """
    try:
        import pyperclip
        
        pyperclip.copy(text)
        
        driver.execute_script("arguments[0].focus();", element)
        time.sleep(0.5)
        
        element.send_keys(Keys.CONTROL, 'v')
        
        logger.info(f"クリップボード経由でテキストを貼り付けました: {text[:20]}...")
        return True
    
    except Exception as e:
        logger.error(f"クリップボード経由でのテキスト貼り付け中にエラーが発生しました: {e}")
        return False

def send_keys_input(driver: webdriver.Chrome, element: WebElement, text: str) -> bool:
    """
    send_keysを使用してテキストを入力する
    
    Args:
        driver: WebDriverインスタンス
        element: 入力対象の要素
        text: 入力するテキスト
        
    Returns:
        bool: 成功したかどうか
    """
    try:
        driver.execute_script("arguments[0].focus();", element)
        time.sleep(0.5)
        
        element.send_keys(text)
        
        logger.info(f"send_keysでテキストを入力しました: {text[:20]}...")
        return True
    
    except Exception as e:
        logger.error(f"send_keysでのテキスト入力中にエラーが発生しました: {e}")
        return False

def input_text_with_fallback(driver: webdriver.Chrome, element: WebElement, text: str) -> bool:
    """
    3段階フォールバックでテキストを入力する
    1. CDP Input.insertText
    2. クリップボード貼り付け
    3. send_keys
    
    Args:
        driver: WebDriverインスタンス
        element: 入力対象の要素
        text: 入力するテキスト
        
    Returns:
        bool: 成功したかどうか
    """
    if cdp_insert_text(driver, element, text):
        return True
    
    logger.warning("CDP Input.insertTextが失敗しました。クリップボード貼り付けを試行します。")
    
    if clipboard_paste(driver, element, text):
        return True
    
    logger.warning("クリップボード貼り付けが失敗しました。send_keysを試行します。")
    
    if send_keys_input(driver, element, text):
        return True
    
    logger.error("すべてのテキスト入力方法が失敗しました。")
    return False
