'use client'

import {
  type Dispatch,
  type MouseEvent,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import type { SelectedSlot } from '@/components/calendar/AvailabilityPickerDesktop'
import type { AvailabilityStatus } from '@/components/calendar/types'

import { formatLocalDate, getJaFormatter, toIsoWithOffset } from '@/utils/date'
import { parseJstDateAtMidnight } from '@/lib/jst'
import type { ReservationOverlayProps } from '../ReservationOverlay'
import {
  type DisplayAvailabilityDay,
  type DisplaySlot,
  type SelectableStatus,
  toDisplayAvailabilityDays,
  findDefaultDisplaySelectableSlot,
  getFirstDisplaySelectableSlot,
} from '@/lib/availability'
import { buildTimelineTimes, calculateSchedulePages } from './utils'

type AvailabilityTemplate = Array<{
  dayOffset: number
  slots: Array<{
    hour: number
    minute: number
    durationMinutes: number
    status: AvailabilityStatus
  }>
}>

export type OverlayFormTab = 'schedule' | 'info'
export type SlotStatus = SelectableStatus

// lib/availability.ts の型を再エクスポート（後方互換性）
export type NormalizedDay = DisplayAvailabilityDay
export type NormalizedSlot = DisplaySlot

// 空き状況のソースを示す型
export type AvailabilitySourceType = 'api' | 'fallback' | 'none'

// フォールバック表示が有効かどうか（環境変数で制御）
const ENABLE_AVAILABILITY_FALLBACK = process.env.NEXT_PUBLIC_ENABLE_AVAILABILITY_FALLBACK === 'true'

// 空き状況データの型
export type AvailabilityDay = NonNullable<ReservationOverlayProps['availabilityDays']>[number]

type UseReservationOverlayStateParams = {
  availabilityDays?: ReservationOverlayProps['availabilityDays']
  fallbackAvailability?: AvailabilityTemplate
  defaultStart?: string | null
  slotDurationMinutes?: number | null
}

export type ReservationOverlayState = {
  dayFormatter: Intl.DateTimeFormat
  timeFormatter: Intl.DateTimeFormat
  scheduleRangeLabel: string
  currentMonthLabel: string
  schedulePage: number
  schedulePageCount: number
  setSchedulePage: Dispatch<SetStateAction<number>>
  currentScheduleDays: NormalizedDay[]
  timelineTimes: Array<{ key: string; label: string }>
  selectedSlots: SelectedSlot[]
  toggleSlot: (day: NormalizedDay, slot: NormalizedSlot) => void
  removeSlot: (startAt: string) => void
  ensureSelection: () => SelectedSlot[]
  hasAvailability: boolean
  availabilitySourceType: AvailabilitySourceType
  formOpen: boolean
  formTab: OverlayFormTab
  setFormTab: Dispatch<SetStateAction<OverlayFormTab>>
  openForm: () => void
  closeForm: () => void
  handleFormBackdrop: (event: MouseEvent<HTMLDivElement>) => void
  // 空き状況データの更新機能
  updateAvailability: (days: AvailabilityDay[]) => void
  isRefreshing: boolean
}

export function useReservationOverlayState({
  availabilityDays,
  fallbackAvailability,
  defaultStart,
  slotDurationMinutes,
}: UseReservationOverlayStateParams): ReservationOverlayState {
  const [formOpen, setFormOpen] = useState(false)
  const [formTab, setFormTab] = useState<OverlayFormTab>('schedule')
  const [schedulePage, setSchedulePage] = useState(0)
  const [selectedSlots, setSelectedSlots] = useState<SelectedSlot[]>([])
  // 更新された空き状況データ（リフレッシュ後のデータ）
  const [freshAvailabilityDays, setFreshAvailabilityDays] = useState<AvailabilityDay[] | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // 実際に使用する空き状況データ（freshがあればそれを使用）
  const effectiveAvailabilityDays = freshAvailabilityDays ?? availabilityDays

  const dayFormatter = getJaFormatter('day')
  const timeFormatter = getJaFormatter('time')

  // Use local date format to ensure consistent timezone handling (JST)
  const todayIso = useMemo(() => formatLocalDate(new Date()), [])

  // 空き状況のソースと種別を計算
  const { availabilitySource, availabilitySourceType } = useMemo(() => {
    // APIからのデータを使用するのは、実際にスロットがある場合のみ
    if (Array.isArray(effectiveAvailabilityDays) && effectiveAvailabilityDays.length) {
      const hasAnySlots = effectiveAvailabilityDays.some((day) => Array.isArray(day.slots) && day.slots.length > 0)
      if (hasAnySlots) {
        return { availabilitySource: effectiveAvailabilityDays, availabilitySourceType: 'api' as const }
      }
    }

    // フォールバックが無効または未定義の場合は空状態
    if (!ENABLE_AVAILABILITY_FALLBACK || !Array.isArray(fallbackAvailability) || fallbackAvailability.length === 0) {
      return { availabilitySource: [], availabilitySourceType: 'none' as const }
    }

    // フォールバック（デモ）データを生成
    const base = new Date()
    base.setHours(0, 0, 0, 0)
    const fallbackData = fallbackAvailability.map((template) => {
      const date = new Date(base)
      date.setDate(base.getDate() + template.dayOffset)
      const iso = formatLocalDate(date)
      return {
        date: iso,
        is_today: template.dayOffset === 0,
        slots: template.slots.map((slot) => {
          const start = new Date(date)
          start.setHours(slot.hour, slot.minute, 0, 0)
          const end = new Date(start)
          end.setMinutes(end.getMinutes() + slot.durationMinutes)
          return {
            start_at: toIsoWithOffset(start),
            end_at: toIsoWithOffset(end),
            status: slot.status,
          }
        }),
      }
    })
    return { availabilitySource: fallbackData, availabilitySourceType: 'fallback' as const }
  }, [effectiveAvailabilityDays, fallbackAvailability])

  const normalizedAvailability = useMemo<NormalizedDay[]>(() => {
    const days = Array.isArray(availabilitySource) ? availabilitySource : []
    // lib/availability.ts の統一関数を使用して正規化
    return toDisplayAvailabilityDays(
      days.map((day) => ({
        date: day.date,
        is_today: Boolean(day.is_today) || day.date === todayIso,
        slots: (Array.isArray(day.slots) ? day.slots : []).map((slot) => ({
          start_at: slot.start_at,
          end_at: slot.end_at,
          status: slot.status,
        })),
      })),
      (date) => dayFormatter.format(date),
      todayIso,
    )
  }, [availabilitySource, dayFormatter, todayIso])

  const timelineTimes = useMemo(
    () => buildTimelineTimes(normalizedAvailability, {
      slotDurationMinutes: slotDurationMinutes ?? undefined,
    }),
    [normalizedAvailability, slotDurationMinutes],
  )

  const schedulePages = useMemo(
    () =>
      calculateSchedulePages({
        normalizedAvailability,
        dayFormatter,
        todayIso,
      }),
    [dayFormatter, normalizedAvailability, todayIso],
  )

  const currentScheduleDays = useMemo(
    () => schedulePages[schedulePage] ?? schedulePages[0] ?? [],
    [schedulePage, schedulePages],
  )

  const currentMonthLabel = useMemo(() => {
    const day = currentScheduleDays[0]
    if (!day) return ''
    const date = parseJstDateAtMidnight(day.date)
    if (Number.isNaN(date.getTime())) return day.label
    return `${date.getFullYear()}年${date.getMonth() + 1}月`
  }, [currentScheduleDays])

  const scheduleRangeLabel = useMemo(() => {
    if (!currentScheduleDays.length) return '空き状況'
    return `${currentScheduleDays[0].label}〜${currentScheduleDays[currentScheduleDays.length - 1].label}`
  }, [currentScheduleDays])

  const schedulePageCount = schedulePages.length
  const hasAvailability = useMemo(
    () => normalizedAvailability.some((day) => day.slots.length),
    [normalizedAvailability],
  )

  useEffect(() => {
    if (schedulePage >= schedulePages.length) {
      setSchedulePage(Math.max(0, schedulePages.length - 1))
    }
  }, [schedulePage, schedulePages.length])

  // lib/availability.ts の統一ヘルパー関数を使用
  useEffect(() => {
    if (selectedSlots.length) return

    // defaultStart に一致するスロット、または最初の選択可能なスロットを取得
    const match = findDefaultDisplaySelectableSlot(normalizedAvailability, defaultStart)
    if (match) {
      setSelectedSlots([
        {
          startAt: match.slot.start_at,
          endAt: match.slot.end_at,
          date: match.day.date,
          status: match.slot.status,
        },
      ])
    }
  }, [defaultStart, normalizedAvailability, selectedSlots.length])

  const toggleSlot = useCallback((day: NormalizedDay, slot: NormalizedSlot) => {
    if (slot.status === 'blocked') return
    const selectableStatus: SlotStatus = slot.status
    setSelectedSlots((prev) => {
      const exists = prev.some((item) => item.startAt === slot.start_at)
      if (exists) {
        return prev.filter((item) => item.startAt !== slot.start_at)
      }
      const next = [
        ...prev,
        { startAt: slot.start_at, endAt: slot.end_at, date: day.date, status: selectableStatus },
      ]
      if (next.length > 3) next.shift()
      return next
    })
  }, [])

  const ensureSelection = useCallback(() => {
    if (selectedSlots.length) return selectedSlots
    const match = getFirstDisplaySelectableSlot(normalizedAvailability)
    if (match) {
      const initial: SelectedSlot = {
        startAt: match.slot.start_at,
        endAt: match.slot.end_at,
        date: match.day.date,
        status: match.slot.status,
      }
      setSelectedSlots([initial])
      return [initial]
    }
    return []
  }, [normalizedAvailability, selectedSlots])

  const removeSlot = useCallback((startAt: string) => {
    setSelectedSlots((prev) => prev.filter((item) => item.startAt !== startAt))
  }, [])

  const openForm = useCallback(() => {
    const selection = ensureSelection()
    // Find the page containing the first selected slot
    let targetPage = 0
    if (selection.length > 0) {
      const selectedDate = selection[0].date
      const pageIndex = schedulePages.findIndex((page) =>
        page.some((day) => day.date === selectedDate)
      )
      if (pageIndex >= 0) {
        targetPage = pageIndex
      }
    }
    setSchedulePage(targetPage)
    setFormTab(hasAvailability ? 'schedule' : 'info')
    setFormOpen(true)
  }, [ensureSelection, hasAvailability, schedulePages])

  useEffect(() => {
    if (!formOpen) return
    setFormTab(hasAvailability ? 'schedule' : 'info')
  }, [formOpen, hasAvailability])

  const closeForm = useCallback(() => {
    setFormOpen(false)
  }, [])

  const handleFormBackdrop = useCallback((event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation()
    setFormOpen(false)
  }, [])

  // 空き状況データを更新する関数
  const updateAvailability = useCallback((days: AvailabilityDay[]) => {
    setFreshAvailabilityDays(days)
    setIsRefreshing(false)
  }, [])

  return {
    dayFormatter,
    timeFormatter,
    scheduleRangeLabel,
    currentMonthLabel,
    schedulePage,
    schedulePageCount,
    setSchedulePage,
    currentScheduleDays,
    timelineTimes,
    selectedSlots,
    toggleSlot,
    removeSlot,
    ensureSelection,
    hasAvailability,
    availabilitySourceType,
    formOpen,
    formTab,
    setFormTab,
    openForm,
    closeForm,
    handleFormBackdrop,
    updateAvailability,
    isRefreshing,
  }
}
