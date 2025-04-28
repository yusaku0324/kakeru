"""
Test script to verify QA data loading with media URLs
"""
import os
import sys
import logging
from bot.generate_qa_videos import load_qa_data, find_answer_for_question

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    """Test QA data loading with media URLs"""
    try:
        logger.info("Loading QA data...")
        qa_dict = load_qa_data()
        
        if not qa_dict:
            logger.error("No QA data loaded")
            return 1
        
        logger.info(f"Loaded {len(qa_dict)} QA pairs")
        
        test_questions = [
            "メンズエステで働くメリットは何でしょうか？",
            "未経験でも稼げるのでしょうか？",
            "出稼ぎの交通費は支給されるのでしょうか？",
            "本指名率を上げるコツはありますか？"
        ]
        
        for question in test_questions:
            logger.info(f"Finding answer for question: {question}")
            answer_data = find_answer_for_question(qa_dict, question)
            
            logger.info(f"Question: {question}")
            logger.info(f"Answer text: {answer_data.get('text', 'No text found')}")
            logger.info(f"Media URL: {answer_data.get('media_url', 'No media URL found')}")
            logger.info("-" * 50)
        
        return 0
    
    except Exception as e:
        logger.error(f"Error in test script: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return 1

if __name__ == "__main__":
    sys.exit(main())
