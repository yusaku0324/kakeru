import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'

import {
  injectDefaultStartSlot,
  generateDefaultAvailability,
  FALLBACK_STAFF_META,
} from '../data'

/**
 * カード時間とカレンダー時間の整合性を担保するためのテスト
 *
 * 根本原因:
 * - TherapistCard に表示される時間 (nextAvailableSlot) は API/サンプルデータから取得
 * - カレンダーに表示される時間は availabilityDays または fallback データを使用
 * - これらが同期していないと、カードで見た時間がカレンダーにない状態になる
 *
 * 解決策:
 * - injectDefaultStartSlot() で、カードの時間を常にカレンダーに注入する
 */

describe('injectDefaultStartSlot', () => {
  beforeEach(() => {
    // 固定日時でテスト: 2024-12-10 10:00:00 JST
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-12-10T10:00:00+09:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns original availability when defaultStart is null', () => {
    const availability = [
      { dayOffset: 0, slots: [{ hour: 13, minute: 0, durationMinutes: 90, status: 'open' as const }] },
    ]
    const result = injectDefaultStartSlot(availability, null)
    expect(result).toEqual(availability)
  })

  it('returns original availability when defaultStart is undefined', () => {
    const availability = [
      { dayOffset: 0, slots: [{ hour: 13, minute: 0, durationMinutes: 90, status: 'open' as const }] },
    ]
    const result = injectDefaultStartSlot(availability, undefined)
    expect(result).toEqual(availability)
  })

  it('injects defaultStart slot into existing day', () => {
    const availability = [
      { dayOffset: 0, slots: [{ hour: 13, minute: 0, durationMinutes: 90, status: 'open' as const }] },
    ]
    // Today at 10:00
    const defaultStart = '2024-12-10T10:00:00+09:00'
    const result = injectDefaultStartSlot(availability, defaultStart)

    expect(result[0].slots).toHaveLength(2)
    expect(result[0].slots[0]).toEqual({
      hour: 10,
      minute: 0,
      durationMinutes: 90,
      status: 'open',
    })
  })

  it('creates new day entry if defaultStart date does not exist in availability', () => {
    const availability = [
      { dayOffset: 0, slots: [{ hour: 13, minute: 0, durationMinutes: 90, status: 'open' as const }] },
    ]
    // Tomorrow at 11:30
    const defaultStart = '2024-12-11T11:30:00+09:00'
    const result = injectDefaultStartSlot(availability, defaultStart)

    expect(result).toHaveLength(2)
    expect(result[1].dayOffset).toBe(1)
    expect(result[1].slots[0]).toEqual({
      hour: 11,
      minute: 30,
      durationMinutes: 90,
      status: 'open',
    })
  })

  it('does not duplicate slot if it already exists', () => {
    const availability = [
      { dayOffset: 0, slots: [{ hour: 10, minute: 0, durationMinutes: 90, status: 'open' as const }] },
    ]
    const defaultStart = '2024-12-10T10:00:00+09:00'
    const result = injectDefaultStartSlot(availability, defaultStart)

    expect(result[0].slots).toHaveLength(1)
  })

  it('does not mutate original availability array', () => {
    const originalSlot = { hour: 13, minute: 0, durationMinutes: 90, status: 'open' as const }
    const availability = [{ dayOffset: 0, slots: [originalSlot] }]
    const defaultStart = '2024-12-10T10:00:00+09:00'

    injectDefaultStartSlot(availability, defaultStart)

    // Original should be unchanged
    expect(availability[0].slots).toHaveLength(1)
    expect(availability[0].slots[0].hour).toBe(13)
  })

  it('sorts slots by time after injection', () => {
    const availability = [
      {
        dayOffset: 0,
        slots: [
          { hour: 15, minute: 0, durationMinutes: 90, status: 'open' as const },
          { hour: 13, minute: 0, durationMinutes: 90, status: 'open' as const },
        ],
      },
    ]
    const defaultStart = '2024-12-10T14:00:00+09:00'
    const result = injectDefaultStartSlot(availability, defaultStart)

    expect(result[0].slots.map((s) => s.hour)).toEqual([13, 14, 15])
  })
})

