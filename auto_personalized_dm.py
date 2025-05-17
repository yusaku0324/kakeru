import os
import sys
import time
import argparse  # 追加: コマンドライン引数パーサー
import yaml    # 追加: YAMLパーサー

# import logging # Comment out logging
from dotenv import load_dotenv
import google.generativeai as genai
import asyncio
from twscrape import API

# from twscrape.errors import NoAccountError # Attempt to import for specific error handling
import datetime
import json
import schedule  # schedule ライブラリをインポート
from bot.services.twitter_client.dm_sender import DMSender
from selenium import webdriver
from selenium.webdriver.chrome.service import Service as ChromeService
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.options import Options
import traceback  # For detailed error logging
from contextlib import aclosing
import twscrape
from twscrape.accounts_pool import NoAccountError
import math

print("DEBUG_PRINT: Script import section completed.", file=sys.stderr)

# ========== 設定 ==========
SEARCH_QUERY = '（出稼ぎ ｜ ヘルス ｜ デリ ｜メンエス｜メンズエステ｜スカウトさん ｜ 在籍 ｜ソープ  ｜ 夜職  ｜ 体入  ｜ デリヘル｜閑散期|写メ日記｜繁忙期）min_replies:2 -filter:replies -iHerb' # min_repliesを2に変更
# TEST_TWEET_IDS = ["1921772921199960070"] # テストツイートIDはコメントアウト

GEMINI_MODEL = "models/gemini-2.5-pro-preview-05-06"  # モデル名を元に戻す
# ACCOUNT_NAME = "fuziko_324" # 削除: YAMLから読み込むように変更
# COOKIES_DIR = "cookies" # 削除: YAMLから読み込むか、デフォルト設定を使用
# MAX_DM_PER_RUN = 1 # 削除: YAMLから読み込むように変更
# TWITTER_ACCOUNT_USERNAME = "fuziko_324" # 削除: YAMLから読み込むように変更
# TWITTER_ACCOUNT_PASSWORD = os.getenv("FUZIKO_324_PASSWORD") # 削除: YAMLから読み込むように変更
# SENT_USERS_FILE = "sent_dms.txt" # 削除: アカウントごとに動的に設定
# SEARCH_WITHIN_MINUTES = 60  # ★テストのため60分に変更
# INITIAL_FETCH_LIMIT = 50  # キーワード検索なので有効化
# DAILY_DM_LIMIT = 50 # 削除: YAMLから読み込むように変更
# DAILY_COUNT_FILE = "daily_dm_count.json" # 削除: アカウントごとに動的に設定

# 実行時間帯の設定 (JST)
JOB_START_HOUR_JST = 0  # JST 0時
JOB_END_HOUR_JST = 23  # JST 23時
JOB_INTERVAL_MINUTES = None
SEARCH_TIMEOUT_SECONDS = 180
# LOG_FILE_PATH = "/Users/yusaku/kakeru/logs/auto_dm_script.log"

print("DEBUG_PRINT: Global settings defined (initial).", file=sys.stderr) # 変更: initialを追加

# ========== .env 読み込み (GEMINI_API_KEY 定義のため、アカウント設定より前に配置) ==========
print("DEBUG_PRINT: Attempting to load .env...", file=sys.stderr)
load_dotenv()
print("DEBUG_PRINT: .env loaded.", file=sys.stderr)
# GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") # この行をコメントアウト

# if not GEMINI_API_KEY: # このブロックをコメントアウト
#     print("ERROR: GEMINI_API_KEY not found in .env or environment.", file=sys.stderr)
#     sys.exit(1)

# ========== アカウント設定のグローバル変数 (初期値はNone) ==========
ACCOUNT_CONFIG = None
ACCOUNT_KEY = None
DM_ACCOUNT_NAME = None
COOKIES_DIR = None
MAX_DM_PER_RUN = None
SCRAPE_USERNAME = None
SCRAPE_PASSWORD = None
SENT_USERS_FILE = None
DAILY_DM_LIMIT = None
DAILY_COUNT_FILE = None
JOB_INTERVAL_MINUTES = None
SEARCH_WITHIN_MINUTES = None
INITIAL_FETCH_LIMIT = None
print("DEBUG_PRINT: Placeholder global account vars initialized.", file=sys.stderr)

# ▼▼▼ WebDriverとDMSenderのグローバルインスタンス ▼▼▼
_driver_instance = None
_dm_sender_instance = None
# ▲▲▲ ここまで ▲▲▲

