'use client'

import {
  type Dispatch,
  type MouseEvent,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import type { SelectedSlot } from '@/components/calendar/AvailabilityPickerDesktop'
import type { AvailabilityStatus } from '@/components/calendar/types'

import { formatLocalDate, getJaFormatter, toIsoWithOffset } from '@/utils/date'
import type { ReservationOverlayProps } from '../ReservationOverlay'
import type { NormalizedDay, NormalizedSlot } from './types'
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
export type SlotStatus = Exclude<AvailabilityStatus, 'blocked'>

type UseReservationOverlayStateParams = {
  availabilityDays?: ReservationOverlayProps['availabilityDays']
  fallbackAvailability?: AvailabilityTemplate
  defaultStart?: string | null
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
  formOpen: boolean
  formTab: OverlayFormTab
  setFormTab: Dispatch<SetStateAction<OverlayFormTab>>
  openForm: () => void
  closeForm: () => void
  handleFormBackdrop: (event: MouseEvent<HTMLDivElement>) => void
}

export function useReservationOverlayState({
  availabilityDays,
  fallbackAvailability,
  defaultStart,
}: UseReservationOverlayStateParams): ReservationOverlayState {
  const [formOpen, setFormOpen] = useState(false)
  const [formTab, setFormTab] = useState<OverlayFormTab>('schedule')
  const [schedulePage, setSchedulePage] = useState(0)
  const [selectedSlots, setSelectedSlots] = useState<SelectedSlot[]>([])

  const dayFormatter = getJaFormatter('day')
  const timeFormatter = getJaFormatter('time')

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const availabilitySource = useMemo(() => {
    if (Array.isArray(availabilityDays) && availabilityDays.length) return availabilityDays
    if (!Array.isArray(fallbackAvailability) || fallbackAvailability.length === 0) return []
    const base = new Date()
    base.setHours(0, 0, 0, 0)
    return fallbackAvailability.map((template) => {
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
  }, [availabilityDays, fallbackAvailability])

  const normalizedAvailability = useMemo<NormalizedDay[]>(() => {
    const days = Array.isArray(availabilitySource) ? availabilitySource : []
    return days
      .map<NormalizedDay>((day) => ({
        date: day.date,
        label: dayFormatter.format(new Date(day.date)),
        isToday: Boolean(day.is_today) || day.date === todayIso,
        slots: (Array.isArray(day.slots) ? day.slots : []).map((slot) => ({
          start_at: slot.start_at,
          end_at: slot.end_at,
          status: slot.status,
          timeKey: slot.start_at.slice(11, 16),
        })),
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [availabilitySource, dayFormatter, todayIso])

  const timelineTimes = useMemo(
    () => buildTimelineTimes(normalizedAvailability),
    [normalizedAvailability],
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
    const date = new Date(`${day.date}T00:00:00`)
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

  useEffect(() => {
    if (!defaultStart || selectedSlots.length) return
    const match = normalizedAvailability
      .flatMap((day) => day.slots.map((slot) => ({ day, slot })))
      .find(({ slot }) => slot.start_at === defaultStart)
    if (match && match.slot.status !== 'blocked') {
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
    const first = normalizedAvailability
      .flatMap((day) => day.slots.map((slot) => ({ day, slot })))
      .find(({ slot }) => slot.status !== 'blocked')
    if (first) {
      const slot = first.slot
      if (slot.status === 'blocked') return []
      const safeStatus: SlotStatus = slot.status
      const initial = {
        startAt: slot.start_at,
        endAt: slot.end_at,
        date: first.day.date,
        status: safeStatus,
      } as const
      setSelectedSlots([initial])
      return [initial]
    }
    return []
  }, [normalizedAvailability, selectedSlots])

  const removeSlot = useCallback((startAt: string) => {
    setSelectedSlots((prev) => prev.filter((item) => item.startAt !== startAt))
  }, [])

  const openForm = useCallback(() => {
    ensureSelection()
    setSchedulePage(0)
    setFormTab(hasAvailability ? 'schedule' : 'info')
    setFormOpen(true)
  }, [ensureSelection, hasAvailability])

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
    formOpen,
    formTab,
    setFormTab,
    openForm,
    closeForm,
    handleFormBackdrop,
  }
}
