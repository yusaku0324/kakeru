# Osakamenesu API

Version: 1.0.0


# Osakamenesu API Documentation

大阪メンズエステ検索・予約プラットフォームのAPIドキュメントです。

## 概要

Osakamenesu APIは、メンズエステ店舗の検索、セラピスト情報の取得、予約管理などの機能を提供するRESTful APIです。

## 主な機能

### 🏪 店舗管理
- 店舗検索（エリア、駅、カテゴリー、料金帯）
- 店舗詳細情報の取得
- セラピスト一覧の取得

### 👩‍💼 セラピスト管理
- セラピスト詳細情報
- 空き状況確認
- 類似セラピスト検索

### 📅 予約管理
- 予約作成・確認・キャンセル
- 予約可能時間の確認
- 予約履歴の取得

### 🔐 認証・認可
- マジックリンク認証
- JWT トークンベース認証
- 管理者API認証

## 認証方法

### 1. ゲストユーザー（認証不要）
- 店舗検索
- セラピスト情報閲覧
- 空き状況確認

### 2. 認証済みユーザー
- Authorization: Bearer {token}
- 予約作成・管理
- お気に入り管理

### 3. 管理者API
- X-Admin-Key: {admin_key}
- 店舗・セラピスト管理
- システム管理

## レート制限

- ゲスト: 60リクエスト/分
- 認証済み: 300リクエスト/分
- 管理者: 無制限

## エラーレスポンス

すべてのエラーレスポンスは以下の形式で返されます：

```json
{
  "detail": "エラーメッセージ",
  "code": "ERROR_CODE"
}
```

## 環境

- Production: https://osakamenesu-api.fly.dev
- Staging: https://osakamenesu-api-stg.fly.dev


## Endpoints


### ADMIN_HTMX

#### GET /admin/htmx/dashboard
Dashboard

**Parameters:**

