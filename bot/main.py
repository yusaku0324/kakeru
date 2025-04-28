"""
Main bot module for Q&A video generation and X posting
"""
import os
import sys
import time
import logging
import argparse
import datetime
from typing import List, Dict, Any, Optional, Union

from bot.utils.log import setup_logger, ensure_utf8_encoding
from bot.services.media import create_video_from_image, create_combined_video, get_media_path
from bot.services.twitter import setup_webdriver, post_to_twitter, reply_to_tweet
from bot.services.html_parse import load_qa_data, load_queue_questions, find_answer_for_question

VIDEO_OUTPUT_DIR = "videos"
os.makedirs(VIDEO_OUTPUT_DIR, exist_ok=True)

logger = setup_logger("bot", "bot.log")

def process_queue(queue_file: str, qa_file: str) -> int:
    """
    キューファイルを処理し、動画を生成してXに投稿する
    
    Args:
        queue_file: キューファイルのパス
        qa_file: Q&Aデータファイルのパス
        
    Returns:
        int: 終了コード（0: 成功、1: 失敗）
    """
    try:
        ensure_utf8_encoding(logger)
        
        logger.info(f"Loading Q&A data from {qa_file}")
        qa_dict = load_qa_data(qa_file, logger)
        
        if not qa_dict:
            logger.error("Failed to load Q&A data")
            return 1
        
        logger.info(f"Loaded {len(qa_dict)} Q&A pairs")
        
        logger.info(f"Loading queue questions from {queue_file}")
        queue_items = load_queue_questions(queue_file, logger)
        
        if not queue_items:
            logger.error("Failed to load queue questions")
            return 1
        
        logger.info(f"Loaded {len(queue_items)} questions from queue")
        
        logger.info("Generating videos...")
        
        video_paths = []
        questions = []
        
        for i, item in enumerate(queue_items):
            question = item['text']
            questions.append(question)
            image_url = item.get('png_url', '')
            
            logger.info(f"Processing question {i+1}: {question}")
            
            if not image_url:
                logger.warning(f"No image URL for question {i+1}, skipping video generation")
                continue
            
            video_path = f"{VIDEO_OUTPUT_DIR}/question_{i+1}.mp4"
            if create_video_from_image(image_url, video_path):
                video_paths.append(video_path)
                logger.info(f"Created video for question {i+1}: {video_path}")
            else:
                logger.error(f"Failed to create video for question {i+1}")
        
        if not video_paths:
            logger.error("No videos created, cannot continue")
            return 1
        
        combined_video_path = f"{VIDEO_OUTPUT_DIR}/combined_questions.mp4"
        logger.info(f"Creating combined video: {combined_video_path}")
        
        if not create_combined_video(video_paths, combined_video_path):
            logger.error("Failed to create combined video")
            return 1
        
        logger.info("Video generation completed successfully!")
        logger.info(f"Individual videos: {video_paths}")
        logger.info(f"Combined video: {combined_video_path}")
        
        logger.info("Starting X posting process...")
        
        driver = setup_webdriver()
        if not driver:
            logger.error("Failed to set up WebDriver")
            return 1
        
        try:
            main_post_text = "メンズエステに関する4つの質問と回答をお届けします。\n\n#メンエス #メンズエステ #求人"
            tweet_url = post_to_twitter(driver, main_post_text, combined_video_path, logger)
            
            if not tweet_url:
                logger.error("Failed to post main tweet")
                return 1
            
            logger.info(f"Posted main tweet: {tweet_url}")
            
            for i, question in enumerate(questions):
                answer_data = find_answer_for_question(qa_dict, question, logger)
                
                if isinstance(answer_data, dict):
                    answer_text = answer_data.get('text', '')
                    media_url = answer_data.get('media_url', '')
                else:
                    answer_text = answer_data
                    media_url = ''
                
                reply_text = f"Q{i+1}: {question}\n\nA: {answer_text}"
                
                media_path = None
                if media_url:
                    media_filename = f"answer_{i+1}.png"
                    media_path = get_media_path(media_url, media_filename)
                
                time.sleep(10)
                
                reply_url = reply_to_tweet(driver, tweet_url, reply_text, media_path, logger)
                
                if reply_url:
                    logger.info(f"Posted reply {i+1}: {reply_url}")
                else:
                    logger.warning(f"Failed to post reply {i+1}")
                
                time.sleep(15)
            
            logger.info("X posting completed successfully!")
            return 0
        
        except Exception as e:
            logger.error(f"Error during X posting: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return 1
        
        finally:
            if driver:
                driver.quit()
                logger.info("WebDriver closed")
    
    except Exception as e:
        logger.error(f"Unexpected error in process_queue function: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return 1

def main() -> int:
    """
    メイン関数
    
    Returns:
        int: 終了コード（0: 成功、1: 失敗）
    """
    try:
        parser = argparse.ArgumentParser(description='Generate Q&A videos and post to X')
        parser.add_argument('--queue', type=str, help='Queue file path')
        parser.add_argument('--qa', type=str, help='Q&A data file path')
        args = parser.parse_args()
        
        queue_file = args.queue
        if not queue_file:
            tomorrow = datetime.datetime.now() + datetime.timedelta(days=1)
            queue_file = f"bot/queue/queue_{tomorrow.strftime('%Y-%m-%d')}.yaml"
            logger.info(f"No queue file specified, using default: {queue_file}")
        
        if not os.path.exists(queue_file):
            logger.error(f"Queue file not found: {queue_file}")
            return 1
        
        qa_file = args.qa
        if not qa_file:
            qa_file = os.getenv("JSONL_PATH", "qa_sheet_polite_fixed.csv")
            logger.info(f"No Q&A file specified, using default: {qa_file}")
        
        if not os.path.exists(qa_file):
            logger.error(f"Q&A file not found: {qa_file}")
            return 1
        
        return process_queue(queue_file, qa_file)
    
    except Exception as e:
        logger.error(f"Unexpected error in main function: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return 1

if __name__ == "__main__":
    sys.exit(main())