# ========== WebDriverとDMSenderを初期化/取得する関数 ==========
def get_or_init_webdriver_dm_sender():
    global _driver_instance, _dm_sender_instance, DM_ACCOUNT_NAME, COOKIES_DIR # DM_ACCOUNT_NAME等も参照するためglobalに追加
    # WebDriverが死んでいるかどうかの簡易チェック (より堅牢なチェックも検討可)
    driver_is_dead = False
    if _driver_instance:
        try:
            # ウィンドウハンドルがあるかなどで簡易的に生存確認
            # もしWebDriverがクラッシュしていると、このアクセスで例外が発生することがある
            _ = _driver_instance.window_handles 
        except Exception:
            print(f"DEBUG_PRINT: WebDriver instance seems to be dead. Re-initializing.", file=sys.stderr)
            driver_is_dead = True
            _driver_instance = None # 死んだインスタンスはクリア
            _dm_sender_instance = None # DMSenderも再作成

    if _driver_instance is None or _dm_sender_instance is None or driver_is_dead:
        print(f"DEBUG_PRINT: Initializing WebDriver and DMSender for {DM_ACCOUNT_NAME}...", file=sys.stderr)
        if _driver_instance and not driver_is_dead: # driver_is_deadでなければ、既存のdriverを一度終了させる (dm_senderだけNoneの場合など)
            try:
                _driver_instance.quit()
            except Exception as e_quit:
                print(f"DEBUG_PRINT: Exception while quitting old driver instance: {e_quit}", file=sys.stderr)
        
        _driver_instance = setup_driver() # setup_driver()は既存のものを利用
        if not _driver_instance:
            print(f"CRITICAL_PRINT: Failed to setup WebDriver for {DM_ACCOUNT_NAME}. Cannot send DMs.", file=sys.stderr)
            _dm_sender_instance = None # 明示的にNoneに
            return None, None

        _dm_sender_instance = DMSender(
            _driver_instance, account_name=DM_ACCOUNT_NAME, cookies_dir=COOKIES_DIR
        )
        try:
            if not _dm_sender_instance._load_cookies():
                print(f"CRITICAL_PRINT: Failed to load cookies for {DM_ACCOUNT_NAME} on init. Cannot send DMs.", file=sys.stderr)
                if _driver_instance: 
                    try: _driver_instance.quit()
                    except: pass
                _driver_instance = None
                _dm_sender_instance = None
                return None, None
            print(f"DEBUG_PRINT: WebDriver and DMSender initialized and cookies loaded for {DM_ACCOUNT_NAME}.", file=sys.stderr)
        except Exception as e_cookie_init:
            print(f"CRITICAL_PRINT: Exception during initial cookie loading for {DM_ACCOUNT_NAME}: {e_cookie_init}", file=sys.stderr)
            if _driver_instance: 
                try: _driver_instance.quit()
                except: pass
            _driver_instance = None
            _dm_sender_instance = None
            return None, None
    else:
        print(f"DEBUG_PRINT: Reusing existing WebDriver and DMSender for {DM_ACCOUNT_NAME}.", file=sys.stderr)
        
    return _driver_instance, _dm_sender_instance

# ========== アカウント設定読み込み関数 ==========
def load_account_config(account_key_arg: str, config_path: str = "dm_accounts.yaml"):
    global ACCOUNT_CONFIG, ACCOUNT_KEY, DM_ACCOUNT_NAME, COOKIES_DIR, MAX_DM_PER_RUN
    global SCRAPE_USERNAME, SCRAPE_PASSWORD
    global SENT_USERS_FILE, DAILY_DM_LIMIT, DAILY_COUNT_FILE
    global JOB_INTERVAL_MINUTES, SEARCH_WITHIN_MINUTES, INITIAL_FETCH_LIMIT
    global CURRENT_GEMINI_API_KEY, TWSCRAPE_DB_PATH

    ACCOUNT_KEY = account_key_arg
    print(f"DEBUG_PRINT: Loading configuration for account key: {ACCOUNT_KEY}", file=sys.stderr)

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            full_config = yaml.safe_load(f)
    except FileNotFoundError:
        print(f"ERROR: Account configuration file not found: {config_path}", file=sys.stderr)
        sys.exit(1)
    except yaml.YAMLError as e:
        print(f"ERROR: Error parsing YAML configuration file {config_path}: {e}", file=sys.stderr)
        sys.exit(1)

    default_cfg = full_config.get("default_settings", {})
    accounts_cfg = full_config.get("accounts", {})

    if ACCOUNT_KEY not in accounts_cfg:
        print(f"ERROR: Account key '{ACCOUNT_KEY}' not found in {config_path} accounts section.", file=sys.stderr)
        sys.exit(1)
    
    ACCOUNT_CONFIG = accounts_cfg[ACCOUNT_KEY]

    DM_ACCOUNT_NAME = ACCOUNT_CONFIG.get("dm_account_name")
    if not DM_ACCOUNT_NAME: sys.exit(f"ERROR: dm_account_name missing for {ACCOUNT_KEY} in {config_path}")
    
    SCRAPE_USERNAME = ACCOUNT_CONFIG.get("scrape_username")
    if not SCRAPE_USERNAME: sys.exit(f"ERROR: scrape_username missing for {ACCOUNT_KEY} in {config_path}")
    
    scrape_password_env_name = ACCOUNT_CONFIG.get("scrape_password_env", default_cfg.get("scrape_password_env"))
    if scrape_password_env_name:
        SCRAPE_PASSWORD = os.getenv(scrape_password_env_name)
        if not SCRAPE_PASSWORD: print(f"WARNING: Scrape password env var '{scrape_password_env_name}' set in YAML but not found in .env for {ACCOUNT_KEY}. twscrape login might fail.", file=sys.stderr)
    else:
        SCRAPE_PASSWORD = None
        print(f"WARNING: 'scrape_password_env' not found in YAML for {ACCOUNT_KEY}. SCRAPE_PASSWORD set to None.", file=sys.stderr)
    
    COOKIES_DIR = ACCOUNT_CONFIG.get("cookies_dir", default_cfg.get("cookies_dir", "cookies"))
    
    try:
        MAX_DM_PER_RUN = int(ACCOUNT_CONFIG.get("max_dm_per_run", default_cfg.get("max_dm_per_run", 1)))
        DAILY_DM_LIMIT = int(ACCOUNT_CONFIG.get("daily_dm_limit", default_cfg.get("daily_dm_limit", 50)))
        JOB_INTERVAL_MINUTES = int(ACCOUNT_CONFIG.get("job_interval_minutes", default_cfg.get("job_interval_minutes", 3)))
        SEARCH_WITHIN_MINUTES = int(ACCOUNT_CONFIG.get("search_within_minutes", default_cfg.get("search_within_minutes", 60)))
        INITIAL_FETCH_LIMIT = int(ACCOUNT_CONFIG.get("initial_fetch_limit", default_cfg.get("initial_fetch_limit", 50)))
    except ValueError as e:
        # エラーメッセージをより汎用的に
        print(f"ERROR: Invalid numeric configuration value for {ACCOUNT_KEY}. Please check YAML. Details: {e}", file=sys.stderr)
        sys.exit(1)

    gemini_key_env_name = ACCOUNT_CONFIG.get("gemini_api_key_env_name", default_cfg.get("gemini_api_key_env_name", "GEMINI_API_KEY"))
    CURRENT_GEMINI_API_KEY = os.getenv(gemini_key_env_name)
    if not CURRENT_GEMINI_API_KEY:
        print(f"ERROR: Gemini API Key for env name '{gemini_key_env_name}' not found for account {ACCOUNT_KEY}.", file=sys.stderr)
        sys.exit(1)
    
    TWSCRAPE_DB_PATH = ACCOUNT_CONFIG.get("twscrape_db_path", default_cfg.get("twscrape_db_path", f"twscrape_acct_{ACCOUNT_KEY}.db"))

    SENT_USERS_FILE = f"sent_dms_{ACCOUNT_KEY}.txt"
    DAILY_COUNT_FILE = f"daily_dm_count_{ACCOUNT_KEY}.json"

    print(f"DEBUG_PRINT: Configuration loaded successfully for account: {ACCOUNT_KEY}", file=sys.stderr)
    print(f"  DM Account Name: {DM_ACCOUNT_NAME}", file=sys.stderr)
    print(f"  Scrape Username: {SCRAPE_USERNAME}", file=sys.stderr)
    # print(f"  Scrape Password Env: {scrape_password_env_name}", file=sys.stderr) # 必要なら表示
    print(f"  Cookies Dir: {COOKIES_DIR}", file=sys.stderr)
    print(f"  Max DM Per Run: {MAX_DM_PER_RUN}", file=sys.stderr)
    print(f"  Daily DM Limit: {DAILY_DM_LIMIT}", file=sys.stderr)
    print(f"  Job Interval Mins: {JOB_INTERVAL_MINUTES}", file=sys.stderr)
    print(f"  Search Within Mins: {SEARCH_WITHIN_MINUTES}", file=sys.stderr)
    print(f"  Initial Fetch Limit: {INITIAL_FETCH_LIMIT}", file=sys.stderr)
    print(f"  Gemini API Key Env Name Used: {gemini_key_env_name}", file=sys.stderr)
    print(f"  Twscrape DB Path: {TWSCRAPE_DB_PATH}", file=sys.stderr)
    print(f"  Sent Users File: {SENT_USERS_FILE}", file=sys.stderr)
    print(f"  Daily Count File: {DAILY_COUNT_FILE}", file=sys.stderr)

