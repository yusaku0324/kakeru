"""
Media processing services for video and image handling
"""
import os
import logging
import subprocess
import urllib.request
from typing import Optional, List, Dict, Any
from bot.utils.backoff import with_backoff
from bot.utils.ocr import extract_text_from_image, extract_text_from_video, extract_text_from_video_frame

logger = logging.getLogger(__name__)

@with_backoff(max_retries=3, initial_delay=1.0)
def create_video_from_image(image_path: str, output_path: str, duration: int = 1) -> bool:
    """
    画像から動画を作成する
    
    Args:
        image_path: 入力画像のパス
        output_path: 出力動画のパス
        duration: 動画の長さ（秒）
        
    Returns:
        bool: 成功したかどうか
    """
    try:
        if not os.path.exists(image_path):
            logger.error(f"Image file not found: {image_path}")
            return False
        
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        cmd = [
            'ffmpeg',
            '-y',  # 出力ファイルを上書き
            '-loop', '1',  # 画像をループ
            '-i', image_path,  # 入力画像
            '-c:v', 'libx264',  # H.264コーデック
            '-t', str(duration),  # 動画の長さ
            '-pix_fmt', 'yuv420p',  # ピクセルフォーマット
            '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2',  # スケーリングとパディング
            output_path
        ]
        
        logger.info(f"Creating video from image: {image_path} -> {output_path}")
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            logger.error(f"FFmpeg error: {result.stderr}")
            return False
        
        logger.info(f"Successfully created video: {output_path}")
        return True
    
    except Exception as e:
        logger.error(f"Error creating video from image: {e}")
        return False

@with_backoff(max_retries=3, initial_delay=1.0)
def create_combined_video(video_paths: List[str], output_path: str) -> bool:
    """
    複数の動画を結合する
    
    Args:
        video_paths: 結合する動画のパスリスト
        output_path: 出力動画のパス
        
    Returns:
        bool: 成功したかどうか
    """
    try:
        if not video_paths:
            logger.error("No video paths provided")
            return False
        
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        list_file = f"{output_path}.txt"
        with open(list_file, 'w') as f:
            for video_path in video_paths:
                if not os.path.exists(video_path):
                    logger.error(f"Video file not found: {video_path}")
                    return False
                f.write(f"file '{os.path.abspath(video_path)}'\n")
        
        cmd = [
            'ffmpeg',
            '-y',  # 出力ファイルを上書き
            '-f', 'concat',  # 結合モード
            '-safe', '0',  # 安全モードを無効化
            '-i', list_file,  # 入力ファイルリスト
            '-c', 'copy',  # コーデックをコピー
            output_path
        ]
        
        logger.info(f"Combining videos: {video_paths} -> {output_path}")
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        os.remove(list_file)
        
        if result.returncode != 0:
            logger.error(f"FFmpeg error: {result.stderr}")
            return False
        
        logger.info(f"Successfully combined videos: {output_path}")
        return True
    
    except Exception as e:
        logger.error(f"Error combining videos: {e}")
        return False

@with_backoff(max_retries=3, initial_delay=1.0)
def download_media(url: str, output_path: str) -> bool:
    """
    メディアファイルをダウンロードする
    
    Args:
        url: ダウンロードURL
        output_path: 保存先パス
        
    Returns:
        bool: 成功したかどうか
    """
    try:
        if not url.startswith(('http://', 'https://')):
            logger.error(f"Invalid URL: {url}")
            return False
        
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        logger.info(f"Downloading media from {url} to {output_path}")
        urllib.request.urlretrieve(url, output_path)
        
        if not os.path.exists(output_path):
            logger.error(f"Failed to download media to {output_path}")
            return False
        
        logger.info(f"Successfully downloaded media to {output_path}")
        return True
    
    except Exception as e:
        logger.error(f"Error downloading media: {e}")
        return False

