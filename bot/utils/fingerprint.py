"""
Fingerprint utility for deduplicating posts
"""
import hashlib
import re
import sqlite3
import os
from typing import Optional, Tuple
import logging

logger = logging.getLogger(__name__)


def normalize_text(text: str) -> str:
    """
    Normalize text for fingerprinting
    
    Args:
        text: Input text to normalize
        
    Returns:
        Normalized text
    """
    text = re.sub(r'\s+', ' ', text).strip()
    
    text = text.lower()
    
    text = re.sub(r'https?://\S+', '', text)
    
    text = re.sub(r'@\w+', '', text)
    
    text = re.sub(r'#\w+', '', text)
    
    text = re.sub(r'[^\w\s]', '', text)
    
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text


def calculate_media_hash(media_path: str) -> str:
    """
    Calculate SHA256 hash of media file
    
    Args:
        media_path: Path to media file
        
    Returns:
        SHA256 hash of the file
    """
    if not os.path.exists(media_path):
        return ""
    
    sha256_hash = hashlib.sha256()
    with open(media_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    
    return sha256_hash.hexdigest()


def generate_fingerprint(text: str, media_path: Optional[str] = None) -> str:
    """
    Generate SHA256 fingerprint for a post
    
    Args:
        text: Post text
        media_path: Optional path to media file
        
    Returns:
        SHA256 fingerprint
    """
    normalized_text = normalize_text(text)
    
    if media_path:
        media_hash = calculate_media_hash(media_path)
        combined = f"{normalized_text}:{media_hash}"
    else:
        combined = normalized_text
    
    return hashlib.sha256(combined.encode('utf-8')).hexdigest()


class PostDeduplicator:
    """
    Deduplicator using SQLite with unique index
    """
    
    def __init__(self, db_path: str = "posts.db"):
        """
        Initialize deduplicator with SQLite database
        
        Args:
            db_path: Path to SQLite database file
        """
        self.db_path = db_path
        self._init_db()
    
    def _init_db(self):
        """Initialize SQLite database with unique index"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS posts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    fingerprint TEXT NOT NULL UNIQUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cursor.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS idx_fingerprint 
                ON posts(fingerprint)
            """)
            conn.commit()
    
    def is_duplicate(self, text: str, media_path: Optional[str] = None) -> bool:
        """
        Check if post is a duplicate
        
        Args:
            text: Post text
            media_path: Optional path to media file
            
        Returns:
            True if duplicate, False otherwise
        """
        fingerprint = generate_fingerprint(text, media_path)
        
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1 FROM posts WHERE fingerprint = ?", (fingerprint,))
            result = cursor.fetchone()
            
            return result is not None
    
    def add_post(self, text: str, media_path: Optional[str] = None) -> Tuple[bool, str]:
        """
        Add post to database if not duplicate
        
        Args:
            text: Post text
            media_path: Optional path to media file
            
        Returns:
            Tuple of (success, fingerprint)
        """
        fingerprint = generate_fingerprint(text, media_path)
        
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("INSERT INTO posts (fingerprint) VALUES (?)", (fingerprint,))
                conn.commit()
                logger.info(f"Added new post with fingerprint: {fingerprint}")
                return True, fingerprint
        except sqlite3.IntegrityError:
            logger.warning(f"Duplicate post detected with fingerprint: {fingerprint}")
            return False, fingerprint
        except Exception as e:
            logger.error(f"Error adding post: {e}")
            return False, fingerprint
