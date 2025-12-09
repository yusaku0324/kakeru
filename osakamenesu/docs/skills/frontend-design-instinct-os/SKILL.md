# frontend-design-instinct-os

| Key         | Value                                                                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| name        | frontend-design-instinct-os                                                                                                                     |
| description | 本能ベースのマッチングOS（メンエス・サウナ・旅行など）用UIデザインガイド。AIスロップUI禁止、成人向けサイト風禁止、検索〜マッチング〜予約の一貫フロー設計。 |

---

## Purpose & Context

### Who is this for?

- **ゲスト**: 自分の「今の気分・本能」に合う体験を探し、予約するユーザー
- **セラピスト**: 自分のサービス・雰囲気・空き状況を管理するプロバイダー
- **店舗**: スタッフやスケジュール、予約を一元管理するオーナー・管理者

### What problem does it solve?

「今の本能状態に合う体験を選んで予約する」までのフローを、迷いなく・安心して・心地よく完了できるUI/UXを提供する。

### Design Principles

1. **Mobile-First**: スマートフォンでの閲覧・予約が主ユースケース
2. **Instinct-Centric**: 本能タグが検索・マッチング・表示のすべてに関わる
3. **Trust & Safety**: 信頼感を最優先。怪しさ・過激さを排除
4. **Flow Continuity**: 検索 → 詳細 → 予約 が途切れない一体設計

---

## Design Direction (Instinct OS)

### Tone

- 都市型ウェルネス / ライフスタイルメディアの雰囲気
- 余白・清潔感・安心感を重視
- 高級感よりも「親しみやすい上質さ」

### Avoid (禁止パターン)

#### 1. 風俗サイト風

- 黒 × 金 × 赤の配色
- 露骨な写真・過度なボディ強調
- 「即予約」「今すぐ」の点滅・過激な煽り

#### 2. AIスロップUI

- Inter / Roboto + 純白背景 + パープルグラデーション
- 量産型のカードレイアウト（角丸16px + 影 + アイコン左配置）
- 「AI-powered」「Smart」「Intelligent」などの無意味なラベリング
- 過度なグラスモーフィズム・ぼかし効果の濫用

---

## Visual System

### Typography

| 用途     | 方針                                                   |
| -------- | ------------------------------------------------------ |
| 見出し   | Display系（Noto Sans JP Bold / LINE Seed など）        |
| 本文     | 日本語対応のSans Serif（Noto Sans JP / ヒラギノ角ゴ）  |
| 数値     | Tabular Lining で揃える                                |

### Color & Theme

#### Base Colors

```
background:     #FAFAF9 (warm white)
backgroundMuted: #F5F5F4 (stone-100)
surface:        #FFFFFF
surfaceMuted:   #FAFAF8
```

#### Text Colors

```
textMain:   #1C1917 (stone-900)
textMuted:  #57534E (stone-600)
textSoft:   #A8A29E (stone-400)
```

#### Accent

```
accent:       #3B82F6 (blue-500) - プライマリアクション
accentSoft:   #DBEAFE (blue-100) - 背景・ホバー
accentStrong: #1D4ED8 (blue-700) - 強調
```

#### Instinct-specific Colors

各Instinctに固有の色を割り当て、一目で識別可能にする：

| Instinct   | Label            | Color Family | Active BG        | Active Text |
| ---------- | ---------------- | ------------ | ---------------- | ----------- |
| relax      | とにかく癒されたい  | Green        | emerald-100      | emerald-700 |
| talk       | たくさん喋りたい    | Orange       | orange-100       | orange-700  |
| reset      | 静かにととのいたい  | Cyan         | cyan-100         | cyan-700    |
| excitement | 少しドキドキ・非日常 | Rose         | rose-100         | rose-700    |
| healing    | 心のケア・寄り添い  | Violet       | violet-100       | violet-700  |
| quiet      | 静かに過ごしたい    | Slate        | slate-200        | slate-700   |

### Motion

- **状態変化の説明手段として使用**: 本能タグON/OFF、リスト更新、選択フィードバック
- **duration**: 150ms〜300ms を基本とする
- **禁止**: 常時バウンス、過度なパララックス、ローディング以外のスピナー乱用

### Layout

- 情報量は多いが、視線の流れ（F字・Z字）が明快
- ファーストビューに「今なにをすればいいか」が明示されていること
- カード間の余白は `spacing.md` (16px) 以上

---

## Domain UX Patterns

