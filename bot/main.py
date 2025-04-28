"""
Main entry point for the Twitter posting bot
"""
import logging
import os
import sys
from typing import Optional

from bot.utils.fingerprint import PostDeduplicator
from bot.services.twitter_client.cookie_loader import load_cookies
from bot.services.twitter_client.cdp_input import cdp_insert_text
from bot.utils.log import configure_logging, ensure_utf8_encoding

logger = logging.getLogger(__name__)

def main():
    """
    Main entry point for the Twitter posting bot
    """
    configure_logging()
    
    ensure_utf8_encoding()
    
    logger.info("Starting Twitter posting bot")
    
    deduplicator = PostDeduplicator(os.environ.get("DEDUP_DB_PATH", "posts.db"))
    
    post_text = "This is a test post from the Twitter bot"
    
    if deduplicator.is_duplicate(post_text):
        logger.warning(f"Post is a duplicate, skipping: {post_text}")
        return 1
    
    success, fingerprint = deduplicator.add_post(post_text)
    if success:
        logger.info(f"Post added to deduplicator with fingerprint: {fingerprint}")
    else:
        logger.warning(f"Failed to add post to deduplicator: {fingerprint}")
    
    logger.info("Twitter posting bot completed successfully")
    return 0

if __name__ == "__main__":
    sys.exit(main())
