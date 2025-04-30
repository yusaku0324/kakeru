"""
Tests for the proxy module
"""
import os
import time
import tempfile
import unittest
from unittest.mock import patch, MagicMock

import yaml
import pytest

from kakeru.proxy import (
    ProxyManager,
    get_proxy_manager,
    rotate_proxy,
    ROTATION_STRATEGY_PER_SESSION,
    ROTATION_STRATEGY_PER_5_POSTS,
    ROTATION_STRATEGY_PER_15_MINUTES,
)


class TestProxyManager(unittest.TestCase):
    """Test the ProxyManager class"""

    def setUp(self):
        """Set up test fixtures"""
        self.temp_dir = tempfile.TemporaryDirectory()
        self.config_path = os.path.join(self.temp_dir.name, "proxy_config.yaml")
        
        self.proxy_config = {
            "ip_rotation_strategy": ROTATION_STRATEGY_PER_SESSION,
            "proxies": {
                "tokyo": {
                    "host": "proxy.tokyo.example.com",
                    "port": 8080,
                    "username": "user1",
                    "password": "pass1"
                },
                "osaka": {
                    "host": "proxy.osaka.example.com",
                    "port": 8080,
                    "username": "user2",
                    "password": "pass2"
                }
            }
        }
        
        with open(self.config_path, "w", encoding="utf-8") as f:
            yaml.dump(self.proxy_config, f)
    
    def tearDown(self):
        """Tear down test fixtures"""
        self.temp_dir.cleanup()
    
    def test_init_with_config(self):
        """Test initialization with a config file"""
        manager = ProxyManager(self.config_path)
        
        self.assertEqual(manager.rotation_strategy, ROTATION_STRATEGY_PER_SESSION)
        self.assertEqual(len(manager.proxies), 2)
        self.assertIn("tokyo", manager.proxies)
        self.assertIn("osaka", manager.proxies)
    
    def test_init_without_config(self):
        """Test initialization without a config file"""
        manager = ProxyManager()
        
        self.assertEqual(manager.rotation_strategy, ROTATION_STRATEGY_PER_SESSION)
        self.assertEqual(len(manager.proxies), 0)
    
    def test_get_proxy_by_tag(self):
        """Test getting a proxy by tag"""
        manager = ProxyManager(self.config_path)
        
        tokyo_proxy = manager.get_proxy("tokyo")
        self.assertEqual(tokyo_proxy["host"], "proxy.tokyo.example.com")
        
        osaka_proxy = manager.get_proxy("osaka")
        self.assertEqual(osaka_proxy["host"], "proxy.osaka.example.com")
    
    def test_get_proxy_nonexistent_tag(self):
        """Test getting a proxy with a nonexistent tag"""
        manager = ProxyManager(self.config_path)
        
        proxy = manager.get_proxy("nonexistent")
        self.assertIsNone(proxy)
    
    def test_get_proxy_random(self):
        """Test getting a random proxy"""
        manager = ProxyManager(self.config_path)
        
        proxy = manager.get_proxy()
        self.assertIsNotNone(proxy)
        self.assertIn(proxy["host"], ["proxy.tokyo.example.com", "proxy.osaka.example.com"])
    
    def test_should_rotate_per_session(self):
        """Test should_rotate with per_session strategy"""
        manager = ProxyManager(self.config_path)
        manager.rotation_strategy = ROTATION_STRATEGY_PER_SESSION
        
        self.assertTrue(manager.should_rotate())
        
        manager.current_proxy = {"host": "proxy.test.com"}
        self.assertFalse(manager.should_rotate())
    
    def test_should_rotate_per_5_posts(self):
        """Test should_rotate with per_5_posts strategy"""
        manager = ProxyManager(self.config_path)
        manager.rotation_strategy = ROTATION_STRATEGY_PER_5_POSTS
        manager.current_proxy = {"host": "proxy.test.com"}
        
        self.assertTrue(manager.should_rotate())  # post_count = 0
        
        manager.post_count = 1
        self.assertFalse(manager.should_rotate())
        
        manager.post_count = 4
        self.assertFalse(manager.should_rotate())
        
        manager.post_count = 5
        self.assertTrue(manager.should_rotate())
        
        manager.post_count = 10
        self.assertTrue(manager.should_rotate())
    
    def test_should_rotate_per_15_minutes(self):
        """Test should_rotate with per_15_minutes strategy"""
        manager = ProxyManager(self.config_path)
        manager.rotation_strategy = ROTATION_STRATEGY_PER_15_MINUTES
        manager.current_proxy = {"host": "proxy.test.com"}
        
        current_time = time.time()
        
        manager.last_rotation_time = current_time
        self.assertFalse(manager.should_rotate())
        
        manager.last_rotation_time = current_time - (10 * 60)
        self.assertFalse(manager.should_rotate())
        
        manager.last_rotation_time = current_time - (16 * 60)
        self.assertTrue(manager.should_rotate())
    
    def test_rotate_proxy_with_tag(self):
        """Test rotating to a proxy with a specific tag"""
        manager = ProxyManager(self.config_path)
        
        proxy = manager.rotate_proxy("tokyo")
        self.assertEqual(proxy["host"], "proxy.tokyo.example.com")
        self.assertEqual(manager.current_proxy, proxy)
    
    def test_rotate_proxy_random(self):
        """Test rotating to a random proxy"""
        manager = ProxyManager(self.config_path)
        
        proxy = manager.rotate_proxy()
        self.assertIsNotNone(proxy)
        self.assertIn(proxy["host"], ["proxy.tokyo.example.com", "proxy.osaka.example.com"])
        self.assertEqual(manager.current_proxy, proxy)
    
    def test_rotate_proxy_no_proxies(self):
        """Test rotating when no proxies are available"""
        manager = ProxyManager()
        
        proxy = manager.rotate_proxy()
        self.assertIsNone(proxy)
        self.assertIsNone(manager.current_proxy)
    
    def test_increment_post_count(self):
        """Test incrementing post count"""
        manager = ProxyManager(self.config_path)
        manager.rotation_strategy = ROTATION_STRATEGY_PER_5_POSTS
        
        manager.rotate_proxy = MagicMock()
        
        for i in range(1, 5):
            manager.increment_post_count()
            self.assertEqual(manager.post_count, i)
            manager.rotate_proxy.assert_not_called()
        
        manager.increment_post_count()
        self.assertEqual(manager.post_count, 5)
        manager.rotate_proxy.assert_called_once()


