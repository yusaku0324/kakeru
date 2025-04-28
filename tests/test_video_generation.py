"""
Test module for video generation functionality
"""
import os
import tempfile
import subprocess
import pytest
from pathlib import Path

def generate_test_video(output_path: str, duration: int = 1) -> bool:
    """
    テスト用の動画を生成する
    
    Args:
        output_path: 出力ファイルパス
        duration: 動画の長さ（秒）
        
    Returns:
        bool: 成功したかどうか
    """
    try:
        cmd = [
            "ffmpeg",
            "-f", "lavfi",
            "-i", f"color=c=blue:s=1280x720:d={duration}",
            "-vf", "drawtext=text='Test Video':fontcolor=white:fontsize=60:x=(w-text_w)/2:y=(h-text_h)/2",
            "-c:v", "libx264",
            "-t", f"{duration}",
            "-y",
            output_path
        ]
        
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        
        return os.path.exists(output_path)
    
    except Exception as e:
        print(f"動画生成中にエラーが発生しました: {e}")
        return False

def verify_video(video_path: str) -> dict:
    """
    FFprobeを使用して動画ファイルを検証する
    
    Args:
        video_path: 動画ファイルのパス
        
    Returns:
        dict: 検証結果
    """
    try:
        cmd = [
            "ffprobe",
            "-v", "error",
            "-show_entries", "format=duration,size:stream=width,height,codec_name",
            "-of", "default=noprint_wrappers=1:nokey=1",
            video_path
        ]
        
        result = subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        output = result.stdout.decode('utf-8').strip().split('\n')
        
        if len(output) >= 5:
            width, height, codec, duration, size = output[:5]
            
            return {
                "width": int(width),
                "height": int(height),
                "codec": codec,
                "duration": float(duration),
                "size": int(size),
                "valid": True
            }
        
        return {"valid": False, "error": "不完全な出力"}
    
    except Exception as e:
        return {"valid": False, "error": str(e)}

def test_video_generation():
    """
    動画生成機能のテスト
    
    1秒のMP4動画が生成され、ffprobeで検証できることを確認
    """
    with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as temp:
        temp_path = temp.name
    
    try:
        assert generate_test_video(temp_path, duration=1)
        
        assert os.path.exists(temp_path)
        
        assert os.path.getsize(temp_path) > 0
        
        result = verify_video(temp_path)
        
        assert result["valid"]
        assert result["width"] == 1280
        assert result["height"] == 720
        assert result["codec"] == "h264"
        assert 0.9 <= result["duration"] <= 1.1  # 約1秒
    
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)
