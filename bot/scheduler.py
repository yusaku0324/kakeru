"""
Enhanced scheduler with random sleep intervals and queue.yaml integration
"""
import os
import sys
import time
import random
import logging
import datetime
import yaml
from typing import List, Dict, Optional, Any

from bot.utils.log import setup_logger
from bot.services.twitter_client.poster import post_to_twitter
from bot.services.twitter_client.driver_factory import create_driver
from bot.services.twitter_client.cookie_loader import load_cookies

logger = setup_logger("scheduler", "scheduler.log")


class QueueScheduler:
    """
    Scheduler that reads from queue.yaml files and posts with random intervals
    """
    
    def __init__(self, queue_dir: str = "queue", dry_run: bool = False):
        """
        Initialize the scheduler
        
        Args:
            queue_dir: Directory containing queue YAML files
            dry_run: If True, don't actually post to Twitter
        """
        self.queue_dir = queue_dir
        self.dry_run = dry_run
        self.processed_items = set()
    
    def get_queue_file_for_date(self, date: datetime.date) -> str:
        """
        Get the queue file path for a specific date
        
        Args:
            date: Date to get queue file for
            
        Returns:
            Path to queue file
        """
        filename = f"queue_{date.strftime('%Y-%m-%d')}.yaml"
        return os.path.join(self.queue_dir, filename)
    
    def load_queue(self, queue_file: str) -> List[Dict[str, Any]]:
        """
        Load queue items from a YAML file
        
        Args:
            queue_file: Path to queue YAML file
            
        Returns:
            List of queue items
        """
        if not os.path.exists(queue_file):
            logger.warning(f"Queue file not found: {queue_file}")
            return []
        
        try:
            with open(queue_file, 'r', encoding='utf-8') as f:
                items = yaml.safe_load(f)
            
            if not isinstance(items, list):
                logger.error(f"Invalid queue format in {queue_file}")
                return []
            
            logger.info(f"Loaded {len(items)} items from {queue_file}")
            return items
        
        except Exception as e:
            logger.error(f"Error loading queue file {queue_file}: {e}")
            return []
    
    def get_random_sleep_interval(self, min_seconds: int = 300, max_seconds: int = 900) -> int:
        """
        Get a random sleep interval between posts
        
        Args:
            min_seconds: Minimum sleep time in seconds
            max_seconds: Maximum sleep time in seconds
            
        Returns:
            Random sleep interval in seconds
        """
        interval = random.randint(min_seconds, max_seconds)
        logger.info(f"Next sleep interval: {interval} seconds")
        return interval
    
    def process_queue_item(self, item: Dict[str, Any], cookie_path: str) -> bool:
        """
        Process a single queue item
        
        Args:
            item: Queue item to process
            cookie_path: Path to cookie file
            
        Returns:
            True if successful, False otherwise
        """
        try:
            text = item.get('text', '')
            if not text:
                logger.warning("Empty text in queue item")
                return False
            
            item_id = hash(text)
            if item_id in self.processed_items:
                logger.info(f"Item already processed: {text[:50]}...")
                return True
            
            if self.dry_run:
                logger.info(f"[DRY RUN] Would post: {text}")
                self.processed_items.add(item_id)
                return True
            
            driver = create_driver()
            if not load_cookies(driver, cookie_path):
                logger.error("Failed to load cookies")
                driver.quit()
                return False
            
            result = post_to_twitter(driver, text)
            driver.quit()
            
            if result:
                logger.info(f"Successfully posted: {text[:50]}...")
                self.processed_items.add(item_id)
                return True
            else:
                logger.error(f"Failed to post: {text[:50]}...")
                return False
        
        except Exception as e:
            logger.error(f"Error processing queue item: {e}")
            return False
    
    def run_daily_schedule(self, cookie_path: str, min_sleep: int = 300, max_sleep: int = 900) -> int:
        """
        Run the daily schedule for posting
        
        Args:
            cookie_path: Path to cookie file
            min_sleep: Minimum sleep time between posts
            max_sleep: Maximum sleep time between posts
            
        Returns:
            Number of items successfully processed
        """
        today = datetime.date.today()
        queue_file = self.get_queue_file_for_date(today)
        
        items = self.load_queue(queue_file)
        if not items:
            logger.info(f"No items to process for {today}")
            return 0
        
        successful_posts = 0
        
        for i, item in enumerate(items):
            logger.info(f"Processing item {i+1}/{len(items)}")
            
            if self.process_queue_item(item, cookie_path):
                successful_posts += 1
            
            if i < len(items) - 1:
                sleep_time = self.get_random_sleep_interval(min_sleep, max_sleep)
                logger.info(f"Sleeping for {sleep_time} seconds...")
                time.sleep(sleep_time)
        
        logger.info(f"Completed daily schedule: {successful_posts}/{len(items)} successful posts")
        return successful_posts


def main():
    """
    Main entry point for the scheduler
    """
    import argparse
    
    parser = argparse.ArgumentParser(description="Queue scheduler for Twitter posting")
    parser.add_argument("--queue-dir", default="queue", help="Directory containing queue files")
    parser.add_argument("--cookie-path", required=True, help="Path to cookie file")
    parser.add_argument("--min-sleep", type=int, default=300, help="Minimum sleep time between posts (seconds)")
    parser.add_argument("--max-sleep", type=int, default=900, help="Maximum sleep time between posts (seconds)")
    parser.add_argument("--dry-run", action="store_true", help="Run without actually posting")
    
    args = parser.parse_args()
    
    scheduler = QueueScheduler(args.queue_dir, args.dry_run)
    successful_posts = scheduler.run_daily_schedule(args.cookie_path, args.min_sleep, args.max_sleep)
    
    return 0 if successful_posts > 0 else 1


if __name__ == "__main__":
    sys.exit(main())