describe('generateDefaultAvailability', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-12-10T10:00:00+09:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('generates 7 days of availability by default', () => {
    const result = generateDefaultAvailability()
    expect(result).toHaveLength(7)
    expect(result[0].dayOffset).toBe(0)
    expect(result[6].dayOffset).toBe(6)
  })

  it('injects defaultStart into correct day', () => {
    const defaultStart = '2024-12-10T09:00:00+09:00'
    const result = generateDefaultAvailability(defaultStart)

    const today = result.find((d) => d.dayOffset === 0)
    expect(today).toBeDefined()
    expect(today!.slots.some((s) => s.hour === 9 && s.minute === 0)).toBe(true)
  })

  it('creates new day entry for defaultStart beyond existing range', () => {
    // Day 10 - beyond the default 7 day range
    const defaultStart = '2024-12-20T15:30:00+09:00'
    const result = generateDefaultAvailability(defaultStart)

    const day10 = result.find((d) => d.dayOffset === 10)
    expect(day10).toBeDefined()
    expect(day10!.slots[0]).toEqual({
      hour: 15,
      minute: 30,
      durationMinutes: 90,
      status: 'open',
    })
  })
})

describe('FALLBACK_STAFF_META consistency', () => {
  it('all staff in FALLBACK_STAFF_META have availability data', () => {
    for (const [name, meta] of Object.entries(FALLBACK_STAFF_META)) {
      expect(meta.availability, `${name} should have availability`).toBeDefined()
      expect(Array.isArray(meta.availability), `${name} availability should be array`).toBe(true)
      expect(meta.availability!.length, `${name} should have at least 1 day`).toBeGreaterThan(0)
    }
  })

  it('all availability slots have required fields', () => {
    for (const [name, meta] of Object.entries(FALLBACK_STAFF_META)) {
      for (const day of meta.availability ?? []) {
        expect(typeof day.dayOffset).toBe('number')
        expect(Array.isArray(day.slots)).toBe(true)
        for (const slot of day.slots) {
          expect(typeof slot.hour, `${name} slot should have hour`).toBe('number')
          expect(typeof slot.minute, `${name} slot should have minute`).toBe('number')
          expect(typeof slot.durationMinutes, `${name} slot should have durationMinutes`).toBe(
            'number',
          )
          expect(['open', 'tentative', 'blocked']).toContain(slot.status)
        }
      }
    }
  })
})

describe('Card-Calendar time consistency integration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-12-10T10:00:00+09:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('ensures card time appears in calendar when using FALLBACK_STAFF_META', () => {
    // Simulate: 真央さんのカードに "本日 10:00〜" と表示
    const cardTime = '2024-12-10T10:00:00+09:00'
    const maoMeta = FALLBACK_STAFF_META['真央']

    expect(maoMeta).toBeDefined()

    // 真央のフォールバックデータを取得
    const baseAvailability = maoMeta!.availability ?? generateDefaultAvailability()

    // injectDefaultStartSlot で カードの時間を注入
    const finalAvailability = injectDefaultStartSlot(baseAvailability, cardTime)

    // 10:00 のスロットが存在することを確認
    const today = finalAvailability.find((d) => d.dayOffset === 0)
    expect(today).toBeDefined()

    const has10am = today!.slots.some((s) => s.hour === 10 && s.minute === 0)
    expect(has10am, 'Card time (10:00) should appear in calendar').toBe(true)
  })

  it('ensures card time appears in calendar when no FALLBACK_STAFF_META exists', () => {
    // Simulate: 新しいセラピストのカードに "明日 14:30〜" と表示
    const cardTime = '2024-12-11T14:30:00+09:00'

    // FALLBACK_STAFF_META に存在しないセラピスト
    const baseAvailability = generateDefaultAvailability()
    const finalAvailability = injectDefaultStartSlot(baseAvailability, cardTime)

    // 明日の 14:30 スロットが存在することを確認
    const tomorrow = finalAvailability.find((d) => d.dayOffset === 1)
    expect(tomorrow).toBeDefined()

    const hasSlot = tomorrow!.slots.some((s) => s.hour === 14 && s.minute === 30)
    expect(hasSlot, 'Card time (14:30) should appear in calendar').toBe(true)
  })

  it('handles edge case: card time already exists in availability', () => {
    const cardTime = '2024-12-10T13:00:00+09:00'
    const baseAvailability = generateDefaultAvailability()

    // Default availability already has 13:00 slot on day 0
    const finalAvailability = injectDefaultStartSlot(baseAvailability, cardTime)
    const today = finalAvailability.find((d) => d.dayOffset === 0)

    // Should not duplicate
    const count13 = today!.slots.filter((s) => s.hour === 13 && s.minute === 0).length
    expect(count13).toBe(1)
  })
})
