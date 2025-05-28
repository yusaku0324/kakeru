"""HimeDeco configuration."""
from dataclasses import dataclass
from typing import Optional, Dict, Any


@dataclass
class HimeDecoConfig:
    """Configuration for HimeDeco client."""
    
    # Authentication
    username: str
    password: str
    
    # URLs (update with actual HimeDeco URLs)
    base_url: str = "https://himedeco.jp"
    login_url: str = "https://himedeco.jp/login"
    diary_url: str = "https://himedeco.jp/diary"
    
    # Posting settings
    max_photos_per_entry: int = 10
    max_title_length: int = 100
    max_content_length: int = 5000
    max_tags: int = 10
    
    # Browser settings
    headless: bool = False
    window_size: tuple = (1280, 720)
    user_agent: Optional[str] = None
    
    # Timeout settings
    page_load_timeout: int = 30
    element_wait_timeout: int = 20
    
    # Retry settings
    max_retries: int = 3
    retry_delay: int = 5
    
    @classmethod
    def from_dict(cls, config_dict: Dict[str, Any]) -> "HimeDecoConfig":
        """Create config from dictionary."""
        return cls(**config_dict)