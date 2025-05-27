#!/usr/bin/env python3
"""
改善版 CityHeaven Bot
リトライロジック、セッション管理、通知システムを統合
"""

import os
import sys
import logging
from datetime import datetime
from pathlib import Path

# 環境変数を読み込む
from dotenv import load_dotenv
load_dotenv()

# featuresモジュールをインポート
sys.path.append(str(Path(__file__).parent))
from features import (
    retry_with_backoff, 
    RetryConfig,
    SessionManager,
    NotificationSystem,
    check_and_refresh_session
)

from auto_login_and_post import AutoLoginPostBot

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/improved_bot.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class ImprovedCityHeavenBot(AutoLoginPostBot):
    """改善版CityHeaven Bot"""
    
    def __init__(self):
        super().__init__()
        self.session_manager = SessionManager()
        self.notifier = NotificationSystem()
        
    def start(self):
        """Bot開始"""
        logger.info("改善版CityHeaven Bot 起動")
        self.notifier.notify_success("Bot起動しました", {
            "時刻": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            "環境": "Production"
        })
        
    @retry_with_backoff(RetryConfig(max_attempts=3, base_delay=5.0))
    def login_with_retry(self):
        """リトライ機能付きログイン"""
        return self.login(self.page)
        
    def run_with_improvements(self, title, content, image_path=None):
        """改善機能を含む投稿実行"""
        try:
            # セッションチェック
            session_status = self.session_manager.get_session_status()
            logger.info(f"セッション状態: {session_status}")
            
            if self.session_manager.should_refresh_session():
                logger.info("セッションの更新が必要です")
                self.notifier.notify_warning("セッションの有効期限が近づいています")
                
                # 再ログイン（リトライ付き）
                if not self.login_with_retry():
                    raise Exception("ログインに失敗しました")
                    
                # 新しいクッキーを保存
                cookies = self.driver.get_cookies()
                self.session_manager.save_cookies(cookies)
                
            # 投稿実行（リトライ付き）
            @retry_with_backoff(RetryConfig(
                max_attempts=5,
                base_delay=3.0,
                exceptions=(Exception,)
            ))
            def post_with_retry():
                return self.post_diary(self.page, title, content, image_path)
                
            success = post_with_retry()
            
            if success:
                self.notifier.notify_success(
                    "投稿が完了しました",
                    {
                        "タイトル": title[:30] + "...",
                        "画像": "あり" if image_path else "なし",
                        "時刻": datetime.now().strftime('%H:%M')
                    }
                )
                logger.info("投稿成功")
            else:
                raise Exception("投稿に失敗しました")
                
        except Exception as e:
            logger.error(f"エラーが発生しました: {e}")
            self.notifier.notify_error(e, "投稿処理中にエラーが発生")
            
            # スクリーンショットを保存
            try:
                error_screenshot = f"screenshots/error_{int(datetime.now().timestamp())}.png"
                self.page.screenshot(path=error_screenshot)
                logger.info(f"エラースクリーンショット保存: {error_screenshot}")
            except:
                pass
                
            raise
            
        finally:
            # クリーンアップ
            try:
                self.browser.close()
            except:
                pass

def main():
    """メイン実行関数"""
    bot = ImprovedCityHeavenBot()
    bot.start()
    
    # テスト投稿
    title = f"改善版Bot テスト {datetime.now().strftime('%m/%d %H:%M')}"
    content = """改善版Botからの投稿です。<br>
    以下の機能を実装しました：<br>
    ✅ リトライロジック<br>
    ✅ セッション管理<br>
    ✅ 通知システム<br>
    <br>
    #自動投稿 #改善版"""
    
    image_path = "media/default.jpg" if Path("media/default.jpg").exists() else None
    
    try:
        bot.run_with_improvements(title, content, image_path)
        logger.info("すべての処理が完了しました")
    except Exception as e:
        logger.error(f"Bot実行失敗: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()