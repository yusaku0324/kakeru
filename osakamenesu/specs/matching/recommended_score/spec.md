# matching/recommended_score

`sort=recommended` のときに使用する、セラピスト推薦スコアの算出ロジック。

1人のゲスト（検索者）の `GuestIntent` と、1人のセラピストの `TherapistProfile` から
`recommended_score: number`（0〜1.05程度）を計算し、その降順で並び替える。

## 目的

- ゲストにとって
  - 顔・雰囲気・会話スタイル・施術の強さなどの「好み」に近いセラピストが上位に出ること
- セラピストにとって
  - 特定の人気セラピストだけに予約が集中しすぎず、自分にもチャンスが回ってくること
- 店舗にとって
  - 新人〜中堅が自然に育ちつつ、全体の稼働バランス・売上が最適化されること

この3者（ゲスト・セラピスト・店舗）の Win-Win-Win を目指す。

---

## 入力定義

### GuestIntent

コンシェルジュや検索UIから組み立てられる「ゲストの希望」。

```ts
type ConversationStyle = "talkative" | "normal" | "quiet";
type MassagePressure = "soft" | "medium" | "strong";
type MoodTag =
  | "cheerful"      // 明るく元気
  | "calm"          // 落ち着いてしっとり
  | "healing"       // ふんわり癒し
  | "oneesan_mood"  // 甘やかし・お姉さんぽい
  | "playful";      // フレンドリー・距離近め

type VisualStyleTag =
  | "baby_face"     // 小動物系・童顔かわいい
  | "kawaii"        // 王道かわいい
  | "natural"       // 素朴・ナチュラル
  | "oneesan"       // 大人っぽい・お姉さん系
  | "cool_beauty"   // クールビューティ
  | "gal"           // ギャル・派手め
  | "elegant";      // 清楚・きれい系

type GuestIntent = {
  area: string | null;          // エリア（"namba"など）
  date: string | null;          // YYYY-MM-DD
  time_from: string | null;     // HH:MM
  time_to: string | null;       // HH:MM
  price_min: number | null;
  price_max: number | null;
  shop_id: string | null;

  // 顔・見た目の好み（0〜2個）
  visual_style_tags: VisualStyleTag[];

  // スタイル系の好み
  conversation_preference: ConversationStyle | null;   // 会話量
  massage_pressure_preference: MassagePressure | null; // 圧
  mood_preference_tags: MoodTag[];                    // 雰囲気（0〜2個）

  raw_text: string; // 自然文（ログ・将来の学習用）
};
```

### TherapistProfile（スコア計算で使う部分）

```ts
type TherapistProfile = {
  therapist_id: string;

  // 顔タイプ（0〜2個）
  visual_style_tags: VisualStyleTag[];

  // スタイル
  conversation_style: ConversationStyle;  // メインの会話スタイル
  massage_pressure: MassagePressure;      // ベースの圧
  mood_tags: MoodTag[];                   // 雰囲気（0〜3個）

  // 人気・実績系（事前に集計済み）
  total_bookings_30d: number;   // 過去30日予約数
  repeat_rate_30d: number;      // 過去30日リピート率(0〜1)
  avg_review_score: number;     // レビュー平均(1〜5等)
  price_tier: number;           // 単価帯（例: 1=低, 2=中, 3=高）

  // 新人 / 稼働状況
  days_since_first_shift: number; // デビューからの日数
  utilization_7d: number;         // 直近7日: 予約枠/シフト枠 (0〜1)

  // 希望時間帯における入りやすさ（別ロジックで算出済み）
  availability_score: number;     // 0〜1
};
```

## スコアの構造

`recommended_score` は次の3レイヤーで構成する。

- `affinity_score`: 顔の系統＋スタイル（会話・雰囲気・圧）の相性
- `user_fit_score` / `fairness_score`:
  - `user_fit` = 相性 + 人気
  - `fairness` = 新人ブースト + 稼働バランス
  を重みづけして合成
- `availability_factor`: 希望時間帯にどれくらい入りやすいか（0.9〜1.05）

最終的な式：

```
base = 0.8 * user_fit_score + 0.2 * fairness_score; // 0〜1 前後
recommended_score = clamp01(base) * availability_factor; // 0〜およそ1.05
```

`sort=recommended` のときは、この `recommended_score` の降順で並べる。

## コンポーネント詳細

### 1. 顔の相性: look_match_score (0〜1)

GuestIntent と TherapistProfile の visual_style_tags の一致度。

```ts
function computeFaceTagMatchScore(
  userTags: VisualStyleTag[],
  therapistTags: VisualStyleTag[],
): number {
  // どちらか未設定なら顔の好みではプラスマイナスしない → 中立
  if (userTags.length === 0 || therapistTags.length === 0) {
    return 0.5;
  }

  const setUser = new Set(userTags);
  const setTherapist = new Set(therapistTags);

  let intersectionCount = 0;
  for (const tag of setUser) {
    if (setTherapist.has(tag)) intersectionCount++;
  }

  const maxPossible = Math.min(setUser.size, setTherapist.size);
  if (maxPossible === 0) return 0.0; // 完全不一致

  const raw = intersectionCount / maxPossible; // 0〜1
  return raw;
}
```

