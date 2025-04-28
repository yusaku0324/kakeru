"""
ログユーティリティモジュール

このモジュールは、ログ設定と標準出力のエンコーディング修正機能を提供します。
"""
import os
import sys
import io
import logging
from typing import Optional

def setup_logger(name: str, log_file: Optional[str] = None, level: int = logging.INFO) -> logging.Logger:
    """
    ロガーをセットアップする

    Args:
        name: ロガー名
        log_file: ログファイルパス（Noneの場合はファイル出力なし）
        level: ログレベル（デフォルト: INFO）

    Returns:
        logging.Logger: 設定されたロガーインスタンス
    """
    logger = logging.getLogger(name)
    logger.setLevel(level)
    
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    if log_file:
        os.makedirs(os.path.dirname(os.path.abspath(log_file)), exist_ok=True)
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    
    return logger

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
        if hasattr(sys.stdout, 'encoding') and sys.stdout.encoding.lower() != 'utf-8':
            sys.stdout = io.TextIOWrapper(
                sys.stdout.buffer, encoding='utf-8', line_buffering=True
            )
            logger.info(f"stdoutのエンコーディングをutf-8に変更しました")
        return True
    except Exception as e:
        logger.error(f"stdoutのエンコーディング変更中にエラーが発生しました: {e}")
        return False
