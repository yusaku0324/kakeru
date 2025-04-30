"""
Account management module for Kakeru
"""
import os
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any

import yaml

from kakeru.proxy import get_proxy_manager, rotate_proxy

logger = logging.getLogger(__name__)

CONFIG_PATH = Path(__file__).parent / "config" / "accounts.yaml"
SHADOWBAN_CONFIG_PATH = Path(__file__).parent / "config" / "shadowban.yaml"


class Account:
    """Account class representing an X account configuration"""
    
    def __init__(self, screen_name: str, cookie_path: str, proxy_tag: Optional[str] = None):
        """
        Initialize Account
        
        Args:
            screen_name: X account screen name
            cookie_path: Path to cookie file
            proxy_tag: Optional proxy tag for IP rotation
        """
        self.screen_name = screen_name
        self.cookie_path = cookie_path
        self.proxy_tag = proxy_tag
        self._proxy_config = None
    
    def __repr__(self) -> str:
        """String representation of Account"""
        return f"Account(screen_name='{self.screen_name}', cookie_path='{self.cookie_path}', proxy_tag={self.proxy_tag})"
    
    @property
    def proxy_config(self) -> Optional[Dict[str, Any]]:
        """
        Get proxy configuration for this account
        
        Returns:
            Optional[Dict[str, Any]]: Proxy configuration or None if not available
        """
        if self._proxy_config is None and self.proxy_tag:
            # Initialize proxy manager with shadowban config
            proxy_manager = get_proxy_manager(SHADOWBAN_CONFIG_PATH)
            
            self._proxy_config = proxy_manager.get_proxy(self.proxy_tag)
        
        return self._proxy_config
    
    def rotate_proxy(self) -> Optional[Dict[str, Any]]:
        """
        Rotate proxy for this account
        
        Returns:
            Optional[Dict[str, Any]]: New proxy configuration or None if not available
        """
        if self.proxy_tag:
            self._proxy_config = rotate_proxy(self.proxy_tag)
            return self._proxy_config
        
        return None


def load_accounts_yaml() -> List[Account]:
    """
    Load accounts from YAML configuration
    
    Returns:
        List[Account]: List of Account objects
    """
    try:
        if not CONFIG_PATH.exists():
            logger.error(f"Configuration file not found: {CONFIG_PATH}")
            return []
        
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f)
        
        if not config:
            logger.error("Empty configuration file")
            return []
        
        accounts = []
        for screen_name, details in config.items():
            if not isinstance(details, dict):
                logger.warning(f"Invalid configuration for {screen_name}: {details}")
                continue
            
            cookie_path = details.get("cookie")
            if not cookie_path:
                logger.warning(f"No cookie path specified for {screen_name}")
                continue
            
            if not os.path.isabs(cookie_path):
                cookie_path = os.path.abspath(cookie_path)
            
            proxy_tag = details.get("proxy")
            
            accounts.append(Account(screen_name, cookie_path, proxy_tag))
        
        return accounts
    
    except Exception as e:
        logger.error(f"Error loading accounts configuration: {e}")
        return []
