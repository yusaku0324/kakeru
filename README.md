Kakeru - X（旧Twitter）自動投稿ツール

![CI](https://github.com/yusaku0324/kakeru/actions/workflows/run-tests.yml/badge.svg)

画像を表示
概要
Kakeruは、X（旧Twitter）に自動で投稿するためのPythonツールです。OpenAI APIを使用して募集ツイートを生成し、X APIを使用して自動投稿します。
機能

OpenAI APIを使用した募集ツイートの自動生成
X（旧Twitter）への自動投稿（最大4本まで動画添付可／合計4添付）
GitHub Actionsによる定期実行（毎日09:30 JST）
手動実行オプション

必要条件 📝

Python 3.12以上
OpenAI API キー
X（旧Twitter）API キー（Bearer Token）

インストール & クイックスタート 🚀
bash# 1. クローン & 依存解決
git clone https://github.com/yusaku0324/kakeru.git
cd kakeru
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 2. 設定ファイルを準備
cp bot/config/accounts.example.yaml bot/config/accounts.yaml
cp bot/config/shadowban.example.yaml bot/config/shadowban.yaml

# 3. ドライラン（投稿せずログだけ）
python bot/main.py --dry-run
設定ファイル 🛠
ファイル役割bot/config/accounts.yamlcookie_path / user_agent / proxy_labelbot/config/shadowban.yamlproxy_pool_size / gateway / static_ips
プロキシ & UA 固定 🌐

Decodo などで 静的 ISP IP を取得（例: 10 本）
bot/config/shadowban.yaml に gateway: と static_ips: を列挙
bot/config/accounts.yaml に proxy_label: jp_pool と同じ user_agent を記入
動作確認

bash# IP が Decodo の 92.113.*.* になるか確認
python tools/check_proxy.py jp_pool
開発環境セットアップ
開発フローやコーディング規約の詳細は [Repository Guidelines](AGENTS.md) を参照してください。
リポジトリクリーンアップ手順
開発環境をクリーンに保つために、以下の手順を実行してください：
bash# .gitignoreに無視すべきファイルパターンが含まれていることを確認
cat .gitignore
# 追跡済みだけど.gitignoreで無視対象になったファイルをインデックスから外す
git ls-files -i -X .gitignore -z | xargs -0 git rm --cached
# 状態確認
git status -s
# 変更をコミット
git commit -m "chore: リポジトリクリーンアップ"
使用方法
bash# 募集ツイートを生成してXに投稿
python generate_recruit_posts.py
環境変数
.envファイルに以下の環境変数を設定してください：
envOPENAI_API_KEY=sk-...
TWITTER_BEARER_TOKEN=AAAAAAAA...
CHROME_PATH=/Applications/Google\ Chrome.app/...
SHADOWBAN_YAML_PATH=bot/config/shadowban.yaml

Spec Kit (dev-only)
-------------------
ローカル開発で Spec Kit CLI を使う場合（本番/CI には影響しません）:

```
# 永続インストール（推奨）
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git

# 1回限り
uvx --from git+https://github.com/github/spec-kit.git specify --help
```

- サンプル spec: `specs/sample-therapist-home.md`
- ツールの補足: `spec-kit/README.md`

テスト
bash# テストを実行
pytest
# カバレッジレポート付きでテストを実行
pytest --cov=generate_recruit_posts
GitHub Actions
このリポジトリには、以下の機能を持つGitHub Actionsワークフローが含まれています：

毎日09:30 JST（00:30 UTC）に自動実行
手動トリガーによる実行も可能

Docker での使い方
画像を表示
Docker イメージの取得
bashdocker pull ghcr.io/yusaku0324/kakeru:latest
単体実行
bashdocker run -v $(pwd)/.env:/app/.env \
  -v $(pwd)/cookies:/app/cookies \
  -v $(pwd)/queue:/app/queue \
  -v $(pwd)/debug:/app/debug \
  ghcr.io/yusaku0324/kakeru:latest
Docker Compose での実行
docker-compose.yml ファイルを作成：
yamlversion: '3.8'
services:
  kakeru:
    image: ghcr.io/yusaku0324/kakeru:latest
    volumes:
      - ./.env:/app/.env
      - ./cookies:/app/cookies
      - ./queue:/app/queue
      - ./debug:/app/debug
    environment:
      - TZ=Asia/Tokyo
    restart: unless-stopped
実行：
bashdocker-compose up -d
変更履歴
v0.4.0

X投稿機能の拡張：最大4本まで動画添付可能（以前は2本まで）
合計添付ファイル数も4件まで対応
リポジトリクリーンアップ手順の追加
テストカバレッジの向上（80%以上）
Dockerコンテナ化とGitHub Container Registryへの自動デプロイ

ライセンス
このプロジェクトはMITライセンスの下で公開されています。再試行Claudeは間違えることがあります。回答内容を必ずご確認ください。