# ========== twscrape環境変数設定 (ログ設定より前に配置) ==========
print("DEBUG_PRINT: Setting TWS_RAISE_WHEN_NO_ACCOUNT=1", file=sys.stderr)
os.environ["TWS_RAISE_WHEN_NO_ACCOUNT"] = "1"

# ========== ログ設定 (コメントアウト) ==========
# logger = logging.getLogger(__name__)
# logger.setLevel(logging.DEBUG) # ★ DEBUGレベルに変更
# formatter = logging.Formatter('%(asctime)s [%(levelname)s] %(name)s: %(message)s')
# ch = logging.StreamHandler()
# ch.setLevel(logging.DEBUG) # ★ DEBUGレベルに変更
# if not logger.hasHandlers():
#     logger.addHandler(ch)
# fh = logging.FileHandler(LOG_FILE_PATH, encoding='utf-8')
# fh.setLevel(logging.DEBUG) # ★ DEBUGレベルに変更
# fh.setFormatter(formatter)
# if not any(isinstance(h, logging.FileHandler) for h in logger.handlers):
#     logger.addHandler(fh)
print("DEBUG_PRINT: Logging setup commented out.", file=sys.stderr)

# ========== 最も原始的なファイル書き込みテスト ==========
try:
    with open("/Users/yusaku/kakeru/logs/startup_test.txt", "a") as f:
        f.write(f"Script execution attempt at {datetime.datetime.now()}\n")
    print(
        f"SIMPLE_PRINT: startup_test.txt written at {datetime.datetime.now()}",
        file=sys.stderr,
    )
except Exception as e_startup_test:
    print(
        f"SIMPLE_PRINT_ERROR: Failed to write startup_test.txt: {e_startup_test}",
        file=sys.stderr,
    )
# =====================================================

# ========== JSTタイムゾーン定義 ==========
JST = datetime.timezone(datetime.timedelta(hours=9), name="JST")
print(f"DEBUG_PRINT: JST timezone defined: {JST}", file=sys.stderr)


# ========== BMP外文字フィルタリング関数 ==========
def filter_non_bmp_chars(text):
    if not text:
        return text
    return "".join(c for c in text if ord(c) <= 0xFFFF)


# ========== 日次DMカウンター関数 ==========
def load_daily_dm_count(filepath):
    print(f"DEBUG_PRINT: load_daily_dm_count called with {filepath}", file=sys.stderr)
    today_str = datetime.date.today().isoformat()
    if not os.path.exists(filepath):
        return {"date": today_str, "count": 0}
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        if data.get("date") == today_str:
            return data
        else:
            print(
                f"INFO: Date changed from {data.get('date')} to {today_str}. Resetting DM count.",
                file=sys.stderr,
            )
            return {"date": today_str, "count": 0}
    except (json.JSONDecodeError, FileNotFoundError):
        print(
            f"ERROR: Failed to load or parse {filepath}. Resetting counter.",
            file=sys.stderr,
        )
        return {"date": today_str, "count": 0}


def save_daily_dm_count(filepath, data):
    print(
        f"DEBUG_PRINT: save_daily_dm_count called with {filepath}, data: {data}",
        file=sys.stderr,
    )
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f)
        print(f"INFO: Daily DM count saved: {data}", file=sys.stderr)
    except Exception as e:
        print(f"ERROR: Error saving daily DM count to {filepath}: {e}", file=sys.stderr)


