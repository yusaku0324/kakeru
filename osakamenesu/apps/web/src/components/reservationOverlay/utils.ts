import { formatLocalDate, pad } from '@/utils/date'

import type { NormalizedDay, TimelineEntry, ReservationContactItem } from '@/components/reservation'

type BuildTimelineOptions = {
  intervalMinutes?: number
  fallbackStartHour?: number
  fallbackEndHour?: number
  slotDurationMinutes?: number
}

/**
 * JST のタイムゾーンオフセット付き ISO 文字列から時刻部分（HH:MM）を抽出
 * 例: "2024-12-12T09:00:00+09:00" -> "09:00"
 */
function extractTimeFromIso(isoString: string): string {
  // ISO文字列から時刻部分を抽出（タイムゾーンを考慮）
  const timeMatch = isoString.match(/T(\d{2}):(\d{2})/)
  if (timeMatch) {
    return `${timeMatch[1]}:${timeMatch[2]}`
  }
  // フォールバック: 11-16文字目を使用
  return isoString.slice(11, 16)
}

export function buildTimelineTimes(
  days: NormalizedDay[],
  { intervalMinutes = 30, fallbackStartHour = 10, fallbackEndHour = 22, slotDurationMinutes = 60 }: BuildTimelineOptions = {},
): TimelineEntry[] {
  if (!days.length) {
    return buildFallbackTimes({ intervalMinutes, fallbackStartHour, fallbackEndHour, slotDurationMinutes })
  }

  // スロットの開始時間を収集（店舗の slotDurationMinutes 刻みで）
  const slotStartMinutes = new Set<number>()

  days.forEach((day) => {
    day.slots.forEach((slot) => {
      // timeKey があればそれを使用、なければ start_at から抽出
      const startKey = slot.timeKey ?? extractTimeFromIso(slot.start_at)
      const [hourStr, minuteStr] = startKey.split(':')
      const startHour = Number.parseInt(hourStr ?? '', 10)
      const startMinute = Number.parseInt(minuteStr ?? '', 10)
      if (Number.isNaN(startHour) || Number.isNaN(startMinute)) return

      const startMinutes = startHour * 60 + startMinute
      slotStartMinutes.add(startMinutes)
    })
  })

  if (!slotStartMinutes.size) {
    return buildFallbackTimes({ intervalMinutes, fallbackStartHour, fallbackEndHour, slotDurationMinutes })
  }

  // スロット開始時間をソート
  const sortedMinutes = Array.from(slotStartMinutes).sort((a, b) => a - b)
  const minMinutes = Math.max(0, sortedMinutes[0] - slotDurationMinutes)
  const maxMinutes = Math.min(24 * 60, sortedMinutes[sortedMinutes.length - 1] + slotDurationMinutes)

  // slotDurationMinutes 刻みで時間軸を生成
  const times: TimelineEntry[] = []
  for (let minutes = minMinutes; minutes <= maxMinutes; minutes += slotDurationMinutes) {
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
      const iso = formatLocalDate(date)
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
      const iso = formatLocalDate(date)
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

export function buildLineContactUrl(lineId: string, message?: string | null): string {
  const base = lineId.startsWith('http') ? lineId : `https://line.me/R/ti/p/${lineId}`
  if (!message) return base
  const encoded = encodeURIComponent(message)
  return base.includes('?') ? `${base}&text=${encoded}` : `${base}?text=${encoded}`
}

type BuildReservationContactItemsParams = {
  tel?: string | null
  lineId?: string | null
  telHref?: string | null
  lineHref?: string | null
}

export function buildReservationContactItems({
  tel,
  lineId,
  telHref,
  lineHref,
}: BuildReservationContactItemsParams): ReservationContactItem[] {
  return [
    {
      key: 'tel',
      label: '電話予約',
      value: tel ? `TEL ${tel}` : '未登録',
      helper: '24時間受付（折り返し連絡）',
      href: tel && telHref ? telHref : undefined,
    },
    {
      key: 'line',
      label: 'LINE相談',
      value: lineId ? `ID ${lineId}` : '準備中',
      helper: '空き状況や指名のご相談に',
      href: lineId && lineHref ? lineHref : undefined,
    },
  ]
}

function buildFallbackTimes({
  intervalMinutes,
  fallbackStartHour,
  fallbackEndHour,
  slotDurationMinutes,
}: Required<BuildTimelineOptions>): TimelineEntry[] {
  const entries: TimelineEntry[] = []
  // slotDurationMinutes を使用して時間軸を生成（店舗設定に合わせる）
  const step = slotDurationMinutes || intervalMinutes
  for (let minutes = fallbackStartHour * 60; minutes <= fallbackEndHour * 60; minutes += step) {
    const hour = Math.floor(minutes / 60)
    const minute = minutes % 60
    const key = `${pad(hour)}:${pad(minute)}`
    entries.push({
      key,
      label: `${hour}:${minute.toString().padStart(2, '0')}`.replace(/^0/, ''),
    })
  }
  return entries
}
