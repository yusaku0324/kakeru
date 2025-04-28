"""
Cron-based scheduler for automated posting
"""
import os
import sys
import logging
import schedule
import time
from typing import Optional

from bot.scheduler import QueueScheduler
from bot.utils.log import setup_logger

logger = setup_logger("cron_scheduler", "cron_scheduler.log")


def run_scheduled_job(queue_dir: str, cookie_path: str, min_sleep: int, max_sleep: int, dry_run: bool) -> None:
    """
    Run the scheduled job
    
    Args:
        queue_dir: Directory containing queue files
        cookie_path: Path to cookie file
        min_sleep: Minimum sleep time between posts
        max_sleep: Maximum sleep time between posts
        dry_run: If True, don't actually post
    """
    try:
        logger.info("Starting scheduled job")
        scheduler = QueueScheduler(queue_dir, dry_run)
        successful_posts = scheduler.run_daily_schedule(cookie_path, min_sleep, max_sleep)
        logger.info(f"Scheduled job completed with {successful_posts} successful posts")
    except Exception as e:
        logger.error(f"Error in scheduled job: {e}")
        import traceback
        logger.error(traceback.format_exc())


def setup_cron_schedule(
    time_str: str = "09:00",
    queue_dir: str = "queue",
    cookie_path: str = "cookies.json",
    min_sleep: int = 300,
    max_sleep: int = 900,
    dry_run: bool = False
) -> None:
    """
    Set up the cron schedule
    
    Args:
        time_str: Time to run the job (HH:MM format)
        queue_dir: Directory containing queue files
        cookie_path: Path to cookie file
        min_sleep: Minimum sleep time between posts
        max_sleep: Maximum sleep time between posts
        dry_run: If True, don't actually post
    """
    logger.info(f"Setting up cron schedule for {time_str}")
    
    schedule.every().day.at(time_str).do(
        run_scheduled_job,
        queue_dir=queue_dir,
        cookie_path=cookie_path,
        min_sleep=min_sleep,
        max_sleep=max_sleep,
        dry_run=dry_run
    )
    
    logger.info(f"Cron schedule set up successfully")


def run_cron_scheduler() -> int:
    """
    Run the cron scheduler
    
    Returns:
        Exit code (0 for success, 1 for failure)
    """
    try:
        import argparse
        
        parser = argparse.ArgumentParser(description="Cron scheduler for Twitter posting")
        parser.add_argument("--time", default="09:00", help="Time to run the job (HH:MM format)")
        parser.add_argument("--queue-dir", default="queue", help="Directory containing queue files")
        parser.add_argument("--cookie-path", required=True, help="Path to cookie file")
        parser.add_argument("--min-sleep", type=int, default=300, help="Minimum sleep time between posts (seconds)")
        parser.add_argument("--max-sleep", type=int, default=900, help="Maximum sleep time between posts (seconds)")
        parser.add_argument("--dry-run", action="store_true", help="Run without actually posting")
        
        args = parser.parse_args()
        
        setup_cron_schedule(
            time_str=args.time,
            queue_dir=args.queue_dir,
            cookie_path=args.cookie_path,
            min_sleep=args.min_sleep,
            max_sleep=args.max_sleep,
            dry_run=args.dry_run
        )
        
        logger.info("Starting cron scheduler loop")
        while True:
            schedule.run_pending()
            time.sleep(60)
    
    except KeyboardInterrupt:
        logger.info("Cron scheduler stopped by user")
        return 0
    except Exception as e:
        logger.error(f"Error in cron scheduler: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return 1


if __name__ == "__main__":
    sys.exit(run_cron_scheduler())
