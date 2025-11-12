# Osaka × メンズエステ — 開発クイックスタート

このリポジトリは **すべての環境変数を Doppler から注入する** 前提です。まずはサービス Token でログインしてください。

```bash
# 初回のみ: 対話なしで CLI を紐付ける
doppler setup --token <SERVICE_TOKEN>

# 依存関係を一括インストール (apps/web も自動で入ります)
pnpm install

# FastAPI と Next.js を Doppler 経由で同時起動
pnpm dev
```

- `pnpm dev` は `MEILI_HOST=http://127.0.0.1:7700` を上書きした FastAPI (`uvicorn`) と Next.js (`apps/web`) を並列実行します。
- `doppler run --project osakamenesu --config dev_web -- …` を必ず経由するため、`.env` や手動 export は不要です。
- CI / ローカルともに `DOPPLER_TOKEN` (サービス Token) を設定すれば対話なしで同じコマンドが動きます。

## よく使う npm/pnpm スクリプト

| コマンド | 説明 |
| --- | --- |
| `pnpm dev` | FastAPI + Next.js を同時にホットリロード起動。すべて Doppler 注入。|
| `pnpm dev:api` | API のみ起動。`MEILI_HOST` を 127.0.0.1 に強制し、`uvicorn --reload` で実行。|
| `pnpm dev:web` | Web のみ起動。Doppler で API キー類を注入したまま `pnpm --dir apps/web dev` を叩きます。|

### Admin E2E (Docker + Doppler)

本番と同じコンテナ構成で Playwright を走らせたい場合は、`docker-compose.admin-e2e.yml` を使用してください。

```bash
cd /Users/yusaku/Repositories/kakeru-local/osakamenesu
doppler secrets download --project osakamenesu --config stg --format env > .env.admin-e2e
docker compose -f docker-compose.admin-e2e.yml up --build --abort-on-container-exit e2e
docker compose -f docker-compose.admin-e2e.yml down -v   # 後片付け
```

API / Web / Postgres / Meilisearch / Redis / Playwright の全コンテナが起動し、`.env.admin-e2e` に流し込んだ値だけで検証できます。`.env.admin-e2e` は毎回 **Doppler で生成** してください。

> **補足:** `services/api` をローカルで改修した場合は `docker buildx build --platform linux/arm64 -t osakamenesu-api:local services/api` で API イメージを作り、`ADMIN_API_IMAGE=osakamenesu-api:local COMPOSE_PLATFORM=linux/arm64 docker compose -f docker-compose.admin-e2e.yml up -d api` のように差し替えてください。`apps/web` も同様に `ADMIN_WEB_IMAGE` を上書きすれば、Docker 上でも最新コードで実 API E2E を回せます。

### Playwright 実 API モード（ローカル Next.js + FastAPI）

FastAPI (`pnpm dev:api`) と Next.js (`playwright.config.ts` の `webServer`) をローカルで動かしつつ、クッキー主体の認証で `/api` を叩くときは次の環境変数が必要です。

| 変数 | 用途 |
| --- | --- |
| `E2E_TEST_AUTH_SECRET` または `TEST_AUTH_SECRET` | `/api/auth/test-login` / `/api/test/reservations` を叩くためのガード。FastAPI 側にも同じ値を渡してください。 |
| `ADMIN_API_KEY` (`OSAKAMENESU_ADMIN_API_KEY`) | 管理画面 API proxy 用のヘッダー。 |
| `ADMIN_BASIC_USER` / `ADMIN_BASIC_PASS` | Playwright の Basic 認証。 |
| `NEXT_PUBLIC_OSAKAMENESU_API_BASE` | 実 API を叩くために `/api` を指定。Next 側の `app/api/*` で FastAPI にリレーします。 |
| `NEXT_PUBLIC_SITE_URL` | Cookie の `domain` を揃えるため `http://127.0.0.1:3000` を指定。 |
| `FAVORITES_API_MODE` / `NEXT_PUBLIC_FAVORITES_API_MODE` | `real` を指定すると `/api/favorites/therapists` を FastAPI 経由で叩きます。 |

`apps/web/scripts/run-e2e-real.sh` が上記のデフォルト値をまとめて設定するので、以下のように実行すれば OK です（追加の引数は `playwright test` へ転送されます）。

```bash
# FastAPI (127.0.0.1:8000) を別プロセスで起動しておく
doppler run --project osakamenesu --config dev_web -- pnpm dev:api

# Playwright を実 API モードで起動
doppler run --project osakamenesu --config dev_web -- \
  pnpm --dir apps/web run test:e2e:real -- --project web favorites.spec.ts
```

Next.js 側には以下のプロキシ／補助エンドポイントを作成済みです。

- `/api/auth/request-link`, `/api/auth/test-login`, `/api/auth/me/site`: FastAPI の `sessionCookieOptions()` をそのまま使い回し、Playwright でも正しい Cookie 属性が得られます。
- `/api/test/reservations`: `X-Test-Auth-Secret` を付けた Playwright からリクエストすると FastAPI がテスト用予約を直接生成します（`admin-dashboard` の通知テストで利用）。

## Doppler 前提のその他タスク

- 依存サービス (Postgres / Meilisearch / Redis) は `just ops-dev-up` でまとめて開始できます。
- テストは `doppler run --project osakamenesu --config dev_web -- pytest -m "not integration"` のように **必ず doppler run** を付けて実行してください。
- Raycast やスクリプトから API を止める場合も、`doppler` 付きの `scripts/raycast/osakamenesu-*.sh` を利用するのが推奨です。

## Doppler について

- ローカルは `doppler setup --token <SERVICE_TOKEN>` を 1 回実行すれば OK です (従来の `doppler login` は不要)。
- CI / GitHub Actions などでは `DOPPLER_TOKEN` をシークレットに設定し、手順書どおり `doppler run -- ...` を呼びます。
- `.env` は廃止しました。どうしてもファイルに書き出す必要がある場合は `doppler secrets download --project osakamenesu --config dev_web --format env > .env.local` のように **Doppler から生成** してください。

詳細なスタック/ディレクトリ構成や Docker ベースの手順は `docs/README.md` を参照してください。
