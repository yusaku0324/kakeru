# 環境変数設定ガイド

## 概要

Osakamenesuアプリケーションで必要な環境変数の設定方法を説明します。

## 1. VAPID鍵の生成（プッシュ通知用）

VAPIDは、Webプッシュ通知のためのセキュリティメカニズムです。

### 鍵の生成方法

```bash
# Node.jsを使用して生成
npx web-push generate-vapid-keys
```

または、Pythonを使用：

```python
from py_vapid import Vapid

vapid = Vapid()
vapid.generate_keys()
print(f"Public Key: {vapid.public_key}")
print(f"Private Key: {vapid.private_key}")
```

### 環境変数の設定

生成された鍵を環境変数に設定：

**APIサーバー側 (.env)**:
```env
VAPID_PUBLIC_KEY=BKd0...（生成された公開鍵）
VAPID_PRIVATE_KEY=UGN3...（生成された秘密鍵）
VAPID_SUBJECT=mailto:support@osakamenesu.com
```

**Webアプリ側 (.env.local)**:
```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BKd0...（同じ公開鍵）
```

## 2. Sentry設定

### Sentryプロジェクトの作成

1. [Sentry.io](https://sentry.io)にログイン
2. 新規プロジェクトを作成：
   - Platform: Python（API用）、Next.js（Web用）
   - Project Name: osakamenesu-api, osakamenesu-web

### DSNの取得と設定

**APIサーバー側**:
```env
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1
```

**Webアプリ側**:
```env
NEXT_PUBLIC_SENTRY_DSN=https://yyy@yyy.ingest.sentry.io/yyy
SENTRY_ORG=your-org-name
SENTRY_PROJECT=osakamenesu-web
SENTRY_AUTH_TOKEN=sntrys_xxx...（CI/CD用）
```

## 3. その他の重要な環境変数

### データベース関連
```env
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/osaka_menesu
POSTGRES_USER=app
POSTGRES_PASSWORD=secure_password
POSTGRES_DB=osaka_menesu
```

### Redis（メトリクス・キャッシュ用）
```env
REDIS_URL=redis://localhost:6379/0
RATE_LIMIT_REDIS_URL=redis://localhost:6379/1
```

### Meilisearch（検索エンジン）
```env
MEILI_MASTER_KEY=secure_master_key
MEILI_HOST=http://localhost:7700
```

### APIキー
```env
ADMIN_API_KEY=secure_admin_key_here
API_SECRET_KEY=secure_api_secret
```

### 認証関連
```env
JWT_SECRET_KEY=secure_jwt_secret_here
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
```

### メール送信（オプション）
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=app-specific-password
SMTP_FROM_EMAIL=noreply@osakamenesu.com
```

### S3（画像アップロード用）
```env
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=yyy
AWS_DEFAULT_REGION=ap-northeast-1
S3_BUCKET_NAME=osakamenesu-images
```

## 4. 環境別設定

### 開発環境 (.env.development)
```env
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
LOG_LEVEL=debug
```

### ステージング環境 (.env.staging)
```env
NODE_ENV=staging
NEXT_PUBLIC_API_URL=https://staging-api.osakamenesu.com
NEXT_PUBLIC_SITE_URL=https://staging.osakamenesu.com
LOG_LEVEL=info
```

### 本番環境 (.env.production)
```env
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api.osakamenesu.com
NEXT_PUBLIC_SITE_URL=https://osakamenesu.com
LOG_LEVEL=warning
```

## 5. セキュリティベストプラクティス

### やるべきこと
- ✅ 秘密鍵は絶対にGitにコミットしない
- ✅ .env.localファイルを.gitignoreに追加
- ✅ 本番環境では環境変数管理サービスを使用（Vercel, Railway等）
- ✅ 定期的にキーをローテーション
- ✅ 最小権限の原則に従う

### やってはいけないこと
- ❌ ハードコードされた秘密情報
- ❌ 開発用キーを本番で使用
- ❌ 秘密鍵をログに出力
- ❌ 環境変数をクライアントサイドで露出

## 6. 環境変数のバリデーション

### APIサーバー側（Pydantic）
```python
# app/core/settings.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    vapid_public_key: str
    vapid_private_key: str
    vapid_subject: str = "mailto:support@osakamenesu.com"
    sentry_dsn: str | None = None

    class Config:
        env_file = ".env"
```

### Webアプリ側（Zod）
```typescript
// src/lib/env.ts
import { z } from 'zod'

const envSchema = z.object({
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_API_URL: z.string().url(),
})

export const env = envSchema.parse(process.env)
```

## 7. CI/CD環境変数

GitHub Actions用：
```yaml
env:
  SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  VAPID_PRIVATE_KEY: ${{ secrets.VAPID_PRIVATE_KEY }}
```

## 8. 環境変数チェックリスト

### 最低限必要な環境変数

- [ ] DATABASE_URL
- [ ] REDIS_URL
- [ ] MEILI_MASTER_KEY
- [ ] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
- [ ] JWT_SECRET_KEY
- [ ] ADMIN_API_KEY

### 本番環境で追加で必要

- [ ] SENTRY_DSN（両方）
- [ ] S3設定（画像アップロード）
- [ ] SMTP設定（メール送信）
- [ ] ドメイン設定

## 9. トラブルシューティング

### 環境変数が読み込まれない
```bash
# 環境変数の確認
printenv | grep VAPID

# .envファイルの読み込み確認
python -c "from dotenv import load_dotenv; load_dotenv(); import os; print(os.getenv('VAPID_PUBLIC_KEY'))"
```

### Sentryにエラーが送信されない
- DSNが正しく設定されているか確認
- SENTRY_ENVIRONMENTが適切か確認
- ネットワーク接続を確認

### プッシュ通知が動作しない
- VAPID鍵が正しく設定されているか
- 公開鍵がフロントエンドとバックエンドで一致しているか
- HTTPS環境で実行されているか

---

環境変数の設定が完了したら、以下のコマンドで確認：

```bash
# API側
cd services/api
python scripts/check_env.py

# Web側
cd apps/web
npm run check:env
```