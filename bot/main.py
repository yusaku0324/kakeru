"""
Main entry point for the bot application
"""
import os
import sys
import logging
from typing import Optional, Dict, Any, List

from bot.utils.log import setup_logger
from bot.services.twitter_client.poster import post_to_twitter
from bot.services.twitter_client.driver_factory import create_driver
from bot.services.twitter_client.cookie_loader import load_cookies
from bot.utils.fingerprint import PostDeduplicator
from bot.accounts import load_accounts_yaml, Account

logger = setup_logger("bot_main", "bot_main.log")


def process_account(account: Account, queue_file: str, qa_file: str) -> bool:
    """
    Process a single account
    
    Args:
        account: Account to process
        queue_file: Path to queue file
        qa_file: Path to Q&A data file
        
    Returns:
        bool: True if successful, False otherwise
    """
    driver = None
    try:
        logger.info(f"Processing account: {account.screen_name}")
        logger.info(f"Using cookie file: {account.cookie_path}")
        
        if not os.path.exists(account.cookie_path):
            logger.error(f"Cookie file not found: {account.cookie_path}")
            return False
        
        deduplicator = PostDeduplicator()
        
        driver = create_driver()
        
        if not load_cookies(driver, account.cookie_path):
            logger.error("Failed to load cookies")
            os.environ["STOP_BOT"] = "1"
            return False
        
        if not post_to_twitter(driver, queue_file, qa_file, deduplicator):
            logger.error("Failed to post to Twitter")
            return False
        
        return True
    
    except Exception as e:
        logger.error(f"Error processing account {account.screen_name}: {e}")
        return False
    
    finally:
        if driver:
            driver.quit()


def process_queue(queue_file: Optional[str] = None, qa_file: Optional[str] = None,
                  env_vars: Optional[Dict[str, str]] = None) -> int:
    """
    Process the queue file and post to Twitter

    Args:
        queue_file: Path to queue file
        qa_file: Path to Q&A data file
        env_vars: Environment variables to set

    Returns:
        int: Exit code (0 for success, 1 for failure)
    """
    try:
        if env_vars:
            for key, value in env_vars.items():
                os.environ[key] = value

        if not queue_file:
            queue_file = os.getenv("QUEUE_FILE", "queue/queue_2025-04-27.yaml")

        if not qa_file:
            qa_file = os.getenv("QA_FILE", "qa_sheet_polite_fixed.csv")

        logger.info(f"Processing queue file: {queue_file}")
        logger.info(f"Using Q&A file: {qa_file}")

        accounts = load_accounts_yaml()

        if not accounts:
            cookie_path = os.getenv("COOKIE_PATH", "niijima_cookies.json")
            if cookie_path:
                logger.info(f"No accounts found in YAML, using environment variable: {cookie_path}")
                accounts = [Account(screen_name="default", cookie_path=cookie_path)]

        if not accounts:
            logger.error("No accounts found")
            return 1

        logger.info(f"Found {len(accounts)} accounts")

        success_count = 0
        for account in accounts:
            if process_account(account, queue_file, qa_file):
                success_count += 1

        if success_count == 0:
            logger.error("All accounts failed")
            return 1

        logger.info(f"Successfully processed {success_count}/{len(accounts)} accounts")
        return 0

    except Exception as e:
        logger.error(f"Error processing queue: {e}")
        return 1


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description="Bot main entry point")
    parser.add_argument("--queue-file", help="Path to queue file")
    parser.add_argument("--qa-file", help="Path to Q&A data file")
    parser.add_argument("--account", help="Specific account to process (from accounts.yaml)")

    args = parser.parse_args()

    if args.account:
        accounts = load_accounts_yaml()
        selected_accounts = [acc for acc in accounts if acc.screen_name == args.account]

        if not selected_accounts:
            logger.error(f"Account not found: {args.account}")
            return 1

        account = selected_accounts[0]
        return 1 if not process_account(account, args.queue_file or os.getenv("QUEUE_FILE", "queue/queue_2025-04-27.yaml"),
                                      args.qa_file or os.getenv("QA_FILE", "qa_sheet_polite_fixed.csv")) else 0

    return process_queue(args.queue_file, args.qa_file)


if __name__ == "__main__":
    sys.exit(main())
