"""
Test script for generate_qa_videos.py
"""
import os
import sys
import logging
from bot.generate_qa_videos import (
    load_qa_data,
    find_answer_for_question,
    create_video_from_image,
    create_combined_video,
    setup_webdriver,
    post_to_twitter,
    reply_to_tweet
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Set environment variables for testing
os.environ["SKIP_TWITTER"] = "False"  # Set to False to test X posting
os.environ["COOKIE_NIIJIMA"] = "niijima_cookies.json"
os.environ["QA_CSV_PATH"] = "qa_sheet_polite_fixed.csv"
os.environ["QUEUE_FILE"] = "queue/queue_2025-04-28.yaml"

def test_load_qa_data():
    """Test loading QA data from CSV"""
    logger.info("Testing load_qa_data()")
    qa_dict = load_qa_data()
    
    if not qa_dict:
        logger.error("Failed to load QA data")
        return False
    
    logger.info(f"Loaded {len(qa_dict)} QA pairs")
    
    # Print a few examples
    for i, (q, a) in enumerate(list(qa_dict.items())[:3]):
        logger.info(f"Example {i+1}:")
        logger.info(f"Q: {q}")
        if isinstance(a, dict):
            logger.info(f"A: {a.get('text', '')[:100]}...")
            logger.info(f"Media URL: {a.get('media_url', 'None')}")
        else:
            logger.info(f"A: {str(a)[:100]}...")
    
    return True

def test_find_answer_for_question():
    """Test finding answers for questions"""
    logger.info("Testing find_answer_for_question()")
    qa_dict = load_qa_data()
    
    if not qa_dict:
        logger.error("Failed to load QA data")
        return False
    
    test_questions = [
        "メンズエステで働くメリットは何でしょうか？",
        "未経験でも稼げるのでしょうか？",
        "出稼ぎの交通費は支給されるのでしょうか？",
        "本指名率を上げるコツはありますか？"
    ]
    
    for question in test_questions:
        answer_data = find_answer_for_question(qa_dict, question)
        logger.info(f"Q: {question}")
        
        if isinstance(answer_data, dict):
            answer_text = answer_data.get('text', '')
            media_url = answer_data.get('media_url', 'None')
            logger.info(f"A: {answer_text[:100]}...")
            logger.info(f"Media URL: {media_url}")
            
            if answer_text == "申し訳ございませんが、この質問に対する回答は現在準備中です。":
                logger.warning(f"No answer found for question: {question}")
        else:
            logger.info(f"A: {str(answer_data)[:100]}...")
            
            if answer_data == "申し訳ございませんが、この質問に対する回答は現在準備中です。":
                logger.warning(f"No answer found for question: {question}")
    
    return True

def test_create_videos():
    """Test creating videos from images"""
    logger.info("Testing create_video_from_image() and create_combined_video()")
    
    os.makedirs("videos", exist_ok=True)
    
    image_paths = [
        "test_images/question_1.png",
        "test_images/question_2.png",
        "test_images/question_3.png",
        "test_images/question_4.png"
    ]
    
    video_paths = []
    
    for i, image_path in enumerate(image_paths):
        video_path = f"videos/question_{i+1}.mp4"
        if create_video_from_image(image_path, video_path):
            video_paths.append(video_path)
            logger.info(f"Created video: {video_path}")
        else:
            logger.error(f"Failed to create video from image: {image_path}")
            return False
    
    combined_video_path = "videos/combined_questions.mp4"
    if create_combined_video(video_paths, combined_video_path):
        logger.info(f"Created combined video: {combined_video_path}")
        return True
    else:
        logger.error("Failed to create combined video")
        return False

def test_x_posting():
    """Test posting to X"""
    logger.info("Testing X posting")
    
    driver = setup_webdriver()
    if not driver:
        logger.error("Failed to set up WebDriver")
        return False
    
    try:
        # Test posting with video
        test_text = "テスト投稿 from Selenium " + os.path.basename(__file__)
        video_path = "videos/combined_questions.mp4"
        
        if not os.path.exists(video_path):
            logger.error(f"Video file not found: {video_path}")
            return False
        
        tweet_url = post_to_twitter(driver, test_text, video_path)
        
        if not tweet_url:
            logger.error("Failed to post to X")
            return False
        
        logger.info(f"Successfully posted to X: {tweet_url}")
        
        # Test replying to tweet
        reply_text = "テスト返信 from Selenium"
        reply_url = reply_to_tweet(driver, tweet_url, reply_text)
        
        if not reply_url:
            logger.error("Failed to reply to tweet")
            return False
        
        logger.info(f"Successfully replied to tweet: {reply_url}")
        
        return True
    finally:
        driver.quit()

def main():
    """Main function"""
    try:
        # Test loading QA data
        if not test_load_qa_data():
            logger.error("Failed to load QA data")
            return 1
        
        # Test finding answers for questions
        if not test_find_answer_for_question():
            logger.error("Failed to find answers for questions")
            return 1
        
        # Test creating videos
        if not test_create_videos():
            logger.error("Failed to create videos")
            return 1
        
        # Skip X posting if SKIP_TWITTER is True
        skip_twitter = os.environ.get("SKIP_TWITTER", "True").lower() == "true"
        if skip_twitter:
            logger.info("Skipping X posting for testing purposes")
            logger.info("To enable X posting, set SKIP_TWITTER=False")
            return 0
        
        # Test X posting
        if not test_x_posting():
            logger.error("Failed to post to X")
            return 1
        
        logger.info("All tests passed!")
        return 0
    
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return 1

if __name__ == "__main__":
    sys.exit(main())
