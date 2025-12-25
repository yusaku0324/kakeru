#!/usr/bin/env python3
"""
VAPIDキーペアを生成するスクリプト

使用方法:
    python generate-vapid-keys.py
"""

import base64
import os
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend


def generate_vapid_keys():
    """VAPIDキーペアを生成する"""
    # プライベートキーを生成
    private_key = ec.generate_private_key(ec.SECP256R1(), default_backend())

    # パブリックキーを取得
    public_key = private_key.public_key()

    # プライベートキーをPEM形式でエクスポート
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )

    # パブリックキーをUncompressed Point形式でエクスポート
    public_bytes = public_key.public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint
    )

    # Base64 URLセーフエンコーディング
    private_key_base64 = base64.urlsafe_b64encode(private_pem).decode('utf-8').rstrip('=')
    public_key_base64 = base64.urlsafe_b64encode(public_bytes).decode('utf-8').rstrip('=')

    return private_key_base64, public_key_base64


def main():
    """メイン関数"""
    print("VAPID鍵ペアを生成しています...")

    private_key, public_key = generate_vapid_keys()

    print("\n=== 生成されたVAPIDキー ===\n")
    print(f"VAPID_PRIVATE_KEY={private_key}")
    print(f"VAPID_PUBLIC_KEY={public_key}")
    print(f"NEXT_PUBLIC_VAPID_PUBLIC_KEY={public_key}")

    print("\n=== 使用方法 ===")
    print("1. 上記の環境変数をAPIとWebアプリの.envファイルに追加してください")
    print("2. APIには VAPID_PRIVATE_KEY と VAPID_PUBLIC_KEY を設定")
    print("3. Webアプリには NEXT_PUBLIC_VAPID_PUBLIC_KEY を設定")

    # オプション: .envファイルに追記
    if input("\n.env.exampleファイルを更新しますか? (y/N): ").lower() == 'y':
        api_env_path = os.path.join(os.path.dirname(__file__), '..', '.env.example')

        with open(api_env_path, 'a') as f:
            f.write('\n# Push Notification Settings\n')
            f.write(f'VAPID_PRIVATE_KEY={private_key}\n')
            f.write(f'VAPID_PUBLIC_KEY={public_key}\n')

        print(f"\n✅ {api_env_path} を更新しました")


if __name__ == "__main__":
    main()