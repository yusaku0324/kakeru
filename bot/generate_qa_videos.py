"""
Script to generate videos from Figma banners and post them to X with answers
"""
import os
import sys
import json
import yaml
import time
import logging
import datetime
import requests
from typing import Dict, List, Any, Optional
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

FIGMA_API_KEY = os.environ.get("FIGMA_API_KEY")
FIGMA_FILE_ID = os.environ.get("FIGMA_FILE_ID", "aJ8OkMzwRoLlpjnEUdHvfN")
FIGMA_NODE_ID = os.environ.get("FIGMA_NODE_ID", "20-2")
NIIJIMA_COOKIES_PATH = "niijima_cookies.json"
QA_CSV_PATH = "qa_sheet_polite_fixed.csv"
QUEUE_FILE = "queue/queue_2025-04-28.yaml"  # Use fixed file for testing
VIDEO_DURATION = 1  # seconds per video (1 second as requested for Canva-like format)
VIDEO_OUTPUT_DIR = "videos"


def load_qa_data() -> Dict[str, str]:
    """
    Load Q&A data from the CSV file
    
    Returns:
        Dict[str, str]: Dictionary mapping questions to answers
    """
    qa_dict = {}
    
    try:
        with open(QA_CSV_PATH, 'r', encoding='utf-8') as f:
            next(f)
            for line in f:
                if '","' in line:
                    question, answer = line.strip().split('","')
                    question = question.strip('"')
                    answer = answer.strip('"')
                    qa_dict[question] = answer
        
        logger.info(f"Loaded {len(qa_dict)} Q&A pairs from {QA_CSV_PATH}")
        return qa_dict
    except Exception as e:
        logger.error(f"Error loading Q&A data: {e}")
        return {}


def load_queue_questions() -> List[Dict[str, Any]]:
    """
    Load questions from the queue file
    
    Returns:
        List[Dict[str, Any]]: List of question items
    """
    try:
        with open(QUEUE_FILE, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        if not data:
            logger.warning(f"Queue file is empty: {QUEUE_FILE}")
            return []
        
        logger.info(f"Loaded {len(data)} questions from {QUEUE_FILE}")
        return data
    except Exception as e:
        logger.error(f"Error loading queue file: {e}")
        return []


def create_video_from_image(image_path: str, output_path: str) -> bool:
    """
    Create a video from an image URL or local file path in Canva-like format
    
    Args:
        image_path: URL or local path of the image
        output_path: Path to save the video
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        temp_image_path = f"{output_path}.png"
        
        if image_path.startswith(('http://', 'https://')):
            # Download the image from URL
            response = requests.get(image_path)
            response.raise_for_status()
            
            with open(temp_image_path, 'wb') as f:
                f.write(response.content)
        else:
            if os.path.exists(image_path):
                import shutil
                shutil.copy(image_path, temp_image_path)
            else:
                logger.error(f"Local image file not found: {image_path}")
                return False
        
        # Use ffmpeg to create a 1-second video from the image
        ffmpeg_cmd = (
            f"ffmpeg -y -loop 1 -i {temp_image_path} -c:v libx264 -t {VIDEO_DURATION} "
            f"-pix_fmt yuv420p -vf \"scale=1920:1080,format=yuv420p\" "
            f"-profile:v high -level:v 4.0 -crf 18 -r 30 -movflags +faststart {output_path}"
        )
        
        logger.info(f"Running ffmpeg command: {ffmpeg_cmd}")
        result = os.system(ffmpeg_cmd)
        
        if result == 0 and os.path.exists(output_path):
            logger.info(f"Created video: {output_path}")
            return True
        else:
            logger.error(f"Failed to create video: {output_path}")
            return False
    except Exception as e:
        logger.error(f"Error creating video: {e}")
        return False


def setup_webdriver() -> Optional[webdriver.Chrome]:
    """
    Set up Chrome WebDriver with niijima cookies
    
    Returns:
        webdriver.Chrome: Chrome WebDriver instance
    """
    try:
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        
        driver = webdriver.Chrome(options=chrome_options)
        
        with open(NIIJIMA_COOKIES_PATH, 'r', encoding='utf-8') as f:
            cookies = json.load(f)
        
        driver.get("https://twitter.com")
        
        for cookie in cookies:
            if 'expiry' in cookie:
                del cookie['expiry']
            driver.add_cookie(cookie)
        
        driver.get("https://twitter.com/home")
        
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "body"))
        )
        
        logger.info("WebDriver set up successfully")
        return driver
    except Exception as e:
        logger.error(f"Error setting up WebDriver: {e}")
        return None


def post_to_twitter(driver: webdriver.Chrome, text: str, video_path: str) -> Optional[str]:
    """
    Post to Twitter with video
    
    Args:
        driver: Chrome WebDriver instance
        text: Text to post
        video_path: Path to video file
        
    Returns:
        Optional[str]: Tweet URL if successful, None otherwise
    """
    try:
        post_button = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, "[data-testid='tweetTextarea_0']"))
        )
        post_button.click()
        
        text_area = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "[data-testid='tweetTextarea_0']"))
        )
        text_area.send_keys(text)
        
        file_input = driver.find_element(By.CSS_SELECTOR, "input[type='file']")
        file_input.send_keys(os.path.abspath(video_path))
        
        WebDriverWait(driver, 60).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "[data-testid='videoPlayer']"))
        )
        
        post_button = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, "[data-testid='tweetButton']"))
        )
        post_button.click()
        
        time.sleep(5)
        
        tweet_url = driver.current_url
        logger.info(f"Posted to Twitter: {tweet_url}")
        
        return tweet_url
    except Exception as e:
        logger.error(f"Error posting to Twitter: {e}")
        return None


def create_combined_video(video_paths: List[str], output_path: str) -> bool:
    """
    Create a combined video from multiple video files
    
    Args:
        video_paths: List of video file paths
        output_path: Path to save the combined video
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        list_file = f"{output_path}.txt"
        with open(list_file, 'w') as f:
            for video_path in video_paths:
                f.write(f"file '{os.path.abspath(video_path)}'\n")
        
        # Use ffmpeg to concatenate videos
        ffmpeg_cmd = (
            f"ffmpeg -y -f concat -safe 0 -i {list_file} -c copy {output_path}"
        )
        
        logger.info(f"Running ffmpeg command: {ffmpeg_cmd}")
        result = os.system(ffmpeg_cmd)
        
        if result == 0 and os.path.exists(output_path):
            logger.info(f"Created combined video: {output_path}")
            return True
        else:
            logger.error(f"Failed to create combined video: {output_path}")
            return False
    except Exception as e:
        logger.error(f"Error creating combined video: {e}")
        return False


def reply_to_tweet(driver: webdriver.Chrome, tweet_url: str, text: str) -> Optional[str]:
    """
    Reply to a tweet with text only (no video)
    
    Args:
        driver: Chrome WebDriver instance
        tweet_url: URL of the tweet to reply to
        text: Text to post
        
    Returns:
        Optional[str]: Reply URL if successful, None otherwise
    """
    try:
        driver.get(tweet_url)
        
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "[data-testid='reply']"))
        )
        
        reply_button = driver.find_element(By.CSS_SELECTOR, "[data-testid='reply']")
        reply_button.click()
        
        text_area = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "[data-testid='tweetTextarea_0']"))
        )
        text_area.send_keys(text)
        
        reply_button = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, "[data-testid='tweetButton']"))
        )
        reply_button.click()
        
        time.sleep(5)
        
        reply_url = driver.current_url
        logger.info(f"Replied to tweet: {reply_url}")
        
        return reply_url
    except Exception as e:
        logger.error(f"Error replying to tweet: {e}")
        return None


