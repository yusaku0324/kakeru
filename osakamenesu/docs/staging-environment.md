# ステージング環境構築・運用ガイド

## 🎯 目的

ステージング環境は、本番環境へのデプロイ前に変更を検証するための環境です。本番と同等の環境で安全にテストを行えます。

## 🏗 インフラ構成

### 環境構成

| コンポーネント | ステージング | 本番 | 備考 |
|------------|----------|-----|-----|
| Web App | Vercel Preview | Vercel Production | 自動デプロイ |
| API | osakamenesu-api-stg.fly.dev | osakamenesu-api.fly.dev | fly.stg.toml使用 |
| Database | Railway PostgreSQL | Railway PostgreSQL | 現在は共有（分離推奨） |
| Redis | Railway Redis | Railway Redis | 現在は共有（分離推奨） |
| Storage | Supabase | Supabase | バケット分離推奨 |
| Search | Meilisearch (Fly.io) | Meilisearch (Fly.io) | インデックス分離推奨 |

### ドメイン構成（推奨）

- **Web App**: `stg.osakamenesu.com` または `staging-osakamenesu.vercel.app`
- **API**: `api-stg.osakamenesu.com` または `osakamenesu-api-stg.fly.dev`

## 🔧 環境変数の設定

### Web App (Vercel)

```env
# .env.staging または Vercel Dashboard で設定
NEXT_PUBLIC_API_URL=https://osakamenesu-api-stg.fly.dev
NEXT_PUBLIC_SUPABASE_URL=your-staging-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-staging-anon-key
NEXT_PUBLIC_ENVIRONMENT=staging
NEXT_PUBLIC_SENTRY_DSN=your-staging-sentry-dsn
```

### API (Fly.io)

```bash
# 環境変数の設定
fly secrets set \
  DATABASE_URL="postgresql://user:pass@postgres.railway.internal:5432/osakamenesu_stg" \
  REDIS_URL="redis://redis.railway.internal:6379" \
  RATE_LIMIT_REDIS_URL="redis://redis.railway.internal:6379/1" \
  SUPABASE_URL="https://your-project.supabase.co" \
  SUPABASE_ANON_KEY="your-anon-key" \
  SUPABASE_SERVICE_ROLE_KEY="your-service-key" \
  JWT_SECRET="your-jwt-secret" \
  ENVIRONMENT="staging" \
  CORS_ORIGINS="https://staging-osakamenesu.vercel.app,https://stg.osakamenesu.com" \
  SENTRY_DSN="your-staging-sentry-dsn" \
  --app osakamenesu-api-stg
```

### 環境変数の分離戦略

```bash
# ディレクトリ構造
osakamenesu/
├── services/
│   ├── web/
│   │   ├── .env.local         # ローカル開発用
│   │   ├── .env.staging       # ステージング用（Gitignore）
│   │   └── .env.production    # 本番用（Gitignore）
│   └── api/
│       ├── .env.local
│       ├── .env.staging
│       └── .env.production
```

## 🚀 ステージング環境の起動

### 1. API の起動

```bash
# ステージング環境を起動（サスペンド解除）
fly scale count 1 --app osakamenesu-api-stg

# 状態確認
fly status --app osakamenesu-api-stg

# ヘルスチェック
curl https://osakamenesu-api-stg.fly.dev/health
```

### 2. Web App のデプロイ

```bash
# Vercel CLI を使用
vercel --env preview --build-env NEXT_PUBLIC_API_URL=https://osakamenesu-api-stg.fly.dev

# または GitHub経由で staging ブランチにプッシュ
git push origin staging
```

## 📋 検証手順

### 1. デプロイ

```bash
cd services/api
fly deploy --app osakamenesu-api-stg --config fly.stg.toml
```

### 2. 動作確認

#### API ヘルスチェック
```bash
curl https://osakamenesu-api-stg.fly.dev/health
```

#### 認証フロー確認
```bash
# マジックリンクのリクエスト
curl -X POST https://osakamenesu-api-stg.fly.dev/api/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

### 3. E2E テスト

```bash
cd apps/web
NEXT_PUBLIC_API_BASE=https://osakamenesu-api-stg.fly.dev pnpm e2e:staging
```

## 💰 コスト最適化

### 自動サスペンド設定

ステージング環境は使用していない時は自動的にサスペンドされます：

```toml
# fly.stg.toml
[http_service]
  auto_stop_machines = 'suspend'
  auto_start_machines = true
  min_machines_running = 0  # 0 にすることで完全停止可能
