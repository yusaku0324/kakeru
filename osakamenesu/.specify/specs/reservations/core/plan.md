# 技術設計: ゲスト予約エンジン v1

## 対応方針
- 憲法に従い fail-soft を優先（area/date 欠損や内部エラーは空応答/空配列）。
- 既存 GuestReservation モデル（services/api/app/models.py）をベースに不足フィールドがあれば拡張。
- API は FastAPI で domains/site/guest_reservations.py に集約（create/cancel/detail）。
- ダブルブッキング/シフト整合/締切判定をドメイン関数で分離し、エンドポイントは薄く保つ。
- データ欠損や未設定は 0.5/空で扱い、例外を投げない。

## DB/モデル設計（FastAPI + Postgres）
- テーブル: guest_reservations（既存 GuestReservation を流用/拡張）
  - id (PK, string/UUID)
  - shop_id (FK -> profiles/shops)
  - therapist_id (nullable FK -> therapists)
  - start_at (datetime, tz-aware)
  - end_at (datetime, tz-aware)
  - duration_minutes (int)
  - course_id (nullable)
  - price (numeric, nullable)
  - payment_method (nullable string)
  - contact_info (JSON, nullable)
  - guest_token (nullable string)
  - status (enum: draft/pending/confirmed/cancelled)
  - created_at/updated_at (timestamp)
  - unique constraint: (therapist_id, start_at, end_at) to prevent double booking
- マイグレーション: 既存フィールドとの差分のみ（必要時）。重複制約がなければ追加。

## API設計（domains/site/guest_reservations.py）
- POST /api/guest/reservations
  - 入力: spec の予約リクエスト。欠損は fail-soft（空/中立）でバリデーションする。
  - 判定: 締切チェック、シフト内判定、ダブルブッキングチェック、フリー/おまかせの場合の割当。
  - 成功: status=confirmed (v1) の予約を返す。
  - 失敗: 空レスポンスまたは 4xx（明確に不正な場合のみ）。例外は出さない。
- POST /api/guest/reservations/{id}/cancel
  - 入力: reservation_id, actor, reason(optional)。
  - 挙動: status を cancelled に更新。二重キャンセルは idempotent。
- GET /api/guest/reservations/{id}
  - 入力: reservation_id。
  - 挙動: 見つからなければ 404。fail-soft対象外（明示的に ID を指定しているため）。

## ドメインロジック配置
- services/api/app/domains/site/guest_reservations.py
  - validate_request(payload) -> 正規化と fail-soft判定（不足時は空応答）
  - check_deadline(start_at) -> 締切判定
  - check_shift_and_overlap(therapist_id, start_at, end_at) -> シフト内/重複判定
  - assign_for_free(shop_id, start_at, end_at) -> フリー/おまかせ割当
  - to_response(reservation, debug?) -> 必須フィールドを含むレスポンス整形
- services/api/app/models.py
  - GuestReservation に必要フィールド/制約がなければ追加（migration 付き）。

## バリデーション・fail-soft
- area/date などが欠ける → 200 + items[]=[]（検索系）。予約 API では必須不足は 4xx ではなくバリデーションエラーを最小限にしつつ空/メッセージ返却（憲法の fail-soft を優先）。
- 内部エラー: try/except で空返却、ログには残す（例外を UI に晒さない）。

## テスト計画
- 単体（pytest, services/api/app/tests/test_guest_reservations.py）
  - 正常系: 指名予約が確定する（重複なし/シフト内/締切内）
  - 重複: 同じセラピスト・重複枠で 409/拒否
  - 締切: 締切超過で拒否（空 or 4xx 明示）
  - キャンセル: idempotent に cancelled を返す
- E2E（必要なら Playwright）
  - 予約フォームから入力 → 成功レスポンスで UI が壊れない
  - 失敗時もページが落ちずメッセージ表示で継続
