"""
Tests for OCR integration in media services
"""
import unittest
from unittest.mock import MagicMock, patch
import pytest
import os

from bot.services.media import (
    extract_text_from_media,
    extract_text_from_media_url,
    extract_text_from_video_frames
)


class TestMediaOCRIntegration(unittest.TestCase):
    """Test OCR integration in media services"""
    
    def setUp(self):
        self.test_image_path = "/tmp/test_image.jpg"
        self.test_video_path = "/tmp/test_video.mp4"
        self.test_url = "https://example.com/test_image.jpg"
    
    @patch('bot.services.media.os.path.exists')
    @patch('bot.services.media.extract_text_from_image')
    def test_extract_text_from_media_image_success(self, mock_extract_image, mock_exists):
        """Test successful text extraction from image"""
        mock_exists.return_value = True
        mock_extract_image.return_value = "Test text from image"
        
        result = extract_text_from_media(self.test_image_path, media_type='image')
        
        self.assertTrue(result['success'])
        self.assertEqual(result['type'], 'image')
        self.assertEqual(result['text'], "Test text from image")
        self.assertEqual(result['path'], self.test_image_path)
        mock_extract_image.assert_called_once_with(self.test_image_path)
    
    @patch('bot.services.media.os.path.exists')
    @patch('bot.services.media.extract_text_from_video')
    def test_extract_text_from_media_video_success(self, mock_extract_video, mock_exists):
        """Test successful text extraction from video"""
        mock_exists.return_value = True
        mock_extract_video.return_value = [
            {'frame': 0, 'text': 'Frame 0 text'},
            {'frame': 30, 'text': 'Frame 30 text'}
        ]
        
        result = extract_text_from_media(self.test_video_path, media_type='video')
        
        self.assertTrue(result['success'])
        self.assertEqual(result['type'], 'video')
        self.assertEqual(len(result['frames']), 2)
        self.assertEqual(result['frames'][0]['text'], 'Frame 0 text')
        self.assertEqual(result['path'], self.test_video_path)
        mock_extract_video.assert_called_once_with(self.test_video_path)
    
    @patch('bot.services.media.os.path.exists')
    @patch('bot.services.media.os.path.splitext')
    @patch('bot.services.media.extract_text_from_image')
    def test_extract_text_from_media_auto_type_image(self, mock_extract_image, mock_splitext, mock_exists):
        """Test automatic media type detection for image"""
        mock_exists.return_value = True
        mock_splitext.return_value = ('/tmp/test_image', '.jpg')
        mock_extract_image.return_value = "Test text from image"
        
        result = extract_text_from_media(self.test_image_path, media_type='auto')
        
        self.assertTrue(result['success'])
        self.assertEqual(result['type'], 'image')
        self.assertEqual(result['text'], "Test text from image")
        mock_extract_image.assert_called_once_with(self.test_image_path)
    
    @patch('bot.services.media.os.path.exists')
    @patch('bot.services.media.os.path.splitext')
    @patch('bot.services.media.extract_text_from_video')
    def test_extract_text_from_media_auto_type_video(self, mock_extract_video, mock_splitext, mock_exists):
        """Test automatic media type detection for video"""
        mock_exists.return_value = True
        mock_splitext.return_value = ('/tmp/test_video', '.mp4')
        mock_extract_video.return_value = [{'frame': 0, 'text': 'Frame 0 text'}]
        
        result = extract_text_from_media(self.test_video_path, media_type='auto')
        
        self.assertTrue(result['success'])
        self.assertEqual(result['type'], 'video')
        self.assertEqual(len(result['frames']), 1)
        mock_extract_video.assert_called_once_with(self.test_video_path)
    
    @patch('bot.services.media.os.path.exists')
    def test_extract_text_from_media_file_not_found(self, mock_exists):
        """Test error handling when file not found"""
        mock_exists.return_value = False
        
        result = extract_text_from_media("nonexistent.jpg")
        
        self.assertFalse(result['success'])
        self.assertEqual(result['error'], 'File not found')
    
    @patch('bot.services.media.os.path.exists')
    @patch('bot.services.media.os.path.splitext')
    def test_extract_text_from_media_unsupported_extension(self, mock_splitext, mock_exists):
        """Test error handling for unsupported file extension"""
        mock_exists.return_value = True
        mock_splitext.return_value = ('/tmp/test_file', '.txt')
        
        result = extract_text_from_media("/tmp/test_file.txt", media_type='auto')
        
        self.assertFalse(result['success'])
        self.assertIn('Unsupported file extension', result['error'])
    
    @patch('bot.services.media.os.path.exists')
    def test_extract_text_from_media_invalid_type(self, mock_exists):
        """Test error handling for invalid media type"""
        mock_exists.return_value = True
        result = extract_text_from_media(self.test_image_path, media_type='invalid')
        
        self.assertFalse(result['success'])
        self.assertIn('Invalid media type', result['error'])
    
    @patch('bot.services.media.get_media_path')
    @patch('bot.services.media.extract_text_from_media')
    def test_extract_text_from_media_url_success(self, mock_extract_media, mock_get_path):
        """Test successful text extraction from media URL"""
        mock_get_path.return_value = self.test_image_path
        mock_extract_media.return_value = {'success': True, 'type': 'image', 'text': 'Test text'}
        
        result = extract_text_from_media_url(self.test_url, "/tmp/local_image.jpg")
        
        self.assertTrue(result['success'])
        self.assertEqual(result['type'], 'image')
        self.assertEqual(result['text'], 'Test text')
        mock_get_path.assert_called_once_with(self.test_url, "/tmp/local_image.jpg")
        mock_extract_media.assert_called_once_with(self.test_image_path, 'auto')
    
    @patch('bot.services.media.get_media_path')
    def test_extract_text_from_media_url_download_failed(self, mock_get_path):
        """Test error handling when media download fails"""
        mock_get_path.return_value = None
        
        result = extract_text_from_media_url(self.test_url, "/tmp/local_image.jpg")
        
        self.assertFalse(result['success'])
        self.assertEqual(result['error'], 'Failed to get media file')
    
    @patch('bot.services.media.os.path.exists')
    @patch('bot.services.media.extract_text_from_video_frame')
    def test_extract_text_from_video_frames_success(self, mock_extract_frame, mock_exists):
        """Test successful text extraction from specific video frames"""
        mock_exists.return_value = True
        mock_extract_frame.side_effect = ["Frame 10 text", "Frame 20 text"]
        
        result = extract_text_from_video_frames(self.test_video_path, [10, 20])
        
        self.assertTrue(result['success'])
        self.assertEqual(result['type'], 'video_frames')
        self.assertEqual(len(result['frames']), 2)
        self.assertEqual(result['frames'][0]['frame'], 10)
        self.assertEqual(result['frames'][0]['text'], "Frame 10 text")
        self.assertEqual(result['frames'][1]['frame'], 20)
        self.assertEqual(result['frames'][1]['text'], "Frame 20 text")
        self.assertEqual(result['path'], self.test_video_path)
    
    @patch('bot.services.media.os.path.exists')
    @patch('bot.services.media.extract_text_from_video_frame')
    def test_extract_text_from_video_frames_partial_error(self, mock_extract_frame, mock_exists):
        """Test handling of partial errors when extracting from video frames"""
        mock_exists.return_value = True
        mock_extract_frame.side_effect = ["Frame 10 text", Exception("Frame error")]
        
        result = extract_text_from_video_frames(self.test_video_path, [10, 20])
        
        self.assertTrue(result['success'])
        self.assertEqual(result['type'], 'video_frames')
        self.assertEqual(len(result['frames']), 2)
        self.assertEqual(result['frames'][0]['frame'], 10)
        self.assertEqual(result['frames'][0]['text'], "Frame 10 text")
        self.assertEqual(result['frames'][1]['frame'], 20)
        self.assertIn('error', result['frames'][1])
    
    @patch('bot.services.media.os.path.exists')
    def test_extract_text_from_video_frames_file_not_found(self, mock_exists):
        """Test error handling when video file not found"""
        mock_exists.return_value = False
        
        result = extract_text_from_video_frames("nonexistent.mp4", [10, 20])
        
        self.assertFalse(result['success'])
        self.assertEqual(result['error'], 'File not found')


if __name__ == '__main__':
    unittest.main()
