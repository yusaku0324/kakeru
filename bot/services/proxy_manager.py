"""
Proxy manager for X (Twitter) automation
"""
import os
import yaml
import logging
from collections import deque
from typing import Dict, Optional, List, Set, Deque

logger = logging.getLogger(__name__)


class ProxyManager:
    """
    Manages proxy rotation for X (Twitter) automation
    """
    def __init__(self, config_path: Optional[str] = None):
        """
        Initialize the proxy manager
        
        Args:
            config_path: Path to shadowban.yaml configuration file
        """
        self.config_path = config_path or os.getenv("SHADOWBAN_YAML_PATH", "kakeru/config/shadowban.yaml")
        self.enabled = False
        self.proxy_pool_size = 40
        self.ip_rotation_strategy = "per_session"
        self.sticky_session = True
        self.proxies: Dict[str, str] = {}
        self.account_proxy_map: Dict[str, str] = {}
        self.in_use_proxies: Set[str] = set()
        self.proxy_queue: Deque[str] = deque()
        
        self._load_config()
    
    def _load_config(self) -> None:
        """Load configuration from shadowban.yaml"""
        if not os.path.exists(self.config_path):
            logger.warning(f"Proxy configuration file not found: {self.config_path}")
            return
        
        try:
            with open(self.config_path, "r", encoding="utf-8") as f:
                config = yaml.safe_load(f)
            
            if not config:
                logger.warning(f"Empty proxy configuration file: {self.config_path}")
                return
            
            self.proxy_pool_size = config.get("proxy_pool_size", 40)
            
            self.ip_rotation_strategy = config.get("ip_rotation_strategy", "per_session")
            
            self.sticky_session = config.get("sticky_session", True)
            
            proxies_config = config.get("proxies", {})
            if proxies_config:
                self.enabled = True
                for name, proxy_data in proxies_config.items():
                    if isinstance(proxy_data, dict):
                        host = proxy_data.get("host")
                        port = proxy_data.get("port")
                        username = proxy_data.get("username")
                        password = proxy_data.get("password")
                        
                        if host and port:
                            proxy_url = f"http://{username}:{password}@{host}:{port}" if username and password else f"http://{host}:{port}"
                            self.proxies[name] = proxy_url
                    elif isinstance(proxy_data, str):
                        self.proxies[name] = proxy_data
            
            logger.info(f"Loaded {len(self.proxies)} proxies from configuration")
            logger.info(f"Proxy rotation strategy: {self.ip_rotation_strategy}")
            logger.info(f"Sticky session: {self.sticky_session}")
            
        except Exception as e:
            logger.error(f"Error loading proxy configuration: {e}")
    
    def pick_proxy(self, account_name: str) -> Optional[str]:
        """
        Pick a proxy for the given account
        
        Args:
            account_name: Account name to pick proxy for
            
        Returns:
            Proxy URL or None if no proxy is available
        """
        if not self.enabled or not self.proxies:
            return None
        
        if self.sticky_session and account_name in self.account_proxy_map:
            return self.account_proxy_map[account_name]
        
        if not self.proxy_queue:
            self.proxy_queue.extend(self.proxies.values())
        
        proxy = self.proxy_queue.popleft()
        self.proxy_queue.append(proxy)
        
        self.in_use_proxies.add(proxy)
        self.account_proxy_map[account_name] = proxy
        
        logger.info(f"Picked proxy for account {account_name}: {proxy}")
        return proxy
    
    def release_proxy(self, proxy: str) -> None:
        """
        Release a proxy back to the pool
        
        Args:
            proxy: Proxy URL to release
        """
        if proxy in self.in_use_proxies:
            self.in_use_proxies.remove(proxy)
            
            if not self.sticky_session:
                for account_name, account_proxy in list(self.account_proxy_map.items()):
                    if account_proxy == proxy:
                        del self.account_proxy_map[account_name]
            
            logger.info(f"Released proxy: {proxy}")


_proxy_manager = None


def get_proxy_manager() -> ProxyManager:
    """
    Get the singleton proxy manager instance
    
    Returns:
        ProxyManager instance
    """
    global _proxy_manager
    if _proxy_manager is None:
        _proxy_manager = ProxyManager()
    return _proxy_manager
