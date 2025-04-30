# Kakeru - X（旧Twitter）自動投稿ツール

## 概要

Kakeruは、X（旧Twitter）に自動で投稿するためのPythonツールです。OpenAI APIを使用して募集ツイートを生成し、X APIを使用して自動投稿します。

## 機能

- OpenAI APIを使用した募集ツイートの自動生成
- X（旧Twitter）への自動投稿（最大4本まで動画添付可／合計4添付）
- GitHub Actionsによる定期実行（毎日09:30 JST）
- 手動実行オプション

## 必要条件

- Python 3.12以上
- OpenAI API キー
- X（旧Twitter）API キー（Bearer Token）

## インストール

```bash
# リポジトリをクローン
git clone https://github.com/yusaku0324/kakeru.git
cd kakeru

# 依存パッケージをインストール
pip install -r requirements.txt

# .envファイルを作成
cp .env.example .env
# .envファイルを編集してAPIキーを設定
```

## 開発環境セットアップ

### リポジトリクリーンアップ手順

開発環境をクリーンに保つために、以下の手順を実行してください：

```bash
# .gitignoreに無視すべきファイルパターンが含まれていることを確認
cat .gitignore

# 追跡済みだけど.gitignoreで無視対象になったファイルをインデックスから外す
git ls-files -i -X .gitignore -z | xargs -0 git rm --cached

# 状態確認
git status -s

# 変更をコミット
git commit -m "chore: リポジトリクリーンアップ"
```

## 使用方法

```bash
# 募集ツイートを生成してXに投稿
python generate_recruit_posts.py
```

## 環境変数

`.env`ファイルに以下の環境変数を設定してください：

- `OPENAI_API_KEY`: OpenAI APIキー
- `TWITTER_BEARER_TOKEN`: X（旧Twitter）のBearer Token

## アカウント設定

Kakeruは複数のX（旧Twitter）アカウントを管理するために、YAML形式の設定ファイルを使用します。

### accounts.yaml

`kakeru/config/accounts.yaml`に以下の形式でアカウントを設定します：

```yaml
# アカウント名: { cookie: パス, proxy: プロキシタグ(オプション) }
yusaku:
  cookie: secrets/yusaku.jar
dev_bot:
  cookie: secrets/dev_bot.jar
  proxy: tokyo
```

### クッキーログインCLI

手動でXアカウントにログインし、クッキーを保存するためのCLIコマンドを提供しています：

```bash
# アカウントにログインしてクッキーを保存
python -m kakeru login <screen_name>
```

このコマンドは、ブラウザを起動して手動ログイン（2FA認証を含む）を待ち、ログイン完了後にクッキーを保存します。

### IPローテーション戦略

シャドウバンを回避するために、IPローテーション戦略を設定できます：

`kakeru/config/shadowban.yaml`に以下の設定を行います：

```yaml
# IPローテーション戦略
# - per_session: セッションごとに1回IPを変更（デフォルト）
# - per_5_posts: 5投稿ごとにIPを変更
# - per_15_minutes: 15分ごとにIPを変更
ip_rotation_strategy: per_session

# プロキシ設定
proxies:
  tokyo:
    host: proxy.tokyo.example.com
    port: 8080
    username: user1
    password: pass1
  osaka:
    host: proxy.osaka.example.com
    port: 8080
    username: user2
    password: pass2
```

## テスト

```bash
# テストを実行
pytest

# カバレッジレポート付きでテストを実行
pytest --cov=generate_recruit_posts
```

## GitHub Actions

このリポジトリには、以下の機能を持つGitHub Actionsワークフローが含まれています：

- 毎日09:30 JST（00:30 UTC）に自動実行
- 手動トリガーによる実行も可能

## Docker での使い方

[![Docker Pulls](https://img.shields.io/docker/pulls/ghcr.io/yusaku0324/kakeru)](https://github.com/yusaku0324/kakeru/pkgs/container/kakeru)

### Docker イメージの取得

```bash
docker pull ghcr.io/yusaku0324/kakeru:latest
```

### 単体実行

```bash
docker run -v $(pwd)/.env:/app/.env \
  -v $(pwd)/profiles:/app/profiles \
  -v $(pwd)/queue:/app/queue \
  -v $(pwd)/debug:/app/debug \
  ghcr.io/yusaku0324/kakeru:latest
```

### Docker Compose での実行

`docker-compose.yml` ファイルを作成：

```yaml
version: '3.8'

services:
  kakeru:
    image: ghcr.io/yusaku0324/kakeru:latest
    volumes:
      - ./.env:/app/.env
      - ./profiles:/app/profiles
      - ./queue:/app/queue
      - ./debug:/app/debug
    environment:
      - TZ=Asia/Tokyo
    restart: unless-stopped
```

実行：

```bash
docker-compose up -d
```

## 変更履歴

### v0.4.0
- X投稿機能の拡張：最大4本まで動画添付可能（以前は2本まで）
- 合計添付ファイル数も4件まで対応
- リポジトリクリーンアップ手順の追加
- テストカバレッジの向上（80%以上）
- Dockerコンテナ化とGitHub Container Registryへの自動デプロイ

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。
