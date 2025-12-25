# Sentry セットアップガイド

## 概要

OsakamenesuアプリケーションのエラートラッキングとパフォーマンスモニタリングのためのSentryセットアップガイドです。

## 1. Sentryアカウントの作成

1. [https://sentry.io](https://sentry.io) にアクセス
2. 新規アカウントを作成またはログイン
3. Organization名を設定（例: `osakamenesu`）

## 2. プロジェクトの作成

### 2.1 APIプロジェクト

1. "Create Project" をクリック
2. Platform: **Python** を選択
3. Alert frequency: **Alert me on every new issue** を選択
4. Project name: `osakamenesu-api`
5. Team: `#osakamenesu` を選択または作成

### 2.2 Webプロジェクト

1. "Create Project" をクリック
2. Platform: **Next.js** を選択
3. Alert frequency: **Alert me on every new issue** を選択
4. Project name: `osakamenesu-web`
5. Team: `#osakamenesu` を選択

## 3. DSN（Data Source Name）の取得

各プロジェクトのSettings → Client Keys (DSN)から取得：

### APIプロジェクトDSN例:
```
https://xxxxxxxxxxxxx@o123456.ingest.sentry.io/1234567
```

### WebプロジェクトDSN例:
```
https://yyyyyyyyyyyyy@o123456.ingest.sentry.io/7654321
```

## 4. 環境変数の設定

### 4.1 API環境変数 (`/services/api/.env.production`)

```bash
# Sentry
SENTRY_DSN=https://xxxxxxxxxxxxx@o123456.ingest.sentry.io/1234567
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1
```

### 4.2 Web環境変数 (`/apps/web/.env.production`)

```bash
# Sentry
NEXT_PUBLIC_SENTRY_DSN=https://yyyyyyyyyyyyy@o123456.ingest.sentry.io/7654321
SENTRY_ORG=osakamenesu
SENTRY_PROJECT=osakamenesu-web
SENTRY_AUTH_TOKEN=your_auth_token_here
SENTRY_ENVIRONMENT=production
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
```

## 5. Sentry Auth Tokenの生成

1. Sentry Dashboard → Settings → Account → API → Auth Tokens
2. "Create New Token" をクリック
3. Scopes:
   - `project:releases` (create and list)
   - `org:read`
   - `project:read`
   - `project:write`
4. Token名: `osakamenesu-deployment`
5. 生成されたトークンを安全に保存

## 6. Release Trackingの設定

### 6.1 APIのリリース設定

Dockerfileに追加済み：
```dockerfile
ARG SENTRY_RELEASE
ENV SENTRY_RELEASE=${SENTRY_RELEASE}
```

### 6.2 Webのリリース設定

`next.config.js`でSentry Webpack pluginが設定済み。

## 7. Alertsの設定

### 7.1 Issue Alerts

1. Alerts → Create Alert Rule → Issue Alert
2. 推奨設定:
   - **新規エラー**: すべての新規エラーを通知
   - **エラー急増**: 1時間で10件以上のエラー
   - **高頻度エラー**: 24時間で100件以上

### 7.2 Performance Alerts

1. Alerts → Create Alert Rule → Metric Alert
2. 推奨設定:
   - **遅いAPI**: p95 response time > 3秒
   - **高エラー率**: Error rate > 5%
   - **Apdex低下**: Apdex < 0.7

## 8. Integrationsの設定

### 8.1 Slack Integration

1. Settings → Integrations → Slack
2. "Add Workspace" をクリック
3. 通知チャンネル: `#osakamenesu-alerts`

### 8.2 GitHub Integration

1. Settings → Integrations → GitHub
2. リポジトリを接続
3. Commit trackingを有効化

## 9. Performance Monitoringの設定

### 9.1 トランザクション設定

1. Performance → Settings
2. Key Transactions:
   - `/api/guest/therapists/[id]/availability_slots`
   - `/api/guest/reservations`
   - `/api/v1/shops`

### 9.2 Web Vitals監視

Web projectで自動的に以下が監視されます：
- LCP (Largest Contentful Paint)
- FID (First Input Delay)
- CLS (Cumulative Layout Shift)
- FCP (First Contentful Paint)
- TTFB (Time to First Byte)

## 10. Data & Privacyの設定

### 10.1 PIIスクラビング

1. Settings → Security & Privacy → Data Scrubbing
2. 以下を有効化:
   - Scrub IP addresses
   - Scrub personally identifiable information
   - Use default scrubbers

### 10.2 Allowed Domains

Webプロジェクト → Settings → Security Headers:
- `osakamenesu.com`
- `*.osakamenesu.com`
- `localhost` (development)

## 11. 環境ごとの設定

### Development環境
```bash
SENTRY_ENVIRONMENT=development
SENTRY_TRACES_SAMPLE_RATE=1.0  # 全トランザクション
```

### Staging環境
```bash
SENTRY_ENVIRONMENT=staging
SENTRY_TRACES_SAMPLE_RATE=0.5  # 50%サンプリング
```

### Production環境
```bash
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1  # 10%サンプリング
```

## 12. デプロイ時の確認事項

1. **環境変数が正しく設定されているか**
   - DSN
   - Environment
   - Auth Token (Web)

2. **Source mapsがアップロードされているか** (Web)
   - ビルドログで確認

3. **エラーが正しく送信されているか**
   - テストエラーを発生させて確認

4. **パフォーマンスデータが収集されているか**
   - Performance dashboardで確認

## 13. モニタリングダッシュボード

### 推奨ダッシュボード

1. **Error Dashboard**
   - Error rate by endpoint
   - Error types distribution
   - Error trends

2. **Performance Dashboard**
   - Transaction duration (p50, p95, p99)
   - Throughput (requests/minute)
   - Apdex score

3. **Release Health**
   - Crash free rate
   - Adoption rate
   - Session duration

## トラブルシューティング

### エラーが送信されない場合

1. DSNが正しいか確認
2. ネットワーク接続を確認
3. Sentryのstatus pageを確認

### Source mapsが機能しない場合

1. Auth tokenが正しいか確認
2. ビルド時のSENTRY_AUTH_TOKEN環境変数
3. Release名が一致しているか確認

## 連絡先

- Sentry Dashboard: https://osakamenesu.sentry.io
- サポート: support@sentry.io
- ドキュメント: https://docs.sentry.io