# ========== X 検索: twscrapeでツイート収集 (async) ==========
async def safe_search(api, query, limit=20, max_retry=3):
    print(f"DEBUG_PRINT: safe_search CALLED with query: {query[:50]}...", file=sys.stderr)
    for attempt in range(max_retry):
        try:
            print(f"DEBUG_PRINT: safe_search attempt {attempt+1}/{max_retry}", file=sys.stderr)
            async with aclosing(api.search(query, limit=limit)) as gen:
                return [tweet async for tweet in gen]
        except NoAccountError as e:
            wait_until = getattr(e, "next_available_at", None)
            if wait_until is None:
                stats = await api.pool.stats()
                qinfo = stats.get("SearchTimeline") or stats.get("search_timeline") or {}
                wait_until = qinfo.get("next_available_at") or qinfo.get("busy_until")
            if wait_until is None:
                wait_sec = 900
            else:
                now = datetime.datetime.now(datetime.timezone.utc)
                wait_sec = max((wait_until - now).total_seconds(), 0) + 1
            print(f"[INFO] SearchTimeline busy → {wait_sec:.0f}s 待機")
            print(f"DEBUG_PRINT: safe_search NoAccountError, waiting {wait_sec:.0f}s for query: {query[:50]}...", file=sys.stderr)
            await asyncio.sleep(wait_sec)
            continue
        except Exception as ex:
            print(f"[WARN] unexpected in safe_search: {type(ex).__name__}: {ex}")
            print(f"DEBUG_PRINT: safe_search Exception: {type(ex).__name__} for query: {query[:50]}...", file=sys.stderr)
            await asyncio.sleep(30)
            continue
    print("[ERROR] 最大リトライ回数を超えました")
    print(f"DEBUG_PRINT: safe_search EXITED after max retries for query: {query[:50]}...", file=sys.stderr)
    return []

async def search_tweets_twscrape(query,
                                 initial_limit=None,
                                 within_minutes=None,
                                 max_retry=3):
    global TWSCRAPE_DB_PATH # グローバル変数から読み込んだDBパスを使用

    current_initial_limit = initial_limit if initial_limit is not None else INITIAL_FETCH_LIMIT
    current_within_minutes = within_minutes if within_minutes is not None else SEARCH_WITHIN_MINUTES

    print(f"DEBUG_PRINT: search_tweets_twscrape CALLED for query: {query[:50]}... with limit: {current_initial_limit}, within: {current_within_minutes}, for account: {ACCOUNT_KEY}", file=sys.stderr)
    
    # API()呼び出し前に環境変数を設定
    if TWSCRAPE_DB_PATH:
        print(f"DEBUG_PRINT: Setting TWSCRAPE_DB_PATH environment variable to: {TWSCRAPE_DB_PATH} for {ACCOUNT_KEY}", file=sys.stderr)
        os.environ["TWSCRAPE_DB_PATH"] = TWSCRAPE_DB_PATH
    else:
        if "TWSCRAPE_DB_PATH" in os.environ:
            print(f"DEBUG_PRINT: TWSCRAPE_DB_PATH is not set in config, removing from environment to use default for {ACCOUNT_KEY}", file=sys.stderr)
            del os.environ["TWSCRAPE_DB_PATH"]
    
    api = API() # db_path引数なしで呼び出す
    
    print(f"DEBUG_PRINT: twscrape API initialized (DB path via env or default) for {ACCOUNT_KEY}", file=sys.stderr)

    try:
        await api.pool.relogin_failed()
        await api.pool.login_all()
        print(f"DEBUG_PRINT: twscrape: login_all/relogin_failed completed for {ACCOUNT_KEY}.", file=sys.stderr)
    except Exception as e_twscrape_login:
        print(f"CRITICAL_PRINT: twscrape: Error during login_all/relogin_failed for {ACCOUNT_KEY}: {e_twscrape_login}", file=sys.stderr)
        print(traceback.format_exc(), file=sys.stderr)
        return []

    print(f"DEBUG_PRINT: search_tweets_twscrape after login attempts for query: {query[:50]}...", file=sys.stderr)
    tweets_objects = await safe_search(api, query, limit=current_initial_limit, max_retry=max_retry)
    
    results = []
    now = datetime.datetime.now(JST)
    time_threshold = now - datetime.timedelta(minutes=current_within_minutes)
    
    if not tweets_objects:
        print(f"DEBUG_PRINT: search_tweets_twscrape - No tweet objects returned from safe_search for query: {query[:50]} for account {ACCOUNT_KEY}.", file=sys.stderr)
        return []
        
    for tweet in tweets_objects: # tweetオブジェクトを直接ループ処理
        if not hasattr(tweet, 'date') or not tweet.date:
            print(f"DEBUG_PRINT: search_tweets_twscrape - Tweet ID {tweet.id if hasattr(tweet, 'id') else 'N/A'} has no date. Skipping for {ACCOUNT_KEY}.", file=sys.stderr)
            continue
        if not hasattr(tweet, 'user') or not hasattr(tweet.user, 'username') or not hasattr(tweet.user, 'displayname') or not hasattr(tweet, 'rawContent'):
            print(f"DEBUG_PRINT: search_tweets_twscrape - Tweet ID {tweet.id if hasattr(tweet, 'id') else 'N/A'} is missing user/username/displayname/rawContent. Skipping for {ACCOUNT_KEY}.", file=sys.stderr)
            continue
            
        tweet_date_jst = tweet.date.astimezone(JST)
        if tweet_date_jst >= time_threshold:
            results.append((tweet.user.username, tweet.user.displayname, tweet.rawContent))
            
    print(
        f"DEBUG_PRINT: search_tweets_twscrape EXITING. Found and filtered {len(results)} tweets within the last {current_within_minutes} minutes for account {ACCOUNT_KEY}.",
        file=sys.stderr,
    )
    print(f"DEBUG_PRINT: search_tweets_twscrape RETURNING {len(results)} tweets for query: {query[:50]} for account {ACCOUNT_KEY}.", file=sys.stderr)
    return results

