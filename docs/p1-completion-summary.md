# P1 deliverables summary（hold TTL / expire_holds / room_count）

P1は「hold（仮押さえ）/期限切れ確定/同時予約数（room_count）」を、最小差分で運用可能な形にすることを目的として進めた。
本番POSTはレート制限があるため、証跡/再現は原則STG（`docs/staging.md`）で行う。

## Slice1: hold（reserved/expired + idempotency）

- 追加エンドポイント: `POST /api/guest/reservations/hold`
- status:
  - `reserved`（hold）
  - `expired`（期限切れ確定）
- idempotency: `Idempotency-Key` ヘッダ必須（同key同payloadは同一予約を返す）

証跡:
- STG hold idempotency proof: `docs/staging.md` の「Hold idempotency proof（STG）」
  - https://github.com/yusaku0324/kakeru/pull/212#issuecomment-3652117628

## Slice2a: expire_holds（期限切れholdの確定）+ cron

- 追加エンドポイント: `POST /api/ops/reservations/expire_holds`
- auth: `Authorization: Bearer $OPS_TOKEN_*`（詳細は `docs/staging.md` の「expire_holds（STG/PROD）」）
- cron: `.github/workflows/expire_holds_cron.yml`（30分おき、mainのみ）

証跡:
- STG smoke evidence: `docs/staging.md` の「expire_holds（STG/PROD）」
- cron run URL（success例）: https://github.com/yusaku0324/kakeru/actions/runs/20248906693

## Slice2b: room_count（同時間帯の同時予約数制限）

- DB: `profiles.room_count`（default `1`）
- create/hold に同じ制約を適用（shop_id単位、セラピストをまたいでカウント）
- overlap判定（half-open）: `start_at < other.end_at && other.start_at < end_at`
- reject reason: `room_full`

STG room_full proof（v14）:
- shop_id: `afecc5ca-8024-4ee7-8aab-cabe4c3b4412`（room_count=1）
- start_at: `2025-12-17T10:00:00+09:00` / duration_minutes: `60`
- A: `POST /api/guest/reservations` → `status=confirmed` / id=`12e26c86-f845-4cd1-bd8f-acb98d5eed06`
- B: `POST /api/guest/reservations/hold` → `status=rejected` / `debug.rejected_reasons=["room_full"]`

## Key rejected reasons（運用でよく見るもの）

- `outside_business_hours`（P0）: 店舗の営業時間ルール外（`booking_hours`）
- `invalid_extension`（P0）: extensionがstep/max制約に違反
- `room_full`（P1 Slice2b）: `room_count` 超過
- `overlap_existing_reservation`（SoT）: 既存予約（reserved/pending/confirmed等）との重複

## How to verify（STG推奨）

- `docs/staging.md`:
  - Seed（A成功 / B outside_business_hours）
  - Hold idempotency proof（STG）
  - expire_holds（STG/PROD）+ cron
  - Room capacity（room_count）

## Sales note（短く）

- room_count=1がデフォルトなので、単独施術前提の店舗でも安全側で運用開始できる（多部屋店舗はroom_countを上げて対応可能）
- hold + expire_holds により「二重予約/放置hold」が運用上回収できる

