"""Example of posting to multiple platforms (Twitter/X and HimeDeco)."""
import logging
import yaml
from pathlib import Path
from typing import List, Optional

from bot.services.twitter_client.poster import TwitterPoster
from bot.services.himedeco_client.main import HimeDecoClient
from bot.services.himedeco_client.config import HimeDecoConfig


logger = logging.getLogger(__name__)


class MultiPlatformPoster:
    """Post to multiple social media platforms."""
    
    def __init__(self, twitter_config_path: str, himedeco_config_path: str):
        """Initialize multi-platform poster.
        
        Args:
            twitter_config_path: Path to Twitter config file
            himedeco_config_path: Path to HimeDeco config file
        """
        self.twitter_config_path = twitter_config_path
        self.himedeco_config_path = himedeco_config_path
        
    def post_to_all_platforms(
        self,
        title: str,
        content: str,
        media_paths: Optional[List[str]] = None,
        tags: Optional[List[str]] = None,
        twitter_only_content: Optional[str] = None
    ) -> dict:
        """Post content to all configured platforms.
        
        Args:
            title: Title for the post (used in HimeDeco)
            content: Main content/description
            media_paths: List of media file paths
            tags: List of tags/hashtags
            twitter_only_content: Optional Twitter-specific content (280 char limit)
            
        Returns:
            dict: Results from each platform
        """
        results = {
            "twitter": {"success": False, "error": None},
            "himedeco": {"success": False, "error": None}
        }
        
        # Post to Twitter/X
        try:
            logger.info("Posting to Twitter/X...")
            twitter_result = self._post_to_twitter(
                content=twitter_only_content or content,
                media_paths=media_paths
            )
            results["twitter"] = twitter_result
        except Exception as e:
            logger.error(f"Twitter posting failed: {str(e)}")
            results["twitter"]["error"] = str(e)
        
        # Post to HimeDeco
        try:
            logger.info("Posting to HimeDeco...")
            himedeco_result = self._post_to_himedeco(
                title=title,
                content=content,
                photo_paths=media_paths,
                tags=tags
            )
            results["himedeco"] = himedeco_result
        except Exception as e:
            logger.error(f"HimeDeco posting failed: {str(e)}")
            results["himedeco"]["error"] = str(e)
        
        return results
    
    def _post_to_twitter(self, content: str, media_paths: Optional[List[str]] = None) -> dict:
        """Post to Twitter/X.
        
        Args:
            content: Tweet content
            media_paths: Optional media files
            
        Returns:
            dict: Posting result
        """
        # Load Twitter config
        with open(self.twitter_config_path, "r") as f:
            twitter_config = yaml.safe_load(f)
        
        # This is a simplified example - actual implementation would use
        # the existing Twitter posting logic from bot/main.py
        # For now, returning mock result
        return {
            "success": True,
            "tweet_url": "https://twitter.com/username/status/123456789",
            "error": None
        }
    
    def _post_to_himedeco(
        self,
        title: str,
        content: str,
        photo_paths: Optional[List[str]] = None,
        tags: Optional[List[str]] = None
    ) -> dict:
        """Post to HimeDeco.
        
        Args:
            title: Entry title
            content: Entry content
            photo_paths: Optional photo files
            tags: Optional tags
            
        Returns:
            dict: Posting result
        """
        # Load HimeDeco config
        with open(self.himedeco_config_path, "r") as f:
            config_dict = yaml.safe_load(f)
        
        config = HimeDecoConfig.from_dict(config_dict)
        client = HimeDecoClient(config)
        
        try:
            # Initialize and login
            if not client.initialize_driver():
                return {"success": False, "error": "Failed to initialize driver"}
            
            if not client.login():
                return {"success": False, "error": "Failed to login"}
            
            # Post diary
            success = client.post_diary(
                title=title,
                content=content,
                photo_paths=photo_paths or [],
                tags=tags
            )
            
            return {
                "success": success,
                "entry_url": "https://himedeco.jp/diary/entry/new",
                "error": None if success else "Posting failed"
            }
            
        finally:
            client.cleanup()


def main():
    """Example usage."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Post to multiple platforms")
    parser.add_argument("--title", required=True, help="Post title")
    parser.add_argument("--content", required=True, help="Post content")
    parser.add_argument("--media", nargs="+", help="Media file paths")
    parser.add_argument("--tags", nargs="+", help="Tags")
    parser.add_argument("--twitter-content", help="Twitter-specific content")
    parser.add_argument("--twitter-config", default="bot/config/accounts.yaml")
    parser.add_argument("--himedeco-config", default="bot/config/himedeco.yaml")
    
    args = parser.parse_args()
    
    # Setup logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    
    # Create poster
    poster = MultiPlatformPoster(
        twitter_config_path=args.twitter_config,
        himedeco_config_path=args.himedeco_config
    )
    
    # Post to all platforms
    results = poster.post_to_all_platforms(
        title=args.title,
        content=args.content,
        media_paths=args.media,
        tags=args.tags,
        twitter_only_content=args.twitter_content
    )
    
    # Print results
    for platform, result in results.items():
        if result["success"]:
            logger.info(f"{platform}: Success!")
            if "tweet_url" in result:
                logger.info(f"  Tweet URL: {result['tweet_url']}")
            if "entry_url" in result:
                logger.info(f"  Entry URL: {result['entry_url']}")
        else:
            logger.error(f"{platform}: Failed - {result['error']}")


if __name__ == "__main__":
    main()