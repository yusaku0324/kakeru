"""
Account management module for X (Twitter) accounts
"""
import os
import yaml
from typing import List, Optional, Dict, Any


class Account:
    """
    Account model for X (Twitter) accounts
    """
    def __init__(self, screen_name: str, cookie_path: str, user_agent: Optional[str] = None):
        """
        Initialize an Account instance
        
        Args:
            screen_name: X (Twitter) screen name
            cookie_path: Path to cookie file
            user_agent: User agent string to use for this account
        """
        self.screen_name = screen_name
        self.cookie_path = cookie_path
        self.user_agent = user_agent or (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/123.0.0.0 Safari/537.36"
        )


def load_accounts_yaml(config_path: Optional[str] = None) -> List[Account]:
    """
    Load accounts from YAML configuration file
    
    Args:
        config_path: Path to accounts.yaml file
        
    Returns:
        List of Account instances
    """
    if not config_path:
        config_path = os.getenv("ACCOUNTS_YAML_PATH", "kakeru/config/accounts.yaml")
    
    if not os.path.exists(config_path):
        return []
    
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            accounts_data = yaml.safe_load(f)
        
        if not accounts_data:
            return []
        
        accounts = []
        for screen_name, account_data in accounts_data.items():
            if isinstance(account_data, dict):
                cookie_path = account_data.get("cookie")
                user_agent = account_data.get("user_agent")
                
                if cookie_path:
                    accounts.append(Account(
                        screen_name=screen_name,
                        cookie_path=cookie_path,
                        user_agent=user_agent
                    ))
            elif isinstance(account_data, str):
                accounts.append(Account(
                    screen_name=screen_name,
                    cookie_path=account_data
                ))
        
        return accounts
    
    except Exception as e:
        print(f"Error loading accounts from {config_path}: {e}")
        return []
