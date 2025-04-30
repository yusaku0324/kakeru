"""
Tests for the accounts module
"""
import os
import tempfile
import unittest
from unittest.mock import patch, MagicMock

import yaml
import pytest

from kakeru.accounts import Account, load_accounts_yaml


class TestAccount(unittest.TestCase):
    """Test the Account class"""
    
    def test_init(self):
        """Test initialization"""
        account = Account("test", "/path/to/cookie.jar", "tokyo")
        
        self.assertEqual(account.screen_name, "test")
        self.assertEqual(account.cookie_path, "/path/to/cookie.jar")
        self.assertEqual(account.proxy_tag, "tokyo")
        self.assertIsNone(account._proxy_config)
    
    def test_repr(self):
        """Test string representation"""
        account = Account("test", "/path/to/cookie.jar", "tokyo")
        
        expected = "Account(screen_name='test', cookie_path='/path/to/cookie.jar', proxy_tag=tokyo)"
        self.assertEqual(repr(account), expected)
    
    @patch("kakeru.accounts.get_proxy_manager")
    def test_proxy_config_with_tag(self, mock_get_proxy_manager):
        """Test proxy_config property with proxy tag"""
        mock_proxy_manager = MagicMock()
        mock_proxy_manager.get_proxy.return_value = {
            "host": "proxy.tokyo.example.com",
            "port": 8080
        }
        mock_get_proxy_manager.return_value = mock_proxy_manager
        
        account = Account("test", "/path/to/cookie.jar", "tokyo")
        
        proxy_config = account.proxy_config
        
        self.assertEqual(proxy_config, {
            "host": "proxy.tokyo.example.com",
            "port": 8080
        })
        mock_get_proxy_manager.assert_called_once()
        mock_proxy_manager.get_proxy.assert_called_once_with("tokyo")
        
        mock_get_proxy_manager.reset_mock()
        mock_proxy_manager.get_proxy.reset_mock()
        
        proxy_config = account.proxy_config
        
        self.assertEqual(proxy_config, {
            "host": "proxy.tokyo.example.com",
            "port": 8080
        })
        mock_get_proxy_manager.assert_not_called()
        mock_proxy_manager.get_proxy.assert_not_called()
    
    def test_proxy_config_without_tag(self):
        """Test proxy_config property without proxy tag"""
        account = Account("test", "/path/to/cookie.jar")
        
        self.assertIsNone(account.proxy_config)
    
    @patch("kakeru.accounts.rotate_proxy")
    def test_rotate_proxy_with_tag(self, mock_rotate_proxy):
        """Test rotate_proxy method with proxy tag"""
        mock_rotate_proxy.return_value = {
            "host": "proxy.osaka.example.com",
            "port": 8080
        }
        
        account = Account("test", "/path/to/cookie.jar", "osaka")
        
        result = account.rotate_proxy()
        
        self.assertEqual(result, {
            "host": "proxy.osaka.example.com",
            "port": 8080
        })
        self.assertEqual(account._proxy_config, {
            "host": "proxy.osaka.example.com",
            "port": 8080
        })
        mock_rotate_proxy.assert_called_once_with("osaka")
    
    def test_rotate_proxy_without_tag(self):
        """Test rotate_proxy method without proxy tag"""
        account = Account("test", "/path/to/cookie.jar")
        
        result = account.rotate_proxy()
        
        self.assertIsNone(result)
        self.assertIsNone(account._proxy_config)


