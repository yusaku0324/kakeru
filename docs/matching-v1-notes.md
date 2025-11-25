# Matching v1 Notes

matching ドメインの「v1 でどこまでできるようになったか」と、「あえてやっていないこと」「v2 でやりたいこと」をざっくり整理するメモ。

> 対象: main にマージ済みの #146 / #147 / #148 / #150 / #151 / #152 時点の状態

---

## 1. 今できること（v1 のスコープ）

### 1-1. プロフィールタグを使ったマッチング

- Therapist / Profile に以下のタグが紐づく:
  - `mood_tag`
  - `style_tag`
  - `look_type`
  - `talk_level`
  - `contact_style`
  - `hobby_tags`（複数）
- ゲスト向けの matching（検索）では:
  - 既存のスコアリングにタグ要素が統合されている。
  - タグが存在する場合は、frontend の `computeMatchingScore` と同じ重みで加点/減点。
  - タグが `NULL` / 未設定の場合はニュートラル（0.5）として扱う。
- UI 側では:
  - プロフィールタグがセラカードや詳細、管理画面の編集UIで可視化・編集できる状態。

**ポイント:**
v1 の matching ロジックは「タグ込みのスコアリングが通り、UIにもそれが見える」状態まで来ている。

---

### 1-2. 類似セラピスト API

- 新規エンドポイント（backend 実装済み）:
  - `GET /api/guest/matching/similar`
  - Query:
    - `therapist_id` (UUID, required)
    - `limit` (default 5, 1–20)
- 挙動:
  - `therapist_id` を基準セラとして取得。
    - `Therapist.status` / `Profile.status` が `published` のみ対象。
    - 非公開のターゲットは `404`。
  - タグベースの簡易スコアで「似ているセラピスト」を算出:
    - `mood_tag`, `talk_level`, `style_tag`, `look_type`, `contact_style`, `hobby_tags`
    - `_extract_tags` で Therapist/Profile + specialties/body_tags から実値を引く。
    - タグが無い部分はニュートラル（0.5）扱い。
  - 本人は類似リストから除外。
  - 類似セラ達はスコア順にソートして返す。

- レスポンス例（shape）:

  ```jsonc
  {
    "base_therapist": {
      "therapist_id": "...",
      "therapist_name": "...",
      "profile_id": "...",
      "profile_name": "...",
      "mood_tag": "...",
      "talk_level": "...",
      "style_tag": "...",
      "look_type": "...",
      "contact_style": "...",
      "hobby_tags": ["..."]
    },
    "similar": [
      {
        "therapist_id": "...",
        "therapist_name": "...",
        "profile_id": "...",
        "profile_name": "...",
        "score": 0.78,
        "breakdown": {
          "mood": 0.9,
          "talk": 0.8,
          "style": 0.7,
          "look": 0.75,
          "contact": 0.5,
          "hobby": 0.6
        }
      }
    ]
  }
  ```

