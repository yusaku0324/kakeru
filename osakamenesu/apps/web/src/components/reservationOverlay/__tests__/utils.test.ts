import { describe, expect, it } from 'vitest'

import {
  calculateSchedulePages,
  buildTimelineTimes,
  buildLineContactUrl,
  buildReservationContactItems,
} from '../utils'
import type { NormalizedDay } from '@/components/reservation'
import { formatLocalDate, getJaFormatter } from '@/utils/date'

const formatter = getJaFormatter('day')

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
    expect(timeline[timeline.length - 1].key).toBe('22:30') // extends past 22:00 slot by 30 minutes
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
    expect(pages[0][0].date).toBe(localizedIso(todayIso))
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
    expect(pages[0][0].date).toBe(localizedIso(sampleDays[0].date))
    expect(pages[0][1].date).toBe(localizedIso(sampleDays[1].date))
  })
})

function localizedIso(dateIso: string) {
  return formatLocalDate(new Date(dateIso))
}

describe('buildLineContactUrl', () => {
  it('adds line.me prefix when lineId is just an ID', () => {
    const result = buildLineContactUrl('my_line_id')
    expect(result).toBe('https://line.me/R/ti/p/my_line_id')
  })

  it('uses URL as-is when lineId is already a URL', () => {
    const result = buildLineContactUrl('https://line.me/custom/path')
    expect(result).toBe('https://line.me/custom/path')
  })

  it('appends message as query param', () => {
    const result = buildLineContactUrl('my_line_id', 'Hello!')
    expect(result).toBe('https://line.me/R/ti/p/my_line_id?text=Hello!')
  })

  it('handles message with special characters', () => {
    const result = buildLineContactUrl('my_line_id', 'こんにちは！予約希望です')
    expect(result).toContain('text=')
    expect(result).toContain(encodeURIComponent('こんにちは！予約希望です'))
  })

  it('appends message with & when URL already has query', () => {
    const result = buildLineContactUrl('https://line.me/path?existing=param', 'Message')
    expect(result).toBe('https://line.me/path?existing=param&text=Message')
  })

  it('returns base URL when message is null', () => {
    const result = buildLineContactUrl('my_line_id', null)
    expect(result).toBe('https://line.me/R/ti/p/my_line_id')
  })

  it('returns base URL when message is empty', () => {
    const result = buildLineContactUrl('my_line_id', '')
    expect(result).toBe('https://line.me/R/ti/p/my_line_id')
  })
})

describe('buildReservationContactItems', () => {
  it('returns array with tel and line items', () => {
    const result = buildReservationContactItems({
      tel: '03-1234-5678',
      lineId: 'line_id_123',
      telHref: 'tel:0312345678',
      lineHref: 'https://line.me/test',
    })
    expect(result.length).toBe(2)
    expect(result[0].key).toBe('tel')
    expect(result[1].key).toBe('line')
  })

  it('includes tel value with prefix', () => {
    const result = buildReservationContactItems({
      tel: '03-1234-5678',
    })
    expect(result[0].value).toBe('TEL 03-1234-5678')
  })

  it('shows 未登録 when tel is not provided', () => {
    const result = buildReservationContactItems({})
    expect(result[0].value).toBe('未登録')
  })

  it('shows 準備中 when lineId is not provided', () => {
    const result = buildReservationContactItems({})
    expect(result[1].value).toBe('準備中')
  })

  it('includes line ID with prefix', () => {
    const result = buildReservationContactItems({
      lineId: 'my_line',
    })
    expect(result[1].value).toBe('ID my_line')
  })

  it('includes href when both value and href are provided', () => {
    const result = buildReservationContactItems({
      tel: '03-1234-5678',
      telHref: 'tel:0312345678',
    })
    expect(result[0].href).toBe('tel:0312345678')
  })

  it('excludes href when value is not provided', () => {
    const result = buildReservationContactItems({
      telHref: 'tel:0312345678',
    })
    expect(result[0].href).toBeUndefined()
  })

  it('includes correct labels', () => {
    const result = buildReservationContactItems({})
    expect(result[0].label).toBe('電話予約')
    expect(result[1].label).toBe('LINE相談')
  })

  it('includes helper text', () => {
    const result = buildReservationContactItems({})
    expect(result[0].helper).toBe('24時間受付（折り返し連絡）')
    expect(result[1].helper).toBe('空き状況や指名のご相談に')
  })
})
