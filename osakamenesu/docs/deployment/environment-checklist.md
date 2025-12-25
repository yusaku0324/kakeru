# 環境変数設定チェックリスト

## 前提条件

- [ ] Railway アカウント作成済み
- [ ] Vercel アカウント作成済み
- [ ] Sentry アカウント作成済み
- [ ] Google Cloud Console プロジェクト作成済み
- [ ] LINE Developers アカウント作成済み
- [ ] SendGrid アカウント作成済み

## 1. シークレット生成

### 1.1 SECRET_KEY (API)
```bash
openssl rand -hex 32
# 例: a1b2c3d4e5f6...
```

### 1.2 JWT_SECRET_KEY
```bash
openssl rand -hex 32
# 例: f6e5d4c3b2a1...
```

### 1.3 VAPID Keys (既に生成済み)
```
Public: BMCHV1zrIazRTE1PAZHArbaxtVsr7hvru5PYG5rx0Xin-JvU6-WFaIiK6Q8V7NwO9ywudqGh_8JxIRlyuywGkrI
Private: 6l3uztIEEcg-bKCDM1wX5sQwuEuoZ7a3ViL8kiORlFM
```

## 2. Google OAuth 設定

### 2.1 Google Cloud Console
1. https://console.cloud.google.com
2. 新規プロジェクトまたは既存プロジェクト選択
3. APIs & Services → Credentials

### 2.2 OAuth 2.0 Client ID 作成
1. Create Credentials → OAuth client ID
2. Application type: Web application
3. Name: `Osakamenesu Production`
4. Authorized redirect URIs:
   - `https://api.osakamenesu.com/api/auth/google/callback`
   - `https://api-staging.osakamenesu.com/api/auth/google/callback` (staging)

### 2.3 取得する値
- [ ] Client ID: `xxxxx.apps.googleusercontent.com`
- [ ] Client Secret: `GOCSPX-xxxxx`

## 3. LINE Login 設定

### 3.1 LINE Developers Console
1. https://developers.line.biz/console/
2. Create new channel → LINE Login

### 3.2 Channel 設定
1. Channel name: `Osakamenesu`
2. Channel description: `メンズエステ予約サービス`
3. App types: Web app

### 3.3 Callback URL 設定
- `https://api.osakamenesu.com/api/auth/line/callback`
- `https://api-staging.osakamenesu.com/api/auth/line/callback` (staging)

### 3.4 取得する値
- [ ] Channel ID: `1234567890`
- [ ] Channel Secret: `xxxxx`

## 4. Sentry 設定

### 4.1 API Project
- [ ] DSN: `https://xxxxx@o123456.ingest.sentry.io/1234567`

### 4.2 Web Project
- [ ] DSN: `https://yyyyy@o123456.ingest.sentry.io/7654321`
- [ ] Organization: `osakamenesu`
- [ ] Project: `osakamenesu-web`

### 4.3 Auth Token
1. Settings → Account → API → Auth Tokens
2. Create New Token
3. Scopes: project:releases, org:read, project:read, project:write
- [ ] Auth Token: `sntrys_xxxxx`

## 5. SendGrid 設定

### 5.1 API Key 作成
1. https://app.sendgrid.com
2. Settings → API Keys → Create API Key
3. API Key Name: `Osakamenesu Production`
4. API Key Permissions: Full Access

### 5.2 取得する値
- [ ] API Key: `SG.xxxxx`
- [ ] Sender Email: `noreply@osakamenesu.com` (要ドメイン認証)

### 5.3 ドメイン認証
1. Settings → Sender Authentication
2. Domain Authentication → Authenticate Your Domain
3. DNS レコード追加

## 6. Railway 環境変数設定

### 6.1 プロジェクト作成済み確認
- [ ] PostgreSQL 追加済み
- [ ] Redis 追加済み
- [ ] Custom domain 設定済み

### 6.2 環境変数設定 (Variables タブ)

**App Settings:**
- [ ] `APP_NAME` = osakamenesu-api
- [ ] `API_URL` = https://api.osakamenesu.com
- [ ] `WEB_APP_URL` = https://osakamenesu.com
- [ ] `DEBUG` = False
- [ ] `LOG_LEVEL` = info
- [ ] `SECRET_KEY` = (生成した値)

**OAuth:**
- [ ] `GOOGLE_OAUTH_CLIENT_ID` = (Google Client ID)
- [ ] `GOOGLE_OAUTH_CLIENT_SECRET` = (Google Client Secret)
- [ ] `LINE_CHANNEL_ID` = (LINE Channel ID)
- [ ] `LINE_CHANNEL_SECRET` = (LINE Channel Secret)

