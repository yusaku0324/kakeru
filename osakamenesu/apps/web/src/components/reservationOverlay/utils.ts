import { pad } from '@/utils/date'

import type { NormalizedDay, TimelineEntry } from './types'

type BuildTimelineOptions = {
  intervalMinutes?: number
  fallbackStartHour?: number
  fallbackEndHour?: number
}

export function buildTimelineTimes(
  days: NormalizedDay[],
  { intervalMinutes = 30, fallbackStartHour = 10, fallbackEndHour = 22 }: BuildTimelineOptions = {},
): TimelineEntry[] {
  const activeMinutes: number[] = []

  days.forEach((day) => {
    day.slots.forEach((slot) => {
      const startKey = slot.timeKey ?? slot.start_at.slice(11, 16)
      const [hourStr, minuteStr] = startKey.split(':')
      const startHour = Number.parseInt(hourStr ?? '', 10)
      const startMinute = Number.parseInt(minuteStr ?? '', 10)
      if (Number.isNaN(startHour) || Number.isNaN(startMinute)) return

      const startMinutes = startHour * 60 + startMinute
      const durationMinutes = Math.max(
        intervalMinutes,
        Math.round(
          (new Date(slot.end_at).getTime() - new Date(slot.start_at).getTime()) / 60000,
        ) || 0,
      )
      const endMinutes = Math.min(24 * 60, startMinutes + durationMinutes)
      for (let minutes = startMinutes; minutes < endMinutes; minutes += intervalMinutes) {
        activeMinutes.push(minutes)
      }
    })
  })

  if (!activeMinutes.length) {
    const fallback: TimelineEntry[] = []
    for (
      let minutes = fallbackStartHour * 60;
      minutes <= fallbackEndHour * 60;
      minutes += intervalMinutes
    ) {
      const hour = Math.floor(minutes / 60)
      const minute = minutes % 60
      const key = `${pad(hour)}:${pad(minute)}`
      fallback.push({
        key,
        label: `${hour}:${minute.toString().padStart(2, '0')}`.replace(/^0/, ''),
      })
    }
    return fallback
  }

  activeMinutes.sort((a, b) => a - b)
  const minMinutes = Math.max(0, activeMinutes[0] - intervalMinutes)
  const maxMinutes = Math.min(24 * 60, activeMinutes[activeMinutes.length - 1] + 2 * intervalMinutes)

  const times: TimelineEntry[] = []
  for (let minutes = minMinutes; minutes <= maxMinutes; minutes += intervalMinutes) {
    const hour = Math.floor(minutes / 60)
    const minute = minutes % 60
    const key = `${pad(hour)}:${pad(minute)}`
    times.push({ key, label: `${hour}:${minute.toString().padStart(2, '0')}`.replace(/^0/, '') })
  }
  return times
}

type CalculateSchedulePagesParams = {
  normalizedAvailability: NormalizedDay[]
  dayFormatter: Intl.DateTimeFormat
  todayIso: string
  chunkSize?: number
}

export function calculateSchedulePages({
  normalizedAvailability,
  dayFormatter,
  todayIso,
  chunkSize = 7,
}: CalculateSchedulePagesParams): NormalizedDay[][] {
  if (!normalizedAvailability.length) {
    const base = new Date(todayIso)
    base.setHours(0, 0, 0, 0)
    const page: NormalizedDay[] = Array.from({ length: chunkSize }).map((_, offset) => {
      const date = new Date(base)
      date.setDate(base.getDate() + offset)
      const iso = date.toISOString().slice(0, 10)
      return {
        date: iso,
        label: dayFormatter.format(date),
        isToday: iso === todayIso,
        slots: [],
      }
    })
    return [page]
  }

  const dayMap = new Map(normalizedAvailability.map((day) => [day.date, day]))
  const firstDate = normalizedAvailability[0]?.date ?? todayIso
  const base = new Date(firstDate)
  base.setHours(0, 0, 0, 0)
  const totalDays = Math.max(normalizedAvailability.length, chunkSize)
  const pageCount = Math.max(1, Math.ceil(totalDays / chunkSize))
  const pages: NormalizedDay[][] = []

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    const page: NormalizedDay[] = []
    for (let dayIndex = 0; dayIndex < chunkSize; dayIndex++) {
      const offset = pageIndex * chunkSize + dayIndex
      const date = new Date(base)
      date.setDate(base.getDate() + offset)
      const iso = date.toISOString().slice(0, 10)
      const existing = dayMap.get(iso)
      page.push(
        existing ?? {
          date: iso,
          label: dayFormatter.format(date),
          isToday: iso === todayIso,
          slots: [],
        },
      )
    }
    pages.push(page)
  }

  return pages
}