- 1個一致：0.5〜1.0
- 2個一致：1.0
- 完全不一致：0.0
- どちらか未設定：0.5（中立）

look_match_score としてこの値を用いる。

### 2. スタイル相性: style_match_score (0〜1)

会話・圧・雰囲気の3つを合成する。

```ts
// 会話量
function conversationMatchScore(
  pref: ConversationStyle | null,
  actual: ConversationStyle,
): number {
  if (!pref) return 0.5;

  if (pref === actual) return 1.0;

  // normal ↔ talkative / quiet はそこそこOK
  if (
    (pref === "talkative" && actual === "normal") ||
    (pref === "normal"     && actual === "talkative") ||
    (pref === "quiet"      && actual === "normal") ||
    (pref === "normal"     && actual === "quiet")
  ) {
    return 0.7;
  }

  // talkative vs quiet のような真逆
  return 0.3;
}

// 圧
function pressureMatchScore(
  pref: MassagePressure | null,
  actual: MassagePressure,
): number {
  if (!pref) return 0.5;

  if (pref === actual) return 1.0;

  // medium を挟む組み合わせは許容
  if (
    (pref === "soft"   && actual === "medium") ||
    (pref === "medium" && actual === "soft")   ||
    (pref === "medium" && actual === "strong") ||
    (pref === "strong" && actual === "medium")
  ) {
    return 0.7;
  }

  // soft vs strong
  return 0.3;
}

// 雰囲気
function moodMatchScore(
  prefTags: MoodTag[],
  actualTags: MoodTag[],
): number {
  if (prefTags.length === 0 || actualTags.length === 0) {
    return 0.5; // 中立
  }

  const prefSet = new Set(prefTags);
  const actSet = new Set(actualTags);

  let intersection = 0;
  for (const t of prefSet) {
    if (actSet.has(t)) intersection++;
  }

  const maxPossible = Math.min(prefSet.size, actSet.size);
  if (maxPossible === 0) return 0.3; // 完全不一致 → やや低め

  const raw = intersection / maxPossible; // 0〜1
  return 0.3 + 0.7 * raw;                // 0.3〜1.0 にマッピング
}
```

合成：

```ts
function styleMatchScore(intent: GuestIntent, profile: TherapistProfile): number {
  const conv  = conversationMatchScore(intent.conversation_preference, profile.conversation_style);
  const press = pressureMatchScore(intent.massage_pressure_preference, profile.massage_pressure);
  const mood  = moodMatchScore(intent.mood_preference_tags, profile.mood_tags);

  const w_conv  = 0.4;
  const w_press = 0.3;
  const w_mood  = 0.3;

  return w_conv * conv + w_press * press + w_mood * mood; // 0〜1
}
```

### 3. affinity_score (0〜1)

顔とスタイルの相性。

```ts
function affinityScore(intent: GuestIntent, profile: TherapistProfile): number {
  const look  = computeFaceTagMatchScore(intent.visual_style_tags, profile.visual_style_tags);
  const style = styleMatchScore(intent, profile);

  const w_look  = 0.5;
  const w_style = 0.5;

  return w_look * look + w_style * style; // 0〜1
}
```

### 4. popularity_score (0〜1)

人気・実績。強くしすぎると人気偏重になるため、軽め＆圧縮する。

```ts
function popularityScore(profile: TherapistProfile): number {
  // それぞれ 0〜1 に正規化済みと仮定する
  const b    = normalizeBookings(profile.total_bookings_30d); // 0〜1
  const r    = clamp01(profile.repeat_rate_30d);              // 0〜1
  const rev  = normalizeReview(profile.avg_review_score);     // 0〜1
  const tier = normalizePriceTier(profile.price_tier);        // 0〜1（高単価なら少し加点）

  const raw =
    0.4 * b +
    0.3 * r +
    0.2 * rev +
    0.1 * tier;

  // 上位人気の差を緩めるために sqrt で圧縮
  return Math.sqrt(clamp01(raw)); // 0〜1
}
```

`normalizeBookings` / `normalizeReview` / `normalizePriceTier` は別途実装（ロジックはこの spec では詳細に縛らないが、0〜1に収まること）。

### 5. newcomer_score (0〜1)

新人・中堅へのブースト。

```ts
function newcomerScore(daysSinceFirstShift: number): number {
  if (daysSinceFirstShift <= 7)  return 0.9; // デビュー1週間
  if (daysSinceFirstShift <= 30) return 0.6; // 〜1ヶ月
  if (daysSinceFirstShift <= 90) return 0.3; // 〜3ヶ月
  return 0.1;                                // それ以降
}
```

### 6. load_balance_score (0〜1)