# ========== 送信済みユーザー管理関数 ==========
def load_sent_users(filepath):
    print(f"DEBUG_PRINT: load_sent_users called with {filepath}", file=sys.stderr)
    if not os.path.exists(filepath):
        print(
            f"DEBUG_PRINT: {filepath} does not exist. Returning empty set.",
            file=sys.stderr,
        )
        return set()
    users = set()
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            for line_number, line in enumerate(f, 1):
                cleaned_line = line.strip()
                if cleaned_line and not cleaned_line.startswith("#"):
                    users.add(cleaned_line.lower())
        print(
            f"DEBUG_PRINT: load_sent_users FINISHED. Loaded {len(users)} users. Sample: {list(users)[:5] if users else '[]'}",
            file=sys.stderr,
        )
        return users
    except Exception as e:
        print(
            f"CRITICAL_PRINT: Error loading sent users from {filepath}: {e}",
            file=sys.stderr,
        )
        print(traceback.format_exc(), file=sys.stderr)
        return set()

def save_sent_user(filepath, username):
    print(
        f"DEBUG_PRINT: save_sent_user called for user '{username}' to file '{filepath}'",
        file=sys.stderr,
    )
    username_lower = username.lower()
    try:
        current_users_in_file = set()
        if os.path.exists(filepath):
            with open(filepath, "r", encoding="utf-8") as f_read:
                for line in f_read:
                    cleaned_line = line.strip()
                    if cleaned_line and not cleaned_line.startswith("#"):
                        current_users_in_file.add(cleaned_line.lower())
        if username_lower not in current_users_in_file:
            with open(filepath, "a", encoding="utf-8") as f_append:
                f_append.write(username_lower + "\n")
            print(
                f"INFO: User '{username_lower}' ADDED to {filepath}. File now contains {len(current_users_in_file) + 1} unique users (approx).",
                file=sys.stderr,
            )
            return True
        else:
            print(
                f"INFO: User '{username_lower}' ALREADY EXISTS in {filepath}. Not saving again.",
                file=sys.stderr,
            )
            return False
    except Exception as e:
        print(
            f"CRITICAL_PRINT: Error saving user '{username_lower}' to {filepath}: {e}",
            file=sys.stderr,
        )
        print(traceback.format_exc(), file=sys.stderr)
        return False

