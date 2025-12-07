# Architecture Vision - Instinct AI Matching Core

> **Note**: このドキュメントは将来構想を記述しています。現時点ではコードとして実装されていません。
> 現状の実装については [CONTEXT.md](./CONTEXT.md) を参照してください。

## Overview

大阪メンエス.com は、将来的に以下の2層アーキテクチャへ進化させる構想があります。

```
┌─────────────────────────────────────────────────────────┐
│     Instinct AI Matching Core（本能AIマッチング基盤）     │
│                                                          │
│  UserState × Item → Score                                │
│  カテゴリ横断の汎用マッチングエンジン                       │
└────────────────────────┬────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ mens_esthe  │  │   sauna     │  │ relaxation  │
│ (メンエス)   │  │ (サウナ)    │  │ (リラク)    │
│             │  │             │  │             │
│ ← 現在実装   │  │ ← 将来追加  │  │ ← 将来追加  │
└─────────────┘  └─────────────┘  └─────────────┘
```

## Instinct AI Matching Core

### コンセプト

ユーザーの「本能状態」と「文脈情報」を受け取り、カテゴリ横断で最適な候補（Item）をスコアリング・推薦するエンジン。

### 本能状態（Instinct State）

ユーザーの根源的な欲求を数値化したもの。

| 欲求 | 説明 | 例 |
|------|------|-----|
| 癒し欲 | リラックス・ストレス解消したい | 疲労度が高い、仕事後 |
| 性欲 | 性的な満足を得たい | - |
| 承認欲 | 認められたい、特別扱いされたい | 接客品質重視 |
| 好奇心 | 新しい体験をしたい | 新店・新人指名 |
| 安心欲 | 馴染みの場所・人を求める | リピート傾向 |

### 抽象エンティティ

#### Item（候補アイテム）

カテゴリ横断の抽象的な候補。

```python
class Item:
    id: UUID
    category: str          # "mens_esthe", "sauna", etc.
    tags: list[str]        # 検索・マッチング用タグ
    price_min: int
    price_max: int
    location: Point        # 位置情報
    attributes: dict       # カテゴリ固有の属性
```

#### UserState（ユーザー状態）

```python
class UserState:
    instinct_state: dict   # {"healing": 0.8, "curiosity": 0.3, ...}
    base_prefs: dict       # {"price_max": 15000, "area": "namba"}
    context: dict          # {"time": "22:00", "mood": "tired"}
```

### 汎用スコアリング要素

| Feature | Description |
|---------|-------------|
| distance_score | 位置情報に基づく近接度 |
| price_affinity | 価格帯の一致度 |
| tag_similarity | タグベースの類似度 |
| availability_score | 空き状況スコア |
| popularity_score | 人気度（レビュー数、予約数等） |
| freshness_bonus | 新着/更新ボーナス |

## カテゴリ別の具体実装

### mens_esthe（メンエス）

現在の大阪メンエス.com の実装。

| 汎用Feature | mens_estheでの実装 |
|-------------|-------------------|
| Item | Profile (shop/therapist) |
| tag_similarity | 施術スタイル（アロマ, 指圧, ストレッチ） |
| attributes | mood_tag, look_type, contact_style |
| availability_score | シフト + 既存予約から算出 |

### sauna（将来）

サウナ施設のマッチング。

| 汎用Feature | saunaでの実装（想定） |
|-------------|---------------------|
| Item | Facility |
| tag_similarity | 施設タイプ（銭湯サウナ, 専門施設） |
| attributes | 水風呂温度, 外気浴有無, サ飯 |
| availability_score | 混雑予測 |

## 将来の API 構想

```
# カテゴリ横断マッチングAPI
POST /api/v1/matching/search
{
  "user_state": {
    "instinct_state": {"healing": 0.8},
    "base_prefs": {"area": "namba"},
    "context": {"time": "22:00"}
  },
  "categories": ["mens_esthe", "sauna"],  // optional
  "limit": 20
}

GET /api/v1/matching/categories
# → ["mens_esthe", "sauna", ...]
```

## 実装フェーズ

### Phase 1: 現状（大阪メンエスOS）
- メンエス専用の検索・予約システム
- スコアリングロジックはドメイン固有

### Phase 2: 抽象化（matching_core 切り出し）
- Item インターフェースの定義
- UserState の導入
- 汎用スコアリング関数の切り出し
- Profile → Item アダプターの実装

### Phase 3: マルチカテゴリ
- 新カテゴリ（sauna等）の追加
- カテゴリ横断検索 API の実装
- 統合 UI の構築

## Backend ディレクトリ構想

```
services/api/app/domains/
├── matching_core/           # Phase 2 で追加
│   ├── item.py              # Item インターフェース
│   ├── user_state.py        # UserState 定義
│   ├── scoring.py           # 汎用スコアリング
│   └── router.py            # /api/v1/matching/*
│
├── site/                    # 現状維持（mens_esthe 相当）
├── admin/
├── dashboard/
│
└── sauna/                   # Phase 3 で追加
    ├── facility.py
    └── router.py
```

## 用語集（将来用）

| 用語 | 英語 | 説明 |
|------|------|------|
| 本能状態 | Instinct State | 癒し欲・性欲・承認欲などのスコア表現 |
| カテゴリ | Category | `mens_esthe`, `sauna` など、業種ラベル |
| アイテム | Item | カテゴリ横断の抽象的な候補 |
| ユーザー状態 | UserState | ユーザーの本能状態と文脈情報 |
| マッチングセッション | MatchingSession | 一連のマッチング処理の単位 |

## Note

この構想は「将来こうしたい」というビジョンであり、現時点のコードベースには反映されていません。
Phase 2 以降で段階的に実装していく予定です。