class TestLoadAccountsYaml(unittest.TestCase):
    """Test the load_accounts_yaml function"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.temp_dir = tempfile.TemporaryDirectory()
        self.config_path = os.path.join(self.temp_dir.name, "accounts.yaml")
        
        self.accounts_config = {
            "yusaku": {
                "cookie": "secrets/yusaku.jar"
            },
            "dev_bot": {
                "cookie": "secrets/dev_bot.jar",
                "proxy": "tokyo"
            }
        }
        
        with open(self.config_path, "w", encoding="utf-8") as f:
            yaml.dump(self.accounts_config, f)
    
    def tearDown(self):
        """Tear down test fixtures"""
        self.temp_dir.cleanup()
    
    def test_load_accounts_yaml(self):
        """Test loading accounts from YAML"""
        test_config = {
            "yusaku": {
                "cookie": "secrets/yusaku.jar"
            },
            "dev_bot": {
                "cookie": "secrets/dev_bot.jar",
                "proxy": "tokyo"
            }
        }
        
        with open(self.config_path, "w", encoding="utf-8") as f:
            yaml.dump(test_config, f)
        
        mock_file = MagicMock()
        mock_file.__enter__.return_value = mock_file
        mock_file.read.return_value = yaml.dump(test_config)
        
        mock_path = MagicMock()
        mock_path.exists.return_value = True
        
        with patch("kakeru.accounts.CONFIG_PATH", mock_path), \
             patch("builtins.open", return_value=mock_file):
            
            accounts = load_accounts_yaml()
            
            self.assertEqual(len(accounts), 2)
            
            self.assertEqual(accounts[0].screen_name, "yusaku")
            self.assertTrue(accounts[0].cookie_path.endswith("secrets/yusaku.jar"))
            self.assertIsNone(accounts[0].proxy_tag)
            
            self.assertEqual(accounts[1].screen_name, "dev_bot")
            self.assertTrue(accounts[1].cookie_path.endswith("secrets/dev_bot.jar"))
            self.assertEqual(accounts[1].proxy_tag, "tokyo")
    
    @patch("kakeru.accounts.CONFIG_PATH")
    def test_load_accounts_yaml_file_not_found(self, mock_config_path):
        """Test loading accounts when file not found"""
        mock_config_path.exists.return_value = False
        
        accounts = load_accounts_yaml()
        
        self.assertEqual(len(accounts), 0)
    
    @patch("kakeru.accounts.CONFIG_PATH")
    def test_load_accounts_yaml_empty_config(self, mock_config_path):
        """Test loading accounts with empty config"""
        empty_config_path = os.path.join(self.temp_dir.name, "empty_accounts.yaml")
        with open(empty_config_path, "w", encoding="utf-8") as f:
            f.write("")
        
        mock_config_path.exists.return_value = True
        mock_config_path.__str__.return_value = empty_config_path
        
        accounts = load_accounts_yaml()
        
        self.assertEqual(len(accounts), 0)
    
    @patch("kakeru.accounts.CONFIG_PATH")
    def test_load_accounts_yaml_invalid_config(self, mock_config_path):
        """Test loading accounts with invalid config"""
        invalid_config_path = os.path.join(self.temp_dir.name, "invalid_accounts.yaml")
        with open(invalid_config_path, "w", encoding="utf-8") as f:
            f.write("invalid: yaml: content")
        
        mock_config_path.exists.return_value = True
        mock_config_path.__str__.return_value = invalid_config_path
        
        accounts = load_accounts_yaml()
        
        self.assertEqual(len(accounts), 0)
    
    @patch("kakeru.accounts.CONFIG_PATH")
    def test_load_accounts_yaml_missing_cookie(self, mock_config_path):
        """Test loading accounts with missing cookie path"""
        missing_cookie_config = {
            "yusaku": {
                "proxy": "tokyo"
            }
        }
        missing_cookie_path = os.path.join(self.temp_dir.name, "missing_cookie.yaml")
        with open(missing_cookie_path, "w", encoding="utf-8") as f:
            yaml.dump(missing_cookie_config, f)
        
        mock_config_path.exists.return_value = True
        mock_config_path.__str__.return_value = missing_cookie_path
        
        accounts = load_accounts_yaml()
        
        self.assertEqual(len(accounts), 0)


if __name__ == "__main__":
    unittest.main()
