"""
Test module for CDP Input.insertText functionality
"""
import pytest
from unittest.mock import MagicMock, patch
from selenium import webdriver
from selenium.webdriver.remote.webelement import WebElement

from bot.services.twitter_client.cdp_input import (
    cdp_insert_text,
    clipboard_paste,
    send_keys_input,
    input_text_with_fallback
)

@pytest.fixture
def mock_driver():
    """WebDriverのモックを提供するフィクスチャ"""
    driver = MagicMock(spec=webdriver.Chrome)
    driver.execute_cdp_cmd.return_value = None
    driver.execute_script.return_value = None
    return driver

@pytest.fixture
def mock_element():
    """WebElementのモックを提供するフィクスチャ"""
    element = MagicMock(spec=WebElement)
    element.send_keys.return_value = None
    return element

def test_cdp_insert_text(mock_driver, mock_element):
    """CDP Input.insertTextのテスト"""
    text = "テストテキスト"
    
    result = cdp_insert_text(mock_driver, mock_element, text)
    
    assert result is True
    mock_driver.execute_script.assert_called_once_with("arguments[0].focus();", mock_element)
    mock_driver.execute_cdp_cmd.assert_called_once_with('Input.insertText', {'text': text})

def test_cdp_insert_text_failure(mock_driver, mock_element):
    """CDP Input.insertTextの失敗テスト"""
    text = "テストテキスト"
    mock_driver.execute_cdp_cmd.side_effect = Exception("CDP error")
    
    result = cdp_insert_text(mock_driver, mock_element, text)
    
    assert result is False

@patch('pyperclip.copy')
def test_clipboard_paste(mock_copy, mock_driver, mock_element):
    """クリップボード貼り付けのテスト"""
    text = "テストテキスト"
    
    result = clipboard_paste(mock_driver, mock_element, text)
    
    assert result is True
    mock_copy.assert_called_once_with(text)
    mock_driver.execute_script.assert_called_once_with("arguments[0].focus();", mock_element)
    mock_element.send_keys.assert_called_once()

def test_send_keys_input(mock_driver, mock_element):
    """send_keys入力のテスト"""
    text = "テストテキスト"
    
    result = send_keys_input(mock_driver, mock_element, text)
    
    assert result is True
    mock_driver.execute_script.assert_called_once_with("arguments[0].focus();", mock_element)
    mock_element.send_keys.assert_called_once_with(text)

def test_input_text_with_fallback_cdp_success(mock_driver, mock_element):
    """フォールバック機能のテスト（CDP成功）"""
    text = "テストテキスト"
    
    result = input_text_with_fallback(mock_driver, mock_element, text)
    
    assert result is True
    mock_driver.execute_cdp_cmd.assert_called_once()

@patch('pyperclip.copy')
def test_input_text_with_fallback_clipboard_success(mock_copy, mock_driver, mock_element):
    """フォールバック機能のテスト（クリップボード成功）"""
    text = "テストテキスト"
    mock_driver.execute_cdp_cmd.side_effect = Exception("CDP error")
    
    result = input_text_with_fallback(mock_driver, mock_element, text)
    
    assert result is True
    mock_copy.assert_called_once_with(text)

@patch('pyperclip.copy')
def test_input_text_with_fallback_send_keys_success(mock_copy, mock_driver, mock_element):
    """フォールバック機能のテスト（send_keys成功）"""
    text = "テストテキスト"
    mock_driver.execute_cdp_cmd.side_effect = Exception("CDP error")
    mock_copy.side_effect = Exception("Clipboard error")
    
    result = input_text_with_fallback(mock_driver, mock_element, text)
    
    assert result is True
    mock_element.send_keys.assert_called_once_with(text)

@patch('pyperclip.copy')
def test_input_text_with_fallback_all_fail(mock_copy, mock_driver, mock_element):
    """フォールバック機能のテスト（すべて失敗）"""
    text = "テストテキスト"
    mock_driver.execute_cdp_cmd.side_effect = Exception("CDP error")
    mock_copy.side_effect = Exception("Clipboard error")
    mock_element.send_keys.side_effect = Exception("Send keys error")
    
    result = input_text_with_fallback(mock_driver, mock_element, text)
    
    assert result is False
