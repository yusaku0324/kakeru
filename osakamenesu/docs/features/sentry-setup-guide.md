# Sentry監視設定ガイド

## 概要

Sentryを使用してOsakamenesuアプリケーションのエラー監視とパフォーマンストラッキングを設定します。

## 1. Sentryアカウントとプロジェクトの作成

### アカウント作成

1. [https://sentry.io](https://sentry.io) にアクセス
2. 無料アカウントを作成（または既存アカウントでログイン）

### プロジェクト作成

#### APIプロジェクト

1. "Create Project" をクリック
2. Platform: **Python** を選択
3. Alert frequency: "Alert me on every new issue" を選択
4. Project name: `osakamenesu-api`
5. Team: 適切なチームを選択

#### Webプロジェクト

1. 再度 "Create Project" をクリック
2. Platform: **Next.js** を選択
3. Alert frequency: "Alert me on every new issue" を選択
4. Project name: `osakamenesu-web`
5. Team: 同じチームを選択

## 2. DSNの取得

### APIプロジェクトのDSN

1. `osakamenesu-api` プロジェクトを開く
2. Settings > Projects > osakamenesu-api > Client Keys (DSN)
3. DSNをコピー（例: `https://xxx@xxx.ingest.sentry.io/xxx`）

### WebプロジェクトのDSN

1. `osakamenesu-web` プロジェクトを開く
2. Settings > Projects > osakamenesu-web > Client Keys (DSN)
3. DSNをコピー（例: `https://yyy@yyy.ingest.sentry.io/yyy`）

## 3. 環境変数の設定

### APIサーバー（services/api/.env）

```env
# Sentry Error Tracking
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_ENVIRONMENT=development  # または production, staging
SENTRY_TRACES_SAMPLE_RATE=0.1  # 10%のトランザクションをサンプリング
SENTRY_PROFILES_SAMPLE_RATE=0.1  # 10%のプロファイルをサンプリング
```

### Webアプリ（apps/web/.env.local）

```env
# Sentry Error Tracking
NEXT_PUBLIC_SENTRY_DSN=https://yyy@yyy.ingest.sentry.io/yyy
SENTRY_ENVIRONMENT=development  # または production, staging
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1

# CI/CD用（GitHub ActionsやVercelデプロイ用）
SENTRY_ORG=your-organization-slug
SENTRY_PROJECT=osakamenesu-web
SENTRY_AUTH_TOKEN=sntrys_xxx...  # 後述の手順で生成
```

## 4. Auth Tokenの生成（CI/CD用）

1. Sentry設定ページへ: Settings > Account > API > Auth Tokens
2. "Create New Token" をクリック
3. Scopes を選択:
   - `project:releases`
   - `org:read`
   - `project:write`
4. トークンを生成してコピー

## 5. Sentryの統合確認

### APIサーバーのテスト

```python
# テスト用エラーの送信
import sentry_sdk

def test_sentry():
    try:
        1 / 0
    except Exception as e:
        sentry_sdk.capture_exception(e)
        print("テストエラーをSentryに送信しました")

# または、APIエンドポイントで意図的にエラーを発生
@router.get("/test-sentry")
async def test_sentry_endpoint():
    raise Exception("This is a test error for Sentry")
```

### Webアプリのテスト

```typescript
// pages/test-sentry.tsx
import * as Sentry from '@sentry/nextjs'

export default function TestSentry() {
  const triggerError = () => {
    throw new Error('This is a test error for Sentry')
  }

  const captureMessage = () => {
    Sentry.captureMessage('Test message from Osakamenesu', 'info')
  }

  return (
    <div>
      <button onClick={triggerError}>Trigger Error</button>
      <button onClick={captureMessage}>Send Test Message</button>
    </div>
  )
}
```

## 6. アラート設定

### 基本アラートルール

1. Projects > osakamenesu-api/web > Alerts > Create Alert
2. "Issues" を選択
3. 条件を設定:
   - When: "A new issue is created"
   - Then: "Send an email to team"

### カスタムアラート例

#### エラー率アラート
- When: Error rate is above 1% for 5 minutes
- Action: Send email + Slack notification

#### パフォーマンスアラート
- When: P95 response time > 1000ms
- Action: Send alert to on-call engineer

#### ユーザー影響アラート
- When: An issue affects > 100 unique users
- Action: Create incident and page team

## 7. ダッシュボード設定

### カスタムダッシュボード作成

1. Dashboards > Create Dashboard
2. 名前: "Osakamenesu Overview"
3. ウィジェットを追加:
   - Error Rate (Line Chart)
   - Transaction Duration (P50, P95, P99)
   - User Misery Score
   - Issues by Browser/Device
   - Top Errors

### 推奨ウィジェット

```yaml
Error Tracking:
  - Total Errors (last 24h)
  - Error Rate Trend
  - Unique Users Affected
  - Top 5 Error Messages

Performance:
  - Web Vitals (LCP, FID, CLS)
  - API Response Times
  - Database Query Performance
  - Slowest Transactions

User Experience:
  - Apdex Score
  - User Sessions with Errors
  - Crash Free Rate
  - Feature Adoption
```

## 8. 実装のベストプラクティス

### エラーコンテキストの追加

```python
# API - ユーザーコンテキスト
sentry_sdk.set_user({
    "id": user.id,
    "username": user.username,
    "email": user.email,
})

# API - カスタムコンテキスト
sentry_sdk.set_context("reservation", {
    "shop_id": shop_id,
    "therapist_id": therapist_id,
    "service_type": service_type,
})
```

```typescript
// Web - ユーザーコンテキスト
Sentry.setUser({
  id: user.id,
  email: user.email,
  username: user.username,
})

// Web - カスタムタグ
Sentry.setTag('page_type', 'shop_detail')
Sentry.setTag('feature', 'reservation')
```

### パフォーマンストランザクション

```python
# API - カスタムトランザクション
from sentry_sdk import start_transaction

with start_transaction(op="reservation", name="create_reservation") as transaction:
    with transaction.start_child(op="db", description="fetch_shop"):
        shop = await get_shop(shop_id)

    with transaction.start_child(op="db", description="check_availability"):
        available = await check_availability(slot_id)

    with transaction.start_child(op="db", description="create_booking"):
        booking = await create_booking(data)
```

### エラーフィルタリング

```javascript
// sentry.client.config.js
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  // ... 他の設定
  beforeSend(event, hint) {
    // 特定のエラーを無視
    if (event.exception) {
      const error = hint.originalException

      // ネットワークエラーを無視
      if (error?.message?.includes('Network request failed')) {
        return null
      }

      // 404エラーを無視
      if (event.tags?.status_code === 404) {
        return null
      }
    }

    return event
  },
})
```

## 9. 本番環境への展開

### Vercelでの設定

```bash
# Vercel CLIで環境変数を設定
vercel env add NEXT_PUBLIC_SENTRY_DSN
vercel env add SENTRY_AUTH_TOKEN
vercel env add SENTRY_ORG
vercel env add SENTRY_PROJECT
```

### GitHub Actionsでの設定

```yaml
# .github/workflows/deploy.yml
env:
  SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
  SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
  SENTRY_PROJECT: osakamenesu-web
```

## 10. モニタリングチェックリスト

- [ ] APIとWebの両方でSentryプロジェクトを作成
- [ ] DSNを環境変数に設定
- [ ] テストエラーが正しく送信されることを確認
- [ ] アラートルールを設定
- [ ] ダッシュボードをカスタマイズ
- [ ] ユーザーコンテキストが正しく設定されている
- [ ] パフォーマンストラッキングが有効
- [ ] 本番環境のサンプリングレートを調整
- [ ] チーム全員がSentryアクセス権を持っている
- [ ] Slackなどへの通知連携を設定

## トラブルシューティング

### エラーが送信されない

1. DSNが正しく設定されているか確認
2. ネットワーク接続を確認
3. `sentry_sdk.init()` が呼ばれているか確認
4. 環境変数が正しく読み込まれているか確認

### パフォーマンスデータが表示されない

1. `traces_sample_rate` が0より大きい値に設定されているか
2. トランザクション名が正しく設定されているか
3. フィルターで除外されていないか確認

### アラートが多すぎる

1. アラートルールのしきい値を調整
2. 特定のエラーをフィルタリング
3. アラートのグルーピング設定を確認

---

詳細なドキュメント: [https://docs.sentry.io/](https://docs.sentry.io/)