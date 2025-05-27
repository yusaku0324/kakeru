#!/usr/bin/env python3
"""
セッション管理機能
クッキーの有効期限チェックと自動更新
"""

import json
import time
import logging
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, Dict, List

logger = logging.getLogger(__name__)

class SessionManager:
    """セッション管理クラス"""
    
    def __init__(self, cookies_path: str = "config/cookies_playwright.json"):
        self.cookies_path = Path(cookies_path)
        self.session_info_path = Path("config/session_info.json")
        
    def load_cookies(self) -> List[Dict]:
        """クッキーを読み込む"""
        if not self.cookies_path.exists():
            logger.warning(f"クッキーファイルが見つかりません: {self.cookies_path}")
            return []
        
        with open(self.cookies_path, 'r') as f:
            return json.load(f)
    
    def save_cookies(self, cookies: List[Dict]) -> None:
        """クッキーを保存"""
        self.cookies_path.parent.mkdir(exist_ok=True)
        with open(self.cookies_path, 'w') as f:
            json.dump(cookies, f, indent=2)
        logger.info(f"クッキーを保存しました: {self.cookies_path}")
        
        # セッション情報も更新
        self.update_session_info()
    
    def update_session_info(self) -> None:
        """セッション情報を更新"""
        session_info = {
            "last_login": datetime.now().isoformat(),
            "expires_at": (datetime.now() + timedelta(days=30)).isoformat(),
            "login_count": self.get_login_count() + 1
        }
        
        with open(self.session_info_path, 'w') as f:
            json.dump(session_info, f, indent=2)
    
    def get_login_count(self) -> int:
        """ログイン回数を取得"""
        if self.session_info_path.exists():
            with open(self.session_info_path, 'r') as f:
                info = json.load(f)
                return info.get("login_count", 0)
        return 0
    
    def is_session_valid(self) -> bool:
        """セッションが有効かチェック"""
        if not self.cookies_path.exists():
            logger.info("クッキーファイルが存在しません")
            return False
        
        if not self.session_info_path.exists():
            logger.info("セッション情報が存在しません")
            return False
        
        with open(self.session_info_path, 'r') as f:
            info = json.load(f)
        
        expires_at = datetime.fromisoformat(info.get("expires_at", "1970-01-01"))
        now = datetime.now()
        
        if now > expires_at:
            logger.warning(f"セッションの有効期限が切れています: {expires_at}")
            return False
        
        # 有効期限の7日前から警告
        warning_date = expires_at - timedelta(days=7)
        if now > warning_date:
            days_left = (expires_at - now).days
            logger.warning(f"セッションの有効期限が近づいています: あと{days_left}日")
        
        return True
    
    def get_session_status(self) -> Dict:
        """セッションの状態を取得"""
        if not self.session_info_path.exists():
            return {
                "valid": False,
                "reason": "セッション情報なし",
                "last_login": None,
                "expires_at": None,
                "login_count": 0
            }
        
        with open(self.session_info_path, 'r') as f:
            info = json.load(f)
        
        expires_at = datetime.fromisoformat(info.get("expires_at", "1970-01-01"))
        now = datetime.now()
        
        return {
            "valid": self.is_session_valid(),
            "last_login": info.get("last_login"),
            "expires_at": info.get("expires_at"),
            "days_remaining": max(0, (expires_at - now).days),
            "login_count": info.get("login_count", 0)
        }
    
    def should_refresh_session(self) -> bool:
        """セッションを更新すべきか判定"""
        status = self.get_session_status()
        
        # 無効なセッション
        if not status["valid"]:
            return True
        
        # 残り日数が3日以下
        if status["days_remaining"] <= 3:
            return True
        
        return False

# 使用例
def check_and_refresh_session(bot):
    """セッションをチェックして必要なら更新"""
    session_manager = SessionManager()
    
    if session_manager.should_refresh_session():
        logger.info("セッションの更新が必要です")
        # ログイン処理を実行
        if bot.login():
            # 新しいクッキーを保存
            cookies = bot.driver.get_cookies()
            session_manager.save_cookies(cookies)
            logger.info("セッションを更新しました")
        else:
            logger.error("セッションの更新に失敗しました")
            return False
    
    return True