## 通知ワーカー運用メモ（FastAPI 内蔵ループ）

### 目的
予約通知（Slack / LINE / Email）を FastAPI プロセス内で非同期に配送する。`services/api/app/notifications.py` が `ReservationNotificationDelivery` テーブルを監視し、バックグラウンドタスクで `pending` レコードを順次送信する。

### 構成
- モジュール: `services/api/app/notifications.py`
- バックグラウンドループ: `start_notification_worker()`（FastAPI `lifespan` で起動）
- データストア: Postgres (`reservation_notification_deliveries`, `reservation_notification_attempts`)
- 外部依存: Slack Webhook / LINE Notify / Email API（設定は `.env` 経由）

### ローカルでの起動
1. `docker compose up -d osakamenesu-api osakamenesu-db osakamenesu-redis`  
   FastAPI が立ち上がると同時に通知ワーカーも起動する。
2. 追加のコマンドは不要。ログは `docker logs -f osakamenesu_api` で確認できる。
3. テーブルの溜まり具合は `services/api/app/notifications.py` の `process_pending_notifications()` を直接実行するか、FastAPI シェルで `await process_pending_notifications()` を叩いて確認できる。

### 本番・ステージング
- Cloud Run / Docker など FastAPI をデプロイする先で自動的にワーカーが起動する。別プロセスを管理する必要はない。
- 環境変数で挙動を調整できる：
  - `RESERVATION_NOTIFICATION_WORKER_INTERVAL_SECONDS`（ポーリング間隔、既定 1.5 秒）
  - `RESERVATION_NOTIFICATION_BATCH_SIZE`（1 バッチの処理数、既定 20）
  - `RESERVATION_NOTIFICATION_MAX_ATTEMPTS`（再試行回数、既定 5）
  - `RESERVATION_NOTIFICATION_RETRY_BASE_SECONDS` / `RESERVATION_NOTIFICATION_RETRY_BACKOFF_MULTIPLIER`
- 送信失敗時は `reservation_notification_attempts` にエラー内容が残り、Sentry を有効化していれば例外も集約される。

### 手動再送 / ヘルスチェック
- `POST /api/async/deliveries/{delivery_id}/dispatch` を呼ぶと単発で再送できる。`ASYNC_WORKER_TOKEN` を `Authorization: Bearer <token>` で渡すこと。  
  長期的にはバッチ処理に任せればよいが、サポート対応時のスポット再送が可能。
- 予約キューの滞留状況は `Ops MCP` の `/api/ops/queue` や DB を直接見る。BullMQ の `/api/internal/notifications/*` や `npm run queue:*` は廃止された。

### 運用Tips
- 通知設定の保存に失敗した場合もレコードは `pending` のまま残るため、`SELECT status, next_attempt_at FROM reservation_notification_deliveries ORDER BY created_at DESC;` で監視する。
- アプリ再起動時はワーカーが自動で再開し、`pending` レコードを順次処理する。別途キューの再アタッチは不要。
- `settings.notification_worker_enabled`（環境変数 `NOTIFICATION_WORKER_ENABLED`, 既定 true）を `false` にするとバックグラウンドループを停止できる。メンテナンスや大規模バッチ時の保護に利用する。