### Instinct Tags（本能タグ）

本能タグは Instinct OS の中核UIであり、以下の特性を持つ：

1. **チップ型**: 丸みを帯びたコンパクトな形状
2. **トグル可能**: タップでON/OFF切り替え
3. **マルチセレクト**: 複数選択可能
4. **視覚的フィードバック**: 選択状態が色・影・アイコンで明確

#### 標準ラベル

- とにかく癒されたい (relax)
- たくさん喋りたい (talk)
- 静かにととのいたい (reset)
- 少しドキドキ・非日常 (excitement)
- 心のケア・寄り添い (healing)
- 静かに過ごしたい (quiet)

### Safety & Trust

- 店舗情報・セラピスト情報・スタイル/雰囲気・口コミ・注意事項を読み取りやすく
- 身体スペックや性的要素を前面に出さない
- 「本人確認済み」「口コミ○件」などの信頼指標を適切に表示

### Matching & Booking

- 「本能選択 → 結果一覧 → 詳細 → 予約」の流れが一体として設計されていること
- 結果カードには「なぜおすすめか（本能マッチ度）」がタグやスコアで表示
- 予約導線は最小ステップで完了できること

---

## Implementation Rules

### Tech Stack

- React / Next.js (App Router)
- TypeScript
- Tailwind CSS
- clsx for className composition

### Component Architecture

- `InstinctTag`: 本能タグの基本コンポーネント
- `MatchScoreBadge`: マッチ度を示すバッジ
- `TherapistCard` / `ShopCard`: 一覧表示用カード
- `FilterBar`: 本能タグ + その他フィルター

### Accessibility

- semantic HTML (`button`, `nav`, `main`, `article`)
- `aria-pressed` for toggle states
- `aria-label` for icon-only buttons
- Focus visible states

### File Structure

```
src/
├── tokens/
│   └── theme.ts          # デザイントークン定義
├── components/
│   └── ui/
│       ├── instinct-tag.tsx
│       ├── match-score-badge.tsx
│       └── ...
└── lib/
    └── utils.ts          # cn() ユーティリティ
```

---

## Banned Patterns

### Visual

- [ ] Inter / Roboto + 白背景 + パープルグラデ + 汎用カード（AIスロップUI）
- [ ] 風俗サイト / Adult広告を連想させる色彩・レイアウト
- [ ] スパム的なポップアップ
- [ ] 「今すぐ予約!!」点滅ボタン

### Code

- [ ] インラインスタイルの濫用
- [ ] マジックナンバー（トークン化されていない値）
- [ ] コンポーネント外での直接的なDOM操作

---

## How to Respond

この SKILL を使用するときの Claude の返答スタイル：

1. **まずコンセプト & レイアウトの説明** → その後にコード
2. Instinct OS の世界観を意識した言葉選び
3. トークン（`theme.ts`）を積極的に参照
4. 既存コンポーネントとの整合性を確認

---

## Quality Bar

- 「実プロダクトとして出しても違和感がない」ことを最低ラインとする
- Instinct 選択方法 / おすすめ理由 / 予約導線 が一目で分かること
- AIスロップ感・風俗サイト感が一切ないこと

---

## Self-check Checklist

実装・デザインレビュー時に以下を確認すること：

### Instinct UX

- [ ] 本能タグがファーストビューで視認できる
- [ ] タグのON/OFF状態が視覚的に明確
- [ ] 選択した本能が検索結果・詳細に反映されている

### Safety & Trust

- [ ] Adult感・風俗サイト感が出ていない
- [ ] 信頼感のある情報構造になっている（口コミ・実績・認証）
- [ ] 過度な煽り文言がない

### Flow Clarity

- [ ] 検索 → マッチング → 予約 のストーリーがUI上で追える
- [ ] 次に何をすればいいかが常に明確
- [ ] 離脱ポイント（戻る・キャンセル）も適切に用意

### Visual Uniqueness

- [ ] 本能OSらしい世界観がある
- [ ] AIスロップっぽくない（パープルグラデ・量産カード禁止）
- [ ] 温かみのある配色・余白が保たれている

### Implementation Quality

- [ ] コンポーネントが適切に分割されている
- [ ] TypeScript の型が正しく定義されている
- [ ] アクセシビリティ（aria属性・フォーカス）が考慮されている
- [ ] トークン（`theme.ts`）が適切に使用されている

---

**If any item would reasonably be answered with "no", revise the design and code before returning the final answer.**
