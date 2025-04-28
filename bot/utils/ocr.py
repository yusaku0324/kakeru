"""
OCR utilities for extracting text from images and videos
"""
import logging
import os
import tempfile
from typing import List, Dict, Any, Optional
import cv2
import pytesseract
from PIL import Image
import numpy as np

logger = logging.getLogger(__name__)


def extract_text_from_image(image_path: str, lang: str = 'jpn+eng') -> str:
    """
    Extract text from an image using OCR
    
    Args:
        image_path: Path to the image file
        lang: Language code for OCR (default: Japanese + English)
        
    Returns:
        str: Extracted text
    """
    try:
        image = Image.open(image_path)
        
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        text = pytesseract.image_to_string(image, lang=lang)
        
        logger.info(f"Extracted text from image: {image_path}")
        return text.strip()
    
    except Exception as e:
        logger.error(f"Error extracting text from image {image_path}: {e}")
        raise


def extract_text_from_video(video_path: str, frame_interval: int = 30, lang: str = 'jpn+eng') -> List[Dict[str, Any]]:
    """
    Extract text from video frames using OCR
    
    Args:
        video_path: Path to the video file
        frame_interval: Number of frames to skip between OCR operations
        lang: Language code for OCR (default: Japanese + English)
        
    Returns:
        List[Dict[str, Any]]: List of dictionaries containing frame number and extracted text
    """
    try:
        cap = cv2.VideoCapture(video_path)
        
        if not cap.isOpened():
            raise ValueError(f"Could not open video file: {video_path}")
        
        results = []
        frame_count = 0
        
        while True:
            ret, frame = cap.read()
            
            if not ret:
                break
            
            if frame_count % frame_interval == 0:
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pil_image = Image.fromarray(rgb_frame)
                
                text = pytesseract.image_to_string(pil_image, lang=lang)
                
                if text.strip():
                    results.append({
                        'frame': frame_count,
                        'text': text.strip()
                    })
                    logger.debug(f"Extracted text from frame {frame_count}: {text[:50]}...")
            
            frame_count += 1
        
        cap.release()
        logger.info(f"Extracted text from {len(results)} frames in video: {video_path}")
        return results
    
    except Exception as e:
        logger.error(f"Error extracting text from video {video_path}: {e}")
        raise


def preprocess_image_for_ocr(image: Image.Image) -> Image.Image:
    """
    Preprocess image to improve OCR accuracy
    
    Args:
        image: PIL Image object
        
    Returns:
        Image.Image: Preprocessed image
    """
    try:
        img_array = np.array(image)
        
        if len(img_array.shape) == 3:
            gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        else:
            gray = img_array
        
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        denoised = cv2.fastNlMeansDenoising(binary)
        
        return Image.fromarray(denoised)
    
    except Exception as e:
        logger.error(f"Error preprocessing image for OCR: {e}")
        return image  # Return original image if preprocessing fails


def extract_text_from_image_region(image_path: str, region: tuple, lang: str = 'jpn+eng') -> str:
    """
    Extract text from a specific region of an image
    
    Args:
        image_path: Path to the image file
        region: Tuple of (x, y, width, height) defining the region
        lang: Language code for OCR (default: Japanese + English)
        
    Returns:
        str: Extracted text from the region
    """
    try:
        image = Image.open(image_path)
        
        x, y, width, height = region
        cropped = image.crop((x, y, x + width, y + height))
        
        preprocessed = preprocess_image_for_ocr(cropped)
        
        text = pytesseract.image_to_string(preprocessed, lang=lang)
        
        logger.info(f"Extracted text from region {region} in image: {image_path}")
        return text.strip()
    
    except Exception as e:
        logger.error(f"Error extracting text from region in image {image_path}: {e}")
        raise


def extract_text_from_video_frame(video_path: str, frame_number: int, lang: str = 'jpn+eng') -> str:
    """
    Extract text from a specific frame in a video
    
    Args:
        video_path: Path to the video file
        frame_number: Frame number to extract text from
        lang: Language code for OCR (default: Japanese + English)
        
    Returns:
        str: Extracted text from the frame
    """
    try:
        cap = cv2.VideoCapture(video_path)
        
        if not cap.isOpened():
            raise ValueError(f"Could not open video file: {video_path}")
        
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
        
        ret, frame = cap.read()
        
        if not ret:
            raise ValueError(f"Could not read frame {frame_number} from video")
        
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pil_image = Image.fromarray(rgb_frame)
        
        preprocessed = preprocess_image_for_ocr(pil_image)
        
        text = pytesseract.image_to_string(preprocessed, lang=lang)
        
        cap.release()
        logger.info(f"Extracted text from frame {frame_number} in video: {video_path}")
        return text.strip()
    
    except Exception as e:
        logger.error(f"Error extracting text from frame {frame_number} in video {video_path}: {e}")
        raise
