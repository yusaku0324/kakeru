/**
 * 空き枠データの正規化・変換ユーティリティ
 *
 * 複数のコンポーネントで使用される availabilitySlots/availabilityDays の
 * 変換ロジックを統一するためのモジュール
 */

// =============================================================================
// 型定義
// =============================================================================

export type AvailabilityStatus = 'open' | 'tentative' | 'blocked'

/** blocked を除いた選択可能なステータス */
export type SelectableStatus = Exclude<AvailabilityStatus, 'blocked'>

/** 選択可能なスロット（blocked を除外） */
export type SelectableSlot = {
  start_at: string
  end_at: string
  status: SelectableStatus
}

export type RawAvailabilitySlot = {
  start_at: string
  end_at: string
  status?: string | null
}

export type NormalizedSlot = {
  start_at: string
  end_at: string
  status: AvailabilityStatus
}

export type NormalizedAvailabilityDay = {
  date: string // "YYYY-MM-DD"
  is_today: boolean
  slots: NormalizedSlot[]
}

// =============================================================================
// 日付ユーティリティ (JSTベース)
// =============================================================================

const JST_OFFSET_MS = 9 * 60 * 60 * 1000

/**
 * 現在の日付をJST基準でYYYY-MM-DD形式で取得
 */
export function getTodayIsoString(): string {
  const now = new Date()
  // JSTのローカル日付を取得
  const jst = new Date(now.getTime() + JST_OFFSET_MS)
  const year = jst.getUTCFullYear()
  const month = String(jst.getUTCMonth() + 1).padStart(2, '0')
  const date = String(jst.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${date}`
}

/**
 * ISO文字列から日付部分(YYYY-MM-DD)を抽出
 */
export function extractDateFromIso(isoString: string): string {
  return isoString.split('T')[0]
}

/**
 * 2つの日付文字列が同じ日かどうかを判定
 */
export function isSameDayIso(dateStr1: string, dateStr2: string): boolean {
  return extractDateFromIso(dateStr1) === extractDateFromIso(dateStr2)
}

/**
 * ISO文字列の日付が本日かどうかを判定
 */
export function isTodayIso(isoString: string): boolean {
  return extractDateFromIso(isoString) === getTodayIsoString()
}

/**
 * 2つのDateオブジェクトがJST基準で同じ日かどうかを判定
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  const d1 = new Date(date1.getTime() + JST_OFFSET_MS)
  const d2 = new Date(date2.getTime() + JST_OFFSET_MS)
  return (
    d1.getUTCFullYear() === d2.getUTCFullYear() &&
    d1.getUTCMonth() === d2.getUTCMonth() &&
    d1.getUTCDate() === d2.getUTCDate()
  )
}

// =============================================================================
// ステータス正規化
// =============================================================================

/**
 * APIから返されるステータス値を正規化
 */
export function normalizeSlotStatus(rawStatus?: string | null): AvailabilityStatus {
  const status = (rawStatus ?? 'open').toLowerCase()
  if (status === 'open' || status === 'available' || status === 'ok') return 'open'
  if (status === 'tentative' || status === 'maybe') return 'tentative'
  if (status === 'blocked' || status === 'unavailable') return 'blocked'
  return 'open' // デフォルト
}

// =============================================================================
// availabilitySlots → availabilityDays 変換
// =============================================================================

/**
 * フラットなスロット配列を日付ごとにグループ化して正規化
 *
 * @param slots - APIから取得したスロット配列
 * @param todayIso - 本日の日付文字列（省略時は現在日付）
 * @returns 正規化された日付ごとのスロット配列
 */
export function normalizeAvailabilityDays(
  slots: RawAvailabilitySlot[] | null | undefined,
  todayIso?: string,
): NormalizedAvailabilityDay[] | null {
  if (!slots?.length) return null

  const today = todayIso || getTodayIsoString()
  const grouped = new Map<string, NormalizedAvailabilityDay>()

  for (const slot of slots) {
    if (!slot.start_at) continue

    const dateStr = extractDateFromIso(slot.start_at)

    if (!grouped.has(dateStr)) {
      grouped.set(dateStr, {
        date: dateStr,
        is_today: dateStr === today,
        slots: [],
      })
    }

    const day = grouped.get(dateStr)!

    // 重複スロットを防ぐ
    const isDuplicate = day.slots.some(
      (s) => s.start_at === slot.start_at && s.end_at === slot.end_at
    )

    if (!isDuplicate) {
      day.slots.push({
        start_at: slot.start_at,
        end_at: slot.end_at,
        status: normalizeSlotStatus(slot.status),
      })
    }
  }

  // 日付でソートして返す
  return Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date))
}

// =============================================================================
// ヘルパー関数
// =============================================================================

/**
 * availabilityDays の中に本日の空き枠があるか判定
 */
export function hasTodayAvailability(
  availabilityDays: NormalizedAvailabilityDay[] | null | undefined,
): boolean {
  if (!availabilityDays?.length) return false

  const today = getTodayIsoString()
  const todayData = availabilityDays.find((day) => day.date === today)

  if (!todayData?.slots?.length) return false

  // open または tentative のスロットがあるか
  return todayData.slots.some(
    (slot) => slot.status === 'open' || slot.status === 'tentative'
  )
}

/**
 * availabilityDays から最初の空き枠を取得
 */
export function getFirstAvailableSlot(
  availabilityDays: NormalizedAvailabilityDay[] | null | undefined,
): { day: NormalizedAvailabilityDay; slot: NormalizedSlot } | null {
  if (!availabilityDays?.length) return null

  for (const day of availabilityDays) {
    for (const slot of day.slots) {
      if (slot.status === 'open' || slot.status === 'tentative') {
        return { day, slot }
      }
    }
  }

  return null
}

/**
 * 指定した start_at に一致するスロットを検索
 */
export function findSlotByStartAt(
  availabilityDays: NormalizedAvailabilityDay[] | null | undefined,
  startAt: string,
): { day: NormalizedAvailabilityDay; slot: NormalizedSlot } | null {
  if (!availabilityDays?.length || !startAt) return null

  const targetTs = new Date(startAt).getTime()
  if (Number.isNaN(targetTs)) return null

  for (const day of availabilityDays) {
    for (const slot of day.slots) {
      const slotTs = new Date(slot.start_at).getTime()
      if (!Number.isNaN(slotTs) && slotTs === targetTs) {
        return { day, slot }
      }
    }
  }

  return null
}

// =============================================================================
// 型ガード
// =============================================================================

/**
 * スロットが選択可能（blocked でない）かどうかを判定する型ガード
 */
export function isSelectableSlot(slot: NormalizedSlot): slot is NormalizedSlot & { status: SelectableStatus } {
  return slot.status !== 'blocked'
}

// =============================================================================
// 選択用ヘルパー関数
// =============================================================================

export type SelectableSlotWithDay = {
  day: NormalizedAvailabilityDay
  slot: SelectableSlot
}

/**
 * 指定した start_at に一致する選択可能なスロットを検索
 * blocked スロットは除外される
 */
export function findSelectableSlotByStartAt(
  availabilityDays: NormalizedAvailabilityDay[] | null | undefined,
  startAt: string | null | undefined,
): SelectableSlotWithDay | null {
  if (!availabilityDays?.length || !startAt) return null

  const targetTs = new Date(startAt).getTime()
  if (Number.isNaN(targetTs)) return null

  for (const day of availabilityDays) {
    for (const slot of day.slots) {
      if (!isSelectableSlot(slot)) continue
      const slotTs = new Date(slot.start_at).getTime()
      if (!Number.isNaN(slotTs) && slotTs === targetTs) {
        return { day, slot }
      }
    }
  }

  return null
}

/**
 * 最初の選択可能なスロットを取得
 * blocked スロットは除外される
 */
export function getFirstSelectableSlot(
  availabilityDays: NormalizedAvailabilityDay[] | null | undefined,
): SelectableSlotWithDay | null {
  if (!availabilityDays?.length) return null

  for (const day of availabilityDays) {
    for (const slot of day.slots) {
      if (isSelectableSlot(slot)) {
        return { day, slot }
      }
    }
  }

  return null
}

/**
 * defaultStart に一致するスロット、または最初の選択可能なスロットを取得
 * デフォルト選択ロジックを統一するためのユーティリティ
 */
export function findDefaultSelectableSlot(
  availabilityDays: NormalizedAvailabilityDay[] | null | undefined,
  defaultStart: string | null | undefined,
): SelectableSlotWithDay | null {
  // まず defaultStart に一致するスロットを検索
  if (defaultStart) {
    const match = findSelectableSlotByStartAt(availabilityDays, defaultStart)
    if (match) return match
  }
  // 見つからなければ最初の選択可能なスロットを返す
  return getFirstSelectableSlot(availabilityDays)
}
