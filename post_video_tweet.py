import csv
import json
import random
import time
import logging
import argparse
import asyncio
from pathlib import Path
from typing import Dict, List, Set, Optional, Any
from datetime import datetime

# Custom module imports
try:
    from bot.services.twitter_client.driver_factory import create_driver
    from bot.services.twitter_client.cookie_loader import load_cookies
    from bot.services.twitter_client.poster import post_to_twitter
    from bot.utils.log import setup_logger
except ImportError as e:
    print(f"Error importing bot modules: {e}. Ensure 'bot' directory is in PYTHONPATH or script is run from project root.")
    # Fallback basic logger if setup_logger fails
    logger = logging.getLogger("video_tweeter_fallback")
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    logger.warning("Using fallback basic logging due to import error.")
    # To make the script runnable for testing even if bot modules are missing, define stubs
    # This is NOT for production but helps in isolated script development/testing.
    if "create_driver" not in globals():
        def create_driver(headless):
            logger.error("STUB: create_driver called! Bot modules not loaded.")
            raise NotImplementedError("create_driver stub called")
    if "load_cookies" not in globals():
        def load_cookies(driver, path):
            logger.error("STUB: load_cookies called! Bot modules not loaded.")
            return False # Simulate failure
    if "post_to_twitter" not in globals():
        def post_to_twitter(driver, post_text, media_files, logger):
            logger.error("STUB: post_to_twitter called! Bot modules not loaded.")
            return None # Simulate failure
else:
    logger = setup_logger("video_tweeter", "video_tweeter.log")

from dotenv import load_dotenv

load_dotenv()

# --- Constants and Configuration ---
QUESTIONS_TSV_PATH = Path("questions.tsv")
VIDEO_MAP_CSV_PATH = Path("video_question_map.csv")
# POSTED_LOG_PATH will be dynamic
# COOKIE_FILE_PATH will be dynamic
# TARGET_ACCOUNT_NAME will be dynamic
COMMON_HASHTAGS = "京都 祇園 水商売 キャバクラ クラブ スカウト 関西 大阪 木屋町 未経験"
HEADLESS_BROWSER = True # Static global for default, overridden by CLI arg

# --- Helper Functions ---

def load_questions_and_answers(filepath: Path) -> Dict[str, str]:
    """Loads Q&A from a TSV file (Question\tAnswer)."""
    qa_map = {}
    if not filepath.exists():
        logger.error(f"Questions TSV file not found: {filepath}")
        return qa_map
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.reader(f, delimiter="\t")
        for i, row in enumerate(reader):
            if len(row) == 2:
                question_raw, answer_raw = row[0], row[1]
                question = " ".join(question_raw.strip().split())
                answer = answer_raw.strip()
                if question:
                    qa_map[question] = answer
            else:
                logger.warning(f"Skipping malformed row {i+1} in {filepath}: {row}")
    logger.info(f"Loaded {len(qa_map)} Q&A pairs from {filepath}")
    return qa_map