# ========== メイン処理 (async対応) をジョブ関数として定義 ==========
async def main_dm_processing_logic():
    print(f"DEBUG_PRINT: main_dm_processing_logic ENTERED for account: {ACCOUNT_KEY}", file=sys.stderr)
    print(f"CRITICAL_PRINT: main_dm_processing_logic CALLED for account: {ACCOUNT_KEY}", file=sys.stderr)
    print(
        f"DEBUG_PRINT: MAIN_LOGIC: --- Starting DM Processing Logic for {ACCOUNT_KEY} ---", file=sys.stderr
    )
    daily_count_data = load_daily_dm_count(DAILY_COUNT_FILE)
    print(
        f"DEBUG_PRINT: MAIN_LOGIC ({ACCOUNT_KEY}): Daily DM count: {daily_count_data['count']} for {daily_count_data['date']}",
        file=sys.stderr,
    )
    if daily_count_data["count"] >= DAILY_DM_LIMIT:
        print(
            f"INFO: MAIN_LOGIC ({ACCOUNT_KEY}): Daily DM limit of {DAILY_DM_LIMIT} reached for {daily_count_data['date']}. Skipping job.",
            file=sys.stderr,
        )
        print(f"DEBUG_PRINT: main_dm_processing_logic - Daily DM limit REACHED for {ACCOUNT_KEY}. Skipping.", file=sys.stderr)
        return
    sent_users_set = load_sent_users(SENT_USERS_FILE)
    print(
        f"DEBUG_PRINT: MAIN_LOGIC ({ACCOUNT_KEY}): In-memory sent_users_set loaded. Size: {len(sent_users_set)}. Sample: {list(sent_users_set)[:5] if sent_users_set else '[]'}",
        file=sys.stderr,
    )
    print(
        f"DEBUG_PRINT: MAIN_LOGIC ({ACCOUNT_KEY}): --- Starting X search (twscrape) with query: '{SEARCH_QUERY}' ---",
        file=sys.stderr,
    )
    print(f"DEBUG_PRINT: main_dm_processing_logic - Calling search_tweets_twscrape for {ACCOUNT_KEY}", file=sys.stderr)
    tweets = await search_tweets_twscrape(SEARCH_QUERY)
    print(f"DEBUG_PRINT: main_dm_processing_logic - search_tweets_twscrape RETURNED {len(tweets)} tweets for {ACCOUNT_KEY}", file=sys.stderr)
    print(
        f"DEBUG_PRINT: MAIN_LOGIC ({ACCOUNT_KEY}): {len(tweets)} tweets fetched and filtered within the last {SEARCH_WITHIN_MINUTES} minutes.",
        file=sys.stderr,
    )
    if not tweets:
        #print("INFO: MAIN_LOGIC: No new tweets found to process.", file=sys.stderr) # 重複する可能性のあるINFOログをコメントアウト
        print(f"DEBUG_PRINT: main_dm_processing_logic - No new tweets found for {ACCOUNT_KEY}. Returning.", file=sys.stderr)
        return
    
    # driver = None # 削除
    # dm_sender = None # 削除
    dm_sent_this_run = 0
    processed_users_this_session = set()

    # --- WebDriverとDMSenderを取得/初期化 ---
    driver, dm_sender = get_or_init_webdriver_dm_sender()
    if not driver or not dm_sender:
        print(f"CRITICAL_PRINT: MAIN_LOGIC ({ACCOUNT_KEY}): WebDriver/DMSender not available. Skipping DM sending part for this job run.", file=sys.stderr)
        return
    # --- ここまで ---

    SKIP_DISPLAYNAME_KEYWORDS = ["メンエス", "スカウト", "デリヘル", "ソープ", "チャイデリ", "韓国デリ"]

    print(
        f"DEBUG_PRINT: MAIN_LOGIC ({ACCOUNT_KEY}): Starting loop through {len(tweets)} tweets.",
        file=sys.stderr,
    )
    print(f"DEBUG_PRINT: main_dm_processing_logic - Starting tweet loop ({len(tweets)} tweets) for {ACCOUNT_KEY}", file=sys.stderr)
    for username, displayname, tweet_text in tweets:
        print(
            f"DEBUG_PRINT: MAIN_LOGIC ({ACCOUNT_KEY}): Processing tweet from @{username} (DisplayName: {displayname}): '{tweet_text[:30].replace(chr(10), ' ')}...'",
            file=sys.stderr,
        )
        username_lower = username.lower().strip()
        displayname_lower = displayname.lower().strip()

        skip_user_by_keyword = False
        for keyword in SKIP_DISPLAYNAME_KEYWORDS:
            if keyword.lower() in displayname_lower:
                print(f"INFO: MAIN_LOGIC ({ACCOUNT_KEY}): DisplayName '{displayname}' (user @{username}) contains skip keyword '{keyword}'. Skipping DM generation and sending.", file=sys.stderr)
                skip_user_by_keyword = True
                break
        if skip_user_by_keyword:
            processed_users_this_session.add(username_lower) 
            continue

        if not username_lower:
            print(
                f"WARNING: MAIN_LOGIC ({ACCOUNT_KEY}): Empty username encountered for tweet: '{tweet_text[:30]}'. Skipping.",
                file=sys.stderr,
            )
            continue
        if username_lower in sent_users_set:
            print(
                f"INFO: MAIN_LOGIC ({ACCOUNT_KEY}): User @{username_lower} already in persistent sent_users_set. Skipping.",
                file=sys.stderr,
            )
            continue
        if username_lower in processed_users_this_session:
            print(
                f"INFO: MAIN_LOGIC ({ACCOUNT_KEY}): User @{username_lower} already processed in this session. Skipping.",
                file=sys.stderr,
            )
            continue
        print(
            f"DEBUG_PRINT: MAIN_LOGIC ({ACCOUNT_KEY}): Generating DM text for @{username_lower}...",
            file=sys.stderr,
        )
        dm_text = generate_dm_text(tweet_text, username)
        if dm_text and dm_text != "NO_DM_NEEDED":
            dm_text_filtered = filter_non_bmp_chars(dm_text)
            if not dm_text_filtered.strip():
                print(
                    f"WARNING: MAIN_LOGIC ({ACCOUNT_KEY}): DM text for @{username_lower} became empty after BMP filtering or was inherently empty. Original: '{dm_text[:30]}'. Skipping.",
                    file=sys.stderr,
                )
                processed_users_this_session.add(username_lower)
                continue
            
            # 以前の if not driver: ... try: ... except: ... return は削除されている前提
            print(
                f"DEBUG_PRINT: MAIN_LOGIC ({ACCOUNT_KEY}): AI generated DM for @{username_lower}: '{dm_text_filtered[:30].replace(chr(10), ' ')}...'",
                file=sys.stderr,
            )
            print(f"DEBUG_PRINT: MAIN_LOGIC ({ACCOUNT_KEY}): Attempting to send DM to @{username_lower} using shared DMSender.", file=sys.stderr)
            try:
                if username_lower in load_sent_users(SENT_USERS_FILE):
                    print(
                        f"INFO: MAIN_LOGIC ({ACCOUNT_KEY}): User @{username_lower} found in {SENT_USERS_FILE} during pre-send check. Skipping.",
                        file=sys.stderr,
                    )
                    processed_users_this_session.add(username_lower)
                    continue
                send_success = dm_sender.send_dm(username_lower, dm_text_filtered) # dm_sender を使用
                processed_users_this_session.add(username_lower)
                if send_success:
                    print(
                        f"INFO: MAIN_LOGIC ({ACCOUNT_KEY}): DM successfully sent to @{username_lower}",
                        file=sys.stderr,
                    )
                    if save_sent_user(SENT_USERS_FILE, username_lower):
                        sent_users_set.add(username_lower)
                        print(
                            f"DEBUG_PRINT: MAIN_LOGIC ({ACCOUNT_KEY}): @{username_lower} added to in-memory sent_users_set.",
                            file=sys.stderr,
                        )
                    daily_count_data["count"] += 1
                    save_daily_dm_count(DAILY_COUNT_FILE, daily_count_data)
                    dm_sent_this_run += 1
                    if dm_sent_this_run >= MAX_DM_PER_RUN:
                        print(
                            f"INFO: MAIN_LOGIC ({ACCOUNT_KEY}): Reached MAX_DM_PER_RUN ({MAX_DM_PER_RUN}). Stopping DM attempts for this job.",
                            file=sys.stderr,
                        )
                        break
                    if daily_count_data["count"] >= DAILY_DM_LIMIT:
                        print(
                            f"INFO: MAIN_LOGIC ({ACCOUNT_KEY}): Reached DAILY_DM_LIMIT ({DAILY_DM_LIMIT}). Stopping DM attempts for today.",
                            file=sys.stderr,
                        )
                        break
                else:
                    print(
                        f"WARNING: MAIN_LOGIC ({ACCOUNT_KEY}): DM send failed for @{username_lower} (returned False from dm_sender).",
                        file=sys.stderr,
                    )
            except Exception as e_dm_send:
                print(
                    f"CRITICAL_PRINT: MAIN_LOGIC ({ACCOUNT_KEY}): Exception during dm_sender.send_dm for @{username_lower}: {e_dm_send}",
                    file=sys.stderr,
                )
                print(traceback.format_exc(), file=sys.stderr)
                processed_users_this_session.add(username_lower)
        elif dm_text == "NO_DM_NEEDED":
            print(
                f"INFO: MAIN_LOGIC ({ACCOUNT_KEY}): AI determined NO_DM_NEEDED for @{username_lower}. Skipping.",
                file=sys.stderr,
            )
            processed_users_this_session.add(username_lower)
        else:
            print(
                f"WARNING: MAIN_LOGIC ({ACCOUNT_KEY}): AI did not generate a DM or explicit NO_DM_NEEDED for @{username_lower}. DM text was: '{dm_text}'. Skipping.",
                file=sys.stderr,
            )
            processed_users_this_session.add(username_lower)
    print(f"DEBUG_PRINT: main_dm_processing_logic - Finished tweet loop for {ACCOUNT_KEY}", file=sys.stderr)
    
    # if driver: driver.quit() # スクリプト終了時に一括で行うため削除

    print(f"CRITICAL_PRINT: main_dm_processing_logic COMPLETED for account: {ACCOUNT_KEY}", file=sys.stderr)
    print(f"DEBUG_PRINT: main_dm_processing_logic EXITED for account: {ACCOUNT_KEY}", file=sys.stderr)

