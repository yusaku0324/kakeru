"""
Tests for OCR utilities
"""
import unittest
from unittest.mock import MagicMock, patch
import pytest
import numpy as np
from PIL import Image
import cv2

from bot.utils.ocr import (
    extract_text_from_image,
    extract_text_from_video,
    preprocess_image_for_ocr,
    extract_text_from_image_region,
    extract_text_from_video_frame
)


class TestOCRUtils(unittest.TestCase):
    """Test OCR utilities"""
    
    def setUp(self):
        self.mock_image = Image.new('RGB', (100, 100), color='white')
        
        self.mock_cap = MagicMock()
        self.mock_cap.isOpened.return_value = True
        self.mock_cap.read.return_value = (True, np.zeros((100, 100, 3), dtype=np.uint8))
    
    @patch('bot.utils.ocr.Image.open')
    @patch('bot.utils.ocr.pytesseract.image_to_string')
    def test_extract_text_from_image_success(self, mock_ocr, mock_open):
        """Test successful text extraction from image"""
        mock_open.return_value = self.mock_image
        mock_ocr.return_value = "Test text"
        
        result = extract_text_from_image("test.jpg")
        
        self.assertEqual(result, "Test text")
        mock_open.assert_called_once_with("test.jpg")
        mock_ocr.assert_called_once()
    
    @patch('bot.utils.ocr.Image.open')
    @patch('bot.utils.ocr.pytesseract.image_to_string')
    def test_extract_text_from_image_with_lang(self, mock_ocr, mock_open):
        """Test text extraction with specific language"""
        mock_open.return_value = self.mock_image
        mock_ocr.return_value = "テストテキスト"
        
        result = extract_text_from_image("test.jpg", lang="jpn")
        
        self.assertEqual(result, "テストテキスト")
        mock_ocr.assert_called_once_with(self.mock_image, lang="jpn")
    
    @patch('bot.utils.ocr.Image.open')
    def test_extract_text_from_image_error(self, mock_open):
        """Test error handling in text extraction from image"""
        mock_open.side_effect = Exception("File not found")
        
        with self.assertRaises(Exception) as context:
            extract_text_from_image("nonexistent.jpg")
        
        self.assertIn("File not found", str(context.exception))
    
    @patch('bot.utils.ocr.cv2.VideoCapture')
    @patch('bot.utils.ocr.pytesseract.image_to_string')
    def test_extract_text_from_video_success(self, mock_ocr, mock_cv2):
        """Test successful text extraction from video"""
        mock_cv2.return_value = self.mock_cap
        mock_ocr.side_effect = ["Frame 0 text", "", "Frame 60 text"]
        
        self.mock_cap.read.side_effect = [(True, np.zeros((100, 100, 3), dtype=np.uint8))] * 90 + [(False, None)]
        
        results = extract_text_from_video("test.mp4", frame_interval=30)
        
        self.assertEqual(len(results), 2)
        self.assertEqual(results[0]['frame'], 0)
        self.assertEqual(results[0]['text'], "Frame 0 text")
        self.assertEqual(results[1]['frame'], 60)
        self.assertEqual(results[1]['text'], "Frame 60 text")
    
    @patch('bot.utils.ocr.cv2.VideoCapture')
    def test_extract_text_from_video_error(self, mock_cv2):
        """Test error handling in text extraction from video"""
        mock_cap = MagicMock()
        mock_cap.isOpened.return_value = False
        mock_cv2.return_value = mock_cap
        
        with self.assertRaises(ValueError) as context:
            extract_text_from_video("nonexistent.mp4")
        
        self.assertIn("Could not open video file", str(context.exception))
    
    def test_preprocess_image_for_ocr(self):
        """Test image preprocessing for OCR"""
        img_array = np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8)
        test_image = Image.fromarray(img_array)
        
        result = preprocess_image_for_ocr(test_image)
        
        self.assertIsInstance(result, Image.Image)
        self.assertEqual(result.mode, 'L')  # Should be grayscale
    
    @patch('bot.utils.ocr.Image.open')
    @patch('bot.utils.ocr.pytesseract.image_to_string')
    def test_extract_text_from_image_region_success(self, mock_ocr, mock_open):
        """Test successful text extraction from image region"""
        mock_open.return_value = self.mock_image
        mock_ocr.return_value = "Region text"
        
        result = extract_text_from_image_region("test.jpg", (10, 10, 50, 50))
        
        self.assertEqual(result, "Region text")
        mock_open.assert_called_once_with("test.jpg")
        mock_ocr.assert_called_once()
    
    @patch('bot.utils.ocr.cv2.VideoCapture')
    @patch('bot.utils.ocr.pytesseract.image_to_string')
    def test_extract_text_from_video_frame_success(self, mock_ocr, mock_cv2):
        """Test successful text extraction from specific video frame"""
        mock_cv2.return_value = self.mock_cap
        mock_ocr.return_value = "Frame 42 text"
        
        result = extract_text_from_video_frame("test.mp4", 42)
        
        self.assertEqual(result, "Frame 42 text")
        self.mock_cap.set.assert_called_once_with(cv2.CAP_PROP_POS_FRAMES, 42)
        self.mock_cap.read.assert_called_once()
    
    @patch('bot.utils.ocr.cv2.VideoCapture')
    def test_extract_text_from_video_frame_error(self, mock_cv2):
        """Test error handling in text extraction from video frame"""
        mock_cap = MagicMock()
        mock_cap.isOpened.return_value = True
        mock_cap.read.return_value = (False, None)
        mock_cv2.return_value = mock_cap
        
        with self.assertRaises(ValueError) as context:
            extract_text_from_video_frame("test.mp4", 42)
        
        self.assertIn("Could not read frame 42", str(context.exception))


if __name__ == '__main__':
    unittest.main()
