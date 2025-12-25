# モニタリングセットアップガイド

## 📊 現在のモニタリング状況

### ✅ 設定済み

1. **Sentry エラー監視**
   - API: 環境変数 `SENTRY_DSN` 設定済み
   - Web: `@sentry/nextjs` インストール済み（要DSN設定）

2. **ヘルスチェックエンドポイント**
   - API: `https://osakamenesu-api.fly.dev/healthz`
   - Web: Next.js の自動ヘルスチェック

### 🔧 設定が必要

## 1. アップタイム監視の設定

### UptimeRobot（推奨・無料プランあり）

1. [UptimeRobot](https://uptimerobot.com/) でアカウント作成
2. 新しいモニターを追加：
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: Osakamenesu API Production
   - **URL**: `https://osakamenesu-api.fly.dev/healthz`
   - **Monitoring Interval**: 5 minutes
   - **Alert Contacts**: メールアドレスを設定

### Better Uptime（より高度な監視）

1. [Better Uptime](https://betteruptime.com/) でアカウント作成
2. モニターを追加：
   ```
   - URL: https://osakamenesu-api.fly.dev/healthz
   - Check type: HEAD
   - Check frequency: 30 seconds
   - Regions: Asia Pacific (Tokyo)
   ```

## 2. Sentry の追加設定

### Web アプリ用の環境変数

Vercel ダッシュボードで設定：
```
NEXT_PUBLIC_SENTRY_DSN=<your-sentry-dsn>
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_REPLAYS_SESSION_SAMPLE_RATE=0.1
SENTRY_REPLAYS_ERROR_SAMPLE_RATE=1.0
```

### アラート設定

Sentry ダッシュボードで設定：
1. **Alerts** → **Create Alert Rule**
2. エラー率アラート：
   - Condition: Error count > 10 in 5 minutes
   - Action: Send email/Slack notification
3. パフォーマンスアラート：
   - Condition: P95 response time > 3000ms
   - Action: Send notification

## 3. Fly.io メトリクス監視

### Grafana Cloud（推奨）

1. [Grafana Cloud](https://grafana.com/products/cloud/) の無料アカウント作成
2. Fly.io メトリクスエクスポート設定：
   ```bash
   fly metrics export grafana -a osakamenesu-api
   ```

### メトリクスダッシュボード

監視すべきメトリクス：
- CPU使用率
- メモリ使用率
- リクエスト数/秒
- エラー率
- レスポンスタイム（P50, P95, P99）

## 4. アラート通知の統合

### Slack 通知設定

1. Slack App を作成
2. Webhook URL を取得
3. 各サービスで Slack 通知を設定：
   - UptimeRobot: Alert Contacts で Slack 追加
   - Sentry: Integrations → Slack
   - Fly.io: Grafana 経由で設定

### Discord 通知設定

1. Discord サーバーで Webhook URL を作成
2. 各サービスで Discord webhook を設定

## 5. インシデント対応フロー

### 監視チェックリスト

- [ ] アップタイム監視（5分ごと）
- [ ] エラー率監視（リアルタイム）
- [ ] パフォーマンス監視（1分ごと）
- [ ] リソース使用率監視（5分ごと）

### アラート対応手順

1. **アラート受信**
   - Slack/Discord/メールで通知

2. **初期調査**（5分以内）
   ```bash
   # API ログ確認
   fly logs -a osakamenesu-api | tail -100

   # ステータス確認
   fly status -a osakamenesu-api

   # Sentry エラー確認
   open https://sentry.io/organizations/your-org/issues/
   ```

3. **対応判断**
   - 緊急度: Critical/High/Medium/Low
   - 影響範囲: 全体/一部機能/特定ユーザー

4. **対応実施**
   - ホットフィックス
   - スケーリング
   - ロールバック

5. **事後対応**
   - インシデントレポート作成
   - 再発防止策の実施

## 6. 定期レビュー

### 週次レビュー
- エラー率のトレンド確認
- パフォーマンスメトリクス確認
- アラート設定の調整

### 月次レビュー
- SLO/SLA の達成状況
- インシデント分析
- 改善計画の策定
