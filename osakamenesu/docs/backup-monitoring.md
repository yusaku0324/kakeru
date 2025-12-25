# バックアップ監視設定ガイド

## 概要

データベースバックアップの成功/失敗を監視し、問題があった場合に迅速に対応できるようにする設定です。

## 監視方法

### 1. GitHub Actions通知

#### Slack通知の設定

1. Slack Webhookの作成:
   - Slackワークスペースで「Apps」→「Incoming Webhooks」を追加
   - 通知チャンネルを選択
   - Webhook URLを取得

2. GitHub Secretsに追加:
   ```
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
   ```

3. 通知内容:
   - ✅ バックアップ成功時（オプション）
   - ⚠️ バックアップ失敗時
   - 📊 バックアップサイズ情報

#### Email通知（GitHub標準）

GitHub Actionsの失敗時は自動的にメール通知が送信されます。
設定: Settings → Notifications → Actions

### 2. UptimeRobotでの監視

バックアップの定期実行を監視するため、ヘルスチェックエンドポイントを使用：

1. UptimeRobotで新しいモニターを作成
2. 監視タイプ: HTTP(s)
3. URL: `https://osakamenesu-api.fly.dev/ops/health/backup`
4. 監視間隔: 24時間

### 3. バックアップヘルスチェックAPIの実装

新しいエンドポイントを追加してバックアップの状態を確認：

```python
# services/api/app/routers/ops.py に追加

@router.get("/health/backup")
async def backup_health_check(
    admin_key: str = Depends(get_admin_key),
    s3_client = Depends(get_s3_client)
):
    """バックアップの健全性をチェック"""
    try:
        # 最新のバックアップを確認
        bucket = os.getenv("BACKUP_S3_BUCKET")
        prefix = "db-backups/"

        response = await s3_client.list_objects_v2(
            Bucket=bucket,
            Prefix=prefix,
            MaxKeys=10
        )

        if "Contents" not in response:
            return JSONResponse(
                status_code=503,
                content={"status": "unhealthy", "message": "No backups found"}
            )

        # 最新のバックアップの日付を確認
        latest_backup = max(response["Contents"], key=lambda x: x["LastModified"])
        last_backup_time = latest_backup["LastModified"]

        # 48時間以内にバックアップがあるかチェック
        time_diff = datetime.now(timezone.utc) - last_backup_time
        if time_diff.total_seconds() > 48 * 3600:
            return JSONResponse(
                status_code=503,
                content={
                    "status": "unhealthy",
                    "message": f"Last backup is {time_diff.days} days old",
                    "last_backup": last_backup_time.isoformat()
                }
            )

        return {
            "status": "healthy",
            "last_backup": last_backup_time.isoformat(),
            "backup_count": len(response["Contents"]),
            "latest_size": latest_backup["Size"]
        }

    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "error": str(e)}
        )
```

### 4. Grafanaダッシュボード（オプション）

メトリクスを可視化する場合：

```yaml
# Prometheus metrics
backup_last_success_timestamp
backup_size_bytes
backup_duration_seconds
backup_failure_total
```

### 5. バックアップ検証の自動化

月次でバックアップのリストアテストを自動実行：

```yaml
# .github/workflows/backup-verify.yml
name: Backup Verification

on:
  schedule:
    # 毎月1日に実行
    - cron: '0 0 1 * *'
  workflow_dispatch:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - name: Download latest backup
        # ... S3からダウンロード

      - name: Create test database
        # ... テスト用DBを作成

      - name: Restore backup
        # ... リストア実行

      - name: Verify data integrity
        # ... データ整合性チェック
```

## アラート設定

### 優先度別アラート

1. **Critical（即時対応）**
   - バックアップが2日以上失敗
   - S3アクセスエラー
   - ディスク容量不足

2. **Warning（24時間以内に対応）**
   - バックアップサイズが前回の50%以下
   - 処理時間が通常の3倍以上

3. **Info（記録のみ）**
   - バックアップ成功
   - 定期クリーンアップ完了

### 対応手順書

#### バックアップ失敗時

1. GitHub Actionsのログを確認
2. エラー内容に応じて対応:
   - **認証エラー**: シークレットを確認
   - **接続エラー**: Railway/S3の状態確認
   - **容量エラー**: 古いバックアップを削除

#### リストア必要時

1. 最新の正常なバックアップを特定
2. ステージング環境でテスト
3. メンテナンスモードに切り替え
4. リストア実行
5. 動作確認

## 定期レビュー

### 月次チェック項目

- [ ] バックアップ成功率の確認
- [ ] ストレージ使用量の確認
- [ ] リストアテストの実施
- [ ] バックアップ時間の推移確認
- [ ] エラーログのレビュー

### 四半期レビュー

- [ ] バックアップ戦略の見直し
- [ ] 保持期間の調整
- [ ] コスト最適化の検討
- [ ] 災害復旧訓練の実施

## コスト監視

### S3/R2使用量の追跡

```bash
# 月次使用量レポート
aws s3 ls s3://osakamenesu-backups/ \
  --recursive \
  --summarize \
  --human-readable
```

### アラート設定

- ストレージが50GBを超えた場合に通知
- 月額コストが$10を超えた場合に通知

## 連絡先

バックアップ関連の問題が発生した場合の連絡先:

1. **プライマリ**: システム管理者
2. **セカンダリ**: 開発リード
3. **エスカレーション**: CTO/技術責任者
