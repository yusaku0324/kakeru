# ローカル開発環境セットアップガイド

このガイドでは、Kakeruのローカル開発環境をセットアップする手順を説明します。

## 前提条件

- Python 3.12以上
- Google Chrome
- Git

## 基本セットアップ

1. リポジトリをクローン

```bash
git clone https://github.com/yusaku0324/kakeru.git
cd kakeru
```

2. 仮想環境を作成して有効化

```bash
python -m venv venv
source venv/bin/activate  # Windowsの場合: venv\Scripts\activate
```

3. 依存パッケージをインストール

```bash
pip install -e .[dev]
pip install -r requirements.txt
```

4. 環境変数の設定

```bash
cp .env.example .env
# .envファイルを編集してAPIキーを設定
```

## アカウント設定

Kakeruは複数のX（旧Twitter）アカウントを管理するために、YAML形式の設定ファイルを使用します。

### accounts.yamlの設定

1. 設定ディレクトリを作成

```bash
mkdir -p kakeru/config secrets
```

2. `kakeru/config/accounts.yaml`ファイルを作成

```yaml
# アカウント名: { cookie: パス, proxy: プロキシタグ(オプション) }
yusaku:
  cookie: secrets/yusaku.jar
dev_bot:
  cookie: secrets/dev_bot.jar
  proxy: tokyo
```

### クッキーログインCLI

手動でXアカウントにログインし、クッキーを保存するためのCLIコマンドを使用します：

```bash
# アカウントにログインしてクッキーを保存
python -m kakeru login <screen_name>
```

このコマンドは、ブラウザを起動して手動ログイン（2FA認証を含む）を待ち、ログイン完了後にクッキーを保存します。

### 新しいアカウントの追加手順

1. `kakeru/config/accounts.yaml`に新しいアカウントを追加

```yaml
new_account:
  cookie: secrets/new_account.jar
  proxy: osaka  # オプション
```

2. CLIを使用してログインしクッキーを保存

```bash
python -m kakeru login new_account
```

3. ブラウザが起動したら、手動でログイン（2FA認証を含む）

4. ログイン完了後、Enterキーを押してクッキーを保存

## IPローテーション戦略の設定

シャドウバンを回避するために、IPローテーション戦略を設定できます。

1. `kakeru/config/shadowban.yaml`ファイルを作成

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

2. アカウントにプロキシタグを設定

`kakeru/config/accounts.yaml`ファイルで、アカウントにプロキシタグを設定します：

```yaml
yusaku:
  cookie: secrets/yusaku.jar
  proxy: tokyo  # shadowban.yamlで定義したプロキシタグ
```

## テストの実行

```bash
# 全テストを実行
pytest

# カバレッジレポート付きでテストを実行
pytest --cov=kakeru --cov=bot --cov-report=term-missing

# 特定のテストを実行
pytest tests/test_proxy.py
```

## GitHub Actionsワークフローのローカル実行

GitHub Actionsワークフローをローカルで実行するには、[act](https://github.com/nektos/act)を使用します：

```bash
# actのインストール（Linuxの場合）
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# ワークフローの実行
act -j post
```

## トラブルシューティング

### クッキーの問題

クッキーが期限切れになった場合は、CLIを使用して再度ログインします：

```bash
python -m kakeru login <screen_name>
```

### プロキシの問題

プロキシ接続に問題がある場合は、以下を確認してください：

1. `shadowban.yaml`のプロキシ設定が正しいか
2. プロキシサーバーが稼働しているか
3. プロキシサーバーの認証情報が正しいか

### テストの失敗

テストが失敗する場合は、以下を確認してください：

1. 依存パッケージが最新かどうか
2. 環境変数が正しく設定されているか
3. クッキーファイルが存在するか