def load_video_map(filepath: Path) -> Dict[str, str]:
    """Loads video map from a CSV file (question,video_path)."""
    video_map = {}
    if not filepath.exists():
        logger.error(f"Video map CSV file not found: {filepath}")
        return video_map
    with open(filepath, "r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            question_raw = row.get("question")
            video_path_raw = row.get("video_path")
            if question_raw and video_path_raw:
                question = " ".join(question_raw.strip().split())
                video_path = video_path_raw.strip()
                video_map[question] = video_path
            else:
                logger.warning(f"Skipping row with missing data in {filepath}: {row}")
    logger.info(f"Loaded {len(video_map)} video mappings from {filepath}")
    return video_map

def load_posted_log(filepath: Path) -> Set[str]:
    """Loads the set of already posted questions (one question per line)."""
    posted_questions = set()
    if filepath.exists():
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                posted_questions.add(" ".join(line.strip().split()))
    logger.info(f"Loaded {len(posted_questions)} posted items from {filepath}")
    return posted_questions

def append_to_posted_log(filepath: Path, question_text: str):
    """Appends a question to the log of posted items."""
    filepath.parent.mkdir(parents=True, exist_ok=True)
    normalized_question_text = " ".join(question_text.strip().split())
    with open(filepath, "a", encoding="utf-8") as f:
        f.write(f"{normalized_question_text}\n")
    logger.info(f"Logged as posted: {normalized_question_text[:50]}... to {filepath}")

def select_item_to_post(
    qa_data: Dict[str, str],
    video_map: Dict[str, str],
    posted_log: Set[str],
    account_id: str
) -> Optional[Dict[str, str]]:
    """
    Selects an item to post. Prioritizes unposted items.
    Returns a dictionary with 'question', 'answer', 'video_path' or None.
    """
    available_items = []
    for q_text_key, answer_text in qa_data.items():
        normalized_q_key = " ".join(q_text_key.strip().split()) # Key in qa_data is already normalized by load_questions_and_answers
        if normalized_q_key in video_map:
            available_items.append({
                "question": normalized_q_key,
                "answer": answer_text,
                "video_path": video_map[normalized_q_key]
            })
        else:
            logger.warning(f"Question '{normalized_q_key[:50]}...' found in Q&A but not in video map. Skipping.")

    if not available_items:
        logger.warning("No items available for posting (Q&A and video map yielded no combined items).")
        return None

    unposted_items = [item for item in available_items if item["question"] not in posted_log]
    
    selected_item = None
    if unposted_items:
        logger.info(f"{len(unposted_items)} unposted items available. Selecting one randomly.")
        selected_item = random.choice(unposted_items)
    elif available_items:
        logger.info("All available items have been posted before. Selecting one randomly from all items.")
        selected_item = random.choice(available_items)
    else:
        logger.warning("No items to select for posting.")
        return None
        
    if selected_item:
        logger.info(f"Selected item to post: {selected_item['question'][:50]}...")
    return selected_item

async def main_post_video_tweet(account_id: str, run_headless: bool):
    logger.info(f"--- Starting Video Tweet Posting Script for account: {account_id} (Headless: {run_headless}) ---")
    
    cookie_file_path = Path(f"cookies/{account_id}_twitter_cookies.json")
    posted_log_path = Path(f"logs/posted_video_tweets_{account_id}.log")
    video_map_file = Path(f"video_question_map_{account_id}.csv")
    questions_file = Path("questions.tsv") # Common questions file

    # Create logs directory if it doesn't exist (moved to save_posted_log)
    # posted_log_path.parent.mkdir(parents=True, exist_ok=True) # Done in save_posted_log

    posted_log = load_posted_log(posted_log_path)
    qa_data = load_questions_and_answers(questions_file)
    video_map = load_video_map(video_map_file)

    if not qa_data:
        logger.error(f"No Q&A data found in {questions_file}. Exiting for account {account_id}.")
        return
    if not video_map:
        logger.error(f"No video map data found in {video_map_file}. Exiting for account {account_id}.")
        return

    item_to_post = select_item_to_post(qa_data, video_map, posted_log, account_id)

    if not item_to_post:
        logger.info(f"No item selected for posting for account {account_id}. Exiting.")
        return

    tweet_text = f"{item_to_post['answer']}\n\n{COMMON_HASHTAGS}"
    video_file_path_str = item_to_post['video_path']
    question_for_log = item_to_post['question']

    # Video path handling from user's suggestion
    video_path_in_repo = Path(video_file_path_str)
    absolute_video_path = video_path_in_repo.resolve() # Resolves relative to CWD

    media_to_upload = None
    if not absolute_video_path.exists():
        logger.error(f"Video file not found at resolved absolute path: {absolute_video_path} (derived from relative path '{video_file_path_str}') for account {account_id}")
        logger.warning(f"Proceeding to post without video for Q: {question_for_log} for account {account_id}")
    else:
        media_to_upload = [str(absolute_video_path)]
    
    logger.info(f"Attempting to post for {account_id}: Video='{media_to_upload[0] if media_to_upload else 'None'}', Text='{tweet_text[:70]}...'")

    driver = None
    try:
        if not cookie_file_path.exists():
            logger.error(f"Cookie file not found: {cookie_file_path}. Cannot proceed with login for account {account_id}.")
            return
        
        logger.info(f"Creating browser driver (headless: {run_headless}) for account {account_id}...")
        driver = create_driver(headless=run_headless) # Use the passed parameter

        if driver is None:
            logger.error(f"Failed to create WebDriver for account {account_id}. Exiting.")
            return

        logger.info(f"Loading cookies from {cookie_file_path} for account {account_id}")
        driver.get("https://x.com") 
        time.sleep(2) # Allow page and any redirects to settle

        if not load_cookies(driver, cookie_file_path): # cookie_loader expects Path object
            logger.error(f"Failed to load cookies for account {account_id}. Exiting.")
            if driver: driver.quit() # Clean up driver
            return 
        
        logger.info(f"Cookies loaded successfully for {account_id}. Refreshing page to apply login state.")
        driver.refresh()
        time.sleep(5) 

        logger.info(f"Calling post_to_twitter for account {account_id}...")
        
        tweet_url_or_id = post_to_twitter(
            driver=driver,
            post_text=tweet_text,
            media_files=media_to_upload,
            logger=logger # Pass the module-level logger
        )

        if tweet_url_or_id:
            logger.info(f"Successfully posted for {account_id}: {question_for_log} -> {tweet_url_or_id}")
            append_to_posted_log(posted_log_path, question_for_log)
        else:
            logger.error(f"Failed to post tweet for {account_id} for question: {question_for_log}. Check logs from poster.py for details.")

    except Exception as e:
        logger.critical(f"An unexpected error occurred in main_post_video_tweet for account {account_id}: {type(e).__name__} - {e}", exc_info=True)
        if driver:
            try:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                s_path = f"error_main_post_video_tweet_{account_id}_{timestamp}.png"
                driver.save_screenshot(s_path) # Use the constructed path
                logger.info(f"Saved error screenshot to {s_path}")
            except Exception as se:
                logger.error(f"Failed to save error screenshot during exception handling for {account_id}: {se}")
    finally:
        if driver:
            logger.info(f"Closing browser for account {account_id}.")
            driver.quit()
        logger.info(f"--- Video Tweet Posting Script Finished for account: {account_id} ---")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Post a video tweet to a specified account.')
    parser.add_argument('--account', type=str, required=True, help='Account ID (e.g., menesu324) to use for posting.')
    parser.add_argument(
        '--debug',
        action='store_true', # If present, set to True
        help='Run in debug mode (non-headless browser, overrides HEADLESS_BROWSER constant).'
    )
    args = parser.parse_args()

    # Determine headless state: 
    # Default to HEADLESS_BROWSER (True), but if --debug is explicitly passed, set to False.
    effective_headless_mode = HEADLESS_BROWSER 
    if args.debug: # If --debug is true
        effective_headless_mode = False # Run non-headless

    if effective_headless_mode:
        logger.info(f"Running in HEADLESS mode for account {args.account}.")
    else:
        logger.info(f"Running in DEBUG mode (browser will be visible) for account {args.account}.")
    
    # Ensure logs directory exists (can be done here or in save_posted_log)
    Path("logs").mkdir(parents=True, exist_ok=True)

    asyncio.run(main_post_video_tweet(args.account, effective_headless_mode))