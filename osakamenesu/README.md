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
- CI / ローカルともに `DOPPLER_STG_TOKEN` (ステージング向けサービス Token) を設定すれば対話なしで同じコマンドが動きます。GitHub Actions (`ci-web`) でもこのトークンを `stg_web` コンフィグで使用します。

### Postgres を必ず起動する
- Docker Compose を使う場合（推奨）:
  ```bash
  docker compose up -d db api  # サービス名に合わせて調整
  ```
- ローカル Postgres を使う場合:
  ```bash
  createdb -h localhost -p 5432 -U app osaka_menesu
  export DATABASE_URL="postgresql+asyncpg://app:app@localhost:5432/osaka_menesu"
  ```
- 開発の一時対応として SQLite に切り替える場合:
  ```bash
  export DATABASE_URL="sqlite+aiosqlite:///:memory:"
  ```
  ※ あくまで開発用。CI/本番では必ず Postgres (asyncpg) を使用。

DB 未起動のままフロントから類似/検索 API を叩くと 500 になります。まず DB を起動し、asyncpg URL が設定されていることを確認してください。

#### Alembic / マイグレーション運用ルール（開発者向け）
- 初回セットアップ（推奨手順）
  ```bash
  # DB を起動
  docker compose up -d osakamenesu-db

  # API コンテナ経由でマイグレ実行（初回）
  docker compose run --rm osakamenesu-api bash -lc "cd services/api && alembic upgrade head"
  ```
- 開発中のチェック:
  ```bash
  cd services/api
  alembic heads  # head が 1 個であることを確認
  alembic upgrade head --sql  # オフラインで SQL を出して syntax を確認
  ```
- head が複数になったら、merge マイグレーション（例: 003X_merge_heads.py）を追加して 1 つにまとめること。複数 head のまま main に入れない。
- 既存 Enum を再定義しないよう、Postgres ENUM は `checkfirst=True` または DO $$ BEGIN ... duplicate_object THEN NULL; を使う（テンプレに helper あり）。
- 本番は必ず `alembic upgrade head` で上げる。`alembic stamp` はローカルの応急処置に限定。

## よく使う npm/pnpm スクリプト

| コマンド | 説明 |
| --- | --- |
| `pnpm dev` | FastAPI + Next.js を同時にホットリロード起動。すべて Doppler 注入。|
| `pnpm dev:api` | API のみ起動。`MEILI_HOST` を 127.0.0.1 に強制し、`uvicorn --reload` で実行。|
| `pnpm dev:web` | Web のみ起動。Doppler で API キー類を注入したまま `pnpm --dir apps/web dev` を叩きます。|

### MCP 連携（Supabase）

Supabase が公開している MCP サーバーに接続することで、Cursor や Windsurf からプロジェクトを直接操作できます。セットアップ方法は [`docs/mcp-supabase.md`](docs/mcp-supabase.md) を参照してください。読み取り専用モードや `project_ref` で権限を絞ることを推奨します。

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

Playwright の実行後は CI で自動再生成される `apps/web/test-results/` が残るため、`rm -rf apps/web/test-results` で後片付けしてからコミットしてください。

Next.js 側には以下のプロキシ／補助エンドポイントを作成済みです。

- `/api/auth/request-link`, `/api/auth/test-login`, `/api/auth/me/site`: FastAPI の `sessionCookieOptions()` をそのまま使い回し、Playwright でも正しい Cookie 属性が得られます。
- `/api/test/reservations`: `X-Test-Auth-Secret` を付けた Playwright からリクエストすると FastAPI がテスト用予約を直接生成します（`admin-dashboard` の通知テストで利用）。

#### ビジュアルリグレッション（Playwright）

- `apps/web/e2e/visual-regression.spec.ts` は opt-in（`E2E_ENABLE_VISUAL=1` のときのみ実行）になっています。
- 例: `doppler run --project osakamenesu --config dev_web -- pnpm test:e2e:visual`
- スナップショットを更新したい場合は `-- --update-snapshots` を付けてください。生成された画像は `apps/web/e2e/visual-regression.spec.ts-snapshots/` に保存されます。

### 通知ワーカー（FastAPI から分離）

予約通知の Slack / Email / LINE 配信は、API プロセスとは別のワーカーで処理するようになりました。ローカルや開発環境で通知を流したい場合は次のように起動してください。

```bash
cd services/api
doppler run --project osakamenesu --config dev_api -- \
  python -m app.scripts.notifications_worker
```

`SIGINT` / `SIGTERM` を受け取ると安全に停止します。Uvicorn の再起動とは独立しているため、Procfile や `docker-compose` では API とワーカーを別サービスとして定義してください。従来の `start_notification_worker()` は非推奨になり、FastAPI の起動時には自動起動しません。

## Doppler 前提のその他タスク

- 依存サービス (Postgres / Meilisearch / Redis) は `just ops-dev-up` でまとめて開始できます。
- テストは `doppler run --project osakamenesu --config dev_web -- pytest -m "not integration"` のように **必ず doppler run** を付けて実行してください。
- Raycast やスクリプトから API を止める場合も、`doppler` 付きの `scripts/raycast/osakamenesu-*.sh` を利用するのが推奨です。

## Doppler について

