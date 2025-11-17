import { describe, expect, it } from 'vitest'

import {
  formatSlotJp,
  getNextAvailableSlot,
  summarizeSlotAvailability,
  type ScheduleSlot,
} from './schedule'

const buildSlot = (
  start: string,
  endOffsetMinutes = 90,
  status: ScheduleSlot['status'] = 'open',
): ScheduleSlot => {
  const startDate = new Date(start)
  const endDate = new Date(startDate.getTime() + endOffsetMinutes * 60 * 1000)
  return {
    start_at: startDate.toISOString(),
    end_at: endDate.toISOString(),
    status,
  }
}

describe('getNextAvailableSlot', () => {
  it('ignores past slots and picks the earliest future slot', () => {
    const now = new Date('2025-01-10T12:00:00+09:00')
    const slots: ScheduleSlot[] = [
      buildSlot('2025-01-09T10:00:00+09:00'),
      buildSlot('2025-01-10T16:00:00+09:00'),
      buildSlot('2025-01-10T14:00:00+09:00'),
    ]
    const nextSlot = getNextAvailableSlot(slots, { now })
    expect(nextSlot?.start_at).toEqual(new Date('2025-01-10T14:00:00+09:00').toISOString())
  })

  it('returns null when there are no future open slots', () => {
    const now = new Date('2025-01-10T12:00:00+09:00')
    const slots: ScheduleSlot[] = [
      buildSlot('2025-01-09T10:00:00+09:00'),
      { ...buildSlot('2025-01-10T10:00:00+09:00'), status: 'blocked' },
    ]
    const nextSlot = getNextAvailableSlot(slots, { now })
    expect(nextSlot).toBeNull()
  })
})

describe('formatSlotJp', () => {
  it('labels today slots with 本日', () => {
    const now = new Date('2025-03-01T09:00:00+09:00')
    const slot = buildSlot('2025-03-01T11:30:00+09:00')
    expect(formatSlotJp(slot, { now })).toBe('本日 11:30〜')
  })

  it('labels the next day as 明日 even for shortly-after-midnight slots', () => {
    const now = new Date('2025-03-01T23:50:00+09:00')
    const slot = buildSlot('2025-03-02T00:10:00+09:00')
    expect(formatSlotJp(slot, { now })).toBe('明日 00:10〜')
  })
})

describe('summarizeSlotAvailability', () => {
  it('reports today availability and formats the next slot label', () => {
    const now = new Date('2025-03-01T09:00:00+09:00')
    const slots: ScheduleSlot[] = [
      buildSlot('2025-03-01T10:00:00+09:00'),
      buildSlot('2025-03-02T10:00:00+09:00'),
    ]
    const summary = summarizeSlotAvailability(slots, { now })
    expect(summary.hasTodayAvailability).toBe(true)
    expect(summary.hasFutureAvailability).toBe(true)
    expect(summary.nextLabel).toBe('本日 10:00〜')
  })
})
