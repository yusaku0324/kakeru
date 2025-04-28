"""
Tests for the cron scheduler
"""
import unittest
from unittest.mock import patch, MagicMock
import schedule

from bot.cron_scheduler import run_scheduled_job, setup_cron_schedule


class TestCronScheduler(unittest.TestCase):
    """Test cases for cron scheduler"""
    
    @patch('bot.cron_scheduler.QueueScheduler')
    def test_run_scheduled_job(self, mock_scheduler_class):
        """Test running a scheduled job"""
        mock_scheduler = MagicMock()
        mock_scheduler.run_daily_schedule.return_value = 5
        mock_scheduler_class.return_value = mock_scheduler
        
        run_scheduled_job("queue", "cookies.json", 300, 900, False)
        
        mock_scheduler_class.assert_called_once_with("queue", False)
        mock_scheduler.run_daily_schedule.assert_called_once_with("cookies.json", 300, 900)
    
    @patch('bot.cron_scheduler.QueueScheduler')
    def test_run_scheduled_job_error(self, mock_scheduler_class):
        """Test error handling in scheduled job"""
        mock_scheduler_class.side_effect = Exception("Test error")
        
        run_scheduled_job("queue", "cookies.json", 300, 900, False)
    
    @patch('schedule.every')
    def test_setup_cron_schedule(self, mock_every):
        """Test setting up cron schedule"""
        mock_day = MagicMock()
        mock_every.return_value.day = mock_day
        
        setup_cron_schedule(
            time_str="10:30",
            queue_dir="test_queue",
            cookie_path="test_cookies.json",
            min_sleep=600,
            max_sleep=1200,
            dry_run=True
        )
        
        mock_day.at.assert_called_once_with("10:30")
        mock_day.at.return_value.do.assert_called_once()


if __name__ == '__main__':
    unittest.main()
