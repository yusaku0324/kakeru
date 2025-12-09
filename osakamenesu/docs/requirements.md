# 大阪メンエス.com 要件定義（現状把握）

## 1. プロジェクト概要

- **目的**: 大阪・関西エリアのメンズエステ店舗情報を収集・精査し、利用者が写真・料金・在籍情報を比較した上で予約依頼できる体験を提供する。
- **開発範囲**: Next.js ベースのフロントサイトと FastAPI + PostgreSQL + Meilisearch を用いた API ベースのバックエンド。Docker Compose でローカル一式を起動可能。
- **リリース想定**: MVP 段階。検索・詳細・予約リクエスト・掲載運用フローまで実装済み。

## 2. 想定ユーザーとユースケース

| 区分 | ユーザー像 | 主な目的 |
| --- | --- | --- |
| エンドユーザー | メンズエステ利用を検討する一般ユーザー | 条件検索 → 店舗比較 → 予約連絡 |
| 店舗運営者 | 掲載店舗の担当者 | 掲載/広告相談、マーケティング情報の更新依頼 |
| 運営チーム | サイトの編集/開発メンバー | 店舗データ投入、日記・レビュー管理、検索精度調整 |

## 3. 機能要件

### 3.1 フロントサイト（Next.js）

- **トップページ** (`apps/web/src/app/page.tsx:74`)
  - ヒーローセクションでサービス価値を訴求、CTA で「検索」「掲載相談」へ導線。
  - 編集部おすすめのクイック検索カード、エリア別リンク、初回ユーザー向けガイドを表示。
- **検索 UI** (`apps/web/src/components/SearchFilters.tsx:15`)
  - キーワード・エリア・サービス形態・タグ・本日出勤・料金下限/上限・並び順を指定可能。
  - 選択中条件のサマリー表示、条件クリアボタン、ローカルストレージで前回条件を復元。
- **検索結果ページ** (`apps/web/src/app/search/page.tsx`)
  - Meilisearch の facet を活用し、ハイライト情報（人気エリア・キャンペーン数など）を生成。
  - PR 枠（編集部スポットライト）を検索結果グリッドに挿入。
- **店舗詳細ページ** (`apps/web/src/app/profiles/[id]/page.tsx:80`)
  - 写真ギャラリー、料金カード、キャンペーン、SNS/連絡先、ランキング理由を表示。
  - 出勤カレンダー、日記（最新6件）、レビュー（最新10件）を参照可能。
  - 予約フォームコンポーネントを組み込み Web 予約リクエストを送信。
- **予約フォーム** (`apps/web/src/components/ReservationForm.tsx:7`)
  - 名前/電話/メール/希望日時/利用時間/メモ/マーケティング同意を入力し API 経由で予約作成。
  - 送信成功後はトースト表示、最新送信情報を保持。
- **共通 UI** (`apps/web/src/app/layout.tsx:21`)
  - Sticky ヘッダー、フッター、Age Gate モーダル、Noto Sans JP フォントなどサイト全体の骨格。
  - 18 歳未満閲覧を抑止する Age Gate は Cookie に 1 年間の検証状態を保持し、`/admin` 系はバイパス。
  - Google Analytics (GA4) を利用したアクセス計測をヘッダー埋め込みで実施（環境変数 `NEXT_PUBLIC_GA_MEASUREMENT_ID` 依存）。

### 3.2 API / バックエンド（FastAPI）

- **店舗検索 API** (`services/api/app/routers/shops.py:97`)
  - キーワード検索、Facet フィルタ、料金・今日出勤などの条件を受け取り Meilisearch と DB を組み合わせて結果返却。
- **店舗詳細 API** (`services/api/app/routers/shops.py:330`)
  - プロフィール情報・メニュー・スタッフ・キャンペーン・在庫カレンダー・レビュー要約などを一括返却。
- **日記・レビュー API**
  - `/api/v1/shops/{id}/diaries`・`/reviews` でページング取得、`POST /reviews` でレビュー投稿受付。
- **予約 API** (`services/api/app/routers/reservations.py:33`)
  - 予約新規作成（重複チェック、ステータスイベント付与）、予約取得/更新（管理 API 経由）。
- **ユーティリティ**
  - Meilisearch インデクシング (`services/api/app/meili.py`)、プロフィールドキュメント整形 (`.../utils/profiles.py`) 等。

### 3.3 管理・運用機能

- **管理 API 認証** (`services/api/app/deps.py:10`)
  - `X-Admin-Key` ヘッダーによる単一キー認証、操作ログ（`AdminLog`）自動記録。
- **店舗データ投入**
  - `/api/admin/profiles` で初期店舗登録、`tools/import_shops_from_yaml.py` により YAML → API の一括投入を支援。
- **マーケティング更新** (`services/api/app/routers/admin.py:544`)
  - 割引・ランキングバッジ・ウェイトの更新、再インデックス処理を提供。ドキュメントは `docs-marketing-workflow.md`。
- **日記 / レビュー管理** (`.../routers/admin.py:176` 以降)
  - 作成・更新・削除・一覧 API を備え、更新時には Meilisearch 再インデックス。
- **出勤データ管理**
  - `/api/admin/availabilities`（単発）と `/bulk` で一括登録。予約カレンダーはこのデータを参照。
- **外部リンク管理**
  - `/api/admin/outlinks` で LINE/TEL/WEB などのトラッキングトークン発行。
- **予約運用**
  - `/api/admin/reservations` で予約リストを取得し、`PATCH /api/admin/reservations/{id}` でステータス更新やメモ追記が可能（`ReservationStatusEvent` を自動追加）。