```

### 手動サスペンド

```bash
# 検証後は手動でサスペンド
fly scale count 0 --app osakamenesu-api-stg
```

## 🔄 ステージング↔本番 の同期

### データベース

- **注意**: 現在、ステージングと本番で同じDBを使用中
- 将来的には分離を推奨

### 分離する場合の手順：
```bash
# 1. Railway で新しい PostgreSQL インスタンスを作成
# 2. 接続文字列を取得
# 3. ステージング環境に設定
fly secrets set DATABASE_URL=<staging-db-url> --app osakamenesu-api-stg
```

## 📊 モニタリング

### ログ確認
```bash
fly logs --app osakamenesu-api-stg
```

### メトリクス
```bash
fly dashboard metrics --app osakamenesu-api-stg
```

## 🚨 トラブルシューティング

### アプリが起動しない

1. マシンの状態確認
   ```bash
   fly machines list --app osakamenesu-api-stg
   ```

2. 強制再起動
   ```bash
   fly machines restart <machine-id> --app osakamenesu-api-stg
   ```

3. デプロイログ確認
   ```bash
   fly logs --app osakamenesu-api-stg
   ```

### 環境変数の問題

1. 全ての環境変数を確認
   ```bash
   fly secrets list --app osakamenesu-api-stg
   ```

2. 本番環境と比較
   ```bash
   diff <(fly secrets list --app osakamenesu-api | sort) \
        <(fly secrets list --app osakamenesu-api-stg | sort)
   ```

3. Vercel環境変数の確認
   ```bash
   vercel env pull .env.staging --environment preview
   ```

### データベース接続エラー

```bash
# Railway内部ネットワークの確認
railway logs --service postgres

# 接続テスト
fly ssh console --app osakamenesu-api-stg
> nc -zv postgres.railway.internal 5432
```

## 📝 ベストプラクティス

1. **常に本番デプロイ前にステージングで検証**
   - 機能テスト
   - パフォーマンステスト
   - セキュリティチェック

2. **ステージング環境は検証後すぐにサスペンド**
   - コスト最適化
   - セキュリティリスク軽減

3. **本番と同じ構成・設定を維持**
   - Infrastructure as Code
   - 環境変数の同期

4. **定期的にステージング環境をリフレッシュ**
   - 本番データのサニタイズコピー
   - 最新の設定同期

## 🔐 セキュリティ考慮事項

### アクセス制限（推奨実装）

1. **Basic認証の追加**
   ```typescript
   // middleware.ts
   if (process.env.NEXT_PUBLIC_ENVIRONMENT === 'staging') {
     const auth = req.headers.get('authorization')
     if (!auth || !verifyBasicAuth(auth)) {
       return new Response('Unauthorized', { status: 401 })
     }
   }
   ```

2. **IP制限**
   - Vercel: Edge Middleware でIP確認
   - Fly.io: iptables または middleware

3. **環境の分離**
   - 本番データの使用禁止
   - 別々のAPIキーとシークレット
   - ステージング専用のサービスアカウント

### 監査ログ

- デプロイ履歴の記録
- アクセスログの保存
- 変更履歴の追跡

## 📊 モニタリングとアラート

### ヘルスチェック

```bash
# 定期監視スクリプト
#!/bin/bash
curl -f https://osakamenesu-api-stg.fly.dev/health || echo "API is down"
curl -f https://staging-osakamenesu.vercel.app/api/health || echo "Web is down"
```

### パフォーマンスモニタリング

- Vercel Analytics（Web Vitals）
- Fly.io Metrics（API レスポンスタイム）
- Sentry（エラートラッキング）

## 🔄 CI/CD パイプライン

### GitHub Actions 設定

```yaml
# .github/workflows/staging-deploy.yml
name: Staging Deployment

on:
  push:
    branches: [staging]
  pull_request:
    types: [opened, synchronize]
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        run: |
          pnpm install
          pnpm test
          pnpm e2e:staging

  deploy-preview:
    needs: test
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Vercel Preview
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-args: '--build-env NEXT_PUBLIC_API_URL=https://osakamenesu-api-stg.fly.dev'

  deploy-staging:
    needs: test
    if: github.ref == 'refs/heads/staging'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy API to Fly.io
        run: |
          flyctl deploy --config fly.stg.toml --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

## 🚦 リリースフロー

1. **開発完了** → `feature/*` ブランチ
2. **PR作成** → `main` へのPR
3. **自動プレビュー** → Vercel Preview URL
4. **ステージング検証** → `staging` ブランチへマージ
5. **本番リリース** → `main` ブランチへマージ

## 💡 Tips

### 環境変数の管理

```bash
# dotenv-vaultを使用した秘密情報の管理
npx dotenv-vault@latest push staging

# 環境変数のバックアップ
fly secrets export --app osakamenesu-api-stg > .env.staging.backup
```

### データベースのクローン

```bash
# 本番DBのステージングへのコピー（サニタイズ付き）
pg_dump $PROD_DATABASE_URL | \
  sed 's/real-email@/test-email@/g' | \
  psql $STAGING_DATABASE_URL
```

現在は公開アクセス可能なため、機密データは扱わないこと。
