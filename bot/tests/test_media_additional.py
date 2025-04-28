"""
Additional tests for media services to increase coverage
"""
import unittest
from unittest.mock import MagicMock, patch
import pytest
import os

from bot.services.media import (
    create_video_from_image,
    create_combined_video,
    download_media,
    get_media_path
)


class TestMediaAdditional(unittest.TestCase):
    """Additional tests for media services"""
    
    def setUp(self):
        self.test_image_path = "/tmp/test_image.jpg"
        self.test_video_path = "/tmp/test_video.mp4"
        self.test_output_path = "/tmp/output_video.mp4"
        self.test_url = "https://example.com/test_image.jpg"
    
    @patch('bot.services.media.os.path.exists')
    @patch('bot.services.media.os.makedirs')
    @patch('bot.services.media.subprocess.run')
    def test_create_video_from_image_success(self, mock_run, mock_makedirs, mock_exists):
        """Test successful video creation from image"""
        mock_exists.return_value = True
        mock_run.return_value = MagicMock(returncode=0)
        
        result = create_video_from_image(self.test_image_path, self.test_output_path)
        
        self.assertTrue(result)
        mock_makedirs.assert_called_once()
        mock_run.assert_called_once()
    
    @patch('bot.services.media.os.path.exists')
    def test_create_video_from_image_file_not_found(self, mock_exists):
        """Test error when image file not found"""
        mock_exists.return_value = False
        
        result = create_video_from_image("nonexistent.jpg", self.test_output_path)
        
        self.assertFalse(result)
    
    @patch('bot.services.media.os.path.exists')
    @patch('bot.services.media.os.makedirs')
    @patch('bot.services.media.subprocess.run')
    def test_create_video_from_image_ffmpeg_error(self, mock_run, mock_makedirs, mock_exists):
        """Test error when FFmpeg fails"""
        mock_exists.return_value = True
        mock_run.return_value = MagicMock(returncode=1, stderr="FFmpeg error")
        
        result = create_video_from_image(self.test_image_path, self.test_output_path)
        
        self.assertFalse(result)
    
    @patch('bot.services.media.os.path.exists')
    @patch('bot.services.media.os.makedirs')
    @patch('bot.services.media.subprocess.run')
    def test_create_video_from_image_exception(self, mock_run, mock_makedirs, mock_exists):
        """Test exception handling in video creation"""
        mock_exists.return_value = True
        mock_run.side_effect = Exception("Unexpected error")
        
        result = create_video_from_image(self.test_image_path, self.test_output_path)
        
        self.assertFalse(result)
    
    @patch('bot.services.media.os.path.exists')
    @patch('bot.services.media.os.makedirs')
    @patch('bot.services.media.subprocess.run')
    @patch('bot.services.media.os.remove')
    @patch('builtins.open', new_callable=unittest.mock.mock_open)
    def test_create_combined_video_success(self, mock_open, mock_remove, mock_run, mock_makedirs, mock_exists):
        """Test successful video combination"""
        mock_exists.return_value = True
        mock_run.return_value = MagicMock(returncode=0)
        
        video_paths = ["/tmp/video1.mp4", "/tmp/video2.mp4"]
        result = create_combined_video(video_paths, self.test_output_path)
        
        self.assertTrue(result)
        mock_makedirs.assert_called_once()
        mock_run.assert_called_once()
        mock_remove.assert_called_once()
    
    def test_create_combined_video_no_paths(self):
        """Test error when no video paths provided"""
        result = create_combined_video([], self.test_output_path)
        
        self.assertFalse(result)
    
    @patch('bot.services.media.os.path.exists')
    @patch('builtins.open', new_callable=unittest.mock.mock_open)
    def test_create_combined_video_file_not_found(self, mock_open, mock_exists):
        """Test error when video file not found"""
        mock_exists.side_effect = [False]
        
        video_paths = ["/tmp/nonexistent.mp4"]
        result = create_combined_video(video_paths, self.test_output_path)
        
        self.assertFalse(result)
    
    @patch('bot.services.media.os.path.exists')
    @patch('bot.services.media.os.makedirs')
    @patch('bot.services.media.subprocess.run')
    @patch('bot.services.media.os.remove')
    @patch('builtins.open', new_callable=unittest.mock.mock_open)
    def test_create_combined_video_ffmpeg_error(self, mock_open, mock_remove, mock_run, mock_makedirs, mock_exists):
        """Test error when FFmpeg fails"""
        mock_exists.return_value = True
        mock_run.return_value = MagicMock(returncode=1, stderr="FFmpeg error")
        
        video_paths = ["/tmp/video1.mp4"]
        result = create_combined_video(video_paths, self.test_output_path)
        
        self.assertFalse(result)
        mock_remove.assert_called_once()
    
    @patch('bot.services.media.os.path.exists')
    @patch('builtins.open', new_callable=unittest.mock.mock_open)
    def test_create_combined_video_exception(self, mock_open, mock_exists):
        """Test exception handling in video combination"""
        mock_exists.return_value = True
        mock_open.side_effect = Exception("Unexpected error")
        
        video_paths = ["/tmp/video1.mp4"]
        result = create_combined_video(video_paths, self.test_output_path)
        
        self.assertFalse(result)
    
    @patch('bot.services.media.os.makedirs')
    @patch('bot.services.media.urllib.request.urlretrieve')
    @patch('bot.services.media.os.path.exists')
    def test_download_media_success(self, mock_exists, mock_urlretrieve, mock_makedirs):
        """Test successful media download"""
        mock_exists.return_value = True
        
        result = download_media(self.test_url, self.test_output_path)
        
        self.assertTrue(result)
        mock_makedirs.assert_called_once()
        mock_urlretrieve.assert_called_once_with(self.test_url, self.test_output_path)
    
    def test_download_media_invalid_url(self):
        """Test error with invalid URL"""
        result = download_media("invalid_url", self.test_output_path)
        
        self.assertFalse(result)
    
    @patch('bot.services.media.os.makedirs')
    @patch('bot.services.media.urllib.request.urlretrieve')
    @patch('bot.services.media.os.path.exists')
    def test_download_media_download_failed(self, mock_exists, mock_urlretrieve, mock_makedirs):
        """Test error when download fails"""
        mock_exists.return_value = False
        
        result = download_media(self.test_url, self.test_output_path)
        
        self.assertFalse(result)
    
    @patch('bot.services.media.os.makedirs')
    @patch('bot.services.media.urllib.request.urlretrieve')
    def test_download_media_exception(self, mock_urlretrieve, mock_makedirs):
        """Test exception handling in media download"""
        mock_urlretrieve.side_effect = Exception("Download error")
        
        result = download_media(self.test_url, self.test_output_path)
        
        self.assertFalse(result)
    
    def test_get_media_path_no_url(self):
        """Test when no media URL provided"""
        result = get_media_path("", "local_file.jpg")
        
        self.assertIsNone(result)
    
    @patch('bot.services.media.os.path.exists')
    def test_get_media_path_local_file(self, mock_exists):
        """Test when media is a local file"""
        mock_exists.return_value = True
        
        result = get_media_path("/tmp/local_file.jpg", "output.jpg")
        
        self.assertEqual(result, "/tmp/local_file.jpg")
    
    @patch('bot.services.media.os.path.exists')
    @patch('bot.services.media.download_media')
    def test_get_media_path_download_success(self, mock_download, mock_exists):
        """Test successful download from URL"""
        mock_exists.return_value = False
        mock_download.return_value = True
        
        result = get_media_path(self.test_url, "output.jpg")
        
        self.assertEqual(result, "output.jpg")
        mock_download.assert_called_once_with(self.test_url, "output.jpg")
    
    @patch('bot.services.media.os.path.exists')
    @patch('bot.services.media.download_media')
    def test_get_media_path_download_failed(self, mock_download, mock_exists):
        """Test failed download from URL"""
        mock_exists.return_value = False
        mock_download.return_value = False
        
        result = get_media_path(self.test_url, "output.jpg")
        
        self.assertIsNone(result)
    
    @patch('bot.services.media.os.path.exists')
    def test_get_media_path_unrecognized_format(self, mock_exists):
        """Test unrecognized media URL format"""
        mock_exists.return_value = False
        
        result = get_media_path("ftp://example.com/file.jpg", "output.jpg")
        
        self.assertIsNone(result)
    
    def test_get_media_path_exception(self):
        """Test exception handling in get_media_path"""
        with patch('bot.services.media.os.path.exists', side_effect=Exception("Unexpected error")):
            result = get_media_path(self.test_url, "output.jpg")
            
            self.assertIsNone(result)


if __name__ == '__main__':
    unittest.main()
