# 認証アーキテクチャ

## 現状の認証方式（2024年12月時点）

### 1. Admin API (`require_admin`)
- **方式**: Cookie セッション認証（優先）+ `X-Admin-Key` ヘッダー（後方互換）
- **用途**: 管理者向け API（プロフィール一括操作、予約管理など）
- **Cookie**: `osakamenesu_admin_session`（環境変数で上書き可能）
- **スコープ**: `admin`
- **フォールバック**: `X-Admin-Key` ヘッダー（将来的に廃止予定）

```
/api/admin/*  → require_admin (Cookie セッション優先、X-Admin-Key フォールバック)
```

### 2. Dashboard API (`require_dashboard_user`)
- **方式**: マジックリンク + Cookie セッション
- **用途**: 店舗スタッフ向けダッシュボード
- **Cookie**: `osakamenesu_dashboard_session`
- **スコープ**: `dashboard`

```
/api/dashboard/*  → require_dashboard_user (Cookie セッション)
```

### 3. Site API (`require_site_user`)
- **方式**: マジックリンク + Cookie セッション
- **用途**: 一般ユーザー向け機能（お気に入り、予約など）
- **Cookie**: `osakamenesu_site_session`
- **スコープ**: `site`

```
/api/site/favorites/*  → require_site_user (Cookie セッション)
```

## エンドポイント別認証一覧

| パス | 認証方式 | Dependency |
|------|----------|------------|
| `/api/admin/*` | Cookie (admin) / X-Admin-Key | `require_admin` |
| `/api/dashboard/shops/*` | Cookie (dashboard) | `require_dashboard_user` |
| `/api/dashboard/therapists/*` | Cookie (dashboard) | `require_dashboard_user` |
| `/api/dashboard/reservations/*` | Cookie (dashboard) | `require_dashboard_user` |
| `/api/dashboard/notifications/*` | Cookie (dashboard) | `require_dashboard_user` |
| `/api/dashboard/reviews/*` | Cookie (dashboard) | `require_dashboard_user` |
| `/api/dashboard/shifts/*` | Cookie (dashboard) | `require_dashboard_user` |
| `/api/site/favorites/*` | Cookie (site) | `require_site_user` |
| `/api/auth/*` | 認証不要（一部を除く） | - |

## セッションの仕組み

### マジックリンクフロー
1. `POST /api/auth/request-link` でメール送信
2. ユーザーがリンクをクリック
3. `POST /api/auth/verify` でトークン検証
4. `UserSession` レコード作成、Cookie にセッショントークン設定

### セッション管理
- **有効期限**: 7日間
- **スコープ分離**: dashboard/site で別 Cookie
- **失効**: `revoked_at` フィールドで管理

## 実装済みの変更（Issue #136）

### フロントエンド HTTP クライアント統合
- `apps/web/src/lib/http-clients.ts` に統一 HTTP クライアントを作成
  - `siteClient`: 一般ユーザー向け API
  - `dashboardClient`: ダッシュボード API
  - `authClient`: 認証 API
  - `createAdminClient()`: Admin API クライアントファクトリ
- 型安全な結果型: `ApiSuccessResult<T>` / `ApiErrorResult`
- CSRF トークン自動取得機能

### Admin 認証のデュアル方式対応
- `require_admin` が Cookie セッション認証を優先でサポート
- 後方互換のため `X-Admin-Key` ヘッダーも引き続き利用可能
- Cookie 名: `osakamenesu_admin_session`（`ADMIN_SESSION_COOKIE_NAME` で設定可能）

## 今後の計画

### X-Admin-Key 廃止
1. Admin ログイン UI を作成
2. 全 Admin クライアントを Cookie 認証に移行
3. X-Admin-Key を完全廃止

### 目標アーキテクチャ
```
全 API → Cookie セッション認証（スコープで分離）
  - admin スコープ: 管理者機能
  - dashboard スコープ: 店舗スタッフ機能
  - site スコープ: 一般ユーザー機能
```
