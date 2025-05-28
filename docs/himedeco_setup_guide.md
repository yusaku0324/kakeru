# HimeDeco写メ日記投稿機能セットアップガイド

## 概要

このガイドでは、Kakeruツールに姫デコ（HimeDeco）の写メ日記投稿機能を追加する方法について説明します。

## 前提条件

- 姫デコのアカウント（ユーザー名とパスワード）
- Python 3.12以上
- Google Chrome または Chromium ブラウザ
- ChromeDriver（Seleniumで使用）

## セットアップ手順

### 1. 設定ファイルの準備

```bash
# 設定ファイルをコピー
cp bot/config/himedeco.example.yaml bot/config/himedeco.yaml

# 編集して認証情報を設定
nano bot/config/himedeco.yaml
```

以下の項目を更新：
- `username`: 姫デコのユーザー名
- `password`: 姫デコのパスワード
- `base_url`, `login_url`, `diary_url`: 実際の姫デコのURLに更新

### 2. 依存関係のインストール

既存の`requirements.txt`にはSeleniumなど必要なパッケージが含まれているので、追加インストールは不要です。

### 3. 使用方法

#### コマンドラインから直接投稿

```bash
# 基本的な使用例
python -m bot.services.himedeco_client.main \
  --config bot/config/himedeco.yaml \
  --title "今日の日記" \
  --content "素敵な一日でした！" \
  --photos /path/to/photo1.jpg /path/to/photo2.jpg \
  --tags "日常" "写真"

# ドライラン（実際には投稿しない）
python -m bot.services.himedeco_client.main \
  --config bot/config/himedeco.yaml \
  --title "テスト投稿" \
  --content "これはテストです" \
  --dry-run
```

#### Pythonコードから使用

```python
from bot.services.himedeco_client.main import HimeDecoClient
from bot.services.himedeco_client.config import HimeDecoConfig
import yaml

# 設定を読み込み
with open("bot/config/himedeco.yaml", "r") as f:
    config_dict = yaml.safe_load(f)

config = HimeDecoConfig.from_dict(config_dict)

# クライアントを初期化
client = HimeDecoClient(config)

try:
    # ドライバーを初期化
    client.initialize_driver()
    
    # ログイン
    client.login()
    
    # 日記を投稿
    success = client.post_diary(
        title="Pythonから投稿",
        content="これはPythonスクリプトから投稿されました。",
        photo_paths=["photo1.jpg", "photo2.jpg"],
        tags=["自動投稿", "テスト"]
    )
    
    if success:
        print("投稿成功！")
    else:
        print("投稿失敗")
        
finally:
    # クリーンアップ
    client.cleanup()
```

### 4. 既存のKakeruツールとの統合

既存のツールと統合する場合は、`bot/main.py`を拡張して姫デコ投稿機能を追加できます：

```python
# bot/main.pyに追加
def post_to_himedeco(title, content, photos=None, tags=None):
    """姫デコに投稿する関数"""
    from bot.services.himedeco_client.main import HimeDecoClient
    from bot.services.himedeco_client.config import HimeDecoConfig
    
    # 設定を読み込み
    with open("bot/config/himedeco.yaml", "r") as f:
        config_dict = yaml.safe_load(f)
    
    config = HimeDecoConfig.from_dict(config_dict)
    client = HimeDecoClient(config)
    
    try:
        client.initialize_driver()
        client.login()
        return client.post_diary(title, content, photos or [], tags)
    finally:
        client.cleanup()
```

## Cookie認証の使用

毎回ログインを避けるため、Cookie認証を使用できます：

1. 一度手動でログインしてCookieを保存
2. 次回以降はCookieを使用してログイン

```bash
# Cookieを使用して投稿
python -m bot.services.himedeco_client.main \
  --config bot/config/himedeco.yaml \
  --cookies profiles/himedeco_cookies.json \
  --title "Cookie認証で投稿" \
  --content "ログイン不要！"
```

## トラブルシューティング

### 問題: ログインできない
- URLが正しいか確認
- ユーザー名とパスワードが正しいか確認
- サイトの構造が変わっていないか確認（セレクターの更新が必要な場合があります）

### 問題: 要素が見つからない
- `bot/services/himedeco_client/poster.py`のセレクターを実際のサイトに合わせて更新
- Developer Toolsを使用して正しいセレクターを確認

### 問題: タイムアウトエラー
- 設定ファイルでタイムアウト値を増やす
- ネットワーク接続を確認

## 注意事項

1. **セレクターの更新**: 実装コードのセレクター（ID、クラス名など）は仮のものです。実際の姫デコサイトの構造に合わせて更新が必要です。

2. **URL の更新**: 設定ファイルのURLも実際の姫デコのURLに更新してください。

3. **利用規約の確認**: 自動投稿を行う前に、姫デコの利用規約を確認し、自動化が許可されているか確認してください。

4. **レート制限**: 短時間に大量の投稿を行わないよう注意してください。

## さらなるカスタマイズ

- スケジュール投稿機能の追加
- 画像の自動リサイズ
- テンプレートベースの投稿
- 複数アカウント対応

これらの機能が必要な場合は、既存のTwitter投稿機能を参考に実装できます。