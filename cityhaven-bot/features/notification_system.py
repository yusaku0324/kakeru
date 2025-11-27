#!/usr/bin/env python3
"""
通知システム
エラーや重要なイベントをSlack/Discordに通知
"""

import json
import logging
import requests
from datetime import datetime
from typing import Optional, Dict, Any
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)

class NotificationChannel(ABC):
    """通知チャンネルの基底クラス"""
    
    @abstractmethod
    def send(self, message: str, level: str = "info", **kwargs) -> bool:
        """メッセージを送信"""
        pass

class SlackNotifier(NotificationChannel):
    """Slack通知"""
    
    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url
        
    def send(self, message: str, level: str = "info", **kwargs) -> bool:
        """Slackにメッセージを送信"""
        color_map = {
            "info": "#36a64f",    # 緑
            "warning": "#ff9900",  # オレンジ
            "error": "#ff0000",    # 赤
            "success": "#0099ff"   # 青
        }
        
        payload = {
            "attachments": [{
                "color": color_map.get(level, "#808080"),
                "title": kwargs.get("title", "CityHeaven Bot 通知"),
                "text": message,
                "timestamp": int(datetime.now().timestamp()),
                "footer": "CityHeaven Bot",
                "fields": kwargs.get("fields", [])
            }]
        }
        
        try:
            response = requests.post(self.webhook_url, json=payload)
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Slack通知の送信に失敗: {e}")
            return False

class DiscordNotifier(NotificationChannel):
    """Discord通知"""
    
    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url
        
    def send(self, message: str, level: str = "info", **kwargs) -> bool:
        """Discordにメッセージを送信"""
        color_map = {
            "info": 0x36a64f,     # 緑
            "warning": 0xff9900,   # オレンジ
            "error": 0xff0000,     # 赤
            "success": 0x0099ff    # 青
        }
        
        embed = {
            "title": kwargs.get("title", "CityHeaven Bot 通知"),
            "description": message,
            "color": color_map.get(level, 0x808080),
            "timestamp": datetime.now().isoformat(),
            "footer": {"text": "CityHeaven Bot"},
            "fields": kwargs.get("fields", [])
        }
        
        payload = {
            "embeds": [embed]
        }
        
        try:
            response = requests.post(self.webhook_url, json=payload)
            return response.status_code in [200, 204]
        except Exception as e:
            logger.error(f"Discord通知の送信に失敗: {e}")
            return False

class NotificationSystem:
    """通知システム統合クラス"""
    
    def __init__(self):
        self.channels = []
        self._load_config()
        
    def _load_config(self):
        """設定ファイルから通知チャンネルを読み込む"""
        try:
            with open('config/notifications.json', 'r') as f:
                config = json.load(f)
                
            if config.get("slack", {}).get("enabled"):
                webhook = config["slack"]["webhook_url"]
                self.channels.append(SlackNotifier(webhook))
                
            if config.get("discord", {}).get("enabled"):
                webhook = config["discord"]["webhook_url"]
                self.channels.append(DiscordNotifier(webhook))
                
        except FileNotFoundError:
            logger.info("通知設定ファイルが見つかりません")
        except Exception as e:
            logger.error(f"通知設定の読み込みエラー: {e}")
    
    def notify(self, message: str, level: str = "info", **kwargs):
        """全チャンネルに通知を送信"""
        for channel in self.channels:
            try:
                channel.send(message, level, **kwargs)
            except Exception as e:
                logger.error(f"通知送信エラー: {e}")
    
    def notify_error(self, error: Exception, context: str = ""):
        """エラー通知"""
        message = f"エラーが発生しました: {type(error).__name__}\n{str(error)}"
        if context:
            message = f"{context}\n{message}"
            
        self.notify(message, level="error", title="❌ エラー発生")
    
    def notify_success(self, message: str, details: Dict[str, Any] = None):
        """成功通知"""
        fields = []
        if details:
            fields = [
                {"name": k, "value": str(v), "inline": True}
                for k, v in details.items()
            ]
            
        self.notify(message, level="success", title="✅ 成功", fields=fields)
    
    def notify_warning(self, message: str):
        """警告通知"""
        self.notify(message, level="warning", title="⚠️ 警告")

# 設定ファイルのテンプレート
NOTIFICATION_CONFIG_TEMPLATE = {
    "slack": {
        "enabled": False,
        "webhook_url": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
    },
    "discord": {
        "enabled": False,
        "webhook_url": "https://discord.com/api/webhooks/YOUR/WEBHOOK/URL"
    }
}

# 使用例
def setup_notifications():
    """通知システムのセットアップ"""
    config_path = Path('config/notifications.json')
    if not config_path.exists():
        config_path.parent.mkdir(exist_ok=True)
        with open(config_path, 'w') as f:
            json.dump(NOTIFICATION_CONFIG_TEMPLATE, f, indent=2)
        logger.info(f"通知設定テンプレートを作成しました: {config_path}")
    
    return NotificationSystem()