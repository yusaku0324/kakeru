"""
Proxy rotation module for Kakeru
"""
import os
import time
import logging
import random
from typing import Dict, Optional, List, Any

logger = logging.getLogger(__name__)

ROTATION_STRATEGY_PER_SESSION = "per_session"
ROTATION_STRATEGY_PER_5_POSTS = "per_5_posts"
ROTATION_STRATEGY_PER_15_MINUTES = "per_15_minutes"

DEFAULT_ROTATION_STRATEGY = ROTATION_STRATEGY_PER_SESSION


class ProxyManager:
    """Proxy manager for IP rotation"""
    
    def __init__(self, config_path: Optional[str] = None):
        """
        Initialize ProxyManager
        
        Args:
            config_path: Path to proxy configuration file
        """
        self.config_path = config_path
        self.proxies = {}
        self.current_proxy = None
        self.rotation_strategy = DEFAULT_ROTATION_STRATEGY
        self.last_rotation_time = 0
        self.post_count = 0
        
        self._load_config()
    
    def _load_config(self) -> None:
        """Load proxy configuration"""
        try:
            if self.config_path and os.path.exists(self.config_path):
                with open(self.config_path, "r", encoding="utf-8") as f:
                    import yaml
                    config = yaml.safe_load(f)
                    
                    if config and isinstance(config, dict):
                        self.proxies = config.get("proxies", {})
                        self.rotation_strategy = config.get("ip_rotation_strategy", DEFAULT_ROTATION_STRATEGY)
                        
                        logger.info(f"Loaded proxy configuration with {len(self.proxies)} proxies")
                        logger.info(f"Using rotation strategy: {self.rotation_strategy}")
            else:
                logger.warning(f"Proxy configuration file not found: {self.config_path}")
        
        except Exception as e:
            logger.error(f"Error loading proxy configuration: {e}")
    
    def get_proxy(self, tag: Optional[str] = None) -> Optional[Dict[str, str]]:
        """
        Get a proxy by tag
        
        Args:
            tag: Proxy tag
            
        Returns:
            Optional[Dict[str, str]]: Proxy configuration or None if not found
        """
        if not self.proxies:
            return None
        
        if tag and tag in self.proxies:
            return self.proxies[tag]
        
        if not tag:
            tags = list(self.proxies.keys())
            if tags:
                tag = random.choice(tags)
                return self.proxies[tag]
        
        return None
    
    def should_rotate(self) -> bool:
        """
        Check if proxy should be rotated based on strategy
        
        Returns:
            bool: True if proxy should be rotated, False otherwise
        """
        if self.rotation_strategy == ROTATION_STRATEGY_PER_SESSION:
            return self.current_proxy is None
        
        elif self.rotation_strategy == ROTATION_STRATEGY_PER_5_POSTS:
            return self.post_count % 5 == 0
        
        elif self.rotation_strategy == ROTATION_STRATEGY_PER_15_MINUTES:
            current_time = time.time()
            if current_time - self.last_rotation_time >= 15 * 60:
                return True
        
        return False
    
    def rotate_proxy(self, tag: Optional[str] = None) -> Optional[Dict[str, str]]:
        """
        Rotate to a new proxy
        
        Args:
            tag: Proxy tag to use
            
        Returns:
            Optional[Dict[str, str]]: New proxy configuration or None if not available
        """
        if not self.proxies:
            logger.warning("No proxies available for rotation")
            return None
        
        new_proxy = self.get_proxy(tag)
        
        if new_proxy:
            self.current_proxy = new_proxy
            self.last_rotation_time = time.time()
            logger.info(f"Rotated to proxy: {new_proxy.get('host')}:{new_proxy.get('port')}")
        else:
            logger.warning(f"Failed to rotate proxy with tag: {tag}")
        
        return self.current_proxy
    
    def increment_post_count(self) -> None:
        """Increment post count and check if rotation is needed"""
        self.post_count += 1
        
        if self.rotation_strategy == ROTATION_STRATEGY_PER_5_POSTS and self.post_count % 5 == 0:
            logger.info(f"Post count reached {self.post_count}, rotating proxy")
            self.rotate_proxy()


_proxy_manager = None


def get_proxy_manager(config_path: Optional[str] = None) -> ProxyManager:
    """
    Get the global proxy manager instance
    
    Args:
        config_path: Path to proxy configuration file
        
    Returns:
        ProxyManager: Proxy manager instance
    """
    global _proxy_manager
    
    if _proxy_manager is None:
        _proxy_manager = ProxyManager(config_path)
    
    return _proxy_manager


def rotate_proxy(tag: Optional[str] = None) -> Optional[Dict[str, str]]:
    """
    Rotate to a new proxy
    
    Args:
        tag: Proxy tag to use
        
    Returns:
        Optional[Dict[str, str]]: New proxy configuration or None if not available
    """
    proxy_manager = get_proxy_manager()
    
    if proxy_manager.should_rotate():
        return proxy_manager.rotate_proxy(tag)
    
    return proxy_manager.current_proxy
