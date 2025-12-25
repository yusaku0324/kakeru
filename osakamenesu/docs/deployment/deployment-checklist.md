# Osakamenesu デプロイメントチェックリスト

## 🚀 デプロイ前の準備

### 環境変数設定 ✅

#### API (Railway)
- [ ] `DATABASE_URL` - PostgreSQL接続文字列
- [ ] `REDIS_URL` - Upstash Redis URL
- [ ] `MEILI_MASTER_KEY` - Meilisearch マスターキー
- [ ] `JWT_SECRET_KEY` - JWT署名用秘密鍵（32文字以上）
- [ ] `ADMIN_API_KEY` - 管理API用キー
- [ ] `VAPID_PUBLIC_KEY` - 生成済み: `BMCHV1zrIazRTE1PAZHArbaxtVsr7hvru5PYG5rx0Xin-JvU6-WFaIiK6Q8V7NwO9ywudqGh_8JxIRlyuywGkrI`
- [ ] `VAPID_PRIVATE_KEY` - 生成済み: `6l3uztIEEcg-bKCDM1wX5sQwuEuoZ7a3ViL8kiORlFM`
- [ ] `SENTRY_DSN` - APIプロジェクトのDSN

#### Web (Vercel)
- [ ] `NEXT_PUBLIC_API_URL` - APIのURL（https://api.osakamenesu.com）
- [ ] `NEXT_PUBLIC_SITE_URL` - サイトURL（https://osakamenesu.com）
- [ ] `NEXT_PUBLIC_VAPID_PUBLIC_KEY` - 上記と同じ公開鍵
- [ ] `NEXT_PUBLIC_SENTRY_DSN` - WebプロジェクトのDSN
- [ ] `SENTRY_AUTH_TOKEN` - Sentry認証トークン

### インフラストラクチャ

#### Railway
- [ ] PostgreSQL データベースを作成
- [ ] Meilisearch サービスをデプロイ
- [ ] API サービスを作成
- [ ] 環境変数を設定
- [ ] カスタムドメインを設定（api.osakamenesu.com）

#### Vercel
- [ ] プロジェクトをインポート
- [ ] 環境変数を設定
- [ ] カスタムドメインを設定（osakamenesu.com）

#### Upstash
- [ ] Redis データベースを作成（東京リージョン）
- [ ] 接続URLをコピー

#### Sentry
- [ ] APIプロジェクトを作成
- [ ] Webプロジェクトを作成
- [ ] Auth Tokenを生成

### GitHub Secrets設定

```bash
# 必要なシークレット
RAILWAY_TOKEN
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
SENTRY_ORG
SENTRY_AUTH_TOKEN
VAPID_PUBLIC_KEY
DATABASE_URL
```

## 🎯 デプロイ実行

### 初回デプロイ

1. **データベースマイグレーション**
   ```bash
   railway run --service osakamenesu-api alembic upgrade head
   ```

2. **APIデプロイ**
   ```bash
   git push origin main
   # または手動で
   railway up --service osakamenesu-api
   ```

3. **Webデプロイ**
   ```bash
   vercel --prod
   ```

### 本番デプロイフロー

1. **ステージング環境でテスト**
   - [ ] E2Eテストがすべて通過
   - [ ] パフォーマンステスト実施
   - [ ] セキュリティスキャン完了

2. **本番デプロイ**
   ```bash
   # mainブランチにマージ
   git checkout main
   git merge develop
   git push origin main
   ```

3. **デプロイ確認**
   - [ ] https://api.osakamenesu.com/health/ready が200を返す
   - [ ] https://osakamenesu.com が正常に表示される
   - [ ] プッシュ通知のテスト送信が成功

## 📊 デプロイ後の確認

### 機能確認

- [ ] **認証機能**
  - [ ] ユーザー登録
  - [ ] ログイン/ログアウト
  - [ ] パスワードリセット

- [ ] **検索機能**
  - [ ] 店舗検索
  - [ ] セラピスト検索
  - [ ] エリア検索

- [ ] **予約機能**
  - [ ] 予約作成
  - [ ] 予約変更
  - [ ] 予約キャンセル

- [ ] **プッシュ通知**
  - [ ] 通知権限の取得
  - [ ] テスト通知の送信

### モニタリング確認

- [ ] **Sentry**
  - [ ] エラーが正しくキャプチャされている
  - [ ] パフォーマンストランザクションが記録されている

- [ ] **ヘルスチェック**
  - [ ] UptimeRobot/Better Uptimeが設定されている
  - [ ] アラートが設定されている

- [ ] **メトリクス**
  - [ ] Prometheusメトリクスが収集されている
  - [ ] Core Web Vitalsが記録されている

### セキュリティ確認

- [ ] **SSL/TLS**
  - [ ] HTTPSが有効
  - [ ] SSL証明書が有効

- [ ] **セキュリティヘッダー**
  - [ ] CSPが設定されている
  - [ ] X-Frame-Optionsが設定されている

- [ ] **環境変数**
  - [ ] 秘密情報がコードに含まれていない
  - [ ] 本番用の強力なキーが使用されている

## 🔄 ロールバック手順

### 問題発生時

1. **即座の対応**
   ```bash
   # Vercel - 前のデプロイメントに戻す
   vercel rollback

   # Railway - 前のデプロイメントを再デプロイ
   # Dashboardから実行
   ```

2. **データベースロールバック**
   ```bash
   # マイグレーションを戻す
   railway run --service osakamenesu-api alembic downgrade -1
   ```

3. **通知**
   - [ ] チームに通知
   - [ ] ステータスページを更新

## 📝 デプロイログ

| 日時 | バージョン | 環境 | デプロイ者 | 備考 |
|------|-----------|------|-----------|------|
| 2025-12-25 | v1.0.0 | Production | - | 初回デプロイ |

## 🎉 完了確認

すべてのチェック項目が完了したら：

1. **パフォーマンステスト**
   ```bash
   # Lighthouse
   npx lighthouse https://osakamenesu.com --view

   # WebPageTest
   # https://www.webpagetest.org
   ```

2. **祝福メッセージ**
   ```
   🎊 デプロイ完了！

   Web: https://osakamenesu.com
   API: https://api.osakamenesu.com

   素晴らしい仕事でした！ 🚀
   ```

---

問題が発生した場合の連絡先：
- Railway Support: support@railway.app
- Vercel Support: support@vercel.com
- 緊急時: [チームSlackチャンネル]