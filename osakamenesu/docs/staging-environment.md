# ステージング環境運用ガイド

## 🎯 目的

ステージング環境は、本番環境へのデプロイ前に変更を検証するための環境です。

## 🏗 環境構成

| コンポーネント | ステージング | 本番 |
|------------|----------|-----|
| API | osakamenesu-api-stg.fly.dev | osakamenesu-api.fly.dev |
| Database | Railway (共有) | Railway |
| Meilisearch | Fly.io (共有) | Fly.io |
| Web | Vercel Preview | Vercel Production |

## 🚀 ステージング環境の起動

### 1. API の起動

```bash
# ステージング環境を起動（サスペンド解除）
fly scale count 1 --app osakamenesu-api-stg

# 状態確認
fly status --app osakamenesu-api-stg
```

### 2. 環境変数の確認・設定

```bash
# 環境変数一覧
fly secrets list --app osakamenesu-api-stg

# 本番と同じ値を設定（DB接続先は同じ）
fly secrets set DATABASE_URL=$PROD_DATABASE_URL --app osakamenesu-api-stg
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

## 📝 ベストプラクティス

1. **常に本番デプロイ前にステージングで検証**
2. **ステージング環境は検証後すぐにサスペンド**
3. **本番と同じ構成・設定を維持**
4. **定期的にステージング環境をリフレッシュ**

## 🔐 アクセス制限（推奨）

将来的な実装：
- Basic認証の追加
- IP制限
- VPN経由のアクセス

現在は公開アクセス可能なため、機密データは扱わないこと。