- **セルフ管理ダッシュボード（β）** (`apps/web/src/app/dashboard/page.tsx`)
  - 店舗担当者がキャッチコピー・紹介文・連絡先・通知先・メニュー・スタッフ情報を更新できる UI を提供。Backoffice API を利用し、保存後は自動でキャッシュを無効化。
  - サーバー環境変数 `DASHBOARD_ADMIN_KEY`（管理APIキー）と `DASHBOARD_SHOP_ID`（対象店舗UUID）を設定することで有効化。

### 3.4 データモデル

- `profiles` テーブル: 店舗基本情報、料金、タグ、ランキング、コンタクト情報など（`models.Profile`）。
- 関連テーブル: `diaries`, `reviews`, `availabilities`, `outlinks`, `reservations`, `reservation_status_events`, `admin_logs` 等。
- JSONB / ARRAY を活用しタグ・メニュー・SNS 等の柔軟な構造を保持。

### 3.5 会員アカウント / ログイン基盤

- **目的**: エンドユーザーの再訪・お気に入り保存・予約履歴管理を実現し、CRM/通知基盤の土台を整備する。

#### 認証・ログイン手段

- **MVP**: メールアドレス + ワンタイムリンク(Magic Link) によるパスワードレス認証。
  - `/api/auth/request-link` でトークン生成 → メール送信、リンクアクセスでセッション確立。`scope` パラメータ（`dashboard` / `site`）でクッキー種別を切り分け、既定は `dashboard`。
- **拡張計画**: メール + パスワード（任意）、LINE OAuth を追加検討。外部ID連携用に `user_social_accounts` テーブルを将来追加できる構造とする。
- セッション管理は HttpOnly Cookie + JWT (アクセストークン/リフレッシュ) をFastAPIで提供。セッション失効は Redis ベースのトークンブラックリストで制御。

#### 必須項目・データモデル

- `users` テーブル（id, email, email_verified_at, display_name, created_at, last_login_at, status）。
- `user_profiles`（任意事項: 居住エリア、年齢帯、興味タグ等）。
- Magic Link トークン保存用に `user_auth_tokens`（user_id, token, expires_at, consumed_at, ip_hash）。
- お気に入り機能向け `user_favorites`（user_id, shop_id, created_at）。
- 予約連携を見据え `reservations` へ `user_id` nullable で追加。

#### API 要件

- `/api/auth/request-link` : メールアドレス受け取り → トークンメール送信。レート制限 (IP + email) を 5回/10分で適用。サイト向けは `scope=site` を付与し、サイト用セッションのみ発行する。
- `/api/auth/verify` : Magic Link のトークン検証、成功時にセッションクッキーを返却。
- `/api/auth/logout` : セッション失効。
- 認証必須エンドポイントは `Depends(require_user)` で保護。未ログイン時は 401 JSON を返却。
- メール送信は SendGrid/Postmark 等で HTML テンプレート化し、監査ログ (`user_auth_audit`) に保存。

#### フロントエンド UI / UX

- `/auth/login` : メール入力フォーム。送信後は「ログインリンクを送信しました」トーストを表示し、再送ボタンは 30 秒クールダウン。
- `/mypage` : ログイン必須。お気に入り店舗、予約履歴、プロフィール編集をタブ構成で表示。
- ヘッダーにログイン状態で「マイページ」「ログアウト」を表示、未ログイン時は「ログイン」「会員登録」CTA。
- Magic Link 完了画面 `/auth/complete` を作成し、ステータス表示・マイページへの自動遷移（5 秒後）を実装。
- 保守用に `/auth-error` を用意し、トークン無効・期限切れ時のガイドを掲載。

#### 非機能・セキュリティ

- メールドメインなりすまし防止（DKIM/SPF設定）、Magic Link の有効期限は 15 分、ワンタイム使用。
- reCAPTCHA v3 または hCaptcha によるフォーム保護を検討。最低限 IP レートリミットは必須。
- 個人情報ポリシーを更新し、退会・データ削除リクエスト対応手順を `docs/compliance-roadmap.md` に反映。

## 4. 非機能要件

- **パフォーマンス**: Meilisearch による高速検索、ページネーション。API は非同期 SQLAlchemy で実装。
- **セキュリティ**: 18 歳確認モーダル、Admin API キー必須、操作ログ保存。
- **運用**: Docker Compose によるローカル環境、Makefile でサービス起動 (`Makefile`)。
- **品質管理**: `npm run lint` / `pytest` / GitHub Actions CI により lint・テストを実施。
  - `ci-web.yml`: Web の TypeScript チェック、単体テスト、E2E スモークテスト
  - `ci-api.yml`: Alembic マイグレーション整合性チェック
  - `ci-api-integration.yml`: API 統合テスト（PostgreSQL + Meilisearch）、依存関係インポートチェック、enum 一貫性チェック
  - `staging-smoke-test.yml`: Staging 環境デプロイ後のスモークテスト
  - `architecture-check.yml`: ファイルサイズ制限、依存関係ルール検証
  - PRテンプレート: DB変更・依存関係・API変更・環境変数変更のチェックリスト
- **観測性**: Google Analytics で主要導線のアクセスを計測予定。追加のログ/モニタリングは今後拡張。

## 5. 既知の課題・検討事項

- 会員ログイン／マイページなどエンドユーザアカウント機能は未実装。
- 店舗自身がセルフ更新する管理 UI は未提供。現状は管理 API/スクリプト経由。
- 地図検索や駅別フィルタ、広告管理など大規模ポータルにある高度機能は今後の検討領域。
- 予約フォーム送信後の店舗通知（メール/SMS等）は未実装。現在は DB への登録のみ。

---

本ドキュメントは現行実装をベースにした要件洗い出しです。仕様変更時は該当セクションを更新してください。
