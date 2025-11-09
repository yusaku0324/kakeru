# Osaka × メンズエステ — 開発環境

ローカルで MVP を最速で検証できるよう、Web(Next.js) + API(FastAPI) + Postgres + Meilisearch を Doppler + pnpm ベースで起動できます。

## セットアップ

> すべての環境変数は Doppler 管理です。`.env` には何も書きません。

```bash
doppler setup --token <SERVICE_TOKEN>   # 初回のみ
pnpm install                            # ルート + apps/web の依存をまとめて導入
pnpm dev                                # Doppler 経由で FastAPI / Next.js を同時起動
```

依存コンテナ(Postgres/Meili/Redis)が必要な場合は `just ops-dev-up` を併用し、停止時は `just ops-dev-down` を実行します。

> 🔁 Docker Compose 版のワークフローは下部に分離しています。ふだんは pnpm + Doppler が唯一の正解です。

アクセス:
- Web: http://localhost:3000
- API: http://localhost:8000/healthz → `{ "ok": true }`
- Meilisearch: http://localhost:7700 (APIキーは Doppler `dev_web` と同じ)
- Postgres: `localhost:5432` (ユーザー/パスワードも Doppler 参照)

## ディレクトリ

```
apps/web        # Next.js(App Router) — フロント
services/api    # FastAPI — API
docker-compose.yml
docker-compose.test.yml
.env.example   # Docker Compose 用サンプル (通常の dev では未使用)
Makefile
```

## 次の実装ガイド

- 検索: API `/api/profiles/search` を Meilisearch に接続し、facet(エリア/料金/タグ)と sort を実装
- 詳細: `/profiles/:id` で料金/出勤/日記3件/CTA を表示
- /out/:token: ローカルは FastAPI の 302、運用は Cloudflare Workers+KV へ置き換え
- 画像: S3互換(例: MinIO) → Cloudflare CDN、`next/image` で AVIF/WebP + LQIP
- 18+ゲート/SEO/構造化データ: Next Middleware + JSON-LD を追加

## ヘルスチェック

- Postgres コンテナには `pg_isready` ベースの healthcheck を設定しているため、API は ready になるまで自動で待機します。
- Next.js と API の応答確認:

```bash
curl --http1.1 -sS http://127.0.0.1:3000/api/health
curl --http1.1 -sS http://127.0.0.1:3000/api/openapi.json
```

## Doppler ワークフローでの Ops API 確認

FastAPI (dev_web) と docker compose (dev_docker) を同時に動かすと `/api/ops/*` のレスポンスを確認できます。`just` がインストール済みであれば次のワークフローで実行できます。

```bash
just ops-dev-up        # Postgres / Meilisearch / Redis を起動
just ops-dev-api       # Doppler 経由で FastAPI を起動 (MEILI_HOST は 127.0.0.1 に上書き)
just ops-dev-check     # /api/ops/{queue,outbox,slots} を curl で確認
just ops-dev-down      # 依存コンテナと API を停止
```

`just` が無い場合は `doppler run --project osakamenesu --config dev_docker -- docker compose up ...` および `doppler run --project osakamenesu --config dev_web -- uvicorn ...` をそのまま実行してください。起動後は `curl http://127.0.0.1:8000/api/ops/queue | jq` などで JSON を確認できます。

## Docker Compose (オプション)

Docker で API/Web/DB をまとめて起動したいケース向けに `.env.example` を残しています。通常の開発では pnpm + Doppler を使ってください。

```bash
cp -n .env.example .env                 # Docker 専用 (pnpm dev では未使用)
docker compose up -d osakamenesu-db osakamenesu-meili
doppler run --project osakamenesu --config dev_web -- pnpm dev  # もしくは docker compose up osakamenesu-api/osakamenesu-web
```

- `pnpm dev` を使わず Docker だけで API/Web を動かす場合:

```bash
cp -n .env.example .env                 # Docker 専用 (pnpm dev では未使用)
docker compose up -d osakamenesu-db osakamenesu-meili
docker compose up -d osakamenesu-api osakamenesu-web
docker compose logs -f osakamenesu-api osakamenesu-web
```

- Admin 向け E2E を Docker + Doppler で実行する場合:

```bash
doppler secrets download --project osakamenesu --config stg --format env > .env.admin-e2e
docker compose -f docker-compose.admin-e2e.yml up --build --abort-on-container-exit e2e
docker compose -f docker-compose.admin-e2e.yml down -v
```

- `.env` は Docker コンテナ用のみに利用します。ホストで FastAPI/Next.js を動かすときは **必ず Doppler** を使うこと。
- `Makefile` の `osakamenesu-*` ターゲットは Docker フロー向けのレガシーサポートです。pnpm スクリプトと混同しないようにしてください。

## よく使うコマンド

```
pnpm dev          # Doppler 付きで FastAPI + Next.js を同時起動
pnpm dev:api      # API 単体 (MEILI_HOST=127.0.0.1 上書き)
pnpm dev:web      # Web 単体 (Doppler 経由で API URL 等を注入)
just ops-dev-up   # Postgres / Meilisearch / Redis を立ち上げ
just ops-dev-down # 依存コンテナを停止
```

## メモ

- 本番は API/DB/検索を別プロセス & CDN キャッシュ/ISR を併用
- クリック計測は Cloudflare Workers へ移行し、ダッシュボードは日/週集計
- スキーマ/ER は 要件ドキュメント の通り。Alembic を追加してマイグレーションを管理予定

## データ投入フロー（WIP）

`tools/import_shops_from_yaml.py` で YAML から店舗データを流し込めます。サンプルは `data/sample_shops.yaml`。

```
python tools/import_shops_from_yaml.py data/sample_shops.yaml --api-base http://localhost:8000 --admin-key dev_admin_key
```

YAMLには以下の情報を記載できます:
- `name`, `area`, `price_min`, `price_max`, `service_type`
- `photos` (配列), `tags`(=service_tags), `discounts`, `badges`
- `promotions` (label/description/expires_at)
- `diaries` (title/body/photos/hashtags/published_at)
- `contact.phone/line/website/reservation_form_url/sns`
- `menus` (name/price/duration_minutes/tags/description)
- `staff` (name/alias/headline/specialties)
- `availability.{YYYY-MM-DD}` の配列（`start_at`, `end_at`, `status`）

スクリプトは以下を実行します:
1. `/api/admin/profiles` で店舗作成（`contact_json` に menus/staff を格納）
2. `/api/admin/availabilities/bulk` で出勤データ投入
3. 任意の LINE/TEL/WEB を `/api/admin/outlinks` へ作成
4. `/api/admin/reindex` で Meilisearch を同期

※ `services/api/requirements.txt` に `PyYAML` を追加したので、`pip install -r requirements.txt` の再実行が必要です。

### Ops デバッグ用のサンプルデータ投入

`tools/seed_ops_samples.py` を実行すると、Ops API の値を確認するためのサンプルプロフィール／予約／通知キューを投入できます。

```bash
cd services/api
doppler run --project osakamenesu --config dev_web -- \
  python tools/seed_ops_samples.py

# Makefile 経由で実行する場合
make ops-sample-seed
```

既存のサンプル（channel=`ops_seed`）はスクリプト実行時にクリーンアップされるため、何度でも流し直せます。