直近の稼働バランス。忙しすぎる子は下がり、暇な子は上がる。

```ts
// utilization_7d: 直近7日の「予約済み枠 / シフト枠」(0〜1)
function loadBalanceScore(utilization_7d: number): number {
  const u = clamp01(utilization_7d);
  return 1.0 - u; // 0〜1
}
```

### 7. fairness_score (0〜1)

新規・中堅ブースト＋稼働の偏り防止。

```ts
function fairnessScore(profile: TherapistProfile): number {
  const newcomer = newcomerScore(profile.days_since_first_shift);
  const load     = loadBalanceScore(profile.utilization_7d);

  const w_newcomer = 0.5;
  const w_load     = 0.5;

  return w_newcomer * newcomer + w_load * load; // 0〜1
}
```

### 8. availability_factor (0.9〜1.05)

「希望時間にどれくらい入りやすいか」を少しだけ反映する係数。
相性や人気をねじ曲げない範囲（±10%以内）に収める。

```ts
function availabilityFactor(availability_score: number): number {
  const a = clamp01(availability_score);
  const minFactor = 0.9;
  const maxFactor = 1.05;

  return minFactor + (maxFactor - minFactor) * a; // 0.9〜1.05
}
```

### 9. user_fit_score (0〜1)

お客側視点の「合いそう度」。
相性を重視しつつ、人気も少し見る。

```ts
function userFitScore(intent: GuestIntent, profile: TherapistProfile): number {
  const affinity   = affinityScore(intent, profile);  // 0〜1
  const popularity = popularityScore(profile);        // 0〜1

  const w_affinity   = 0.7;
  const w_popularity = 0.3;

  return w_affinity * affinity + w_popularity * popularity;
}
```

### 最終スコア：recommended_score

```ts
export function recommendedScore(intent: GuestIntent, profile: TherapistProfile): number {
  const user_fit = userFitScore(intent, profile);   // 0〜1
  const fair     = fairnessScore(profile);          // 0〜1
  const availFac = availabilityFactor(profile.availability_score); // 0.9〜1.05

  const w_user = 0.8;
  const w_fair = 0.2;

  const base = w_user * user_fit + w_fair * fair;   // 0〜1 前後
  const clampedBase = clamp01(base);

  return clampedBase * availFac; // 0〜およそ1.05
}
```

`clamp01(x)` は 0 <= x <= 1 に収めるユーティリティ。

---

## テスト観点（必須）

`recommendedScore` には少なくとも以下のようなテストケースを用意すること：

1. 人気＆相性が高いベテラン vs 相性ドンピシャな新人

- Case A: affinity=高, popularity=高, days_since_first_shift 大, utilization_7d=高
- Case B: affinity=非常に高い, popularity=低, days_since_first_shift 小, utilization_7d=低
- → B の方が recommended_score が同等以上になること（新人にちゃんとチャンスが回る）。

2. 人気だけ高くて相性が低いセラピスト

- 相性が低いが、人気系メトリクスだけ高いプロファイル
- 相性が高く職歴が浅いセラピストよりも上位に来ないこと。

3. availability_score の影響

- 同一の user_fit / fairness を持つ2人で、availability_score が 1.0 と 0.0 の場合の比較
- availability_factor によりスコアが最大 ±10% 程度しか変動しないこと。

4. 顔・スタイルの相性（sanity check）

- GuestIntent の visual_style_tags, conversation_preference, massage_pressure_preference, mood_preference_tags を変えたときに、意図通り affinity_score が上がったり下がったりすること。

実装時、必要に応じて追加のテストケースを増やしてよい。

---

## 2. この spec を実装する GitHub Issue テンプレ（例）

```markdown
タイトル: Implement recommendedScore matching logic

## 背景

`sort=recommended` の並び順を、
ゲスト・セラピスト・店舗の Win-Win-Win になるように最適化したい。

以下の仕様に基づいて、`recommendedScore(intent, profile)` を実装し、
単体テストを整備する。

- spec: `specs/matching/recommended_score/spec.md`

## スコープ

- `src/matching/recommendedScore.ts` の新規作成
  - GuestIntent / TherapistProfile の型定義
  - affinityScore / popularityScore / fairnessScore / availabilityFactor / recommendedScore などのサブ関数
- `src/matching/recommendedScore.test.ts` の新規作成
  - spec に記載のテスト観点をカバーするテスト

## やりたいこと

1. spec.md を読み、必要な型と関数の一覧を洗い出す
2. `recommendedScore(intent, profile)` を仕様どおり実装
3. 最低限のテストケースを作成し、`npm test` で通ることを確認

## 受け入れ条件

- `recommendedScore.test.ts` がすべてパスしている
- 人気が高くても相性が低いセラピストより、
  相性が高く新人ブーストが効いているセラピストが上位に来るケースが確認できる
- `availability_score` の影響が ±10% 程度に収まっていること（テストで確認）
```
