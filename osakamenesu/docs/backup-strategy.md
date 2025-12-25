# バックアップ戦略

## 概要

Osakamenesuプロジェクトのデータベースとファイルのバックアップ戦略について説明します。

## バックアップ対象

### 1. PostgreSQLデータベース（Railway）
- **頻度**: 毎日午前4時（JST）
- **保持期間**: 30日間
- **形式**: SQL dump（gzip圧縮）

### 2. アップロードされたファイル
- セラピスト写真
- 店舗画像
- その他のユーザーアップロードファイル

## ストレージオプション

### 推奨: Cloudflare R2
- **メリット**:
  - S3互換API
  - エグレス料金無料
  - 高い可用性
  - 低コスト

### 代替オプション
1. **Backblaze B2**
   - 非常に低コスト
   - S3互換

2. **AWS S3**
   - 標準的な選択肢
   - 高い信頼性

3. **DigitalOcean Spaces**
   - シンプルな価格体系
   - S3互換

## 実装手順

### 1. Cloudflare R2のセットアップ

```bash
# 1. Cloudflareアカウントでバケットを作成
# - osakamenesu-backups

# 2. API認証情報を取得
# - Account ID
# - Access Key ID
# - Secret Access Key
```

### 2. GitHub Secretsの設定

```bash
# 以下のシークレットを設定:
RAILWAY_DATABASE_URL        # 既存
BACKUP_S3_BUCKET           # osakamenesu-backups
BACKUP_S3_ENDPOINT         # https://<account-id>.r2.cloudflarestorage.com
AWS_ACCESS_KEY_ID          # R2のアクセスキー
AWS_SECRET_ACCESS_KEY      # R2のシークレットキー
SLACK_WEBHOOK_URL          # 通知用（オプション）
```

### 3. バックアップワークフローの有効化

既存の`.github/workflows/db-backup.yml`は既に設定済みです。必要なシークレットを設定すれば自動的に動作します。

## リストア手順

### データベースリストア

```bash
# 1. S3からバックアップファイルをダウンロード
aws s3 cp s3://osakamenesu-backups/db-backups/backup_20240315_040000.sql.gz ./backup.sql.gz \
  --endpoint-url https://<account-id>.r2.cloudflarestorage.com

# 2. 解凍
gunzip backup.sql.gz

# 3. リストア
psql $DATABASE_URL < backup.sql
```

### ローカル環境へのリストア

```bash
# 1. バックアップをダウンロード（上記と同じ）

# 2. ローカルDBにリストア
psql -h localhost -U postgres -d osakamenesu < backup.sql
```

## 監視とアラート

### 1. バックアップ成功/失敗の通知
- GitHub ActionsからSlackへの通知（設定済み）
- バックアップサイズの記録

### 2. 定期的な検証
- 月1回のリストアテスト
- バックアップファイルの整合性チェック

## セキュリティ考慮事項

### 1. 暗号化
- S3/R2での保存時暗号化（自動）
- 転送時のTLS暗号化

### 2. アクセス制御
- IAMポリシーによる最小権限
- バックアップバケットへの読み取り専用アクセス

### 3. 監査
- アクセスログの記録
- 不正アクセスの検知

## コスト見積もり

### Cloudflare R2の場合
- ストレージ: $0.015/GB/月
- 操作: $0.36/100万リクエスト
- エグレス: 無料

**月間コスト見積もり**:
- DB サイズ: ~1GB（圧縮後）
- 30日分保持: 30GB
- 月額: 約$0.45（約60円）

## トラブルシューティング

### バックアップが失敗する場合

1. **認証エラー**
   ```bash
   # シークレットを確認
   gh secret list
   ```

2. **接続エラー**
   - エンドポイントURLを確認
   - ネットワーク設定を確認

3. **容量不足**
   - 古いバックアップの削除
   - 保持期間の調整

### リストアが失敗する場合

1. **権限エラー**
   - データベースユーザーの権限確認
   - --no-owner フラグの使用

2. **互換性エラー**
   - PostgreSQLバージョンの確認
   - 文字エンコーディングの確認

## 今後の改善案

1. **増分バックアップ**
   - WALアーカイブの設定
   - ポイントインタイムリカバリ

2. **地理的冗長性**
   - 複数リージョンへのレプリケーション
   - クロスリージョンバックアップ

3. **自動リストアテスト**
   - 定期的な自動リストア検証
   - データ整合性チェック
