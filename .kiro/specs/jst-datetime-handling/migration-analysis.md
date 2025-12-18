# JST仕様適用のための差分設計・移行分析

## 現行実装の評価

### 既存の強み（変更不要な部分）

#### 1. `osakamenesu/apps/web/src/lib/jst.ts` - **変更不要**
- ✅ JST基準の日付処理が既に完全に実装済み
- ✅ `Intl.DateTimeFormat` でタイムゾーン固定済み
- ✅ テスト用の時刻注入機能（`setNowForTesting`）完備
- ✅ 禁止事項が明確に文書化されている
- ✅ すべての関数がピュア関数として設計済み

**評価**: JST仕様の要求を既に満たしている。DateTime Handlerの核となる部分。

#### 2. `osakamenesu/apps/web/src/lib/availability-date-range.ts` - **変更不要**
- ✅ JST基準の日付レンジ生成が実装済み
- ✅ ユニットテスト可能な純粋関数として分離済み
- ✅ 連続性検証機能も含む
- ✅ デバッグ情報取得機能完備

**評価**: 日付レンジ処理は既に仕様要求を満たしている。

#### 3. E2Eテストの基盤 - **拡張のみ必要**
- ✅ JST整合性テストが既に存在
- ✅ API-UI間の一貫性検証済み
- ✅ 境界条件テストも実装済み

**評価**: Playwright E2Eテストの基盤は既に整備されている。

### 改善が必要な部分

#### 1. `osakamenesu/apps/web/src/lib/availability.ts` - **リファクタリング必要**

**問題点**:
```typescript
// 非推奨関数が多数存在
export function getTodayIsoString(): string {
  return jstToday() // @deprecated lib/jst.ts の today() を直接使用してください
}
```

**対応**: 
- 非推奨関数を削除し、`lib/jst.ts`への直接委譲に統一
- 型定義は保持（既存のコンポーネントが依存）

#### 2. `route.ts` - **部分的な改善必要**

**問題点**:
```typescript
// JST計算が複雑で可読性が低い
const dayBaseJst = new Date(`${dateStr}T00:00:00+09:00`)
let minHour = 24
let maxHour = 0
for (const avail of availableSlots) {
  const start = new Date(avail.start_at)
  // ... 複雑な時間計算
}
```

**対応**:
- `lib/jst.ts`の関数を活用してシンプル化
- 時間計算ロジックを`lib/jst.ts`に移動

## 差分設計：変更分類

### 🟢 変更不要（Keep As-Is）

1. **`lib/jst.ts`の核となる関数群**
   - `formatDateISO()`, `formatTimeHM()`, `today()`, `isToday()`
   - `parseJstDateAtMidnight()`, `addDays()`, `weekRange()`
   - テスト用の`setNowForTesting()`

2. **`availability-date-range.ts`の日付生成ロジック**
   - `generateWeekDateRangeWithToday()`
   - `formatDateJST()`, `getTodayJST()`

3. **E2Eテストの基本構造**
   - JST整合性テストのフレームワーク
   - API-UI一貫性検証パターン

### 🟡 リファクタリング必要（Refactor）

1. **`availability.ts`の非推奨関数削除**
```typescript
// 削除対象
export function getTodayIsoString(): string
export function extractDateFromIso(isoString: string): string
export function isSameDayIso(dateStr1: string, dateStr2: string): boolean
export function isTodayIso(isoString: string): boolean
export function isSameDay(date1: Date, date2: Date): boolean
export function extractTimeKey(isoString: string): string

// 置き換え先: lib/jst.ts の対応関数を直接使用
```

2. **`route.ts`の時間計算ロジック簡素化**
```typescript
// 現在の複雑な実装を
function generateTimeSlots(dateStr: string, availableSlots: AvailabilitySlot[], isToday: boolean)

// lib/jst.ts の関数を使ってシンプル化
```

### 🔴 新規追加必要（Add New）

1. **プロパティベーステスト（オプション）**
   - `lib/jst.ts`の関数群に対するProperty-Based Testing
   - 既存のE2Eテストを補完する形で追加

2. **JST処理の統一ガイドライン**
   - 既存の禁止事項を拡張
   - チーム全体での統一ルール文書化

3. **エラーハンドリングの強化**
   - 不正な日付入力に対する統一的なエラー処理
   - ログ出力の標準化

## 移行戦略：段階的アプローチ

### Phase 1: クリーンアップ（低リスク）
1. `availability.ts`から非推奨関数を削除
2. 全ての`import`文を`lib/jst.ts`直接参照に変更
3. 既存テストが通ることを確認

### Phase 2: 最適化（中リスク）
1. `route.ts`の時間計算ロジックを`lib/jst.ts`に移動
2. 複雑な日付計算を既存の関数で置き換え
3. E2Eテストで回帰がないことを確認

### Phase 3: 拡張（低リスク・オプション）
1. プロパティベーステストの追加
2. エラーハンドリングの強化
3. 監視・アラート機能の追加

## Backend/Frontend責務境界の維持

### 現行の責務分担（維持）
- **Backend**: JST基準でのデータ生成・保存
- **Frontend**: JST基準での表示・入力処理
- **API Layer**: JST形式での入出力標準化

### 境界を崩さない実装方針
1. **APIレスポンス形式は変更しない**
   - 既存の`start_at`, `end_at`フィールド形式を維持
   - `+09:00`タイムゾーン表記を継続

2. **フロントエンドの型定義は保持**
   - `AvailabilitySlot`, `NormalizedAvailabilityDay`等の型は維持
   - 既存コンポーネントの破壊的変更を回避

3. **データフロー方向は変更しない**
   - Backend → API → Frontend の一方向データフロー維持
   - 既存のキャッシュ戦略・状態管理は保持

## 既存E2Eテストとの接続

### 現行テストの活用
1. **`jst-date-consistency.spec.ts`を基盤として拡張**
   - 既存の5つのテストケースは保持
   - 新しいプロパティテストを追加形式で実装

2. **テストデータ生成の統一**
   - 既存の`USE_SAMPLES`フラグを活用
   - サンプルデータとリアルAPIの両方で検証継続

3. **境界条件テストの拡張**
   - 既存の0:00境界テストを基に、より多くのエッジケースを追加
   - リープ年、月末境界等の追加検証

## 実装優先度

### 高優先度（即座に実施可能）
1. `availability.ts`の非推奨関数削除
2. Import文の`lib/jst.ts`直接参照への統一
3. 既存テストでの回帰確認

### 中優先度（段階的実施）
1. `route.ts`の時間計算ロジック最適化
2. エラーハンドリングの統一化
3. 追加のE2Eテストケース

### 低優先度（オプション）
1. プロパティベーステストの追加
2. 監視・アラート機能
3. パフォーマンス最適化

## 結論

現行実装は既にJST仕様の要求を高いレベルで満たしており、**破壊的変更は不要**です。主な作業は：

1. **クリーンアップ**: 非推奨関数の削除と統一化
2. **最適化**: 複雑なロジックの簡素化
3. **拡張**: オプションのテスト・監視機能追加

この段階的アプローチにより、**現行実装を壊すことなく**JST仕様を完全に適用できます。