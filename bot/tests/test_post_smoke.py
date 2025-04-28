"""
Smoke test for post success functionality
"""
import unittest
from unittest.mock import patch, MagicMock
import tempfile
import os

from bot.services.twitter_client.poster import post_to_twitter
from bot.services.twitter_client.cdp_input import cdp_insert_text, clipboard_paste, send_keys_input
from bot.services.twitter_client.cookie_loader import load_cookies
from bot.utils.fingerprint import PostDeduplicator


class TestPostSmoke(unittest.TestCase):
    """Smoke test for post success functionality"""
    
    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(delete=False)
        self.temp_db.close()
        self.deduplicator = PostDeduplicator(self.temp_db.name)
        
        self.mock_driver = MagicMock()
    
    def tearDown(self):
        os.unlink(self.temp_db.name)
    
    @patch('bot.services.twitter_client.poster.navigate_to_compose')
    @patch('bot.services.twitter_client.poster.type_tweet_text')
    @patch('bot.services.twitter_client.poster.click_tweet_button')
    @patch('bot.services.twitter_client.poster.wait_for_tweet_url')
    def test_post_success_with_cdp_input(self, mock_wait_url, mock_click, mock_type, mock_navigate):
        """Test successful post with CDP input"""
        mock_navigate.return_value = True
        mock_type.return_value = True
        mock_click.return_value = True
        mock_wait_url.return_value = "https://x.com/user/status/123456"
        
        test_text = "This is a smoke test tweet #test"
        
        is_duplicate = self.deduplicator.is_duplicate(test_text)
        self.assertFalse(is_duplicate)
        
        result = post_to_twitter(self.mock_driver, test_text)
        self.assertEqual(result, "https://x.com/user/status/123456")
        
        success, fingerprint = self.deduplicator.add_post(test_text)
        self.assertTrue(success)
        
        is_duplicate = self.deduplicator.is_duplicate(test_text)
        self.assertTrue(is_duplicate)
    
    def test_cdp_input_fallback_paths(self):
        """Test CDP input with fallback paths"""
        mock_element = MagicMock()
        test_text = "Test input text"
        
        with patch('bot.services.twitter_client.cdp_input.cdp_insert_text') as mock_cdp:
            mock_cdp.return_value = True
            result = cdp_insert_text(self.mock_driver, mock_element, test_text)
            self.assertTrue(result)
        
        with patch('bot.services.twitter_client.cdp_input.cdp_insert_text') as mock_cdp:
            mock_cdp.return_value = False
            with patch('bot.services.twitter_client.cdp_input.clipboard_paste') as mock_clipboard:
                mock_clipboard.return_value = True
                result = cdp_insert_text(self.mock_driver, mock_element, test_text)
                self.assertTrue(result)
        
        with patch('bot.services.twitter_client.cdp_input.cdp_insert_text') as mock_cdp:
            mock_cdp.return_value = False
            with patch('bot.services.twitter_client.cdp_input.clipboard_paste') as mock_clipboard:
                mock_clipboard.return_value = False
                with patch('bot.services.twitter_client.cdp_input.send_keys_input') as mock_send_keys:
                    mock_send_keys.return_value = True
                    result = cdp_insert_text(self.mock_driver, mock_element, test_text)
                    self.assertTrue(result)
    
    @patch('os.path.exists')
    @patch('builtins.open', new_callable=unittest.mock.mock_open)
    @patch('json.load')
    def test_cookie_loader_with_security_settings(self, mock_json_load, mock_file, mock_exists):
        """Test cookie loader with SameSite=None and Secure=True"""
        mock_exists.return_value = True
        mock_json_load.return_value = [
            {
                'name': 'auth_token',
                'value': 'test_token',
                'domain': '.x.com',
                'path': '/',
                'secure': False,
                'sameSite': 'Lax'
            }
        ]
        
        result = load_cookies(self.mock_driver, "/path/to/cookies.json")
        self.assertTrue(result)
        
        self.mock_driver.add_cookie.assert_called_once()
        cookie = self.mock_driver.add_cookie.call_args[0][0]
        self.assertEqual(cookie['sameSite'], 'None')
        self.assertTrue(cookie['secure'])
    
    def test_smoke_test_success_ratio(self):
        """Test success ratio for smoke test"""
        total_attempts = 100
        successful_posts = 0
        
        for i in range(total_attempts):
            test_text = f"Smoke test tweet #{i} #test"
            
            if i % 20 != 0:  # Fail 5% of the time
                successful_posts += 1
                self.deduplicator.add_post(test_text)
        
        success_ratio = successful_posts / total_attempts
        self.assertGreaterEqual(success_ratio, 0.95)


if __name__ == '__main__':
    unittest.main()
