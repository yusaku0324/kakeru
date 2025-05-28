"""Main entry point for HimeDeco posting."""
import logging
import argparse
from pathlib import Path
from typing import List, Optional
import yaml

from bot.services.twitter_client.driver_factory import DriverFactory
from bot.services.twitter_client.cookie_loader import CookieLoader
from bot.services.himedeco_client.poster import HimeDecoPoster
from bot.services.himedeco_client.config import HimeDecoConfig
from bot.utils.backoff import BackoffHandler

logger = logging.getLogger(__name__)


class HimeDecoClient:
    """Main client for HimeDeco operations."""
    
    def __init__(self, config: HimeDecoConfig):
        """Initialize HimeDeco client.
        
        Args:
            config: HimeDeco configuration
        """
        self.config = config
        self.driver = None
        self.poster = None
        self.backoff_handler = BackoffHandler(
            max_retries=config.max_retries,
            initial_delay=config.retry_delay
        )
    
    def initialize_driver(self, cookie_path: Optional[str] = None) -> bool:
        """Initialize browser driver.
        
        Args:
            cookie_path: Optional path to cookies file
            
        Returns:
            bool: True if initialization successful
        """
        try:
            # Create driver
            driver_factory = DriverFactory()
            self.driver = driver_factory.create_driver(
                headless=self.config.headless,
                user_agent=self.config.user_agent,
                window_size=self.config.window_size
            )
            
            # Set timeouts
            self.driver.set_page_load_timeout(self.config.page_load_timeout)
            
            # Load cookies if provided
            if cookie_path and Path(cookie_path).exists():
                cookie_loader = CookieLoader()
                cookie_loader.load_cookies(self.driver, cookie_path, self.config.base_url)
            
            # Initialize poster
            self.poster = HimeDecoPoster(self.driver, self.backoff_handler)
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize driver: {str(e)}")
            return False
    
    def login(self) -> bool:
        """Login to HimeDeco.
        
        Returns:
            bool: True if login successful
        """
        if not self.poster:
            logger.error("Poster not initialized")
            return False
            
        return self.poster.login(self.config.username, self.config.password)
    
    def post_diary(
        self,
        title: str,
        content: str,
        photo_paths: List[str],
        tags: Optional[List[str]] = None
    ) -> bool:
        """Post a diary entry.
        
        Args:
            title: Entry title
            content: Entry content
            photo_paths: List of photo file paths
            tags: Optional list of tags
            
        Returns:
            bool: True if posting successful
        """
        if not self.poster:
            logger.error("Poster not initialized")
            return False
        
        # Validate inputs
        if len(title) > self.config.max_title_length:
            logger.warning(f"Title too long, truncating to {self.config.max_title_length} chars")
            title = title[:self.config.max_title_length]
        
        if len(content) > self.config.max_content_length:
            logger.warning(f"Content too long, truncating to {self.config.max_content_length} chars")
            content = content[:self.config.max_content_length]
        
        if len(photo_paths) > self.config.max_photos_per_entry:
            logger.warning(f"Too many photos, using first {self.config.max_photos_per_entry}")
            photo_paths = photo_paths[:self.config.max_photos_per_entry]
        
        if tags and len(tags) > self.config.max_tags:
            logger.warning(f"Too many tags, using first {self.config.max_tags}")
            tags = tags[:self.config.max_tags]
        
        # Post diary entry
        result = self.poster.post_diary_entry(title, content, photo_paths, tags)
        
        return result["success"]
    
    def cleanup(self):
        """Clean up resources."""
        if self.driver:
            try:
                self.driver.quit()
            except Exception as e:
                logger.error(f"Error closing driver: {str(e)}")


def main():
    """Main entry point for command line usage."""
    parser = argparse.ArgumentParser(description="Post to HimeDeco photo diary")
    parser.add_argument("--config", required=True, help="Path to config file")
    parser.add_argument("--title", required=True, help="Diary entry title")
    parser.add_argument("--content", required=True, help="Diary entry content")
    parser.add_argument("--photos", nargs="+", help="Photo file paths")
    parser.add_argument("--tags", nargs="+", help="Tags for the entry")
    parser.add_argument("--cookies", help="Path to cookies file")
    parser.add_argument("--dry-run", action="store_true", help="Dry run mode")
    
    args = parser.parse_args()
    
    # Setup logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    
    # Load config
    with open(args.config, "r") as f:
        config_dict = yaml.safe_load(f)
    
    config = HimeDecoConfig.from_dict(config_dict)
    
    if args.dry_run:
        logger.info("DRY RUN MODE - No actual posting will occur")
        logger.info(f"Title: {args.title}")
        logger.info(f"Content: {args.content}")
        logger.info(f"Photos: {args.photos}")
        logger.info(f"Tags: {args.tags}")
        return
    
    # Create client
    client = HimeDecoClient(config)
    
    try:
        # Initialize driver
        if not client.initialize_driver(args.cookies):
            logger.error("Failed to initialize driver")
            return
        
        # Login if no cookies
        if not args.cookies:
            if not client.login():
                logger.error("Failed to login")
                return
        
        # Post diary
        success = client.post_diary(
            title=args.title,
            content=args.content,
            photo_paths=args.photos or [],
            tags=args.tags
        )
        
        if success:
            logger.info("Successfully posted diary entry")
        else:
            logger.error("Failed to post diary entry")
            
    finally:
        client.cleanup()


if __name__ == "__main__":
    main()