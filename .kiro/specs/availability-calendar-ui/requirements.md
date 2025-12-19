# Availability Calendar UI/API Requirements

## 概要

本仕様書は、availability calendar UIとAPIの要件を定義し、曖昧さを排除した一貫した実装を可能にする。SoT（TherapistShift + GuestReservation）に基づく正確な空き状況表示と、ユーザーの予約操作を安全に処理することを目的とする。

## 前提条件

- **SoT**: TherapistShift + GuestReservation が唯一の真実源
- **slots_json**: 管理用途キャッシュのみ、UI判定の根拠には使用禁止
- **タイムゾーン**: 全ての日付・時刻処理はJST基準
- **対象ステータス**: open / tentative / blocked の3状態のみ

## ステータス定義

### 1. open（空き）
- **定義**: 予約可能な時間枠
- **表示**: 緑色、◎アイコン
- **操作**: クリック可能、予約確定可能
- **API値**: `"open"`

### 2. tentative（仮押さえ）
- **定義**: 一時的に予約候補として選択された状態
- **意味**: ユーザーが予約検討中、他ユーザーからは見えない
- **確認期限**: セッション内のみ有効（ページ離脱で解除）
- **表示**: 黄色、△アイコン
- **操作**: クリック可能、確定または解除可能
- **API値**: `"tentative"`

### 3. blocked（予約済み/利用不可）
- **定義**: 予約済みまたは利用できない時間枠
- **原因**: 既存予約、休憩時間、営業時間外
- **表示**: グレー、×アイコン
- **操作**: クリック不可、disabled状態
- **API値**: `"blocked"`

## カレンダーUIの振る舞い

### 基本表示ルール

#### セル表示
```
open:     [◎] 緑背景 + 白文字
tentative: [△] 黄背景 + 黒文字  
blocked:   [×] グレー背景 + グレー文字
```

#### 操作可能性
```
open:     cursor: pointer, hover効果あり
tentative: cursor: pointer, hover効果あり
blocked:   cursor: not-allowed, pointer-events: none, disabled属性
```

### インタラクション仕様

#### 1. openセルクリック時
- セル状態を `tentative` に変更
- 他の `tentative` セルがあれば `open` に戻す（単一選択）
- 予約フォームを表示または更新

#### 2. tentativeセルクリック時
- セル状態を `open` に戻す
- 予約フォームを非表示または無効化

#### 3. blockedセルクリック時
- 何も実行しない（pointer-events: none により物理的にクリック不可）

### 同一時間帯の表示優先度

複数シフトが同一時間帯にある場合の表示優先度：
1. **blocked** （最優先）- 1つでもblockedなら全体をblocked表示
2. **open** （次優先）- blockedがなく、1つでもopenなら全体をopen表示  
3. **tentative** （最低優先）- 全てがtentativeの場合のみtentative表示

## API レスポンス仕様

### AvailabilitySlotsResponse

```typescript
interface AvailabilitySlot {
  start_at: string;        // ISO 8601 format with JST timezone (+09:00)
  end_at: string;          // ISO 8601 format with JST timezone (+09:00)
  status: AvailabilityStatus;  // 必須フィールド
  staff_id?: string;       // UUID format, optional
  menu_id?: string;        // UUID format, optional
}

type AvailabilityStatus = "open" | "tentative" | "blocked";

interface AvailabilityDay {
  date: string;            // "YYYY-MM-DD" format (JST)
  is_today: boolean;
  slots: AvailabilitySlot[];
}

interface AvailabilityCalendarResponse {
  days: AvailabilityDay[];
}
```

### API エンドポイント仕様

#### GET /api/guest/therapists/{id}/availability_slots

**レスポンス例**:
```json
{
  "days": [
    {
      "date": "2025-01-15",
      "is_today": true,
      "slots": [
        {
          "start_at": "2025-01-15T10:00:00+09:00",
          "end_at": "2025-01-15T10:30:00+09:00",
          "status": "open",
          "staff_id": "123e4567-e89b-12d3-a456-426614174000"
        },
        {
          "start_at": "2025-01-15T10:30:00+09:00", 
          "end_at": "2025-01-15T11:00:00+09:00",
          "status": "blocked"
        }
      ]
    }
  ]
}
```

## データ形式定義

### availabilityDays[].date
- **フォーマット**: `"YYYY-MM-DD"` (JST基準)
- **例**: `"2025-01-15"`
- **バリデーション**: ISO 8601 date format, JST timezone

### break_slots 入力形式
```json
{
  "break_slots": [
    {
      "start_time": "12:00",
      "end_time": "13:00",
      "description": "昼休憩"
    }
  ]
}
```

