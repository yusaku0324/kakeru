# インフラストラクチャ セットアップガイド

## 概要

Osakamenesuアプリケーションのデプロイメントインフラストラクチャ構成：
- **API**: Railway (FastAPI + PostgreSQL + Redis)
- **Web**: Vercel (Next.js)
- **画像**: Cloudinary/S3
- **監視**: Sentry
- **CI/CD**: GitHub Actions

## 1. Railway セットアップ (API)

### 1.1 Railwayアカウント作成

1. [https://railway.app](https://railway.app) にアクセス
2. GitHubでサインイン
3. プロジェクト作成

### 1.2 新規プロジェクト作成

1. **New Project** → **Deploy from GitHub repo**
2. リポジトリ選択: `osakamenesu`
3. サービス名: `osakamenesu-api`

### 1.3 PostgreSQLデータベース追加

1. **New** → **Database** → **Add PostgreSQL**
2. 環境変数が自動設定:
   - `DATABASE_URL`
   - `PGDATABASE`
   - `PGHOST`
   - `PGPASSWORD`
   - `PGPORT`
   - `PGUSER`

### 1.4 Redisキャッシュ追加

1. **New** → **Database** → **Add Redis**
2. 環境変数が自動設定:
   - `REDIS_URL`
   - `REDISHOST`
   - `REDISPASSWORD`
   - `REDISPORT`
   - `REDISUSER`

### 1.5 環境変数設定

Railway Dashboard → Variables から設定:

```bash
# App Settings
APP_NAME=osakamenesu-api
API_URL=https://api.osakamenesu.com
WEB_APP_URL=https://osakamenesu.com
DEBUG=False
LOG_LEVEL=info
SECRET_KEY=your-secret-key-here

# Database (自動設定済み)
# DATABASE_URL=postgresql://...

# Redis (自動設定済み)
# REDIS_URL=redis://...

# Google OAuth
GOOGLE_OAUTH_CLIENT_ID=your-google-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-google-client-secret

# LINE OAuth
LINE_CHANNEL_ID=your-line-channel-id
LINE_CHANNEL_SECRET=your-line-channel-secret

# JWT
JWT_SECRET_KEY=your-jwt-secret-key
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=720

# Sentry
SENTRY_DSN=your-sentry-dsn
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1

# Email (SendGrid)
SENDGRID_API_KEY=your-sendgrid-api-key
FROM_EMAIL=noreply@osakamenesu.com

# Web Push
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_EMAIL=admin@osakamenesu.com

# Railway specific
PORT=8000
RAILWAY_ENVIRONMENT=production
```

### 1.6 ビルド設定

`railway.json` (作成済み):
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "services/api/Dockerfile"
  },
  "deploy": {
    "numReplicas": 1,
    "startCommand": "./start.sh",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

### 1.7 カスタムドメイン設定

1. Settings → Domains
2. Add Domain: `api.osakamenesu.com`
3. CNAMEレコードを追加:
   ```
   api.osakamenesu.com CNAME your-app.up.railway.app
   ```

## 2. Vercel セットアップ (Web)

### 2.1 Vercelアカウント作成

1. [https://vercel.com](https://vercel.com) にアクセス
2. GitHubでサインイン

### 2.2 新規プロジェクト作成

1. **New Project**
2. **Import Git Repository** → `osakamenesu`を選択
3. Framework Preset: **Next.js**
4. Root Directory: `apps/web`

### 2.3 環境変数設定

Project Settings → Environment Variables:

```bash
# API
NEXT_PUBLIC_API_URL=https://api.osakamenesu.com
NEXT_PUBLIC_API_HOST=api.osakamenesu.com

# App
NEXT_PUBLIC_APP_URL=https://osakamenesu.com
NEXT_PUBLIC_APP_NAME=おさかめねす
NEXT_PUBLIC_GA_TRACKING_ID=G-XXXXXXXXXX

# Sentry
NEXT_PUBLIC_SENTRY_DSN=your-sentry-web-dsn
SENTRY_ORG=osakamenesu
SENTRY_PROJECT=osakamenesu-web
SENTRY_AUTH_TOKEN=your-sentry-auth-token
SENTRY_ENVIRONMENT=production
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production

# PWA
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key

# Build
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
```

### 2.4 ビルド&デプロイ設定

```json
{
  "buildCommand": "pnpm build",
  "outputDirectory": ".next",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "nodeVersion": "20.x"
}
```

### 2.5 カスタムドメイン設定

1. Settings → Domains
2. Add Domain: `osakamenesu.com`
3. Add Domain: `www.osakamenesu.com`
4. DNS設定:
   ```
   A     osakamenesu.com     76.76.21.21
   CNAME www.osakamenesu.com cname.vercel-dns.com
   ```

## 3. GitHub Actions CI/CD

### 3.1 Secrets設定

Repository → Settings → Secrets:

```
RAILWAY_TOKEN
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
SENTRY_AUTH_TOKEN
SENDGRID_API_KEY
```

### 3.2 デプロイワークフロー

`.github/workflows/deploy.yml` (作成済み)

## 4. Cloudinary セットアップ (画像)

### 4.1 アカウント作成

1. [https://cloudinary.com](https://cloudinary.com)
2. 無料プランで開始

### 4.2 設定取得

Dashboard から:
- Cloud Name
- API Key
- API Secret

### 4.3 環境変数追加

Railway (API):
```bash
CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name
```

## 5. 監視&アラート

### 5.1 Railway監視

- メトリクス: CPU, Memory, Network
- ログ: Railway Dashboard → Deployments → Logs
- アラート: Webhook統合でSlack通知

### 5.2 Vercel監視

- Analytics: 自動有効
- Web Vitals: 自動収集
- Functions: 実行時間、エラー率

### 5.3 Uptime監視

[UptimeRobot](https://uptimerobot.com) 設定:
1. Monitor追加
2. URL: `https://api.osakamenesu.com/health`
3. Interval: 5分
4. Alert: Email/Slack

## 6. バックアップ設定

### 6.1 データベースバックアップ

GitHub Actions経由で毎日実行 (設定済み):
- `.github/workflows/db-backup.yml`
- S3/Google Cloud Storageに保存

### 6.2 手動バックアップ

```bash
# Railway CLI経由
railway run pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

## 7. スケーリング設定

### 7.1 Railway (API)

1. Horizontal Scaling:
   ```
   Settings → Deploy → Replicas → 2-4
   ```

2. Vertical Scaling:
   ```
   Settings → Deploy → Resources
   - CPU: 1-2 vCPU
   - RAM: 1-2 GB
   ```

### 7.2 Vercel (Web)

- 自動スケーリング（無制限）
- Edge Network配信
- 帯域幅制限に注意

## 8. セキュリティ設定

### 8.1 環境変数暗号化

- Railway: 自動暗号化
- Vercel: 自動暗号化

### 8.2 ネットワークセキュリティ

Railway:
- Private networking有効
- 公開エンドポイントのみ露出

Vercel:
- WAF自動有効
- DDoS保護

### 8.3 アクセス制御

- Railway: Team members管理
- Vercel: Team設定
- GitHub: Branch protection

## 9. デプロイチェックリスト

### Pre-deployment:
- [ ] 環境変数確認
- [ ] データベースマイグレーション準備
- [ ] Sentryリリース設定
- [ ] ドメイン設定確認

### Deployment:
- [ ] Staging環境でテスト
- [ ] データベースバックアップ
- [ ] Production環境変数設定
- [ ] デプロイ実行

### Post-deployment:
- [ ] ヘルスチェック確認
- [ ] エラー監視確認
- [ ] パフォーマンス監視
- [ ] ユーザー通知（必要に応じて）

## 10. トラブルシューティング

### Railway

**ビルドエラー**:
```bash
railway logs
railway run bash # デバッグシェル
```

**データベース接続エラー**:
- Private URL使用確認
- SSL設定確認

### Vercel

**ビルド失敗**:
- Function size制限（50MB）
- ビルドタイムアウト（45分）

**404エラー**:
- Root directory設定確認
- Dynamic routes設定

## 連絡先

- Railway: https://railway.app/project/xxx
- Vercel: https://vercel.com/team/project
- Status Page: https://status.osakamenesu.com