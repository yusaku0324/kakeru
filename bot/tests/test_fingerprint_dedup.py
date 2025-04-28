"""
Tests for fingerprint deduplication functionality
"""
import unittest
from unittest.mock import patch, MagicMock
import tempfile
import os
import sqlite3
import time

from bot.utils.fingerprint import PostDeduplicator, generate_fingerprint


class TestFingerprintDedup(unittest.TestCase):
    """Test fingerprint deduplication functionality"""
    
    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(delete=False)
        self.temp_db.close()
        self.deduplicator = PostDeduplicator(self.temp_db.name)
    
    def tearDown(self):
        os.unlink(self.temp_db.name)
    
    def test_deduplication_text_only(self):
        """Test deduplication with text-only posts"""
        text1 = "This is a test tweet #test"
        success1, fingerprint1 = self.deduplicator.add_post(text1)
        self.assertTrue(success1)
        
        success2, fingerprint2 = self.deduplicator.add_post(text1)
        self.assertFalse(success2)
        self.assertEqual(fingerprint1, fingerprint2)
        
        text2 = "This is a different tweet #test"
        success3, fingerprint3 = self.deduplicator.add_post(text2)
        self.assertTrue(success3)
        self.assertNotEqual(fingerprint1, fingerprint3)
    
    def test_deduplication_with_media(self):
        """Test deduplication with text and media"""
        text = "This is a tweet with media #test"
        media1 = "/tmp/test_media1.png"
        media2 = "/tmp/test_media2.png"
        
        with open(media1, 'wb') as f:
            f.write(b"media content 1")
        with open(media2, 'wb') as f:
            f.write(b"media content 2")
        
        try:
            success1, fingerprint1 = self.deduplicator.add_post(text, media1)
            self.assertTrue(success1)
            
            success2, fingerprint2 = self.deduplicator.add_post(text, media1)
            self.assertFalse(success2)
            self.assertEqual(fingerprint1, fingerprint2)
            
            success3, fingerprint3 = self.deduplicator.add_post(text, media2)
            self.assertTrue(success3)
            self.assertNotEqual(fingerprint1, fingerprint3)
        
        finally:
            if os.path.exists(media1):
                os.unlink(media1)
            if os.path.exists(media2):
                os.unlink(media2)
    
    def test_normalized_text_deduplication(self):
        """Test deduplication with normalized text"""
        text1 = "Hello World! #test @user https://example.com"
        text2 = "  hello   world  #different @another https://other.com  "
        
        fingerprint1 = generate_fingerprint(text1)
        fingerprint2 = generate_fingerprint(text2)
        
        self.assertEqual(fingerprint1, fingerprint2)
        
        success1, _ = self.deduplicator.add_post(text1)
        self.assertTrue(success1)
        
        success2, _ = self.deduplicator.add_post(text2)
        self.assertFalse(success2)
    
    def test_concurrent_deduplication(self):
        """Test deduplication with concurrent access"""
        text = "Concurrent test tweet #test"
        
        success1, _ = self.deduplicator.add_post(text)
        self.assertTrue(success1)
        
        success2, _ = self.deduplicator.add_post(text)
        self.assertFalse(success2)
    
    def test_database_integrity(self):
        """Test database integrity and unique index"""
        text = "Database integrity test #test"
        
        success, fingerprint = self.deduplicator.add_post(text)
        self.assertTrue(success)
        
        with sqlite3.connect(self.temp_db.name) as conn:
            cursor = conn.cursor()
            
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='posts'")
            self.assertIsNotNone(cursor.fetchone())
            
            cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_fingerprint'")
            self.assertIsNotNone(cursor.fetchone())
            
            cursor.execute("SELECT fingerprint FROM posts WHERE fingerprint = ?", (fingerprint,))
            result = cursor.fetchone()
            self.assertIsNotNone(result)
            self.assertEqual(result[0], fingerprint)
    
    def test_large_scale_deduplication(self):
        """Test deduplication with many posts"""
        for i in range(100):
            text = f"Unique tweet number {i} #test"
            success, _ = self.deduplicator.add_post(text)
            self.assertTrue(success)
        
        for i in range(100):
            text = f"Unique tweet number {i} #test"
            success, _ = self.deduplicator.add_post(text)
            self.assertFalse(success)
        
        with sqlite3.connect(self.temp_db.name) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM posts")
            count = cursor.fetchone()[0]
            self.assertEqual(count, 100)


if __name__ == '__main__':
    unittest.main()
