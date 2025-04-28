"""
Logging utilities for consistent logging across the application
"""
import io
import sys
import logging
import logging.handlers
from typing import Optional, TextIO

def ensure_utf8_encoding(logger: Optional[logging.Logger] = None) -> bool:
    """
    標準出力のエンコーディングをUTF-8に設定する
    
    Args:
        logger: ロガーインスタンス（Noneの場合はモジュールロガーを使用）
        
    Returns:
        bool: 設定に成功したかどうか
    """
    if logger is None:
        logger = logging.getLogger(__name__)
    
    try:
        old_stdout = sys.stdout
        
        if hasattr(sys.stdout, 'encoding') and sys.stdout.encoding.lower() != 'utf-8':
            sys.stdout = io.TextIOWrapper(
                sys.stdout.buffer, encoding='utf-8', line_buffering=True
            )
            logger.info(f"stdoutのエンコーディングを{old_stdout.encoding}からutf-8に変更しました")
        
        return True
    except Exception as e:
        logger.error(f"stdoutのエンコーディング変更中にエラーが発生しました: {e}")
        return False

def setup_logger(name: str, log_file: Optional[str] = None, level: int = logging.INFO, 
                format_string: Optional[str] = None) -> logging.Logger:
    """
    ロガーを設定する
    
    Args:
        name: ロガー名
        log_file: ログファイルのパス（Noneの場合はファイル出力なし）
        level: ログレベル
        format_string: ログフォーマット文字列（Noneの場合はデフォルト）
        
    Returns:
        logging.Logger: 設定されたロガー
    """
    logger = logging.getLogger(name)
    logger.setLevel(level)
    
    if format_string is None:
        format_string = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    
    formatter = logging.Formatter(format_string)
    
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    if log_file:
        file_handler = logging.handlers.RotatingFileHandler(
            log_file, maxBytes=10*1024*1024, backupCount=5, encoding='utf-8'
        )
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    
    return logger

def get_logger(name: str) -> logging.Logger:
    """
    既存のロガーを取得する（存在しない場合は作成）
    
    Args:
        name: ロガー名
        
    Returns:
        logging.Logger: ロガーインスタンス
    """
    logger = logging.getLogger(name)
    
    if not logger.handlers:
        logger = setup_logger(name)
    
    return logger

class LoggerAdapter(logging.LoggerAdapter):
    """
    追加のコンテキスト情報を持つロガーアダプター
    """
    def process(self, msg, kwargs):
        """
        ログメッセージにコンテキスト情報を追加する
        
        Args:
            msg: ログメッセージ
            kwargs: キーワード引数
            
        Returns:
            tuple: 処理されたメッセージとキーワード引数
        """
        if 'extra' not in kwargs:
            kwargs['extra'] = self.extra
        else:
            kwargs['extra'].update(self.extra)
        return msg, kwargs

def create_logger_with_context(name: str, context: dict) -> LoggerAdapter:
    """
    コンテキスト情報を持つロガーアダプターを作成する
    
    Args:
        name: ロガー名
        context: コンテキスト情報の辞書
        
    Returns:
        LoggerAdapter: コンテキスト付きロガーアダプター
    """
    logger = get_logger(name)
    return LoggerAdapter(logger, context)
