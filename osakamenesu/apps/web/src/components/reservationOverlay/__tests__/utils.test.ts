import { describe, expect, it } from 'vitest'

import { calculateSchedulePages, buildTimelineTimes } from '../utils'
import type { NormalizedDay } from '../types'

const formatter = new Intl.DateTimeFormat('ja-JP', {
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
  timeZone: 'Asia/Tokyo',
})

const sampleDays: NormalizedDay[] = [
  {
    date: '2024-01-01',
    label: '1/1(月)',
    isToday: true,
    slots: [
      {
        start_at: '2024-01-01T09:30:00+09:00',
        end_at: '2024-01-01T10:15:00+09:00',
        status: 'open',
        timeKey: '09:30',
      },
    ],
  },
  {
    date: '2024-01-02',
    label: '1/2(火)',
    isToday: false,
    slots: [
      {
        start_at: '2024-01-02T21:00:00+09:00',
        end_at: '2024-01-02T22:00:00+09:00',
        status: 'tentative',
        timeKey: '21:00',
      },
    ],
  },
]

describe('buildTimelineTimes', () => {
  it('returns a fallback range when no availability exists', () => {
    const timeline = buildTimelineTimes([])
    expect(timeline[0]).toEqual({ key: '10:00', label: '10:00' })
    expect(timeline[timeline.length - 1]).toEqual({ key: '22:00', label: '22:00' })
  })

  it('expands the active range with padding around earliest/latest slots', () => {
    const timeline = buildTimelineTimes(sampleDays)
    expect(timeline[0].key).toBe('09:00') // earliest slot starts 09:30, minus 30 minutes
    expect(timeline[timeline.length - 1].key).toBe('23:00') // extends past 22:00 slot
    expect(timeline.some((entry) => entry.key === '09:30')).toBe(true)
  })
})

describe('calculateSchedulePages', () => {
  it('fills empty availability with today-based skeleton', () => {
    const todayIso = '2024-01-10'
    const pages = calculateSchedulePages({
      normalizedAvailability: [],
      dayFormatter: formatter,
      todayIso,
    })

    expect(pages).toHaveLength(1)
    expect(pages[0]).toHaveLength(7)
    expect(pages[0][0].date).toBe(todayIso)
  })

  it('preserves real availability while padding to chunk size', () => {
    const pages = calculateSchedulePages({
      normalizedAvailability: sampleDays,
      dayFormatter: formatter,
      todayIso: '2024-01-01',
      chunkSize: 7,
    })

    expect(pages).toHaveLength(1)
    // chunk should still have 7 entries even if only 2 are populated
    expect(pages[0]).toHaveLength(7)
    expect(pages[0][0].date).toBe(sampleDays[0].date)
    expect(pages[0][1].date).toBe(sampleDays[1].date)
  })
})
