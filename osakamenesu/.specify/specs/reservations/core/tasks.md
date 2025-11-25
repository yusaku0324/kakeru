# タスク: 予約ドメイン core v1 実装（fail-soft 方針）

1. [P] Spec 反映とドキュメント
   - `.specify/specs/reservations/core/spec.md` と既存 `specs/reservations/core.yaml` の整合を確認し、必要なら YAML 側にステータス/締切/ダブルブッキング禁止の追記を検討。

2. モデル/マイグレーション整備
   - `services/api/app/models.py` の GuestReservation を確認し、欠けているフィールド（duration_minutes, payment_method, contact_info など）があれば追加。
   - 重複防止のユニーク制約 (therapist_id, start_at, end_at) を確認・追加。必要なら Alembic migration を作成。

3. バリデーション/ドメインロジック
   - `services/api/app/domains/site/guest_reservations.py` に以下の関数を追加・整理:
     - validate_request(payload): 必須項目の正規化と fail-soft 空返却判定
     - check_deadline(start_at): 締切判定
     - check_shift_and_overlap(therapist_id, start_at, end_at): シフト内判定＋重複判定
     - assign_for_free(shop_id, start_at, end_at): フリー/おまかせ用割当（暫定ロジックでも可）
   - 内部エラー時は空返却＋ログに統一。

4. エンドポイント実装
   - `POST /api/guest/reservations`: fail-soft で予約可否判定 → confirmed で返却、失敗は空/メッセージ（5xx 禁止）。
   - `POST /api/guest/reservations/{id}/cancel`: idempotent に cancelled を返す。存在しなければ 404。
   - `GET /api/guest/reservations/{id}`: 404 を適切に返す。

5. テスト追加（pytest）
   - `services/api/app/tests/test_guest_reservations.py` に以下を追加/更新:
     - 正常系: 指名予約がシフト内・重複なし・締切内で confirmed になる
     - 締切超過: 予約不可（空 or 4xx 明示、fail-soft優先）
     - 重複: 同一セラピスト同時間帯で予約できない
     - キャンセル: 二重キャンセルも cancelled を返す
     - フリー/おまかせ: 割当失敗時に予約確定しないが 5xx を返さない

6. E2E（必要なら）
   - Playwright で予約導線（簡易フォーム）をテストし、失敗時も UI が落ちないことを確認。
