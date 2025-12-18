/**
 * 空き枠データの正規化・変換ユーティリティ
 *
 * 複数のコンポーネントで使用される availabilitySlots/availabilityDays の
 * 変換ロジックを統一するためのモジュール
 */

import {
  today as jstToday,
  extractDate,
  extractTime,
  isToday as jstIsToday,
  isSameDate,
  formatDateISO,
} from '@/lib/jst'

// =============================================================================
// Deprecated re-exports for backward compatibility (used by tests)
// Use lib/jst.ts directly in new code
// =============================================================================

/** @deprecated Use today() from lib/jst.ts */
export const getTodayIsoString = jstToday

/** @deprecated Use extractDate() from lib/jst.ts */
export const extractDateFromIso = extractDate

/** @deprecated Use isSameDate() from lib/jst.ts */
export const isSameDayIso = isSameDate

/** @deprecated Use isToday() from lib/jst.ts */
export const isTodayIso = jstIsToday

/** @deprecated Use isSameDate(formatDateISO(d1), formatDateISO(d2)) from lib/jst.ts */
export function isSameDay(date1: Date, date2: Date): boolean {
  return isSameDate(formatDateISO(date1), formatDateISO(date2))
}

/** @deprecated Use extractTime() from lib/jst.ts */
export const extractTimeKey = extractTime

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
  /** HH:mm形式の時刻キー（例: "18:00"）- カレンダーグリッド表示用 */
  timeKey?: string
}

export type NormalizedAvailabilityDay = {
  date: string // "YYYY-MM-DD"
  is_today: boolean
  /** 表示用ラベル（例: "12月9日"）- UI表示用 */
  label?: string
  slots: NormalizedSlot[]
}

/**
 * UI表示用の拡張された日付型
 * label と isToday を必須にした NormalizedAvailabilityDay
 */
export type DisplayAvailabilityDay = Omit<NormalizedAvailabilityDay, 'is_today' | 'label'> & {
  isToday: boolean
  label: string
  slots: Array<NormalizedSlot & { timeKey: string }>
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

  const today = todayIso || jstToday()
  const grouped = new Map<string, NormalizedAvailabilityDay>()

  for (const slot of slots) {
    if (!slot.start_at) continue

    const dateStr = extractDate(slot.start_at)

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

  const today = jstToday()
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

// =============================================================================
// DisplayAvailabilityDay 用ヘルパー（UI表示用）
// =============================================================================

export type DisplaySlot = NormalizedSlot & { timeKey: string }

export type DisplaySelectableSlotWithDay = {
  day: DisplayAvailabilityDay
  slot: DisplaySlot & { status: SelectableStatus }
}

/**
 * NormalizedAvailabilityDay[] を DisplayAvailabilityDay[] に変換
 *
 * @param days - 正規化された日付配列
 * @param formatLabel - 日付からラベルを生成する関数
 * @param todayIso - 本日の日付文字列（省略時は現在日付）
 */
export function toDisplayAvailabilityDays(
  days: NormalizedAvailabilityDay[] | null | undefined,
  formatLabel: (date: Date) => string,
  todayIso?: string,
): DisplayAvailabilityDay[] {
  if (!days?.length) return []

  const today = todayIso || jstToday()

  return days.map((day) => ({
    date: day.date,
    isToday: day.is_today || day.date === today,
    label: day.label || formatLabel(new Date(`${day.date}T00:00:00`)),
    slots: day.slots.map((slot) => ({
      ...slot,
      timeKey: slot.timeKey || extractTime(slot.start_at),
    })),
  }))
}

/**
 * DisplayAvailabilityDay[] から選択可能なスロットを検索
 */
export function findDisplaySelectableSlot(
  days: DisplayAvailabilityDay[] | null | undefined,
  startAt: string | null | undefined,
): DisplaySelectableSlotWithDay | null {
  if (!days?.length || !startAt) return null

  const targetTs = new Date(startAt).getTime()
  if (Number.isNaN(targetTs)) return null

  for (const day of days) {
    for (const slot of day.slots) {
      if (slot.status === 'blocked') continue
      const slotTs = new Date(slot.start_at).getTime()
      if (!Number.isNaN(slotTs) && slotTs === targetTs) {
        return { day, slot: slot as DisplaySlot & { status: SelectableStatus } }
      }
    }
  }
  return null
}

/**
 * DisplayAvailabilityDay[] から最初の選択可能なスロットを取得
 */
export function getFirstDisplaySelectableSlot(
  days: DisplayAvailabilityDay[] | null | undefined,
): DisplaySelectableSlotWithDay | null {
  if (!days?.length) return null

  for (const day of days) {
    for (const slot of day.slots) {
      if (slot.status !== 'blocked') {
        return { day, slot: slot as DisplaySlot & { status: SelectableStatus } }
      }
    }
  }
  return null
}

/**
 * DisplayAvailabilityDay[] から defaultStart に一致するスロット、
 * または最初の選択可能なスロットを取得
 */
export function findDefaultDisplaySelectableSlot(
  days: DisplayAvailabilityDay[] | null | undefined,
  defaultStart: string | null | undefined,
): DisplaySelectableSlotWithDay | null {
  if (defaultStart) {
    const match = findDisplaySelectableSlot(days, defaultStart)
    if (match) return match
  }
  return getFirstDisplaySelectableSlot(days)
}
