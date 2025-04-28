"""
Tests for the enhanced scheduler with random sleep intervals
"""
import unittest
from unittest.mock import patch, MagicMock, mock_open
import os
import datetime
import yaml

from bot.scheduler import QueueScheduler


class TestQueueScheduler(unittest.TestCase):
    """Test cases for QueueScheduler"""
    
    def setUp(self):
        self.scheduler = QueueScheduler(queue_dir="test_queue", dry_run=True)
    
    def test_get_queue_file_for_date(self):
        """Test getting queue file path for a specific date"""
        date = datetime.date(2025, 4, 27)
        expected_path = os.path.join("test_queue", "queue_2025-04-27.yaml")
        self.assertEqual(self.scheduler.get_queue_file_for_date(date), expected_path)
    
    @patch('os.path.exists')
    @patch('builtins.open', new_callable=mock_open)
    @patch('yaml.safe_load')
    def test_load_queue_success(self, mock_yaml_load, mock_file, mock_exists):
        """Test successful queue loading"""
        mock_exists.return_value = True
        mock_yaml_load.return_value = [
            {"text": "Test question 1?"},
            {"text": "Test question 2?"}
        ]
        
        items = self.scheduler.load_queue("test_queue.yaml")
        self.assertEqual(len(items), 2)
        self.assertEqual(items[0]["text"], "Test question 1?")
    
    @patch('os.path.exists')
    def test_load_queue_file_not_found(self, mock_exists):
        """Test queue loading when file doesn't exist"""
        mock_exists.return_value = False
        items = self.scheduler.load_queue("nonexistent.yaml")
        self.assertEqual(items, [])
    
    @patch('os.path.exists')
    @patch('builtins.open', new_callable=mock_open)
    @patch('yaml.safe_load')
    def test_load_queue_invalid_format(self, mock_yaml_load, mock_file, mock_exists):
        """Test queue loading with invalid format"""
        mock_exists.return_value = True
        mock_yaml_load.return_value = {"not": "a list"}
        
        items = self.scheduler.load_queue("test_queue.yaml")
        self.assertEqual(items, [])
    
    def test_get_random_sleep_interval(self):
        """Test random sleep interval generation"""
        min_sleep = 300
        max_sleep = 900
        
        for _ in range(10):
            interval = self.scheduler.get_random_sleep_interval(min_sleep, max_sleep)
            self.assertGreaterEqual(interval, min_sleep)
            self.assertLessEqual(interval, max_sleep)
    
    def test_process_queue_item_dry_run(self):
        """Test processing queue item in dry run mode"""
        item = {"text": "Test question?"}
        result = self.scheduler.process_queue_item(item, "dummy_cookie_path")
        self.assertTrue(result)
        self.assertIn(hash("Test question?"), self.scheduler.processed_items)
    
    def test_process_queue_item_empty_text(self):
        """Test processing queue item with empty text"""
        item = {"text": ""}
        result = self.scheduler.process_queue_item(item, "dummy_cookie_path")
        self.assertFalse(result)
    
    def test_process_queue_item_already_processed(self):
        """Test processing already processed item"""
        item = {"text": "Test question?"}
        item_id = hash("Test question?")
        self.scheduler.processed_items.add(item_id)
        
        result = self.scheduler.process_queue_item(item, "dummy_cookie_path")
        self.assertTrue(result)
    
    @patch('bot.scheduler.create_driver')
    @patch('bot.scheduler.load_cookies')
    @patch('bot.scheduler.post_to_twitter')
    def test_process_queue_item_success(self, mock_post, mock_load_cookies, mock_create_driver):
        """Test successful queue item processing"""
        self.scheduler.dry_run = False
        mock_driver = MagicMock()
        mock_create_driver.return_value = mock_driver
        mock_load_cookies.return_value = True
        mock_post.return_value = "https://twitter.com/status/123"
        
        item = {"text": "Test question?"}
        result = self.scheduler.process_queue_item(item, "dummy_cookie_path")
        
        self.assertTrue(result)
        mock_driver.quit.assert_called_once()
        self.assertIn(hash("Test question?"), self.scheduler.processed_items)
    
    @patch('bot.scheduler.create_driver')
    @patch('bot.scheduler.load_cookies')
    def test_process_queue_item_cookie_failure(self, mock_load_cookies, mock_create_driver):
        """Test queue item processing with cookie loading failure"""
        self.scheduler.dry_run = False
        mock_driver = MagicMock()
        mock_create_driver.return_value = mock_driver
        mock_load_cookies.return_value = False
        
        item = {"text": "Test question?"}
        result = self.scheduler.process_queue_item(item, "dummy_cookie_path")
        
        self.assertFalse(result)
        mock_driver.quit.assert_called_once()
    
    @patch('bot.scheduler.QueueScheduler.load_queue')
    @patch('bot.scheduler.QueueScheduler.process_queue_item')
    @patch('time.sleep')
    def test_run_daily_schedule(self, mock_sleep, mock_process_item, mock_load_queue):
        """Test running daily schedule"""
        mock_load_queue.return_value = [
            {"text": "Question 1?"},
            {"text": "Question 2?"},
            {"text": "Question 3?"}
        ]
        mock_process_item.side_effect = [True, False, True]
        
        successful_posts = self.scheduler.run_daily_schedule("dummy_cookie_path")
        
        self.assertEqual(successful_posts, 2)
        self.assertEqual(mock_process_item.call_count, 3)
        self.assertEqual(mock_sleep.call_count, 2)  # Sleep between posts, not after the last one
    
    @patch('bot.scheduler.QueueScheduler.load_queue')
    def test_run_daily_schedule_no_items(self, mock_load_queue):
        """Test running daily schedule with no items"""
        mock_load_queue.return_value = []
        
        successful_posts = self.scheduler.run_daily_schedule("dummy_cookie_path")
        
        self.assertEqual(successful_posts, 0)


if __name__ == '__main__':
    unittest.main()
