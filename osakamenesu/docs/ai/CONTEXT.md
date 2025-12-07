# Project Context for AI Assistants

このファイルはAIアシスタント（Claude, ChatGPT等）がプロジェクトを理解するための永続的なコンテキストを提供します。

> **Note**: このドキュメントは「現状の実装」を中心に記述しています。
> 将来のアーキテクチャ構想（Instinct AI Matching Core 等）については [VISION.md](./VISION.md) を参照してください。

---

## Instructions for AI Assistants

* あなたはこのリポジトリ専用の AI コーディングアシスタントです。

* **現状の実装について何かする場合は、必ずこの CONTEXT.md を真実ソースとして扱ってください。**
  * `services/api/app/domains/` 配下は、現状は `site/`, `admin/`, `dashboard/`, `auth/`, `line/`, `ops/` のみが存在します。
  * `matching_core/` や `mens_esthe/` といったディレクトリは **まだ存在しません**。こちらは VISION.md に書かれた将来構想です。

* **VISION.md に書かれた内容は「将来こうしたい」というビジョンです。**
  * 「Instinct AI Matching Core（本能AIマッチング基盤）」や `Item`, `UserState` などは、現時点では概念レベルにとどまっています。
  * matching_core 周りのコードやディレクトリを勝手に新規作成・リファクタリングしないでください（ユーザーから明示的な依頼があった場合のみ検討する）。

* **実装やバグ修正・小さな機能追加:**
  * 現状の Domain Structure（`site/`, `admin/`, `dashboard/` 等）に合わせてコードを編集してください。
  * この範囲では、「本能AIマッチング基盤」はあくまで頭の片隅に置いておく程度で構いません。

* **設計相談・アーキテクチャ設計・リファクタ案の検討:**
  * ユーザーから「将来構想」「matching_core を切り出したい」などの相談があったときのみ、VISION.md を参照してください。
  * その場合も「Phase 1（現状）」「Phase 2（matching_core 切り出し）」「Phase 3（マルチカテゴリ）」という段階を意識し、一気にすべてを変える提案は避けてください。

* **Profile / Reservation / Shift / GuestMatchLog について:**
  * 現状は「メンエス専用のドメインモデル」として実装されています。
  * VISION.md にある「Profile は将来的に Item インターフェースを実装する」といった話は、**今はまだ妄想レベル**です。実コードでは既存スキーマを前提にしてください。

* **迷ったときの優先順位:**
  1. 実際のコード・マイグレーションファイル
  2. CONTEXT.md（現状仕様）
  3. specs/ 以下の個別仕様
  4. VISION.md（将来構想）

このルールに従うことで、「今動いている大阪メンエス.com」を壊さずに、少しずつ Instinct AI Matching Core へ寄せていける状態を保ちたいです。

---

## Project Overview

**大阪メンエス.com** - 大阪エリアのメンズエステ店舗・セラピスト検索・予約プラットフォーム

### What This System Does

1. **ゲスト（お客様）向け機能**
   - 店舗・セラピスト検索
   - AIコンシェルジュによるマッチング
   - 予約リクエスト送信
   - お気に入り管理

2. **店舗管理者向け機能**
   - セラピストのシフト管理
   - 予約管理（承認/拒否）
   - 店舗情報編集

3. **運営（Admin）向け機能**
   - 全店舗・セラピストの管理
   - 予約状況のモニタリング

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   Next.js Web   │────▶│  FastAPI (API)  │
│   (Vercel)      │     │  (Fly.io)       │
└─────────────────┘     └────────┬────────┘
                                 │
                        ┌────────▼────────┐
                        │   PostgreSQL    │
                        │   (Supabase)    │
                        └─────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS |
| Backend | FastAPI, Python 3.11, SQLAlchemy |
| Database | PostgreSQL (Supabase) |
| Search | Meilisearch |
| Auth | Magic Link (メール), LINE Login |
| Deployment | Vercel (Frontend), Fly.io (API) |

### Backend Domain Structure（現状）

```
services/api/app/domains/
├── site/           # ゲスト向け（検索、マッチング、予約等）
├── admin/          # 運営管理者向け
├── dashboard/      # 店舗管理者向けダッシュボード
├── auth/           # 認証
├── line/           # LINE連携
└── ops/            # 運用系
```

## Domain Model

### Core Entities