**JWT:**
- [ ] `JWT_SECRET_KEY` = (生成した値)
- [ ] `JWT_ALGORITHM` = HS256
- [ ] `JWT_EXPIRATION_HOURS` = 720

**Sentry:**
- [ ] `SENTRY_DSN` = (API Project DSN)
- [ ] `SENTRY_ENVIRONMENT` = production
- [ ] `SENTRY_TRACES_SAMPLE_RATE` = 0.1
- [ ] `SENTRY_PROFILES_SAMPLE_RATE` = 0.1

**Email:**
- [ ] `SENDGRID_API_KEY` = (SendGrid API Key)
- [ ] `FROM_EMAIL` = noreply@osakamenesu.com

**Web Push:**
- [ ] `VAPID_PUBLIC_KEY` = (公開鍵)
- [ ] `VAPID_PRIVATE_KEY` = (秘密鍵)
- [ ] `VAPID_EMAIL` = admin@osakamenesu.com

**Railway:**
- [ ] `PORT` = 8000
- [ ] `RAILWAY_ENVIRONMENT` = production

## 7. Vercel 環境変数設定

### 7.1 プロジェクト設定確認
- [ ] Framework: Next.js
- [ ] Root Directory: apps/web
- [ ] Node Version: 20.x

### 7.2 環境変数設定 (Settings → Environment Variables)

**API:**
- [ ] `NEXT_PUBLIC_API_URL` = https://api.osakamenesu.com
- [ ] `NEXT_PUBLIC_API_HOST` = api.osakamenesu.com

**App:**
- [ ] `NEXT_PUBLIC_APP_URL` = https://osakamenesu.com
- [ ] `NEXT_PUBLIC_APP_NAME` = おさかめねす
- [ ] `NEXT_PUBLIC_GA_TRACKING_ID` = G-XXXXXXXXXX (後で設定)

**Sentry:**
- [ ] `NEXT_PUBLIC_SENTRY_DSN` = (Web Project DSN)
- [ ] `SENTRY_ORG` = osakamenesu
- [ ] `SENTRY_PROJECT` = osakamenesu-web
- [ ] `SENTRY_AUTH_TOKEN` = (Auth Token)
- [ ] `SENTRY_ENVIRONMENT` = production
- [ ] `NEXT_PUBLIC_SENTRY_ENVIRONMENT` = production

**PWA:**
- [ ] `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = (公開鍵)

**Build:**
- [ ] `NODE_ENV` = production
- [ ] `NEXT_TELEMETRY_DISABLED` = 1

## 8. GitHub Secrets 設定

Repository → Settings → Secrets and variables → Actions:

- [ ] `RAILWAY_TOKEN` (Railway → Account Settings → Tokens)
- [ ] `VERCEL_TOKEN` (Vercel → Account Settings → Tokens)
- [ ] `VERCEL_ORG_ID` (Vercel → Team Settings)
- [ ] `VERCEL_PROJECT_ID` (Vercel → Project Settings)
- [ ] `SENTRY_AUTH_TOKEN` (同上)
- [ ] `SENDGRID_API_KEY` (同上)

## 9. DNS 設定

### 9.1 API (api.osakamenesu.com)
```
CNAME api.osakamenesu.com → your-app.up.railway.app
```

### 9.2 Web (osakamenesu.com)
```
A     osakamenesu.com     → 76.76.21.21
CNAME www.osakamenesu.com → cname.vercel-dns.com
```

## 10. 最終確認

### 10.1 Railway
- [ ] Build成功
- [ ] Health check通過
- [ ] Database接続確認
- [ ] Redis接続確認

### 10.2 Vercel
- [ ] Build成功
- [ ] ドメイン接続確認
- [ ] 環境変数反映確認

### 10.3 統合テスト
- [ ] OAuth ログイン (Google)
- [ ] OAuth ログイン (LINE)
- [ ] メール送信
- [ ] Sentry エラー送信
- [ ] Web Push 通知

## トラブルシューティング

### 環境変数が反映されない
1. Railway: Redeploy必要
2. Vercel: Redeploy必要

### OAuth リダイレクトエラー
1. Callback URLの確認
2. HTTPSの確認
3. Client ID/Secretの確認

### メール送信エラー
1. SendGrid ドメイン認証
2. FROM_EMAIL設定
3. API Key権限確認

## 次のステップ

すべての環境変数設定が完了したら：
1. Staging環境にデプロイ
2. 全機能テスト
3. Production環境にデプロイ

---

設定完了日時: _______________
確認者: _______________