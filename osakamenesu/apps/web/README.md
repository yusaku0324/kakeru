# Osaka Men-Esu Web Frontend

This app powers the public reservation/search experience used throughout the project.

## 開発メモ

- **依存関係のインストール**（リポジトリ直下で実行）
  ```bash
  cd /Users/yusaku/Repositories/kakeru-local/osakamenesu
  pnpm install   # apps/web も postinstall で自動インストールされます
  ```
- **開発サーバー**
  ```bash
  pnpm dev          # API + Web を Doppler 経由で同時起動
  pnpm dev:web      # Web のみ起動（Doppler で環境変数注入）
  pnpm dev:api      # API のみ起動（参考）
  ```
- **ユニットテスト**
  ```bash
  doppler run --project osakamenesu --config dev_web -- \
    pnpm --dir apps/web run test:unit
  ```
- **E2E テスト（Playwright）**
  ```bash
  doppler run --project osakamenesu --config dev_web -- \
    pnpm --dir apps/web run test:e2e
  ```
  Doppler から注入される API ベース URL / Sentry DSN を利用するため、追加の `.env.local` は不要です。
- **管理画面データのシード**
  ```bash
  doppler run --project osakamenesu --config dev_web -- \
    pnpm --dir apps/web run e2e:setup
  ```

### 通知設定のローカル確認

予約ステータス更新で外部通知を送るには以下の環境変数を設定してください。`pnpm dev` / `pnpm dev:web` で起動すると Doppler が自動注入します。

```bash
SENTRY_DSN=...                  # 任意 (Sentry 集約)
NEXT_PUBLIC_SENTRY_DSN=...
SLACK_ERROR_WEBHOOK_URL=https://hooks.slack.com/services/...
LINE_NOTIFY_TOKEN=LINE-Notify-Token
NOTIFY_EMAIL_ENDPOINT=http://localhost:8000/mock/email      # API サービス側
NOTIFY_LINE_ENDPOINT=http://localhost:8000/mock/line
MAIL_API_KEY=your-sendgrid-key
MAIL_FROM_ADDRESS=no-reply@example.com
```

ダッシュボードで承認／辞退すると Slack / LINE / Mail 側に通知が入る想定です。ローカルで簡易確認する場合は FastAPI を `pnpm dev` で起動するか、モックエンドポイント（`services/api`）を別途動かしてください。

## 参考リンク

- Playwright 設定: `playwright.config.ts`
- E2E シナリオ: `e2e/*.spec.ts`
- 予約関連コンポーネント: `src/components/ReservationOverlay.tsx`, `src/components/ReservationForm.tsx`

## コンテナ運用メモ

### 1. びっくりアップデート防止（digest固定）

`Dockerfile` ではマニフェストリストの digest（`node:22-alpine@sha256:b2358...`）を `ARG NODE_IMAGE` で固定済みです。別アーキ digest を確認したいときは以下のように取得できます。

```bash
docker manifest inspect node:22-alpine \
  | jq -r '.manifests[] | "\(.platform.os)/\(.platform.architecture)\t\(.digest)"'
```

単一アーキ向けに縛りたい場合は、上記一覧から該当 digest を `FROM node:22-alpine@sha256:<arch-specific>` に差し替えてください。

### 2. ローカルは arm64 を強制（Rosetta 回避）

`docker-compose` 側で `platform: linux/arm64` を宣言済みですが、単体ビルドする際も必ず arm64 を指定してください。

```bash
# ビルド
docker buildx build --platform linux/arm64 -t osakamenesu/web:dev .

# 実行テスト
docker run --rm --platform=linux/arm64 node:22-alpine uname -m  # → arm64 など
```

### 3. CI / 本番（amd64）との両立

Cloud Run など amd64 が前提でも、マルチアーキで push しておくと後から Arm 移行が容易です。

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t gcr.io/your-prj/osakamenesu-web:$(date +%Y%m%d%H%M) \
  --push .
```

上記は manifest index digest が固定されているため、両アーキで同一バージョン集合を必ず取得できます。

### 4. 依存イメージが arm64 を持っているか監査

```bash
docker compose config --images | xargs -I{} sh -c \
'printf "%-40s " "{}"; docker buildx imagetools inspect "{}" 2>/dev/null | sed -n "s/Platforms: //p"'
```

`linux/arm64` を含まないイメージだけ抽出されるので、差し替えや自前ビルドの要否を判断できます。

### 5. SBOM / プロベナンス / 署名

ビルド時に SBOM や provenance を吐き出し、`cosign` などで署名検証する運用を想定しています。

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --sbom=true --provenance=mode=max \
  -t gcr.io/your-prj/osakamenesu-web:$(git rev-parse --short HEAD) \
  --push .

cosign verify gcr.io/your-prj/osakamenesu-web@sha256:<digest>
```
