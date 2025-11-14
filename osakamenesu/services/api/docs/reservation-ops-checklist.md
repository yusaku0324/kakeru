## 予約機能 運用チェックリスト

リリース後に予約フローを安定運用するための手順と確認ポイントです。導入前・導入後にそれぞれ実施してください。

### 1. アプリケーション設定
- [ ] `.env` または環境変数に API ベース URL (`API_PUBLIC_BASE_URL`) を設定し、承認ボタンURLが外部からアクセス可能な形で発行されることを確認。
- [ ] Slack / Email / LINE 通知のエンドポイント (`notify_email_endpoint`, `notify_line_endpoint`, `slack_webhook_url`) を本番用にセット。
- [ ] Playwright 用 `.env.playwright` にも同様の設定を反映し、E2E テストで承認リンクが解決できることを確認。

### 2. DB マイグレーション
- [ ] `alembic upgrade head` を実行し、`reservations` テーブルの承認カラム・リマインド列が追加されていることを確認。  
  - 既存レコードは `approval_decision = NULL` のまま残るので、導入初期は新規予約から順次値が入り始めます。

### 3. LINE 承認フロー確認
1. 通知設定ページ (`/dashboard/{profileId}/notifications`) で LINE トークンを設定。
2. 実際にテスト予約を送信し、LINE に承認ボタン付きで通知が届くか確認。
3. 承認ボタンから `/api/v1/reservations/{id}/decision` が呼ばれ、  
    - ステータスが `confirmed` に変わる  
    - 顧客へ確認メールが届く  
    - ダッシュボードと公開ページのステータスカードが即時更新される  
   ことをチェック。
4. 辞退ボタンでも同様に `declined` へ遷移することを確認。

### 4. 自動リマインドの確認
- [ ] テスト用に希望日時を +4時間程度に設定し、3時間前にリマインド通知 (`event=reminder`) が届くことをステージング環境で確認。
- [ ] 送信を見落とした際にログ (`reservation_notification_log`) が適切に出力されるか確認。
- [ ] `reservation_notification_worker_interval_seconds` と `reservation_notification_batch_size` を運用に合わせて調整。

### 5. ダッシュボード側の確認
- [ ] `/dashboard/{profileId}` トップに最新予約が表示されるか確認。承認操作後にステータスカード／履歴リストが更新されるかチェック。
- [ ] `/dashboard/{profileId}/profile` と `/dashboard/{profileId}/notifications` でも同じステータスカードが反映されているか確認。
- [ ] `/api/dashboard/{profileId}/reservations` エンドポイントを叩き、最新予約が取得できることを確認。必要に応じて `?start=2025-11-01&end=2025-11-07` のように期間を指定し、希望日時で絞り込めることも合わせてチェック。大量データの場合はレスポンスの `next_cursor` / `prev_cursor` を使ってページ送りができること、`cursor_direction=backward` で新着側も遡れることを確認する。

### 6. ログ・モニタリング
- [ ] LINE／メール／Slack への通知送信が失敗した場合、`reservation_notification_deliveries` テーブルで再試行されることを確認。
- [ ] `process_pending_notifications` のスケジューラを本番環境の監視対象に追加。失敗リトライが連続する場合はアラートを出す。
- [ ] FastAPI 側のログレベル (`reservation_notification_log`) を INFO 以上に設定し、障害解析に備える。

### 7. 失敗時の対処
- [ ] 承認URLの期限 (`approval_token_expires_at`) は 24h。期限切れの場合は顧客に再送してもらうか、ダッシュボードから手動登録する運用を決めておく。
- [ ] 誤承認・誤辞退の修正フロー（例: `PATCH /api/v1/reservations/{id}` を使ってステータスを戻す）をチーム内で共有。

### 8. 今後の改善候補
- [ ] 予約履歴のフィルター／検索をダッシュボードに追加。（期間フィルター付き一覧の挙動を随時確認）
- [ ] Playwright で承認→ダッシュボード反映のE2Eテストを自動化。
- [ ] 顧客へのリマインド完了をメトリクス化し、送信率を可視化。