- `q` (query, optional): No description
- `X-Admin-Key` (header, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### GET /admin/htmx/dashboard/table
Dashboard Table

**Parameters:**

- `q` (query, optional): No description
- `X-Admin-Key` (header, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### GET /admin/htmx/static/{path}
Admin Htmx Static

**Parameters:**

- `path` (path, required): No description
- `X-Admin-Key` (header, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### GET /admin/htmx/shifts
Shifts Index

**Parameters:**

- `therapist_id` (query, optional): No description
- `date` (query, optional): No description
- `X-Admin-Key` (header, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /admin/htmx/shifts/rebuild
Shifts Rebuild

**Parameters:**

- `X-Admin-Key` (header, optional): No description

**Request Body:**

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


### ASYNC

#### GET /api/async/ping
Async Ping

**Responses:**

- `200`: Successful Response


#### POST /api/async/jobs
Enqueue Job

Legacy notification job endpoint - removed.

**Responses:**

- `202`: Successful Response


### AUTH
認証関連のエンドポイント


#### POST /api/auth/request-link
Request Link

**Request Body:**

See schema: #/components/schemas/AuthRequestLink

**Responses:**

- `202`: Successful Response
- `422`: Validation Error


#### POST /api/auth/verify
Verify Token

**Request Body:**

See schema: #/components/schemas/AuthVerifyRequest

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /api/auth/logout
Logout

**Responses:**

- `204`: Successful Response


#### GET /api/auth/session
Session Status

**Responses:**

- `200`: Successful Response


#### GET /api/auth/me
Get Me

**Responses:**

- `200`: Successful Response


#### GET /api/auth/me/site
Get Me Site

**Responses:**

- `200`: Successful Response


#### POST /api/auth/test-login
Test Login

**Parameters:**

- `X-Test-Auth-Secret` (header, optional): No description

**Request Body:**

See schema: #/components/schemas/AuthTestLoginRequest

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /api/auth/line/login-url
Line Login Url

Generate LINE OAuth authorization URL.

Returns a URL that the client should redirect the user to for LINE authentication.

**Request Body:**

See schema: #/components/schemas/LineLoginUrlRequest

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /api/auth/line/callback
Line Callback

Handle LINE OAuth callback.

Exchanges authorization code for access token, fetches user profile,
and creates/updates user session.

**Request Body:**

See schema: #/components/schemas/LineCallbackRequest

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### GET /api/auth/line/status
Line Connection Status

Get LINE connection status for the current user.

**Responses:**

- `200`: Successful Response


#### POST /api/auth/google/login-url
Google Login Url

Generate Google OAuth authorization URL.

Returns a URL that the client should redirect the user to for Google authentication.

**Request Body:**

See schema: #/components/schemas/GoogleLoginUrlRequest

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /api/auth/google/callback
Google Callback

Handle Google OAuth callback.

Exchanges authorization code for access token, fetches user profile,
and creates/updates user session.

**Request Body:**

See schema: #/components/schemas/GoogleCallbackRequest

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### GET /api/auth/google/status
Google Connection Status

Get Google connection status for the current user.

**Responses:**

- `200`: Successful Response


### DASHBOARD
ダッシュボード（管理画面）のエンドポイント


#### GET /api/dashboard/shops/{profile_id}/notifications
Get Dashboard Notifications

**Parameters:**

- `profile_id` (path, required): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### PUT /api/dashboard/shops/{profile_id}/notifications
Update Dashboard Notifications

**Parameters:**

- `profile_id` (path, required): No description

**Request Body:**

See schema: #/components/schemas/DashboardNotificationSettingsUpdatePayload

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /api/dashboard/shops/{profile_id}/notifications/test
Test Dashboard Notifications

**Parameters:**

- `profile_id` (path, required): No description

**Request Body:**

See schema: #/components/schemas/DashboardNotificationSettingsTestPayload

**Responses:**

- `204`: Successful Response
- `422`: Validation Error


#### GET /api/dashboard/shops/{profile_id}/reservations
List Dashboard Reservations

List GuestReservations for a shop (dashboard view).

**Parameters:**

- `profile_id` (path, required): No description
- `status` (query, optional): No description
- `sort` (query, optional): No description
- `direction` (query, optional): No description
- `q` (query, optional): No description
- `start` (query, optional): No description
- `end` (query, optional): No description
- `mode` (query, optional): No description
- `cursor` (query, optional): No description
- `cursor_direction` (query, optional): No description
- `limit` (query, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### PATCH /api/dashboard/shops/{profile_id}/reservations/{reservation_id}
Update Dashboard Reservation

Update a GuestReservation status from the dashboard.

**Parameters:**

- `profile_id` (path, required): No description
- `reservation_id` (path, required): No description

**Request Body:**

See schema: #/components/schemas/DashboardReservationUpdateRequest

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### GET /api/dashboard/shops
List Dashboard Shops

**Parameters:**

- `limit` (query, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /api/dashboard/shops
Create Dashboard Shop Profile

**Request Body:**

See schema: #/components/schemas/DashboardShopProfileCreatePayload

**Responses:**

- `201`: Successful Response
- `422`: Validation Error


#### GET /api/dashboard/shops/{profile_id}/profile
Get Dashboard Shop Profile

**Parameters:**

- `profile_id` (path, required): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### PUT /api/dashboard/shops/{profile_id}/profile
Update Dashboard Shop Profile

**Parameters:**

- `profile_id` (path, required): No description

**Request Body:**

See schema: #/components/schemas/DashboardShopProfileUpdatePayload

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /api/dashboard/shops/{profile_id}/photos/upload
Upload Shop Photo

**Parameters:**

- `profile_id` (path, required): No description

**Request Body:**

**Responses:**

- `201`: Successful Response
- `422`: Validation Error


### DASHBOARD-MANAGERS

#### GET /api/dashboard/shops/{shop_id}/managers
List Shop Managers

List all managers for a shop.

**Parameters:**

- `shop_id` (path, required): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /api/dashboard/shops/{shop_id}/managers
Add Shop Manager

Add a new manager to a shop. Only owners can add managers.

**Parameters:**

- `shop_id` (path, required): No description

**Request Body:**

See schema: #/components/schemas/AddShopManagerRequest

**Responses:**

- `201`: Successful Response
- `422`: Validation Error


#### PATCH /api/dashboard/shops/{shop_id}/managers/{manager_id}
Update Shop Manager

Update a manager's role. Only owners can update managers.

**Parameters:**

- `shop_id` (path, required): No description
- `manager_id` (path, required): No description

**Request Body:**

See schema: #/components/schemas/UpdateShopManagerRequest

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### DELETE /api/dashboard/shops/{shop_id}/managers/{manager_id}
Delete Shop Manager

Remove a manager from a shop. Only owners can remove managers.

**Parameters:**

- `shop_id` (path, required): No description
- `manager_id` (path, required): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


### DASHBOARD-REVIEWS

#### GET /api/dashboard/shops/{profile_id}/reviews
List Shop Reviews

List reviews for a specific shop with optional status filter.

**Parameters:**

- `profile_id` (path, required): No description
- `status_filter` (query, optional): No description
- `page` (query, optional): No description
- `page_size` (query, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### GET /api/dashboard/shops/{profile_id}/reviews/stats
Get Shop Review Stats

Get review statistics for a shop.

**Parameters:**

- `profile_id` (path, required): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### GET /api/dashboard/shops/{profile_id}/reviews/{review_id}
Get Shop Review

Get a single review detail for a shop.

**Parameters:**

- `profile_id` (path, required): No description
- `review_id` (path, required): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### PUT /api/dashboard/shops/{profile_id}/reviews/{review_id}/status
Update Shop Review Status

Update the status of a review (moderate: approve/reject).

**Parameters:**

- `profile_id` (path, required): No description
- `review_id` (path, required): No description

**Request Body:**

See schema: #/components/schemas/ReviewModerationRequest

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


### DASHBOARD-SHIFTS

#### GET /api/dashboard/shops/{profile_id}/shifts
List Shifts

**Parameters:**

- `profile_id` (path, required): No description
- `therapist_id` (query, optional): No description
- `date_from` (query, optional): No description
- `date_to` (query, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /api/dashboard/shops/{profile_id}/shifts
Create Shift

**Parameters:**

- `profile_id` (path, required): No description

**Request Body:**

See schema: #/components/schemas/ShiftCreatePayload

**Responses:**

- `201`: Successful Response
- `422`: Validation Error


#### GET /api/dashboard/shops/{profile_id}/shifts/{shift_id}
Get Shift

**Parameters:**

- `profile_id` (path, required): No description
- `shift_id` (path, required): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### PATCH /api/dashboard/shops/{profile_id}/shifts/{shift_id}
Update Shift

**Parameters:**

- `profile_id` (path, required): No description
- `shift_id` (path, required): No description
- `force` (query, optional): 予約がはみ出しても強制更新する

**Request Body:**

See schema: #/components/schemas/ShiftUpdatePayload

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### DELETE /api/dashboard/shops/{profile_id}/shifts/{shift_id}
Delete Shift

**Parameters:**

- `profile_id` (path, required): No description
- `shift_id` (path, required): No description
- `force` (query, optional): 予約があっても強制削除する

**Responses:**

- `204`: Successful Response
- `422`: Validation Error


### DASHBOARD-THERAPISTS

#### GET /api/dashboard/shops/{profile_id}/therapists
List Dashboard Therapists

**Parameters:**

- `profile_id` (path, required): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /api/dashboard/shops/{profile_id}/therapists
Create Dashboard Therapist

**Parameters:**

- `profile_id` (path, required): No description

**Request Body:**

See schema: #/components/schemas/DashboardTherapistCreatePayload

**Responses:**

- `201`: Successful Response
- `422`: Validation Error


#### GET /api/dashboard/shops/{profile_id}/therapists/{therapist_id}
Get Dashboard Therapist

**Parameters:**

- `profile_id` (path, required): No description
- `therapist_id` (path, required): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### PATCH /api/dashboard/shops/{profile_id}/therapists/{therapist_id}
Update Dashboard Therapist

**Parameters:**

- `profile_id` (path, required): No description
- `therapist_id` (path, required): No description

**Request Body:**

See schema: #/components/schemas/DashboardTherapistUpdatePayload

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### DELETE /api/dashboard/shops/{profile_id}/therapists/{therapist_id}
Delete Dashboard Therapist

**Parameters:**

- `profile_id` (path, required): No description
- `therapist_id` (path, required): No description

**Responses:**

- `204`: Successful Response
- `422`: Validation Error


#### POST /api/dashboard/shops/{profile_id}/therapists/photos/upload
Upload Dashboard Therapist Photo

**Parameters:**

- `profile_id` (path, required): No description

**Request Body:**

**Responses:**

- `201`: Successful Response
- `422`: Validation Error


#### POST /api/dashboard/shops/{profile_id}/therapists:reorder
Reorder Dashboard Therapists

**Parameters:**

- `profile_id` (path, required): No description

**Request Body:**

See schema: #/components/schemas/DashboardTherapistReorderPayload

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


### FAVORITES

#### GET /api/favorites
List Favorites

**Responses:**

- `200`: Successful Response


#### POST /api/favorites
Add Favorite

**Request Body:**

See schema: #/components/schemas/FavoriteCreate

**Responses:**

- `201`: Successful Response
- `422`: Validation Error


#### DELETE /api/favorites/{shop_id}
Remove Favorite

**Parameters:**

- `shop_id` (path, required): No description

**Responses:**

- `204`: Successful Response
- `422`: Validation Error


#### GET /api/favorites/therapists
List Therapist Favorites

**Responses:**

- `200`: Successful Response


#### POST /api/favorites/therapists
Add Therapist Favorite

**Request Body:**

See schema: #/components/schemas/TherapistFavoriteCreate

**Responses:**

- `201`: Successful Response
- `422`: Validation Error


#### DELETE /api/favorites/therapists/{therapist_id}
Remove Therapist Favorite

**Parameters:**

- `therapist_id` (path, required): No description

**Responses:**

- `204`: Successful Response
- `422`: Validation Error


### GUEST-MATCHING

#### POST /api/guest/matching/search
Guest Matching Search

v1: 既存ショップ検索をラップし、簡易スコアリングして返却。
現状はタグ不足のため雰囲気系タグは空（0.5のニュートラル）で計算。

**Parameters:**

- `area` (query, optional): No description
- `date` (query, optional): No description
- `time_from` (query, optional): No description
- `time_to` (query, optional): No description
- `budget_level` (query, optional): No description
- `free_text` (query, optional): No description
- `guest_token` (query, optional): No description
- `price_rank_min` (query, optional): No description
- `price_rank_max` (query, optional): No description
- `age_min` (query, optional): No description
- `age_max` (query, optional): No description
- `base_staff_id` (query, optional): No description
- `sort` (query, optional): No description
- `limit` (query, optional): No description
- `offset` (query, optional): No description
- `phase` (query, optional): No description
- `step_index` (query, optional): No description
- `entry_source` (query, optional): No description

**Request Body:**

See schema: #/components/schemas/Body_guest_matching_search_api_guest_matching_search_post

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### GET /api/guest/matching/search
Guest Matching Search

v1: 既存ショップ検索をラップし、簡易スコアリングして返却。
現状はタグ不足のため雰囲気系タグは空（0.5のニュートラル）で計算。

**Parameters:**

- `area` (query, optional): No description
- `date` (query, optional): No description
- `time_from` (query, optional): No description
- `time_to` (query, optional): No description
- `budget_level` (query, optional): No description
- `free_text` (query, optional): No description
- `guest_token` (query, optional): No description
- `price_rank_min` (query, optional): No description
- `price_rank_max` (query, optional): No description
- `age_min` (query, optional): No description
- `age_max` (query, optional): No description
- `base_staff_id` (query, optional): No description
- `sort` (query, optional): No description
- `limit` (query, optional): No description
- `offset` (query, optional): No description
- `phase` (query, optional): No description
- `step_index` (query, optional): No description
- `entry_source` (query, optional): No description

**Request Body:**

See schema: #/components/schemas/Body_guest_matching_search_api_guest_matching_search_get

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### GET /api/guest/matching/similar
Guest Matching Similar

**Parameters:**

- `staff_id` (query, optional): Base staff/therapist id (alias: therapist_id)
- `therapist_id` (query, optional): Deprecated alias for staff_id
- `limit` (query, optional): Maximum similar candidates to return
- `shop_id` (query, optional): If set, restricts search to this shop/profile
- `exclude_unavailable` (query, optional): Exclude therapists with no availability
- `min_score` (query, optional): Drop candidates below this score

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


### GUEST-RESERVATIONS

#### POST /api/guest/reservations
Create Guest Reservation Api

**Request Body:**

See schema: #/components/schemas/GuestReservationPayload

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### GET /api/guest/reservations
List Guest Reservations Api

**Parameters:**

- `guest_token` (query, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /api/guest/reservations/hold
Hold Guest Reservation Api

**Parameters:**

- `Idempotency-Key` (header, required): No description

**Request Body:**

See schema: #/components/schemas/GuestReservationHoldPayload

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /api/guest/reservations/{reservation_id}/cancel
Cancel Guest Reservation Api

**Parameters:**

- `reservation_id` (path, required): No description
- `guest_token` (query, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### GET /api/guest/reservations/{reservation_id}
Get Guest Reservation Api

**Parameters:**

- `reservation_id` (path, required): No description
- `guest_token` (query, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


### GUEST-THERAPIST-AVAILABILITY

#### GET /api/guest/therapists/{therapist_id}/availability_summary
Get Availability Summary Api

**Parameters:**

- `therapist_id` (path, required): No description
- `date_from` (query, required): inclusive YYYY-MM-DD
- `date_to` (query, required): inclusive YYYY-MM-DD

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### GET /api/guest/therapists/{therapist_id}/availability_slots
Get Availability Slots Api

**Parameters:**

- `therapist_id` (path, required): No description
- `date` (query, required): target YYYY-MM-DD

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### GET /api/guest/therapists/{therapist_id}/verify_slot
Verify Slot Api

予約前にスロットの最新状態を検証する。

- 200: スロットが予約可能
- 409: スロットが予約不可（他の予約が入った等）

**Parameters:**

- `therapist_id` (path, required): No description
- `start_at` (query, required): Slot start time (ISO format)

**Responses:**

- `200`: Successful Response
- `409`: Slot is no longer available
- `422`: Validation Error


### LINE

#### POST /api/line/webhook
Line Webhook

**Responses:**

- `204`: Successful Response


#### GET /api/line/ping
Line Ping

**Responses:**

- `200`: Successful Response


### OPS
運用・監視のエンドポイント


#### GET /api/ops/queue
Get Ops Queue

**Parameters:**

- `Authorization` (header, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### GET /api/ops/outbox
Get Ops Outbox

**Parameters:**

- `Authorization` (header, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### GET /api/ops/slots
Get Ops Slots

**Parameters:**

- `Authorization` (header, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /api/ops/reservations/expire_holds
Expire Holds

**Parameters:**

- `Authorization` (header, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /api/ops/stamp
Stamp Migration

Stamp the database with a specific alembic revision without running migrations.

Use this to mark the database as being at a specific migration version
when the actual schema is already in sync but alembic_version is missing.

**Parameters:**

- `Authorization` (header, optional): No description

**Request Body:**

See schema: #/components/schemas/StampRequest

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /api/ops/migrate
Run Migrations

Run alembic database migrations.

This endpoint runs 'alembic upgrade head' to apply any pending migrations.
Protected by the ops_api_token.

**Parameters:**

- `Authorization` (header, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### GET /api/ops/health/backup
Backup Health Check

Check the health of database backups.

Returns unhealthy if:
- No backups found
- Latest backup is older than 48 hours
- Cannot access backup storage

**Parameters:**

- `Authorization` (header, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### GET /api/ops/cache/metrics
Get Cache Metrics

Get cache performance metrics.

**Parameters:**

- `Authorization` (header, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### GET /api/ops/cache/metrics
Get Cache Metrics

Get cache performance metrics.

**Parameters:**

- `Authorization` (header, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /api/ops/cache/clear
Clear Caches

Clear cache(s).

Args:
    cache_type: Which caches to clear ("all", "memory", "redis", or specific cache name)

**Parameters:**

- `cache_type` (query, optional): No description
- `Authorization` (header, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /api/ops/cache/clear
Clear Caches

Clear cache(s).

Args:
    cache_type: Which caches to clear ("all", "memory", "redis", or specific cache name)

**Parameters:**

- `cache_type` (query, optional): No description
- `Authorization` (header, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /api/ops/cache/warm
Warm Cache

Warm up cache by pre-loading common data.

Args:
    cache_type: Which cache to warm ("shops", "therapists", or "all")

**Parameters:**

- `cache_type` (query, optional): No description
- `Authorization` (header, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /api/ops/cache/warm
Warm Cache

Warm up cache by pre-loading common data.

Args:
    cache_type: Which cache to warm ("shops", "therapists", or "all")

**Parameters:**

- `cache_type` (query, optional): No description
- `Authorization` (header, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


### OTHER

#### GET /healthz
Healthz

**Responses:**

- `200`: Successful Response


#### GET /health
Health

Health check endpoint with DB connectivity check.

**Responses:**

- `200`: Successful Response


#### GET /api/out/{token}
Out Redirect

Resolve outlink token from DB and redirect. Optionally logs a click.

**Parameters:**

- `token` (path, required): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /api/admin/profiles
Create profile (seed)

**Parameters:**

- `skip_index` (query, optional): Skip immediate Meili indexing
- `X-Admin-Key` (header, optional): No description

**Request Body:**

See schema: #/components/schemas/ProfileCreate

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### GET /api/profiles/search
Search Profiles

**Parameters:**

- `q` (query, optional): No description
- `area` (query, optional): No description
- `station` (query, optional): No description
- `bust` (query, optional): No description
- `service` (query, optional): No description
- `body` (query, optional): No description
- `page` (query, optional): No description
- `page_size` (query, optional): No description
- `today` (query, optional): No description
- `price_min` (query, optional): No description
- `price_max` (query, optional): No description
- `sort` (query, optional): No description
- `status` (query, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### GET /api/profiles/{profile_id}
Get profile detail

**Parameters:**

- `profile_id` (path, required): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### DELETE /api/admin/profiles/{profile_id}
Delete profile

Delete a profile and all related data (therapists, shifts, etc.).

**Parameters:**

- `profile_id` (path, required): No description
- `X-Admin-Key` (header, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /api/admin/seed/cleanup
Cleanup seed data

Delete all profiles matching the name pattern (for seed cleanup).

**Parameters:**

- `name_pattern` (query, optional): Delete profiles with names containing this pattern
- `X-Admin-Key` (header, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /api/admin/profiles/{profile_id}/reindex
Reindex single profile

**Parameters:**

- `profile_id` (path, required): No description
- `X-Admin-Key` (header, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /api/admin/reindex
Reindex all published profiles

**Parameters:**

- `purge` (query, optional): No description
- `X-Admin-Key` (header, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /api/admin/availabilities
Create availability (seed)

**Parameters:**

- `profile_id` (query, required): No description
- `date` (query, required): No description
- `X-Admin-Key` (header, optional): No description

**Request Body:**

```json
{
  "anyOf": [
    {
      "type": "object",
      "additionalProperties": true
    },
    {
      "type": "null"
    }
  ],
  "title": "Slots Json"
}
```

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /api/admin/availabilities/bulk
Create availabilities from JSON

**Parameters:**

- `X-Admin-Key` (header, optional): No description

**Request Body:**

```json
{
  "type": "array",
  "items": {
    "$ref": "#/components/schemas/AvailabilityCreate"
  },
  "title": "Payload"
}
```

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /api/admin/outlinks
Create outlink (seed)

**Parameters:**

- `profile_id` (query, required): No description
- `kind` (query, required): No description
- `token` (query, required): No description
- `target_url` (query, required): No description
- `X-Admin-Key` (header, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /api/admin/profiles/{profile_id}/marketing
Update marketing metadata

**Parameters:**

- `profile_id` (path, required): No description
- `X-Admin-Key` (header, optional): No description

**Request Body:**

See schema: #/components/schemas/ProfileMarketingUpdate

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### GET /api/admin/shops
List Shops

**Parameters:**

- `X-Admin-Key` (header, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /api/admin/shops
Create Shop

**Parameters:**

- `X-Admin-Key` (header, optional): No description

**Request Body:**

See schema: #/components/schemas/ShopPayload

**Responses:**

- `201`: Successful Response
- `422`: Validation Error


#### GET /api/admin/shops/{shop_id}
Get Shop

Get a specific shop by ID.

**Parameters:**

- `shop_id` (path, required): No description
- `X-Admin-Key` (header, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### GET /api/admin/shops/{shop_id}/availability
Get availability calendar

**Parameters:**

- `shop_id` (path, required): No description
- `start_date` (query, optional): No description
- `end_date` (query, optional): No description
- `X-Admin-Key` (header, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### PUT /api/admin/shops/{shop_id}/availability
Upsert availability

**Parameters:**

- `shop_id` (path, required): No description
- `X-Admin-Key` (header, optional): No description

**Request Body:**

See schema: #/components/schemas/AvailabilityUpsert

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### PATCH /api/admin/shops/{shop_id}/content
Update shop content

**Parameters:**

- `shop_id` (path, required): No description
- `X-Admin-Key` (header, optional): No description

**Request Body:**

See schema: #/components/schemas/ShopContentUpdate

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /api/admin/shops/content:bulk
Bulk ingest shop content

**Parameters:**

- `X-Admin-Key` (header, optional): No description

**Request Body:**

See schema: #/components/schemas/BulkShopContentRequest

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### GET /api/admin/reviews
List reviews

**Parameters:**

- `status` (query, optional): No description
- `page` (query, optional): No description
- `page_size` (query, optional): No description
- `X-Admin-Key` (header, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### PATCH /api/admin/reviews/{review_id}
Update review status

**Parameters:**

- `review_id` (path, required): No description
- `X-Admin-Key` (header, optional): No description

**Request Body:**

See schema: #/components/schemas/ReviewModerationRequest

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### GET /api/admin/therapist_shifts
List Shifts

**Parameters:**

- `therapist_id` (query, optional): No description
- `date` (query, optional): No description
- `page` (query, optional): No description
- `limit` (query, optional): No description
- `X-Admin-Key` (header, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /api/admin/therapist_shifts
Create Shift

**Parameters:**

- `X-Admin-Key` (header, optional): No description

**Request Body:**

See schema: #/components/schemas/TherapistShiftPayload

**Responses:**

- `201`: Successful Response
- `422`: Validation Error


#### PUT /api/admin/therapist_shifts/{shift_id}
Update Shift

**Parameters:**

- `shift_id` (path, required): No description
- `force` (query, optional): 予約がはみ出しても強制更新する
- `X-Admin-Key` (header, optional): No description

**Request Body:**

See schema: #/components/schemas/TherapistShiftPayload

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### DELETE /api/admin/therapist_shifts/{shift_id}
Delete Shift

**Parameters:**

- `shift_id` (path, required): No description
- `force` (query, optional): 予約があっても強制削除する
- `X-Admin-Key` (header, optional): No description

**Responses:**

- `204`: Successful Response
- `422`: Validation Error


#### PATCH /api/admin/shops/{shop_id}/buffer
Update Shop Buffer

Update buffer minutes for a shop.

**Parameters:**

- `shop_id` (path, required): No description
- `X-Admin-Key` (header, optional): No description

**Request Body:**

See schema: #/components/schemas/UpdateBufferMinutesPayload

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### GET /api/admin/guest_reservations
List Guest Reservations

**Parameters:**

- `shop_id` (query, optional): No description
- `date_from` (query, optional): No description
- `date_to` (query, optional): No description
- `page` (query, optional): No description
- `limit` (query, optional): No description
- `X-Admin-Key` (header, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### GET /api/admin/guest_reservations/{reservation_id}
Get Guest Reservation Detail

**Parameters:**

- `reservation_id` (path, required): No description
- `X-Admin-Key` (header, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /api/admin/guest_reservations/{reservation_id}/status
Update Guest Reservation Status Api

**Parameters:**

- `reservation_id` (path, required): No description
- `X-Admin-Key` (header, optional): No description

**Request Body:**

See schema: #/components/schemas/AdminGuestReservationStatusPayload

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### GET /api/admin/therapists
List Therapists

**Parameters:**

- `shop_id` (query, optional): No description
- `X-Admin-Key` (header, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /api/admin/therapists
Create Therapist

**Parameters:**

- `X-Admin-Key` (header, optional): No description

**Request Body:**

See schema: #/components/schemas/TherapistPayload

**Responses:**

- `201`: Successful Response
- `422`: Validation Error


#### PATCH /api/admin/therapists/{therapist_id}
Update Therapist

Update therapist fields.

**Parameters:**

- `therapist_id` (path, required): No description
- `X-Admin-Key` (header, optional): No description

**Request Body:**

See schema: #/components/schemas/TherapistUpdatePayload

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /api/admin/therapists/embeddings/generate
Generate Photo Embeddings

Generate or regenerate photo embeddings for therapists.

This endpoint allows administrators to generate embeddings for:
- All therapists without embeddings (default)
- Specific therapist IDs
- Force regeneration of existing embeddings

**Parameters:**

- `X-Admin-Key` (header, optional): No description

**Request Body:**

See schema: #/components/schemas/EmbeddingGenerateRequest

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### GET /api/admin/therapists/{therapist_id}/embedding
Get Therapist Embedding Status

Get embedding status for a specific therapist.

**Parameters:**

- `therapist_id` (path, required): No description
- `X-Admin-Key` (header, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /api/admin/therapists/embeddings/batch
Start Batch Embedding Computation

Start batch computation of photo embeddings in the background.

This endpoint triggers a background task to compute embeddings for
all therapists without embeddings. The task runs asynchronously.

**Parameters:**

- `X-Admin-Key` (header, optional): No description

**Request Body:**

See schema: #/components/schemas/BatchEmbeddingRequest

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### GET /api/admin/shops/{shop_id}/dashboard
Shop Dashboard

**Parameters:**

- `shop_id` (path, required): No description
- `X-Admin-Key` (header, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


### PUSH

#### POST /api/push/subscribe
Subscribe To Push

Subscribe to push notifications.

Args:
    subscription: Push subscription information from browser
    current_user: Current authenticated user
    db: Database session

Returns:
    Success response

**Request Body:**

See schema: #/components/schemas/PushSubscriptionRequest

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /api/push/unsubscribe
Unsubscribe From Push

Unsubscribe from push notifications.

Args:
    subscription: Push subscription information
    current_user: Current authenticated user
    db: Database session

Returns:
    Success response

**Request Body:**

See schema: #/components/schemas/PushSubscriptionRequest

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /api/push/test
Send Test Notification

Send a test push notification.

Args:
    request: Test notification details
    current_user: Current authenticated user
    db: Database session

Returns:
    Success response

**Request Body:**

See schema: #/components/schemas/TestNotificationRequest

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### GET /api/push/vapid-key
Get Vapid Public Key

Get VAPID public key for push notifications.

Returns:
    VAPID public key

**Responses:**

- `200`: Successful Response


### SHOPS
店舗関連のエンドポイント


#### GET /api/v1/shops
Search Shops

**Parameters:**

- `q` (query, optional): Free text query
- `area` (query, optional): Area code filter
- `station` (query, optional): Nearest station filter
- `category` (query, optional): Service category
- `service_tags` (query, optional): Comma separated service tags
- `price_min` (query, optional): No description
- `price_max` (query, optional): No description
- `available_date` (query, optional): Required availability date
- `open_now` (query, optional): No description
- `today` (query, optional): Alias for open_now
- `price_band` (query, optional): Comma separated price band keys
- `ranking_badges_param` (query, optional): Comma separated ranking badge keys
- `promotions_only` (query, optional): Filter shops with promotions
- `discounts_only` (query, optional): Filter shops with discounts
- `diaries_only` (query, optional): Filter shops with published diaries
- `bust_min` (query, optional): Lower bound bust tag (A-Z)
- `bust_max` (query, optional): Upper bound bust tag (A-Z)
- `age_min` (query, optional): No description
- `age_max` (query, optional): No description
- `height_min` (query, optional): No description
- `height_max` (query, optional): No description
- `hair_color` (query, optional): Hair color tag
- `hair_style` (query, optional): Hair style tag
- `body_shape` (query, optional): Body shape tag
- `sort` (query, optional): No description
- `page` (query, optional): No description
- `page_size` (query, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### GET /api/v1/shops/{shop_id}
Get Shop Detail

**Parameters:**

- `shop_id` (path, required): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### GET /api/v1/shops/{shop_id}/diaries
List Shop Diaries

**Parameters:**

- `shop_id` (path, required): No description
- `page` (query, optional): No description
- `page_size` (query, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### GET /api/v1/shops/{shop_id}/availability
Get Shop Availability

**Parameters:**

- `shop_id` (path, required): No description
- `date_from` (query, optional): No description
- `date_to` (query, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### GET /api/v1/shops/{shop_id}/reviews
List Shop Reviews

**Parameters:**

- `shop_id` (path, required): No description
- `page` (query, optional): No description
- `page_size` (query, optional): No description
- `sort_by` (query, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### POST /api/v1/shops/{shop_id}/reviews
Create Shop Review

**Parameters:**

- `shop_id` (path, required): No description

**Request Body:**

See schema: #/components/schemas/ReviewCreateRequest

**Responses:**

- `201`: Successful Response
- `422`: Validation Error


#### GET /api/v1/shops/{shop_id}/therapists
List Shop Therapists

List therapists for a shop with optional availability.

Returns published therapists with their tags, photos, and availability slots.
Useful for shop detail pages where users want to see available therapists.

**Parameters:**

- `shop_id` (path, required): No description
- `include_availability` (query, optional): Include availability slots
- `availability_days` (query, optional): Days of availability to fetch
- `page` (query, optional): No description
- `page_size` (query, optional): No description

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


### THERAPISTS
セラピスト関連のエンドポイント


#### GET /api/v1/therapists/{therapist_id}
Get Therapist Detail

Get therapist detail with shop info and availability.

Query Parameters:
    - shop_slug: Optional. Verify therapist belongs to this shop.
    - entry_source: Track where user came from (shop_page, search, direct).
    - days: Number of days to fetch availability (default 7).
    - slot_granularity_minutes: Granularity of slots (default 30).

Error Codes:
    - therapist_not_found: Therapist ID does not exist.
    - shop_slug_mismatch: Therapist does not belong to specified shop.

**Parameters:**

- `therapist_id` (path, required): No description
- `shop_slug` (query, optional): Shop slug to verify affiliation
- `entry_source` (query, optional): Entry source for tracking
- `days` (query, optional): Number of days for availability
- `slot_granularity_minutes` (query, optional): Slot granularity in minutes

**Responses:**

- `200`: Successful Response
- `422`: Validation Error


#### GET /api/v1/therapists/{therapist_id}/similar
Get Similar Therapists

Get similar therapists based on tag similarity.

Returns therapists similar to the given therapist, sorted by similarity score.
Includes availability information for today.

Query Parameters:
    - limit: Number of similar therapists to return (default 6, max 20).

Error Codes:
    - therapist_not_found: Therapist ID does not exist or is not published.

**Parameters:**

- `therapist_id` (path, required): No description
- `limit` (query, optional): Number of similar therapists to return

**Responses:**

- `200`: Successful Response
- `422`: Validation Error

