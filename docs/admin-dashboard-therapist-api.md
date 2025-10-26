# Admin Dashboard – Therapist & Shop Editing API Design

- Issue: [#76](https://github.com/yusaku0324/kakeru/issues/76)
- Author: Codex (GPT-5)
- Date: 2025-10-21

## Objectives

- Give メンエス店舗の運用担当者 the ability to keep therapist profiles and core shop information up to date without依頼 to the開発 team.
- Separate general shop settings, menu構成, and therapist管理 so that UI can surface dedicated編集画面.
- Maintain完全な監査 trailと公開フロントの整合性 (Meili index, availability slots 等) while allowing self-serve editing.

## Current State

| Domain | 現状 | 課題 |
| --- | --- | --- |
| Shop profile | `profiles` table + `contact_json` blobs; admin endpoints (`/api/admin/shops`) と dashboard endpoints (`/api/dashboard/shops/{id}/profile`) allow全体更新 | 各項目を個別に更新する粒度がなく、`contact_json` 内の構造が暗黙的。並行編集検知は `updated_at` の比較のみ。 |
| Menu / Staff | JSON 配列 (`contact_json["menus"]`, `contact_json["staff"]`) に保存。ID は UUID 文字列だが DB 参照なし。 | セラピストの公開状態や表示順を個別管理できず、API からも部分更新しづらい。 |
| Availability | `availability.slots_json` に `staff_id` / `menu_id` が文字列で保存される。 | 参照整合性が保証されないため、スタッフ削除時の整合性崩壊リスクがある。 |
| Change log | `admin.py` 経由の操作のみ `AdminChangeLog` に記録。 | ダッシュボード側の操作は追跡されず、外部監査が難しい。 |

## Proposed Data Model Changes

1. **Therapist (新規テーブル)**
   - `id UUID PK`
   - `profile_id UUID FK -> profiles.id (CASCADE)`
   - `name VARCHAR(160) NOT NULL`
   - `alias VARCHAR(160)`
   - `headline TEXT`
   - `biography TEXT`
   - `specialties TEXT[]`
   - `experience_years SMALLINT`
   - `qualifications TEXT[]`
   - `photo_urls TEXT[]`
   - `display_order SMALLINT DEFAULT 0`
  - `status therapist_status_enum` (draft / published / archived)
   - `is_booking_enabled BOOLEAN DEFAULT TRUE`
   - `created_at`, `updated_at`

2. **TherapistMedia (option)**
   - Attach multiple photos / videos if必要 (if not, keep inside `photo_urls`).

3. **Profile contact_json deprecation**
   - Move `menus`, `staff`, `service_tags` out of the JSON blob.
   - Introduce `shop_menus` table (optional second stage) mirroring `Therapist`.
   - Keep `contact_json` for legacy fields but start migrating (phase 1 will read/write both).

4. **Availability slots**
   - Update `availability.slots_json` structure to store `staff_uuid` that references新 `therapists.id`.
   - Add migration to backfill existing slots by mapping old IDs (if they are valid UUID strings).

## API Surface (Dashboard)

### Shop Core

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/dashboard/shops/{shop_id}/profile` | GET | 現在の店舗情報（menus/staff を除く）取得 |
| `/api/dashboard/shops/{shop_id}/profile` | PUT | 既存と同様だが、`menus`/`staff` は除外。`business_hours`, `amenities`, `payment_methods`, `outlinks` を追加フィールドとして受付 |
| `/api/dashboard/shops/{shop_id}/contact` | PATCH | 電話・SNS・予約フォームなどの部分更新 |
| `/api/dashboard/shops/{shop_id}/location` | PATCH | 住所・緯度経度・最寄駅等を個別更新 |

### Menus (phase 2 if必要)

| Endpoint | Method | 説明 |
| --- | --- | --- |
| `/api/dashboard/shops/{shop_id}/menus` | GET | 一覧取得 |
| `/api/dashboard/shops/{shop_id}/menus` | POST | 新規メニュー追加 |
| `/api/dashboard/shops/{shop_id}/menus/{menu_id}` | PATCH | 更新 |
| `/api/dashboard/shops/{shop_id}/menus/{menu_id}` | DELETE | 論理削除 (status=archived) |

### Therapists

| Endpoint | Method | 説明 |
| --- | --- | --- |
| `/api/dashboard/shops/{shop_id}/therapists` | GET | スタッフ一覧 (フィルタ: status / keyword / booking_enabled) |
| `/api/dashboard/shops/{shop_id}/therapists` | POST | 新規作成 (draft で作成) |
| `/api/dashboard/shops/{shop_id}/therapists/{therapist_id}` | GET | 詳細取得 |
| `/api/dashboard/shops/{shop_id}/therapists/{therapist_id}` | PATCH | 項目更新 (名前、プロフィール、専門、写真、ステータスなど) |
| `/api/dashboard/shops/{shop_id}/therapists/{therapist_id}` | DELETE | アーカイブ (hard delete は管理者のみ) |
| `/api/dashboard/shops/{shop_id}/therapists/photos/upload` | POST | 画像ファイルのアップロード (FormData: `file`) |
| `/api/dashboard/shops/{shop_id}/therapists:reorder` | POST | `[{id, display_order}]` を受け取り order 更新 |
| `/api/dashboard/shops/{shop_id}/therapists/{therapist_id}/publish` | POST | ステータスを `published` / `draft` にトグル |

### Availability

- 既存 `/api/admin/shops/...` および `/api/dashboard/...` を改修し、`slots` で渡される `staff_id` を `therapist_id` として検証。
- Therapist が非公開になった際は該当スロットを `status="cancelled"` にするなど整合性ルールを追加。

### Audit / Permissions

- すべてのダッシュボードエンドポイントに `audit_admin` 相当のロギングを導入 (`DashboardChangeLog` 新設、もしくは `AdminChangeLog` を流用)。
- `require_user` で認証されたユーザーに対し、`dashboard_user_status` (pending/active/suspended) と `profile_id` に紐づく権限を確認する。
- Therapist 削除や公開ステータス変更は `active` ユーザーのみ許可。`pending` は閲覧のみ。

## Schema Samples

```jsonc
// POST /api/dashboard/shops/{shop_id}/therapists
{
  "name": "三上 ゆり",
  "alias": "Yuri",
  "headline": "極上オイル × 極癒し",
  "biography": "有名メンズエステで3年経験...",
  "specialties": ["ディープリンパ", "ヘッドスパ"],
  "experience_years": 3,
  "qualifications": ["メンズエステ協会認定セラピスト"],
  "photo_urls": ["https://cdn/.../yuri01.jpg"],
  "is_booking_enabled": true
}
```

```jsonc
// GET /api/dashboard/shops/{shop_id}/therapists レスポンス
{
  "items": [
    {
      "id": "1d3f...",
      "name": "三上 ゆり",
      "alias": "Yuri",
      "headline": "極上オイル × 極癒し",
      "status": "published",
      "display_order": 10,
      "photo_urls": ["https://..."],
      "specialties": ["ディープリンパ", "ヘッドスパ"],
      "is_booking_enabled": true,
      "updated_at": "2025-10-20T09:12:00Z"
    }
  ]
}
```

## Migration Strategy

1. **Phase 0 – Dual Write**
   - Introduce `therapists` table and API, but keep existing JSON fields for backward compatibility.
   - When dashboard updates occur, populate both `therapists` rows and `contact_json["staff"]`.
   - Add feature flag (`DASHBOARD_THERAPISTS_V2=true`) to gate new UI.

2. **Phase 1 – Read Prefer Table**
   - Update public and admin API serialization to read from `therapists` when flag enabled, fallback to JSON if empty.
   - Backfill existing JSON into `therapists` via migration script.

3. **Phase 2 – Remove JSON Staff**
   - Stop writing `contact_json["staff"]`, clean up obsolete keys through migration.
   - Adjust Availability migrations to reference `therapists.id`.

4. **Phase 3 – Menu & Availability parity**
   - Repeat same approach for menus if必要 (not blocking initial release).

## Testing Plan

- Unit tests for new schemas/validators (`app/tests/test_dashboard_therapists.py`).
- 写真アップロード API は `image/png` / `image/jpeg` / `image/webp` / `image/gif` のみ許可、最大 8MB。レスポンスの `url` を `photo_urls` に格納する。
- Integration tests hitting new endpoints with authenticated dashboard user, verifying DB persistence and indexing side effects.
- Regression tests ensuring existing `/shops/{id}/profile` responses remain backward compatible for old clients.
- Migration test scripts to verify JSON ↔ table sync and availability slot rewriting.

## Open Questions

- Should therapist写真を S3 等外部ストレージに移す際の署名 URL 発行を API で提供するか？
- Availability slots が大量の場合の `therapist` ステータス変更時のパフォーマンスはどう扱うか？ (非同期キューで処理する案)
- ダッシュボードユーザーごとの操作権限（複数店舗を跨ぐユーザー）は想定するか？ 今回は単一店舗前提で設計。

## Next Steps

1. ダッシュボード UI と連携した統合テストの整備。
2. Availability・予約周りでセラピスト ID を参照する処理のデータ整合性チェック。
3. Feature flag を用いた段階的リリース手順を `docs/operations.md` に追記。