# ========== ジョブ実行関数 ==========
def run_dm_sending_job():
    print(f"DEBUG_PRINT: run_dm_sending_job CALLED for account: {ACCOUNT_KEY}", file=sys.stderr)
    print(f"CRITICAL_PRINT: run_dm_sending_job CALLED for account: {ACCOUNT_KEY}!", file=sys.stderr)
    now_jst = datetime.datetime.now(JST)
    current_hour_jst = now_jst.hour
    print(f"DEBUG_PRINT: run_dm_sending_job - Current JST hour: {current_hour_jst} for {ACCOUNT_KEY}", file=sys.stderr)
    print(
        f"DEBUG_PRINT: Current JST time in run_dm_sending_job ({ACCOUNT_KEY}): {now_jst.strftime('%Y-%m-%d %H:%M:%S %Z%z')}",
        file=sys.stderr,
    )
    if JOB_START_HOUR_JST <= current_hour_jst <= JOB_END_HOUR_JST:
        print(
            f"DEBUG_PRINT: Current hour {current_hour_jst} (JST) for account {ACCOUNT_KEY} is within the execution window. Starting DM processing logic.",
            file=sys.stderr,
        )
        print(f"DEBUG_PRINT: run_dm_sending_job - Within execution window. Calling main_dm_processing_logic for {ACCOUNT_KEY}", file=sys.stderr)
        try:
            print(
                f"DEBUG_PRINT: Attempting asyncio.run(main_dm_processing_logic()) --- START --- GOGO for {ACCOUNT_KEY}",
                file=sys.stderr,
            )
            asyncio.run(main_dm_processing_logic())
            print(
                f"DEBUG_PRINT: asyncio.run(main_dm_processing_logic()) --- COMPLETED --- GOGO for {ACCOUNT_KEY}",
                file=sys.stderr,
            )
            print(f"DEBUG_PRINT: run_dm_sending_job - main_dm_processing_logic COMPLETED for {ACCOUNT_KEY}", file=sys.stderr)
        except Exception as e_async_run:
            print(
                f"CRITICAL_PRINT: Exception in asyncio.run(main_dm_processing_logic()) for {ACCOUNT_KEY}: {e_async_run}",
                file=sys.stderr,
            )
            print(traceback.format_exc(), file=sys.stderr)
    else:
        print(
            f"INFO: Current hour {current_hour_jst} (JST) for account {ACCOUNT_KEY} is outside the configured execution window ({JOB_START_HOUR_JST}-{JOB_END_HOUR_JST} JST). Skipping DM processing.",
            file=sys.stderr,
        )
        print(f"DEBUG_PRINT: run_dm_sending_job - Outside execution window for {ACCOUNT_KEY}. Skipping.", file=sys.stderr)
    print(f"CRITICAL_PRINT: run_dm_sending_job COMPLETED for account: {ACCOUNT_KEY}!", file=sys.stderr)
    print(f"DEBUG_PRINT: run_dm_sending_job EXITED for account: {ACCOUNT_KEY}", file=sys.stderr)

# ========== GeminiでDM文生成 ==========
GEMINI_MODEL_OBJ = genai.GenerativeModel(GEMINI_MODEL)
gemini_response_cache = {} # Gemini APIレスポンスキャッシュ用

