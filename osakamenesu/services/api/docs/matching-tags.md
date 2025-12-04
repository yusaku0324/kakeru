# Matching Tags

マッチング/レコメンドで使用するタグ定義を説明します。

## タグ一覧

### 1. mood_tag (雰囲気タグ)

セラピストの雰囲気・印象を表すタグ。

| 値 | 説明 |
|---|---|
| `gentle` | 穏やか・優しい |
| `energetic` | 元気・活発 |
| `calm` | 落ち着いている |
| `cheerful` | 明るい |

**DB カラム**: `therapists.mood_tag` (String(32), nullable)
**スコアリング重み**: 0.15

---

### 2. style_tag (施術スタイルタグ)

施術のスタイル・強さを表すタグ。

| 値 | 説明 |
|---|---|
| `soft` | ソフト・軽め |
| `firm` | しっかり・強め |
| `balanced` | バランス型 |

**DB カラム**: `therapists.style_tag` (String(32), nullable)
**スコアリング重み**: 0.10

---

### 3. look_type (外見タイプタグ)

セラピストの外見タイプを表すタグ。

| 値 | 説明 |
|---|---|
| `cute` | かわいい系 |
| `elegant` | 上品・エレガント |
| `cool` | クール系 |
| `natural` | ナチュラル |

**DB カラム**: `therapists.look_type` (String(32), nullable)
**スコアリング重み**: 0.05

---

### 4. contact_style (接触スタイルタグ)

施術時の接触の仕方を表すタグ。

| 値 | 説明 |
|---|---|
| `light` | 軽め |
| `deep` | しっかり |
| `moderate` | 中程度 |

**DB カラム**: `therapists.contact_style` (String(32), nullable)
**スコアリング重み**: 現在未使用（将来用）

---

### 5. talk_level (会話レベルタグ)

会話の多さ・スタイルを表すタグ。

| 値 | 説明 |
|---|---|
| `chatty` | 会話多め |
| `quiet` | 静かめ |
| `moderate` | 適度 |

**DB カラム**: `therapists.talk_level` (String(32), nullable)
**スコアリング重み**: 0.10

---

### 6. hobby_tags (趣味タグ)

セラピストの趣味・興味を表す複数タグ。

| 例 | 説明 |
|---|---|
| `travel` | 旅行 |
| `music` | 音楽 |
| `sports` | スポーツ |
| `cooking` | 料理 |
| `reading` | 読書 |

**DB カラム**: `therapists.hobby_tags` (ARRAY(String(32)), nullable)
**スコアリング重み**: 現在未使用（表示用）

---

### 7. price_rank (価格帯)

セラピストの価格帯を 1-5 の段階で表す。

| 値 | 説明 |
|---|---|
| 1 | リーズナブル |
| 2 | やや低め |
| 3 | 標準 |
| 4 | やや高め |
| 5 | プレミアム |

**DB カラム**: `therapists.price_rank` (Integer, nullable, 1-5)
**スコアリング重み**: 0.15

---

### 8. age (年齢)

セラピストの年齢。マッチング時の参考情報として使用。

**DB カラム**: `therapists.age` (Integer, nullable)
**スコアリング重み**: 現在未使用（表示用）

---

## スコアリング計算

マッチングスコアは以下の重み付けで計算されます：

```
total_score =
    0.40 * core_score +        # エリア/時間/基本条件
    0.15 * price_fit +         # 価格帯マッチ
    0.15 * mood_fit +          # 雰囲気マッチ
    0.10 * talk_fit +          # 会話レベルマッチ
    0.10 * style_fit +         # 施術スタイルマッチ
    0.05 * look_fit +          # 外見タイプマッチ
    0.05 * availability_score  # 空き状況
```

各スコアは 0〜1 の範囲に正規化されます。タグが未設定の場合はデフォルト値 0.5 が使用されます。

## API エンドポイント

### タグの取得

セラピスト一覧/詳細取得時にタグ情報が含まれます：

```
GET /api/admin/therapists
GET /api/admin/therapists/{therapist_id}
```

レスポンス例：
```json
{
  "id": "uuid",
  "name": "セラピスト名",
  "mood_tag": "gentle",
  "style_tag": "soft",
  "look_type": "cute",
  "contact_style": "light",
  "talk_level": "moderate",
  "hobby_tags": ["travel", "music"],
  "price_rank": 3,
  "age": 25
}
```

### タグの更新

```
PATCH /api/admin/therapists/{therapist_id}
```

リクエストボディ：
```json
{
  "mood_tag": "energetic",
  "style_tag": "firm",
  "look_type": "elegant",
  "contact_style": "deep",
  "talk_level": "chatty",
  "hobby_tags": ["sports", "cooking"],
  "price_rank": 4,
  "age": 28
}
```

## DB マイグレーション

タグカラムはマイグレーション `0038_add_therapist_matching_tags` で追加されます。

## 関連ファイル

- `services/api/app/models.py` - Therapist モデル定義
- `services/api/app/domains/admin/therapists_api.py` - Admin API
- `services/api/app/domains/site/guest_matching.py` - マッチングスコア計算
- `apps/web/src/features/matching/computeMatchingScore.ts` - フロントエンドスコア計算
- `specs/matching/base.md` - マッチング仕様
