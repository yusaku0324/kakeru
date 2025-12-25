# ステージング環境ガイド

## 🌐 ステージング環境概要

- **URL**: https://osakamenesu-api-stg.fly.dev
- **アプリ名**: osakamenesu-api-stg
- **リージョン**: nrt (東京)
- **自動スケーリング**: アイドル時は0台、リクエスト時に自動起動

## 📋 ステージング環境の目的

1. **本番前の最終確認**
   - 新機能の動作確認
   - バグ修正の検証
   - パフォーマンステスト

2. **リスク軽減**
   - 本番環境への影響を防ぐ
   - データベース変更の事前検証
   - 外部API連携のテスト

3. **デモンストレーション**
   - ステークホルダーへの機能確認
   - QAチームでのテスト

## 🚀 デプロイ手順

### 1. 手動デプロイ
```bash
cd osakamenesu/services/api
flyctl deploy -a osakamenesu-api-stg --remote-only -c fly.stg.toml
```

### 2. CI/CDからのデプロイ
GitHub Actions ワークフローを使用：
```bash
# workflow_dispatch でステージングを選択
gh workflow run deploy-api-fly-osakamenesu.yml -f environment=staging
```

### 3. 特定ブランチからのデプロイ
```bash
# feature ブランチをステージングに
git checkout feature/new-feature
flyctl deploy -a osakamenesu-api-stg --remote-only -c fly.stg.toml
```

## 🔍 環境の確認

### ステータス確認
```bash
# アプリの状態確認
fly status -a osakamenesu-api-stg

# ログ確認
fly logs -a osakamenesu-api-stg

# リアルタイムログ監視
fly logs -a osakamenesu-api-stg --follow
```

### ヘルスチェック
```bash
# APIの稼働確認
curl https://osakamenesu-api-stg.fly.dev/healthz

# ドキュメント確認
open https://osakamenesu-api-stg.fly.dev/docs
```

## 🔧 環境変数の管理

### 現在の環境変数確認
```bash
fly secrets list -a osakamenesu-api-stg
```

### 環境変数の設定
```bash
# 単一の変数
fly secrets set KEY=value -a osakamenesu-api-stg

# 複数の変数
fly secrets set KEY1=value1 KEY2=value2 -a osakamenesu-api-stg
```

### 本番環境との差分
ステージング専用の環境変数：
- `ENVIRONMENT=staging`
- `DEBUG=true`（デバッグログ有効）
- `DATABASE_URL`（ステージング用DB）

## 📊 コスト最適化

ステージング環境は以下の設定でコストを最小化：

```toml
# fly.stg.toml
auto_stop_machines = 'suspend'
auto_start_machines = true
min_machines_running = 0  # アイドル時は0台
```

### 手動での停止/開始
```bash
# 全マシンを停止
fly scale count 0 -a osakamenesu-api-stg

# 通常の台数に戻す
fly scale count 2 -a osakamenesu-api-stg
```

## 🧪 テストシナリオ

### 1. API エンドポイントテスト
```bash
# 認証フロー
curl -X POST https://osakamenesu-api-stg.fly.dev/api/auth/request-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# セッション確認
curl https://osakamenesu-api-stg.fly.dev/api/auth/session \
  -H "Cookie: session_token=..."
```

### 2. 負荷テスト
```bash
# Apache Bench を使用
ab -n 1000 -c 10 https://osakamenesu-api-stg.fly.dev/healthz
```

### 3. データベースマイグレーション
```bash
# ステージングDBへの接続
fly ssh console -a osakamenesu-api-stg

# マイグレーション実行
cd /app
alembic upgrade head
```

## 🔄 本番環境への反映

### 1. ステージングで確認完了後
```bash
# main ブランチにマージ
git checkout main
git merge feature/new-feature
git push origin main
```

### 2. 自動デプロイ
- main ブランチへのプッシュで自動的に本番環境へデプロイ
- GitHub Actions の deploy-api-fly-osakamenesu.yml が実行

### 3. ロールバック手順
```bash
# 前のバージョンを確認
fly releases -a osakamenesu-api-stg

# 特定バージョンにロールバック
fly deploy --image registry.fly.io/osakamenesu-api-stg:deployment-XXXXX -a osakamenesu-api-stg
```

## 📝 チェックリスト

### デプロイ前
- [ ] ローカルテストがパス
- [ ] データベースマイグレーションの準備
- [ ] 環境変数の確認

### デプロイ後
- [ ] ヘルスチェックの確認
- [ ] 主要機能の動作確認
- [ ] エラーログの確認
- [ ] パフォーマンスの確認

### 本番反映前
- [ ] ステージングでの全機能テスト完了
- [ ] ステークホルダーの承認取得
- [ ] ロールバック手順の確認