def find_answer_for_question(qa_dict: Dict[str, str], question: str) -> str:
    """
    Find the answer for a question in the Q&A dictionary
    
    Args:
        qa_dict: Dictionary mapping questions to answers
        question: Question to find the answer for
        
    Returns:
        str: Answer for the question, or default message if not found
    """
    for q, a in qa_dict.items():
        if question in q or q in question:
            return a
    
    logger.warning(f"No answer found for question: {question}")
    return "申し訳ございませんが、この質問に対する回答は現在準備中です。"


def main():
    """Main function"""
    try:
        os.makedirs(VIDEO_OUTPUT_DIR, exist_ok=True)
        
        # Load Q&A data
        qa_dict = load_qa_data()
        
        queue_items = load_queue_questions()
        
        if not queue_items:
            logger.error("No questions found in queue")
            return 1
        
        video_paths = []
        questions = []
        for i, item in enumerate(queue_items):
            if 'text' not in item:
                logger.warning(f"Item missing 'text' field: {item}")
                continue
            
            if 'png_url' not in item:
                logger.warning(f"Item missing 'png_url' field: {item}")
                continue
            
            question = item['text']
            questions.append(question)
            image_url = item['png_url']
            
            video_path = f"{VIDEO_OUTPUT_DIR}/question_{i+1}.mp4"
            if create_video_from_image(image_url, video_path):
                video_paths.append(video_path)
        
        if not video_paths:
            logger.error("No videos created")
            return 1
        
        combined_video_path = f"{VIDEO_OUTPUT_DIR}/combined_questions.mp4"
        if not create_combined_video(video_paths, combined_video_path):
            logger.error("Failed to create combined video")
            return 1
        
        logger.info("Video generation completed successfully!")
        logger.info(f"Individual videos: {video_paths}")
        logger.info(f"Combined video: {combined_video_path}")
        
        # Skip Twitter posting for testing
        skip_twitter = os.environ.get("SKIP_TWITTER", "True").lower() == "true"
        if skip_twitter:
            logger.info("Skipping Twitter posting for testing purposes")
            logger.info("To enable Twitter posting, set SKIP_TWITTER=False")
            return 0
        
        driver = setup_webdriver()
        if not driver:
            logger.error("Failed to set up WebDriver")
            return 1
        
        try:
            first_question = questions[0]
            first_answer = find_answer_for_question(qa_dict, first_question)
            
            main_post_text = f"【質問と回答】\n\n質問1: {first_question}\n\n回答: {first_answer}"
            
            # Post main post with combined video
            tweet_url = post_to_twitter(driver, main_post_text, combined_video_path)
            
            if not tweet_url:
                logger.error("Failed to post main tweet")
                return 1
            
            for i in range(1, len(questions)):
                question = questions[i]
                answer = find_answer_for_question(qa_dict, question)
                
                reply_text = f"質問{i+1}: {question}\n\n回答: {answer}"
                
                reply_url = reply_to_tweet(driver, tweet_url, reply_text)
                
                if not reply_url:
                    logger.warning(f"Failed to reply with answer {i+1}")
                    continue
                
                time.sleep(5)
            
            logger.info("Successfully posted all questions and answers")
            return 0
        finally:
            driver.quit()
    
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