def get_media_path(media_url: str, local_filename: str) -> Optional[str]:
    """
    メディアURLからローカルパスを取得する（必要に応じてダウンロード）
    
    Args:
        media_url: メディアURL
        local_filename: ローカルファイル名
        
    Returns:
        Optional[str]: ローカルパス、失敗した場合はNone
    """
    try:
        if not media_url:
            logger.info("No media URL provided")
            return None
        
        if os.path.exists(media_url):
            logger.info(f"Using local media file: {media_url}")
            return media_url
        
        if media_url.startswith(('http://', 'https://')):
            if download_media(media_url, local_filename):
                return local_filename
            else:
                logger.error(f"Failed to download media from {media_url}")
                return None
        
        logger.warning(f"Unrecognized media URL format: {media_url}")
        return None
    
    except Exception as e:
        logger.error(f"Error getting media path: {e}")
        return None


def extract_text_from_media(media_path: str, media_type: str = 'auto') -> Dict[str, Any]:
    """
    メディアファイルからテキストを抽出する
    
    Args:
        media_path: メディアファイルのパス
        media_type: メディアタイプ ('image', 'video', 'auto')
        
    Returns:
        Dict[str, Any]: 抽出結果
    """
    try:
        if not os.path.exists(media_path):
            logger.error(f"Media file not found: {media_path}")
            return {'success': False, 'error': 'File not found'}
        
        if media_type == 'auto':
            ext = os.path.splitext(media_path)[1].lower()
            if ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp']:
                media_type = 'image'
            elif ext in ['.mp4', '.avi', '.mov', '.mkv']:
                media_type = 'video'
            else:
                logger.error(f"Unsupported file extension: {ext}")
                return {'success': False, 'error': f'Unsupported file extension: {ext}'}
        
        if media_type == 'image':
            text = extract_text_from_image(media_path)
            return {
                'success': True,
                'type': 'image',
                'text': text,
                'path': media_path
            }
        
        elif media_type == 'video':
            results = extract_text_from_video(media_path)
            return {
                'success': True,
                'type': 'video',
                'frames': results,
                'path': media_path
            }
        
        else:
            logger.error(f"Invalid media type: {media_type}")
            return {'success': False, 'error': f'Invalid media type: {media_type}'}
    
    except Exception as e:
        logger.error(f"Error extracting text from media: {e}")
        return {'success': False, 'error': str(e)}


def extract_text_from_media_url(media_url: str, local_filename: str, media_type: str = 'auto') -> Dict[str, Any]:
    """
    メディアURLからテキストを抽出する（必要に応じてダウンロード）
    
    Args:
        media_url: メディアURL
        local_filename: ローカルファイル名
        media_type: メディアタイプ ('image', 'video', 'auto')
        
    Returns:
        Dict[str, Any]: 抽出結果
    """
    try:
        media_path = get_media_path(media_url, local_filename)
        if not media_path:
            return {'success': False, 'error': 'Failed to get media file'}
        
        return extract_text_from_media(media_path, media_type)
    
    except Exception as e:
        logger.error(f"Error extracting text from media URL: {e}")
        return {'success': False, 'error': str(e)}


def extract_text_from_video_frames(video_path: str, frame_numbers: List[int]) -> Dict[str, Any]:
    """
    動画の特定フレームからテキストを抽出する
    
    Args:
        video_path: 動画ファイルのパス
        frame_numbers: 抽出するフレーム番号のリスト
        
    Returns:
        Dict[str, Any]: 抽出結果
    """
    try:
        if not os.path.exists(video_path):
            logger.error(f"Video file not found: {video_path}")
            return {'success': False, 'error': 'File not found'}
        
        results = []
        for frame_number in frame_numbers:
            try:
                text = extract_text_from_video_frame(video_path, frame_number)
                results.append({
                    'frame': frame_number,
                    'text': text
                })
            except Exception as e:
                logger.warning(f"Error extracting text from frame {frame_number}: {e}")
                results.append({
                    'frame': frame_number,
                    'error': str(e)
                })
        
        return {
            'success': True,
            'type': 'video_frames',
            'frames': results,
            'path': video_path
        }
    
    except Exception as e:
        logger.error(f"Error extracting text from video frames: {e}")
        return {'success': False, 'error': str(e)}