- ローカルは `doppler setup --token <SERVICE_TOKEN>` を 1 回実行すれば OK です (従来の `doppler login` は不要)。
- CI / GitHub Actions などでは `DOPPLER_TOKEN` をシークレットに設定し、手順書どおり `doppler run -- ...` を呼びます。
- `.env` は廃止しました。どうしてもファイルに書き出す必要がある場合は `doppler secrets download --project osakamenesu --config dev_web --format env > .env.local` のように **Doppler から生成** してください。
- Doppler 経由で実行されているか不安なときは `just require-doppler` でチェックできます。詳しくは [`docs/doppler-workflow.md`](docs/doppler-workflow.md) を参照してください。

詳細なスタック/ディレクトリ構成や Docker ベースの手順は `docs/README.md` を参照してください。

## 主な機能と改善

### パフォーマンス最適化

包括的なパフォーマンス最適化により、優れたユーザー体験を実現：

- **Core Web Vitals モニタリング**: LCP、FID、CLS、FCP、TTFBの自動計測とレポート
- **画像最適化**: 遅延読み込み、WebP/AVIF対応、レスポンシブ画像 (`OptimizedImage` コンポーネント)
- **バンドル最適化**: 動的インポート、コード分割、Tree shaking (分析: `npm run build:analyze`)
- **フォント最適化**: WOFF2、日本語サブセット化、アダプティブローディング
- **キャッシュ戦略**: Stale-while-revalidate、メモリ/IndexedDBキャッシュ (`CacheManager`)
- **レンダリング最適化**: 仮想リスト、Progressive Hydration、バッチ状態更新

詳細は [`docs/features/performance-optimization-summary.md`](docs/features/performance-optimization-summary.md) を参照。

### モニタリングとアラート

- **Sentry統合**: エラー追跡、パフォーマンスモニタリング、カスタムコンテキスト
- **Prometheusメトリクス**: API、DB、キャッシュ操作の詳細メトリクス
- **ヘルスチェック**: 包括的な依存関係チェック (`/health/*` エンドポイント)

詳細は [`docs/features/monitoring-alerts-summary.md`](docs/features/monitoring-alerts-summary.md) を参照。

### PWA対応

- **オフライン対応**: Service Worker、キャッシュ戦略、オフラインページ
- **プッシュ通知**: VAPID認証、予約確認通知
- **インストール可能**: ホーム画面追加、スタンドアロン動作
- **バックグラウンド同期**: オフライン時のデータ同期

詳細は [`docs/features/pwa-implementation-summary.md`](docs/features/pwa-implementation-summary.md) を参照。

### E2Eテスト拡張

- **包括的テストスイート**: プッシュ通知、予約フロー、ダッシュボード、モバイル体験
- **マルチデバイス対応**: デスクトップ・モバイルブラウザ、実デバイスサイズ
- **実API統合**: モックを使わない本物のエンドツーエンドテスト

詳細は [`docs/features/e2e-test-expansion-summary.md`](docs/features/e2e-test-expansion-summary.md) を参照。

### SEO最適化

- **メタタグ最適化**: 動的なtitle/description生成、OGP、Twitter Card
- **構造化データ**: Organization、LocalBusiness、Service、BreadcrumbListスキーマ
- **サイトマップ**: 動的生成、優先度自動計算、店舗・セラピスト対応
- **パンくずリスト**: 視覚的ナビゲーションと構造化データ
- **画像最適化**: alt属性自動生成、SEO対応画像コンポーネント

詳細は [`docs/features/seo-optimization-summary.md`](docs/features/seo-optimization-summary.md) を参照。

## 共通 UI Hooks / Utils

- `apps/web/src/hooks/useBodyScrollLock.ts` にスクロール固定用の React フックを用意しています。モーダルや全画面オーバーレイを実装するときは `useBodyScrollLock(isOpen)` を呼び出し、`body` の `overflow` を自動的に復旧させてください。
- 日付フォーマット (`pad`, `formatLocalDate`, `toIsoWithOffset`) は `apps/web/src/utils/date.ts`、料金テキストのパースは `apps/web/src/utils/pricing.ts` に集約しています。同じユーティリティを使うことで UI 間での表記揺れを防げます。
- パフォーマンス最適化フック (`useDebounce`, `useThrottle`, `useVirtualScroll` など) は `apps/web/src/hooks/use-performance.ts` に集約しています。

## アーキテクチャ健全性チェック

スプリントごとにリファクタ候補を洗い出すため、`just architecture-check` で肥大化ファイルとホットスポット、サービス層の依存方向（例: FastAPI import）を確認できます。出力やオプションの詳細は [`docs/architecture-check.md`](docs/architecture-check.md) を参照してください。GitHub Actions (`Architecture Check`) でも同じスクリプトを `--fail-on-issues` 付きで走らせており、新規で閾値を超えるファイルや禁止 import が発生すると CI が失敗します。また `Artifact Guard` ワークフローが `python tools/check_artifacts.py` を実行し、`.next` や `apps/web/test-results` などの生成物が誤ってコミットされていないかも自動検査、`Import Cycles` ワークフローが `python tools/check_cycles.py` で `services/api/app` 内の import 循環をブロックします。ローカルでは `just check-artifacts`, `just check-cycles`, `just check-all`（`just checkall` エイリアスあり）で同じ検査をまとめて回せます。週次のトリアージ手順は [`docs/architecture-triage.md`](docs/architecture-triage.md)、垂直スライス設計ルールは [`docs/vertical-slice-guidelines.md`](docs/vertical-slice-guidelines.md) を参照してください。
- **CI 失敗時のルール**: GitHub Actions が落ちた場合、まず `scripts/ci-debug.sh --job <job>` を実行してログを自動ダウンロード＆エラー抽出してください。ログは `tmp/ci-logs/` に出力されるため、調査・共有が容易です。