def generate_dm_text(tweet_text, username):
    print(f"DEBUG_PRINT: generate_dm_text CALLED for @{username}", file=sys.stderr)
    cache_key = (username, tweet_text) # キャッシュキーを作成

    if cache_key in gemini_response_cache:
        print(f"DEBUG_PRINT: Cache HIT for @{username} - Tweet: '{tweet_text[:30]}...'", file=sys.stderr)
        return gemini_response_cache[cache_key]

    print(f"DEBUG_PRINT: Cache MISS. Calling Gemini API for @{username} - Tweet: '{tweet_text[:30]}...'", file=sys.stderr)
    prompt = f"""
ユーザー @{username} のツイート「{tweet_text}」を読み、この人が仕事を探しているか、新しいキャリアに関心があるかを判断してください。
もしそうであれば、フレンドリーで自然なトーンで、100字程度の短いDMを作成してください。DMの例：「@{username}さん、ツイート拝見しました。新しいお仕事にご興味はありませんか？もしよろしければ、いくつか情報をお送りしたいです。」
仕事を探していない、またはDMを送るべきでないと判断した場合は、「NO_DM_NEEDED」とだけ返してください。
生成するDMには、ユーザー名を含め、絵文字は使用せず、丁寧な言葉遣いを心がけてください。
"""
    try:
        response = GEMINI_MODEL_OBJ.generate_content(prompt)
        generated_text = response.text.strip()
        print(f"DEBUG_PRINT: Gemini generated text for @{username}: '{generated_text[:50].replace(chr(10), ' ')}...'", file=sys.stderr)
        gemini_response_cache[cache_key] = generated_text # 結果をキャッシュに保存
        return generated_text
    except Exception as e:
        print(f"ERROR: Gemini API call failed for @{username}: {e}", file=sys.stderr)
        # エラー時はNO_DM_NEEDEDとして扱い、キャッシュにも保存（APIエラーの繰り返しを防ぐため）
        gemini_response_cache[cache_key] = "NO_DM_NEEDED_API_ERROR"
        return "NO_DM_NEEDED_API_ERROR"

# ========== Selenium WebDriverセットアップ ==========
def setup_driver():
    print("DEBUG_PRINT: setup_driver called.", file=sys.stderr)
    options = Options()
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1280,800")
    options.add_argument("--headless")
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-popup-blocking")
    ua = (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
    options.add_argument(f"--user-agent={ua}")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)
    try:
        print(
            "DEBUG_PRINT: Attempting to initialize Chrome WebDriver...", file=sys.stderr
        )
        driver = webdriver.Chrome(
            service=ChromeService(ChromeDriverManager().install()), options=options
        )
        driver.execute_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
        )
        print(
            "DEBUG_PRINT: Chrome WebDriver initialized successfully.", file=sys.stderr
        )
        return driver
    except Exception as e_driver_setup:
        print(
            f"CRITICAL_PRINT: Error setting up Chrome WebDriver: {e_driver_setup}",
            file=sys.stderr,
        )
        print(traceback.format_exc(), file=sys.stderr)
        return None

if __name__ == "__main__":
    print(f"DEBUG_PRINT: __main__ block ENTERED", file=sys.stderr)
    print("CRITICAL_PRINT: Script __main__ started.", file=sys.stderr)

    parser = argparse.ArgumentParser(description="Automated Personalized DM Sender Bot")
    parser.add_argument(
        "--account",
        type=str,
        required=True,
        help="Account key from dm_accounts.yaml to use for this instance.",
    )
    parser.add_argument(
        "--config",
        type=str,
        default="dm_accounts.yaml",
        help="Path to the account configuration YAML file (default: dm_accounts.yaml)",
    )
    args = parser.parse_args()
    print(f"DEBUG_PRINT: __main__ - Parsed arguments: account={args.account}, config={args.config}", file=sys.stderr)

    load_account_config(args.account, args.config)
    print(f"DEBUG_PRINT: __main__ - SUCCESSFULLY RETURNED from load_account_config for {ACCOUNT_KEY}", file=sys.stderr)

    print(f"DEBUG_PRINT: __main__ - ABOUT TO CALL schedule.every() for {ACCOUNT_KEY}", file=sys.stderr)
    schedule.every(JOB_INTERVAL_MINUTES).minutes.do(run_dm_sending_job)
    print(f"DEBUG_PRINT: __main__ - SUCCESSFULLY CALLED schedule.every() for {ACCOUNT_KEY}", file=sys.stderr)

    print(f"DEBUG_PRINT: __main__ - Scheduling job every {JOB_INTERVAL_MINUTES} mins for {ACCOUNT_KEY}", file=sys.stderr)

    print("CRITICAL_PRINT: Starting schedule.run_pending() loop...", file=sys.stderr)
    print(f"DEBUG_PRINT: __main__ - Starting scheduler loop for {ACCOUNT_KEY}", file=sys.stderr)
    
    try:
        loop_count = 0
        while True:
            schedule.run_pending()
            loop_count += 1
            if loop_count % 30 == 1: # 約5分おき（10秒スリープ * 30回）に詳細情報を表示
                next_run_time_str = "None"
                idle_seconds_val = -1.0
                jobs_list_str = "[]"
                try:
                    next_run_time_obj = schedule.next_run()
                    if next_run_time_obj:
                        next_run_time_str = next_run_time_obj.astimezone(JST).strftime(
                            "%Y-%m-%d %H:%M:%S %Z%z"
                        )
                    idle_seconds_val = schedule.idle_seconds()
                    if idle_seconds_val is None: # ジョブがない場合など
                        idle_seconds_val = -1.0 
                    jobs_list_str = f"Count: {len(schedule.jobs)}"
                except Exception as e_sched_info:
                    print(
                        f"DEBUG_PRINT: Error getting schedule info: {e_sched_info}",
                        file=sys.stderr,
                    )
                print(
                    f"CRITICAL_PRINT: Loop iter {loop_count} for account {ACCOUNT_KEY}. Next run (JST): {next_run_time_str}. Idle secs: {idle_seconds_val:.2f}. Jobs: {jobs_list_str}",
                    file=sys.stderr,
                )
            time.sleep(10)
    except KeyboardInterrupt:
        print("INFO: KeyboardInterrupt received. Shutting down...", file=sys.stderr)
    finally:
        if _driver_instance: # _driver_instance はグローバル変数
            print("INFO: Quitting WebDriver instance before script exit.", file=sys.stderr)
            try:
                _driver_instance.quit()
                print("INFO: WebDriver quit successfully.", file=sys.stderr)
            except Exception as e_final_quit:
                print(f"ERROR: Exception during final WebDriver quit: {e_final_quit}", file=sys.stderr)
        print("CRITICAL_PRINT: Script finished.", file=sys.stderr)