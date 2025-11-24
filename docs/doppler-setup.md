# Doppler 導入ガイド

## 概要

ローカル／ステージング／本番で散らばりがちな `.env` を Doppler に集約し、`doppler run` コマンド経由でアプリ・ワーカーを起動できるようにするための手順です。  
Codex で作業する場合も下記フローを踏めば、同じコマンドで環境を切り替えられます。

## 前提

1. 開発マシンに Doppler CLI をインストール  
   ```bash
   # macOS
   brew install dopplerhq/cli/doppler
   # それ以外のOSは https://docs.doppler.com/docs/install-cli を参照
   ```
2. `doppler login` でワークスペースへサインイン（CI ではサービストークンを使用）

## プロジェクト／コンフィグ構成

| 区分 | Doppler 設定値 | 役割 |
| ---- | -------------- | ---- |
| Project | `osakamenesu` | このリポジトリ専用のコンフィグ集合 |
| Configs | `dev_docker`, `dev_web`, `stg`, `prd` | `dev_docker`: docker-compose 用 (`osakamenesu/.env` 相当)、`dev_web`: Next.js/Worker のホスト実行 (`apps/web/.env.local` 相当) |
| Services | `apps/web`, `services/api` | 1 Project で共通のシークレットを使う想定 |

> ※ Project/Config 名は自由ですが、上記で揃えると `scripts/doppler-dev.sh` がそのまま使えます。

## 必須シークレット一覧

| キー | 説明 | 備考 |
| ---- | ---- | ---- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_HOST`, `POSTGRES_PORT` | FastAPI (docker-compose) 用の DB 情報 | ローカルは既存の `.env` と同じでOK |
| `MEILI_HOST`, `MEILI_MASTER_KEY` | Meilisearch 接続 | `http://osakamenesu-meili:7700` など |
| `API_ORIGIN`, `NEXT_PUBLIC_API_BASE`, `API_INTERNAL_BASE` | API / Web の通信先 | ローカルでは `http://localhost:3000` / `/api` / `http://osakamenesu-api:8000` |
| `ADMIN_BASIC_USER`, `ADMIN_BASIC_PASS` | 既存の Basic 認証 | Playwright でも使用 |
| `NOTIFICATION_WORKER_ENABLED` | FastAPI 内蔵ワーカーの有効/無効 | 既定 `true`。障害対応で止めたい場合のみ `false` |
| `ASYNC_WORKER_TOKEN` | `/api/async/deliveries/{id}/dispatch` 用のトークン | 手動再送 API を叩く場合に使用 |
| `SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE` | Sentry 連携（任意） | Worker, Web, API で共有 |
| `SLACK_ERROR_WEBHOOK_URL`, `LINE_NOTIFY_TOKEN` など | 通知関連 | 既存 `.env` と同じ |

その他 `.env` に存在するキーは基本的に Doppler に移すのがおすすめです。

## シークレット登録例

```bash
# 例: FastAPI 内蔵ワーカーを明示的に有効化
doppler secrets set NOTIFICATION_WORKER_ENABLED=true --project osakamenesu --config dev
# 再送 API 用トークン
doppler secrets set ASYNC_WORKER_TOKEN="$(openssl rand -hex 32)" --project osakamenesu --config dev
```

CI ではサービストークンを発行し、GitHub Actions の Secrets に `DOPPLER_TOKEN` を保存して `doppler run` を利用します。

## doppler run での起動

### Next.js (apps/web)
```bash
# dev config を使って Next.js を起動
cd osakamenesu/apps/web
doppler run --project osakamenesu --config dev_web -- npm run dev
```

### FastAPI + Worker を docker-compose で起動
```bash
cd osakamenesu
doppler run --project osakamenesu --config dev_docker -- docker compose up osakamenesu-db osakamenesu-meili osakamenesu-redis osakamenesu-api
```

### 便利スクリプト

`scripts/doppler-dev.sh` を用意してあるため、以下でも一括起動できます（config は `dev` がデフォルト）。
```bash
./scripts/doppler-dev.sh dev_docker
```

## CI/CD での利用例

GitHub Actions ではジョブ内で `DOPPLER_TOKEN` を設定し、以下のようにコマンドを包みます。

```yaml
- name: Install Doppler
  run: curl -Ls https://cli.doppler.com/install.sh | sh
- name: Run tests with Doppler secrets
  env:
    DOPPLER_TOKEN: ${{ secrets.DOPPLER_STG_TOKEN }}
  run: doppler run --project osakamenesu --config stg -- npm run lint
```

## 既存 .env との共存

- `.env` / `.env.local` はテンプレート（例: `.env.example`）として残し、初期セットアップ時に手動で埋めたい場合に使う。  
- 通常は `doppler run` 経由で値を注入するため、平文で `.env` をコミットする必要がなくなる。

---
運用で追加のシークレットが必要になった場合は、このガイドの表に追記して `doppler secrets set` で反映してください。