#### Profile (店舗 or セラピスト)
メンエスの店舗・セラピストを表現するドメインモデル。

| Field | Type | Description |
|-------|------|-------------|
| type | enum | 'shop' または 'therapist' |
| shop_id | UUID | セラピストの場合、所属店舗のID |
| slug | string | URL用の一意識別子 |
| status | enum | 'active', 'inactive', 'pending' |

#### Reservation (予約)

| Field | Type | Description |
|-------|------|-------------|
| guest_id | UUID | 予約したゲストのID |
| therapist_id | UUID | 指名セラピスト |
| shop_id | UUID | 店舗 |
| start_at | datetime | 予約開始時間 |
| end_at | datetime | 予約終了時間 |
| status | enum | 'pending', 'confirmed', 'completed', 'cancelled' |

#### Shift (シフト)
- セラピストの勤務可能時間
- 予約可否の判定に使用

#### GuestMatchLog (マッチングログ)
- AIコンシェルジュの会話・推薦履歴

### Key Relationships

```
Shop (Profile) 1─────n Therapist (Profile)
                           │
                           n
                           │
                      Reservation
                           │
                           n
                           │
                        Guest
```

## Business Rules

### Matching System

1. **スコアリング要素**
   - 空き状況 (availability_score)
   - プロフィール一致度 (profile_score)
   - 人気度 (popularity_score)
   - 新着ボーナス (freshness_bonus)

2. **推奨順位の計算**
   ```
   recommended_score =
     availability_weight * availability_score +
     profile_weight * profile_score +
     popularity_weight * popularity_score +
     freshness_bonus
   ```

### Reservation Flow

1. ゲストが予約リクエスト送信 → status: 'pending'
2. 店舗が承認 → status: 'confirmed'
3. 施術完了 → status: 'completed'

### Buffer Minutes

店舗ごとに設定される予約間の空き時間（デフォルト: 0分）
- 次の予約との間に必要な準備時間

## API Conventions

### URL Structure

**Public Site API**
```
/api/v1/shops/{shop_id_or_slug}
/api/v1/shops/{shop_id}/therapists
/api/v1/therapists/{therapist_id}
```

**Guest API (認証必要)**
```
/api/guest/reservations
/api/guest/favorites
```

**Admin API**
```
/api/admin/shops
/api/admin/therapists
/api/admin/reservations
```

**Dashboard API (店舗管理者)**
```
/api/dashboard/...
```

### Response Format

```json
{
  "items": [...],      // リスト系
  "total": 100,        // 総件数
  "page": 1,           // 現在ページ
  "per_page": 20       // 件数/ページ
}
```

## Common Patterns

### Frontend

- **ページ構造**: `apps/web/src/app/[route]/page.tsx`
- **APIルート**: `apps/web/src/app/api/[route]/route.ts`
- **コンポーネント**: `apps/web/src/components/`
- **機能別**: `apps/web/src/features/`

### Backend

- **ルーター**: `services/api/app/domains/[domain]/router.py`
- **ビジネスロジック**: `services/api/app/domains/[domain]/[feature].py`
- **モデル**: `services/api/app/models.py`
- **スキーマ**: `services/api/app/schemas.py`

## Glossary (用語集)

| 用語 | 説明 |
|------|------|
| セラピスト | 施術を行うスタッフ |
| ゲスト | サービスを利用するお客様 |
| マッチング | AIによるセラピスト推薦 |
| コンシェルジュ | AIチャットによる対話型マッチング |
| シフト | セラピストの勤務可能時間枠 |
| バッファ | 予約間の準備時間 |
| スラグ | URL用の一意識別子（例: sample-namba-resort） |

## Testing

### E2E Tests
- Playwright使用
- `apps/web/e2e/` ディレクトリ
- サンプルデータ: `seed_e2e_sample_data.py`

### Unit Tests
- Backend: pytest (`services/api/app/tests/`)
- Frontend: vitest (`apps/web/tests/`)

## Important Notes for AI

1. **Profile テーブルは店舗とセラピスト両方を格納** - `type` フィールドで区別
2. **日本語のコメント/変数名あり** - 意味を推測可能
3. **Timezone は Asia/Tokyo** - 日本時間での処理
4. **specs/ ディレクトリに仕様書** - ビジネスロジックの詳細はここを参照
5. **将来構想あり** - 詳細は [VISION.md](./VISION.md) を参照