**JSONスキーマ**:
```json
{
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "start_time": {"type": "string", "pattern": "^([01]?[0-9]|2[0-3]):[0-5][0-9]$"},
      "end_time": {"type": "string", "pattern": "^([01]?[0-9]|2[0-3]):[0-5][0-9]$"},
      "description": {"type": "string", "maxLength": 100}
    },
    "required": ["start_time", "end_time"]
  }
}
```

### buffer_minutes
- **最小値**: 0分
- **最大値**: 120分
- **デフォルト**: 0分
- **バリデーション**: 0 <= buffer_minutes <= 120, 整数のみ

## availability_status の語義と用途

### TherapistShift.availability_status
- **open**: シフト登録済み、予約受付可能
- **busy**: シフト登録済み、予約受付不可（プライベート予約等）
- **off**: 休み、シフト未登録

### 用途
- **open**: カレンダーに空き枠として表示
- **busy**: カレンダーにblockedとして表示
- **off**: カレンダーに表示しない（枠自体が存在しない）

## リアルタイム検証要件

### 予約送信直前の検証フロー
1. **再検証API呼び出し**: 選択した時間枠の最新状態を確認
2. **競合チェック**: 他ユーザーによる予約がないか確認
3. **状態判定**: 
   - `open` → 予約処理続行
   - `blocked` → エラー表示、予約処理中止
   - `tentative` → 他ユーザーの仮押さえ、エラー表示

### 競合時のUI表示
```
エラーメッセージ: "申し訳ございません。選択された時間は他のお客様により予約されました。別の時間をお選びください。"
アクション: カレンダーを最新状態に更新、tentativeセルをクリア
```

## アイコン・色・UI制約の統一定義

### アイコン定義（統一）
- **open**: ◎ (二重丸)
- **tentative**: △ (三角)
- **blocked**: × (バツ)

### 色定義
```css
.availability-open {
  background-color: #22c55e; /* 緑 */
  color: #ffffff;
  cursor: pointer;
}

.availability-tentative {
  background-color: #fbbf24; /* 黄 */
  color: #000000;
  cursor: pointer;
}

.availability-blocked {
  background-color: #6b7280; /* グレー */
  color: #9ca3af;
  cursor: not-allowed;
  pointer-events: none;
  opacity: 0.6;
}
```

### テキスト代替
- **open**: "予約可能"
- **tentative**: "選択中"
- **blocked**: "予約不可"

## バリデーションルール

### フロントエンド検証
- tentativeセルが選択されていない場合、予約ボタンを無効化
- 過去の日時は自動的にblocked扱い
- 営業時間外は自動的にblocked扱い

### バックエンド検証
- 予約リクエスト受信時、対象時間枠の最新状態を再確認
- SoT（TherapistShift + GuestReservation）から計算した結果と照合
- 不整合がある場合は409 Conflictエラーを返却

## エラーハンドリング

### API エラーレスポンス
```json
{
  "error": "SLOT_UNAVAILABLE",
  "message": "選択された時間は予約できません",
  "details": {
    "slot_start": "2025-01-15T10:00:00+09:00",
    "current_status": "blocked",
    "reason": "already_reserved"
  }
}
```

### UI エラー表示
- エラーメッセージをカレンダー上部に表示
- 該当セルをハイライト表示
- 3秒後に自動的にメッセージを非表示
- カレンダーデータを最新状態に更新

## アクセシビリティ要件

### 色覚多様性対応
- 色だけでなくアイコンとパターンで状態を区別
- 高コントラスト比の確保（WCAG 2.1 AA準拠）

### キーボード操作
- Tabキーでセル間移動可能
- Enterキーでセル選択可能
- Escapeキーでtentative状態解除

### スクリーンリーダー対応
- aria-label属性で状態を音声読み上げ
- role="grid"でカレンダー構造を明示
- 状態変更時のaria-live通知

## 成功条件

### 機能要件
- [ ] 3つのステータス（open/tentative/blocked）が正確に表示される
- [ ] blockedセルがクリック不可能である
- [ ] tentativeセルの単一選択が機能する
- [ ] リアルタイム検証で競合を検出できる
- [ ] API responseにstatusフィールドが含まれる

### 非機能要件
- [ ] カレンダー表示が1秒以内に完了する
- [ ] 予約競合検証が500ms以内に完了する
- [ ] アクセシビリティ基準（WCAG 2.1 AA）を満たす
- [ ] モバイル端末で操作可能である

## 制約事項

### 技術制約
- 新しいステータス追加は禁止
- SoT仕様との矛盾は禁止
- slots_jsonをUI判定に使用することは禁止

### 運用制約
- tentative状態はセッション内のみ有効
- 同時に複数のtentativeセルは選択不可
- 過去の時間枠は常にblocked扱い