class TestProxyHelpers(unittest.TestCase):
    """Test the proxy helper functions"""
    
    def test_get_proxy_manager(self):
        """Test get_proxy_manager"""
        import kakeru.proxy
        kakeru.proxy._proxy_manager = None
        
        with patch("kakeru.proxy.ProxyManager") as mock_proxy_manager:
            mock_instance = MagicMock()
            mock_proxy_manager.return_value = mock_instance
            
            manager1 = get_proxy_manager()
            mock_proxy_manager.assert_called_once()
            assert manager1 == mock_instance
        
        with patch("kakeru.proxy.ProxyManager") as mock_proxy_manager:
            manager2 = get_proxy_manager()
            mock_proxy_manager.assert_not_called()
            assert manager2 == manager1
    
    @patch("kakeru.proxy.get_proxy_manager")
    def test_rotate_proxy(self, mock_get_manager):
        """Test rotate_proxy helper function"""
        mock_manager = MagicMock()
        mock_get_manager.return_value = mock_manager
        
        mock_manager.should_rotate.return_value = True
        mock_manager.rotate_proxy.return_value = {"host": "proxy.test.com"}
        
        result = rotate_proxy("tokyo")
        mock_manager.should_rotate.assert_called_once()
        mock_manager.rotate_proxy.assert_called_once_with("tokyo")
        assert result == {"host": "proxy.test.com"}
        
        mock_manager.reset_mock()
        mock_manager.should_rotate.return_value = False
        mock_manager.current_proxy = {"host": "proxy.current.com"}
        
        result = rotate_proxy("tokyo")
        mock_manager.should_rotate.assert_called_once()
        mock_manager.rotate_proxy.assert_not_called()
        assert result == {"host": "proxy.current.com"}


if __name__ == "__main__":
    unittest.main()
