# Stagingデプロイメントガイド

## 概要

本番環境にデプロイする前に、Staging環境で全機能をテストします。

## Staging環境構成

- **API**: Railway staging environment (`api-staging.osakamenesu.com`)
- **Web**: Vercel preview (`staging.osakamenesu.com`)
- **Database**: PostgreSQL (staging instance)
- **Redis**: Redis (staging instance)

## 1. 事前準備

### 1.1 Staging環境変数確認

**Railway Staging:**
```bash
SENTRY_ENVIRONMENT=staging
SENTRY_TRACES_SAMPLE_RATE=0.5  # 高めのサンプリング
DEBUG=True  # 詳細ログ有効
```

**Vercel Staging:**
```bash
NEXT_PUBLIC_API_URL=https://api-staging.osakamenesu.com
NEXT_PUBLIC_SENTRY_ENVIRONMENT=staging
```

### 1.2 データベース準備

```bash
# Staging DBの作成（初回のみ）
railway run --environment staging python -c "
from app.database import engine
from app.models import Base
Base.metadata.create_all(bind=engine)
"

# テストデータ投入
railway run --environment staging python seed_staging.py
```

## 2. デプロイ手順

### 2.1 コードの準備

```bash
# 最新のmainブランチを取得
git checkout main
git pull origin main

# Stagingブランチ作成
git checkout -b staging/$(date +%Y%m%d)
```

### 2.2 API デプロイ (Railway)

```bash
# Railway CLIでデプロイ
cd services/api
railway up --environment staging

# マイグレーション実行
railway run --environment staging alembic upgrade head

# ヘルスチェック
curl https://api-staging.osakamenesu.com/health
```

### 2.3 Web デプロイ (Vercel)

```bash
# Vercel CLIでデプロイ
cd apps/web
vercel --env-file .env.staging

# デプロイURLを取得
# https://osakamenesu-xxx.vercel.app
```

### 2.4 カスタムドメイン設定

Vercel Dashboard:
1. Project Settings → Domains
2. Add `staging.osakamenesu.com`
3. DNS設定:
   ```
   CNAME staging.osakamenesu.com → cname.vercel-dns.com
   ```

## 3. テストプラン

### 3.1 認証機能テスト

**Googleログイン:**
- [ ] ログインページ表示
- [ ] Googleリダイレクト
- [ ] コールバック処理
- [ ] セッション作成
- [ ] ダッシュボードリダイレクト

**LINEログイン:**
- [ ] ログインページ表示
- [ ] LINEリダイレクト
- [ ] コールバック処理
- [ ] セッション作成
- [ ] ダッシュボードリダイレクト

**メールリンクログイン:**
- [ ] メールアドレス入力
- [ ] メール送信（SendGrid）
- [ ] リンククリック
- [ ] 認証完了
- [ ] セッション作成

### 3.2 ゲスト予約フロー

**検索から予約まで:**
1. [ ] `/guest/search` アクセス
2. [ ] エリア・日時選択
3. [ ] セラピスト一覧表示
4. [ ] セラピスト詳細表示
5. [ ] 空き時間表示
6. [ ] 予約フォーム入力
7. [ ] 予約確認
8. [ ] 予約完了メール受信

### 3.3 管理画面機能

**店舗管理:**
- [ ] 店舗一覧表示
- [ ] 店舗詳細編集
- [ ] 営業時間設定
- [ ] バッファ時間設定

**セラピスト管理:**
- [ ] セラピスト一覧表示
- [ ] セラピスト追加
- [ ] シフト設定
- [ ] プロフィール編集

**予約管理:**
- [ ] 予約一覧表示
- [ ] 予約詳細確認
- [ ] ステータス変更
- [ ] キャンセル処理

### 3.4 PWA機能テスト

**インストール:**
- [ ] インストールプロンプト表示
- [ ] ホーム画面追加
- [ ] スタンドアロン起動

**プッシュ通知:**
- [ ] 通知許可リクエスト
- [ ] 購読作成
- [ ] テスト通知送信
- [ ] 通知受信確認

**オフライン機能:**
- [ ] Service Worker登録
- [ ] 静的アセットキャッシュ
- [ ] オフラインページ表示

### 3.5 パフォーマンステスト

**Core Web Vitals:**
```bash
# Lighthouse実行
npm run lighthouse https://staging.osakamenesu.com

# 目標値
- LCP: < 2.5s
- FID: < 100ms
- CLS: < 0.1
```

**API レスポンス時間:**
```bash
# 負荷テスト
npm run load-test -- --url https://api-staging.osakamenesu.com

# 目標値
- p50: < 200ms
- p95: < 1000ms
- p99: < 3000ms
```

### 3.6 セキュリティテスト

- [ ] HTTPSリダイレクト
- [ ] CSRFトークン検証
- [ ] 認証必須エンドポイント保護
- [ ] SQLインジェクション対策
- [ ] XSS対策

### 3.7 エラーハンドリング

**Sentry確認:**
- [ ] エラー送信確認
- [ ] ソースマップ確認
- [ ] パフォーマンストレース
- [ ] ユーザーコンテキスト

**エラーページ:**
- [ ] 404ページ表示
- [ ] 500ページ表示
- [ ] メンテナンスページ

## 4. E2Eテスト実行

```bash
# Playwright E2Eテスト
cd apps/web
npm run test:e2e:staging

# 個別テスト実行
npm run test:e2e -- --grep "reservation flow"
```

## 5. チェックリスト

### デプロイ前
- [ ] 全テスト通過
- [ ] 環境変数設定確認
- [ ] マイグレーション準備

### デプロイ中
- [ ] APIデプロイ成功
- [ ] Webデプロイ成功
- [ ] マイグレーション完了

### デプロイ後
- [ ] ヘルスチェック通過
- [ ] 主要機能動作確認
- [ ] エラー監視確認

## 6. ロールバック手順

### APIロールバック
```bash
# 前のデプロイに戻す
railway rollback --environment staging

# DBロールバック（必要な場合）
railway run --environment staging alembic downgrade -1
```

### Webロールバック
```bash
# Vercel Dashboardから
# Deployments → 前のデプロイ → Promote to Production
```

## 7. 本番デプロイ準備

Staging環境で全テスト通過後：

1. **パフォーマンスレポート作成**
   - Core Web Vitals
   - API response times
   - Error rates

2. **セキュリティチェック完了証明**
   - 脆弱性スキャン結果
   - ペネトレーションテスト（必要に応じて）

3. **デプロイ計画書作成**
   - デプロイ日時
   - 担当者
   - ロールバック計画
   - 連絡体制

4. **本番環境変数最終確認**
   - Production values設定
   - Secrets rotation（必要に応じて）

## トラブルシューティング

### デプロイ失敗
```bash
# ログ確認
railway logs --environment staging
vercel logs

# 再デプロイ
railway up --environment staging --force
vercel --force
```

### DB接続エラー
```bash
# 接続テスト
railway run --environment staging python -c "
from app.database import SessionLocal
db = SessionLocal()
print('DB connection successful')
db.close()
"
```

### 通知送信エラー
- SendGrid API Key確認
- ドメイン認証確認
- VAPIDキー確認

## 次のステップ

全テスト通過後：
1. ステークホルダーレビュー
2. 本番デプロイ承認取得
3. 本番デプロイ実施

---

Stagingデプロイ日時: _______________
テスト完了日時: _______________
承認者: _______________