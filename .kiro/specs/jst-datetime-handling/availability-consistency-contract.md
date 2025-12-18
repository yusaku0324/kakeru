# Availability Consistency Contract

## 概要

本システムでは、以下のUI表示はすべて「同一の空き枠計算結果」に基づくものとする。

## 前提条件

この契約は以下の前提条件が満たされていることを前提とする：
- 有効なセラピストカードがシステムに存在する
- セラピストカードは必ず1つの店舗に所属している
- 有効なシフトが作成済みで存在している
- シフト作成フロー、営業時間制約、命名規則は上流プロセスで処理済み

**スコープ**: この契約は既存の有効なシフトからの空き枠計算とUI表示整合性のみを対象とする。

## 対象UI

- **シフト作成に基づく空き枠計算**
- **予約フォームのカレンダー表示**（○ / × / △）
- **セラピストカードの「次回◯時〜」表示**
- **today_available / next_available_slot 等の派生値**

## Feature: Next Available Slot Canonicalization

### Definition
`next_available_slot` は、`availability_slots` の中からJST基準で最も早い `start_at` を持つ slot とする。

### Rules
1. **Backend決定原則**: Backend が `next_available_slot` を決定する
2. **Frontend非計算原則**: UI は `next_available_slot` を再計算・再解釈しない
3. **空配列処理**: `availability_slots` が空の場合、`next_available_slot` は `null`
4. **順序保証**: `availability_slots` が存在する場合、`next_available_slot.start_at === availability_slots[0].start_at` が常に成り立つ

### Success Criteria
- セラピストカードの表示時刻とカレンダー最初の空き枠が完全一致する
- Playwright E2E で完全一致を検証できる

## 契約ルール

### 1. 単一責任原則
空き枠の計算はBackendのavailabilityロジックのみが行う

### 2. Frontend非計算原則
Frontendは空き枠を再計算・再解釈しない

### 3. API準拠原則
すべてのUI表示はAPIが返すslot/availability情報に従う

### 4. 一貫性保証原則
表示差異が出た場合、それはバグとみなす

## 成功条件

### UI一貫性
- 同一日時に対して、カレンダー表示とセラピストカード表示が矛盾しない
- 「次回◯時〜」の時刻がカレンダーの最初の空きスロットと一致する
- today_available フラグとカレンダーの本日空き状況が一致する

### テスト検証可能性
- Playwright E2Eで両UIが同一真実を表示していることを検証できる
- 自動テストで表示矛盾を検出できる

## 実装における注意点

### Backend責務
```typescript
// ✅ 正しい: Backendで空き枠計算 + next_available_slot決定
const availabilitySlots = await calculateAvailability(therapistId, dateRange)
const nextAvailableSlot = availabilitySlots.length > 0 ? availabilitySlots[0] : null

return { 
  slots: availabilitySlots,
  next_available_slot: nextAvailableSlot
}
```

### Frontend責務
```typescript
// ✅ 正しい: APIレスポンスをそのまま使用
const { slots, next_available_slot } = await fetchAvailability(therapistId)

// セラピストカード表示
const cardDisplay = next_available_slot ? formatTime(next_available_slot.start_at) : '空きなし'

// カレンダー表示
const calendarSlots = slots // そのまま表示

// ❌ 間違い: Frontend独自の next_available_slot 計算
const myNextSlot = findEarliestSlot(slots) // 禁止：Backendが決定済み
```

### Next Available Slot Canonicalization
```typescript
// ✅ 正しい: Backend決定の next_available_slot を使用
const { slots, next_available_slot } = apiResponse

// セラピストカード
const cardTime = next_available_slot?.start_at

// カレンダー最初のスロット  
const calendarFirstSlot = slots[0]?.start_at

// 保証: cardTime === calendarFirstSlot (Backend契約)

// ❌ 間違い: Frontend独自の「最初のスロット」計算
const myFirstSlot = slots.find(s => s.status === 'open')?.start_at // 禁止
```

## 検証方法

### E2Eテストパターン
```typescript
test('next available slot canonicalization', async ({ page, request }) => {
  // 1. API直接呼び出しで期待値を取得
  const apiResponse = await request.get(`/api/therapists/${therapistId}/availability`)
  const { slots, next_available_slot } = await apiResponse.json()
  
  // 2. Backend契約の検証
  if (slots.length > 0) {
    expect(next_available_slot.start_at).toBe(slots[0].start_at)
  } else {
    expect(next_available_slot).toBeNull()
  }
  
  // 3. UI表示の一致検証
  const cardNextTime = await getCardNextAvailableTime(page, therapistId)
  const calendarFirstSlot = await getCalendarFirstAvailableSlot(page, therapistId)
  
  // 4. 完全一致を検証
  expect(cardNextTime).toBe(calendarFirstSlot)
  expect(cardNextTime).toBe(next_available_slot?.start_at)
})
```

### API契約テスト
```typescript
test('UI displays match API response exactly', async ({ page, request }) => {
  // 1. API直接呼び出し
  const apiResponse = await request.get(`/api/therapists/${id}/availability`)
  const apiSlots = await apiResponse.json()
  
  // 2. UI表示を取得
  const uiDisplayedSlots = await extractUIAvailabilityData(page)
  
  // 3. 完全一致を検証
  expect(uiDisplayedSlots).toEqual(transformForDisplay(apiSlots))
})
```

## 違反例と修正

### 違反例1: Frontend独自のnext_available_slot計算
```typescript
// ❌ 違反: Frontendで next_available_slot を再計算
function getNextAvailableSlot(slots) {
  return slots
    .filter(s => s.status === 'open')
    .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))[0]
}
```

### 修正例1: Backend決定のnext_available_slotを使用
```typescript
// ✅ 修正: APIレスポンスのnext_available_slotを使用
function displayNextAvailable(apiResponse) {
  const { next_available_slot } = apiResponse
  return next_available_slot ? formatTime(next_available_slot.start_at) : '空きなし'
}
```

### 違反例2: 順序保証の違反
```typescript
// ❌ 違反: Backend契約に依存しない独自ソート
// CardComponent.tsx
const nextSlot = slots
  .filter(s => s.status === 'open')
  .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))[0]

// CalendarComponent.tsx  
const firstSlot = slots[0] // Backend順序に依存
```

### 修正例2: Backend契約の統一利用
```typescript
// ✅ 修正: Backend決定のnext_available_slotを統一使用
// CardComponent.tsx
const nextSlot = apiResponse.next_available_slot

// CalendarComponent.tsx
const firstSlot = apiResponse.next_available_slot

// 保証: nextSlot === firstSlot (Backend契約により)
```

## まとめ

このAvailability Consistency Contract + Next Available Slot Canonicalizationにより：

1. **UI間の矛盾を防止**: セラピストカードとカレンダーが常に同じ時刻を表示
2. **Backend/Frontend責務の明確化**: next_available_slotはBackend決定、Frontend表示のみ
3. **テスト可能な一貫性保証**: E2Eで完全一致を機械的に検証
4. **保守性の向上**: 単一の真実の源泉（Backend API）
5. **順序保証の明確化**: availability_slots[0] === next_available_slot の契約

が実現され、ユーザーが混乱することなく、開発者も安心してコードを変更できるシステムとなる。

### 核心的な保証

```typescript
// この等式が常に成り立つことをシステムが保証
next_available_slot.start_at === availability_slots[0].start_at

// UI表示の完全一致
therapistCard.displayTime === calendar.firstSlotTime === next_available_slot.start_at
```