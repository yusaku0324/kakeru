# Osakamenesu デプロイメントガイド

## 概要

このガイドでは、Osakamenesuアプリケーションをステージング環境と本番環境にデプロイする手順を説明します。

## アーキテクチャ概要

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│                 │     │                  │     │                 │
│   Vercel        │────▶│  Railway/Render  │────▶│  PostgreSQL     │
│   (Next.js)     │     │  (FastAPI)       │     │  (Railway)      │
│                 │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │                         │
         │                       │                         │
         ▼                       ▼                         ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│                 │     │                  │     │                 │
│   CloudFront    │     │   Redis          │     │  Meilisearch    │
│   (CDN)         │     │   (Upstash)      │     │  (Railway)      │
│                 │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## 1. 前提条件

### 必要なアカウント

- [ ] GitHub アカウント
- [ ] Vercel アカウント
- [ ] Railway または Render アカウント
- [ ] Sentry アカウント
- [ ] Upstash アカウント（Redis用）
- [ ] AWS アカウント（S3用、オプション）

### ローカル環境

- [ ] Node.js 18+
- [ ] Python 3.11+
- [ ] Docker & Docker Compose
- [ ] Git

## 2. インフラストラクチャのセットアップ

### 2.1 Railway でのデータベース作成

1. [Railway](https://railway.app) にログイン
2. New Project → PostgreSQL を選択
3. 環境変数をコピー:
   - `DATABASE_URL`
   - `POSTGRES_*` 変数

### 2.2 Upstash Redis セットアップ

1. [Upstash](https://upstash.com) にログイン
2. Create Database
3. 設定:
   - Region: `ap-northeast-1` (東京)
   - Type: Regional
4. 接続情報をコピー:
   - `REDIS_URL`

### 2.3 Meilisearch デプロイ（Railway）

1. Railway で New → Template → Meilisearch
2. 環境変数を設定:
   ```env
   MEILI_MASTER_KEY=your-secure-master-key
   MEILI_ENV=production
   ```
3. デプロイ後、URLをコピー

## 3. APIサーバーのデプロイ

### 3.1 Railway でのデプロイ

#### Dockerfile の準備

```dockerfile
# services/api/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# システム依存関係
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Python依存関係
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションコード
COPY . .

# マイグレーションとサーバー起動
CMD alembic upgrade head && \
    uvicorn app.main:app \
    --host 0.0.0.0 \
    --port ${PORT:-8000} \
    --workers 4
```

#### Railway設定

```toml
# railway.toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "services/api/Dockerfile"

[deploy]
healthcheckPath = "/health/live"
healthcheckTimeout = 300
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

#### 環境変数設定

Railway ダッシュボードで設定:

```env
# データベース
DATABASE_URL=${POSTGRES_URL}

# Redis
REDIS_URL=${UPSTASH_REDIS_URL}

# Meilisearch
MEILI_HOST=${MEILISEARCH_URL}
MEILI_MASTER_KEY=${MEILI_MASTER_KEY}

# 認証
JWT_SECRET_KEY=your-production-jwt-secret
ADMIN_API_KEY=your-production-admin-key

# Sentry
SENTRY_DSN=your-api-sentry-dsn
SENTRY_ENVIRONMENT=production

# VAPID (Push通知)
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:support@osakamenesu.com

# CORS
BACKEND_CORS_ORIGINS=["https://osakamenesu.com","https://www.osakamenesu.com"]
```

### 3.2 GitHub Actions CI/CD

```yaml
# .github/workflows/deploy-api.yml
name: Deploy API

on:
  push:
    branches: [main]
    paths:
      - 'services/api/**'
      - '.github/workflows/deploy-api.yml'

env:
  RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          cd services/api
          pip install -r requirements.txt
          pip install pytest pytest-asyncio

      - name: Run tests
        run: |
          cd services/api
          pytest

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v4

      - name: Install Railway CLI
        run: npm i -g @railway/cli

      - name: Deploy to Railway
        run: |
          cd services/api
          railway up --service api
```

## 4. Webアプリケーションのデプロイ

### 4.1 Vercel設定

#### vercel.json

```json
{
  "framework": "nextjs",
  "buildCommand": "pnpm build",
  "devCommand": "pnpm dev",
  "installCommand": "pnpm install",
  "regions": ["hnd1"],
  "functions": {
    "src/app/api/[...route]/route.ts": {
      "maxDuration": 30
    }
  }
}
```

#### 環境変数設定（Vercel Dashboard）

```env
# API接続
NEXT_PUBLIC_API_URL=https://api.osakamenesu.com
API_INTERNAL_BASE=https://api.osakamenesu.com

# サイトURL
NEXT_PUBLIC_SITE_URL=https://osakamenesu.com

# Sentry
NEXT_PUBLIC_SENTRY_DSN=your-web-sentry-dsn
SENTRY_AUTH_TOKEN=your-sentry-auth-token
SENTRY_ORG=your-org
SENTRY_PROJECT=osakamenesu-web

# VAPID
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key

# Analytics (オプション)
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

### 4.2 GitHub Integration

1. Vercel Dashboard → Import Git Repository
2. osakamenesu リポジトリを選択
3. Root Directory: `apps/web`
4. Framework Preset: Next.js
5. Environment Variables を設定

### 4.3 ドメイン設定

1. Vercel Dashboard → Settings → Domains
2. カスタムドメインを追加: `osakamenesu.com`
3. DNSレコードを設定:
   ```
   A     @     76.76.21.21
   CNAME www   cname.vercel-dns.com
   ```

## 5. データベースマイグレーション

### 本番環境でのマイグレーション実行

```bash
# Railway CLI を使用
railway run --service api alembic upgrade head

# または GitHub Actions で自動実行
```

### バックアップ設定

```yaml
# .github/workflows/backup.yml
name: Database Backup

on:
  schedule:
    - cron: '0 3 * * *' # 毎日午前3時（JST: 午後12時）

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Backup PostgreSQL
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          S3_BUCKET: osakamenesu-backups
        run: |
          DATE=$(date +%Y%m%d_%H%M%S)
          pg_dump $DATABASE_URL | gzip > backup_$DATE.sql.gz
          aws s3 cp backup_$DATE.sql.gz s3://$S3_BUCKET/postgres/
```

## 6. モニタリングとアラート

### 6.1 ヘルスチェック設定

```python
# services/api/app/api/endpoints/health.py
@router.get("/health/ready")
async def health_ready(
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis)
):
    checks = {
        "database": False,
        "redis": False,
        "meilisearch": False
    }

    # Database check
    try:
        await db.execute(text("SELECT 1"))
        checks["database"] = True
    except:
        pass

    # Redis check
    try:
        await redis.ping()
        checks["redis"] = True
    except:
        pass

    # Meilisearch check
    try:
        client = get_meilisearch_client()
        client.health()
        checks["meilisearch"] = True
    except:
        pass

    all_healthy = all(checks.values())
    status_code = 200 if all_healthy else 503

    return JSONResponse(
        content={"status": "ready" if all_healthy else "unhealthy", "checks": checks},
        status_code=status_code
    )
```

### 6.2 Uptime監視

1. [Better Uptime](https://betteruptime.com) または [UptimeRobot](https://uptimerobot.com) でアカウント作成
2. モニター追加:
   - API Health: `https://api.osakamenesu.com/health/ready`
   - Web App: `https://osakamenesu.com`
   - 間隔: 1分
   - タイムアウト: 30秒

## 7. セキュリティ設定

### 7.1 環境変数の暗号化

```bash
# Railway secrets
railway variables set ADMIN_API_KEY="$(openssl rand -base64 32)"

# Vercel secrets
vercel env add ADMIN_API_KEY production
```

### 7.2 WAF設定（Cloudflare）

1. Cloudflareアカウントでドメインを追加
2. セキュリティ設定:
   - SSL/TLS: Full (strict)
   - WAF: Enabled
   - Rate Limiting: 100 req/min per IP
   - Bot Fight Mode: Enabled

### 7.3 セキュリティヘッダー

```javascript
// apps/web/next.config.js
const securityHeaders = [
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'Content-Security-Policy',
    value: `
      default-src 'self';
      script-src 'self' 'unsafe-eval' 'unsafe-inline' *.google-analytics.com;
      style-src 'self' 'unsafe-inline';
      img-src 'self' blob: data: *.osakamenesu.com;
      font-src 'self';
      connect-src 'self' *.osakamenesu.com *.sentry.io;
    `.replace(/\n/g, '')
  }
]
```

## 8. デプロイチェックリスト

### ステージング環境

- [ ] すべての環境変数が設定されている
- [ ] データベースマイグレーションが完了
- [ ] ヘルスチェックが正常
- [ ] E2Eテストが通過
- [ ] Sentryにエラーが送信される
- [ ] プッシュ通知が動作する

### 本番環境

- [ ] ステージング環境でのテスト完了
- [ ] バックアップ設定が有効
- [ ] モニタリングアラート設定
- [ ] セキュリティスキャン実施
- [ ] ドメイン設定完了
- [ ] SSL証明書が有効
- [ ] CDN設定完了
- [ ] ロールバック手順の確認

## 9. ロールバック手順

### Vercel（Web）

```bash
# 前のデプロイメントにロールバック
vercel rollback

# 特定のデプロイメントにロールバック
vercel rollback [deployment-url]
```

### Railway（API）

1. Railway Dashboard → Deployments
2. 前の成功したデプロイメントを選択
3. "Redeploy" をクリック

### データベース

```bash
# バックアップから復元
pg_restore -d $DATABASE_URL backup_20231225.sql
```

## 10. パフォーマンス最適化

### CDN設定（Cloudflare）

```
Page Rules:
- /api/* → Cache Level: Bypass
- /images/* → Cache Level: Cache Everything, Edge Cache TTL: 1 month
- /* → Cache Level: Standard
```

### 画像最適化

```javascript
// next.config.js
module.exports = {
  images: {
    domains: ['osakamenesu.com', 'cdn.osakamenesu.com'],
    formats: ['image/avif', 'image/webp'],
  },
}
```

## トラブルシューティング

### デプロイが失敗する

1. ビルドログを確認
2. 環境変数が正しく設定されているか確認
3. 依存関係のバージョン競合を確認

### 本番環境でエラーが発生

1. Sentryでエラーの詳細を確認
2. アプリケーションログを確認
3. データベース接続を確認
4. 外部サービス（Redis, Meilisearch）の状態を確認

---

緊急連絡先:
- Railway Status: https://status.railway.app
- Vercel Status: https://vercel-status.com
- Upstash Status: https://status.upstash.com