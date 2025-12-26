import { describe, it, expect } from 'vitest'
import {
  getNextAvailableSlot,
  summarizeSlotAvailability,
  formatSlotJp,
  hasTodayAvailability,
  type ScheduleSlot,
} from '../schedule'

describe('schedule', () => {
  const mockNow = '2024-12-17T10:00:00+09:00'

  describe('getNextAvailableSlot', () => {
    it('returns null for empty slots', () => {
      const result = getNextAvailableSlot([], { now: mockNow })
      expect(result).toBeNull()
    })

    it('returns null when all slots are blocked', () => {
      const slots: ScheduleSlot[] = [
        { start_at: '2024-12-17T14:00:00+09:00', end_at: '2024-12-17T15:00:00+09:00', status: 'blocked' },
      ]
      const result = getNextAvailableSlot(slots, { now: mockNow })
      expect(result).toBeNull()
    })

    it('returns next open slot', () => {
      const slots: ScheduleSlot[] = [
        { start_at: '2024-12-17T14:00:00+09:00', end_at: '2024-12-17T15:00:00+09:00', status: 'open' },
        { start_at: '2024-12-17T16:00:00+09:00', end_at: '2024-12-17T17:00:00+09:00', status: 'open' },
      ]
      const result = getNextAvailableSlot(slots, { now: mockNow })
      expect(result).toEqual(slots[0])
    })

    it('returns tentative slot as available', () => {
      const slots: ScheduleSlot[] = [
        { start_at: '2024-12-17T14:00:00+09:00', end_at: '2024-12-17T15:00:00+09:00', status: 'tentative' },
      ]
      const result = getNextAvailableSlot(slots, { now: mockNow })
      expect(result).toEqual(slots[0])
    })

    it('skips slots that have already ended', () => {
      const slots: ScheduleSlot[] = [
        { start_at: '2024-12-17T08:00:00+09:00', end_at: '2024-12-17T09:00:00+09:00', status: 'open' },
        { start_at: '2024-12-17T14:00:00+09:00', end_at: '2024-12-17T15:00:00+09:00', status: 'open' },
      ]
      const result = getNextAvailableSlot(slots, { now: mockNow })
      expect(result).toEqual(slots[1])
    })

    it('handles invalid slot dates', () => {
      const slots: ScheduleSlot[] = [
        { start_at: 'invalid', end_at: 'invalid', status: 'open' },
        { start_at: '2024-12-17T14:00:00+09:00', end_at: '2024-12-17T15:00:00+09:00', status: 'open' },
      ]
      const result = getNextAvailableSlot(slots, { now: mockNow })
      expect(result).toEqual(slots[1])
    })
  })

  describe('summarizeSlotAvailability', () => {
    it('returns empty summary for no slots', () => {
      const result = summarizeSlotAvailability([], { now: mockNow })
      expect(result).toEqual({
        nextSlot: null,
        nextLabel: null,
        hasTodayAvailability: false,
        hasFutureAvailability: false,
      })
    })

    it('returns fallback label when no slots available', () => {
      const result = summarizeSlotAvailability([], { now: mockNow, fallbackLabel: '予約不可' })
      expect(result.nextLabel).toBe('予約不可')
    })

    it('identifies today availability', () => {
      const slots: ScheduleSlot[] = [
        { start_at: '2024-12-17T14:00:00+09:00', end_at: '2024-12-17T15:00:00+09:00', status: 'open' },
      ]
      const result = summarizeSlotAvailability(slots, { now: mockNow })
      expect(result.hasTodayAvailability).toBe(true)
      expect(result.hasFutureAvailability).toBe(true)
    })

    it('identifies future availability without today', () => {
      const slots: ScheduleSlot[] = [
        { start_at: '2024-12-18T14:00:00+09:00', end_at: '2024-12-18T15:00:00+09:00', status: 'open' },
      ]
      const result = summarizeSlotAvailability(slots, { now: mockNow })
      expect(result.hasTodayAvailability).toBe(false)
      expect(result.hasFutureAvailability).toBe(true)
    })
  })

  describe('formatSlotJp', () => {
    it('returns null for null slot', () => {
      const result = formatSlotJp(null, { now: mockNow })
      expect(result).toBeNull()
    })

    it('returns fallback for null slot', () => {
      const result = formatSlotJp(null, { now: mockNow, fallbackLabel: '空き無し' })
      expect(result).toBe('空き無し')
    })

    it('returns fallback for invalid date', () => {
      const slot: ScheduleSlot = { start_at: 'invalid', end_at: 'invalid', status: 'open' }
      const result = formatSlotJp(slot, { now: mockNow, fallbackLabel: '無効' })
      expect(result).toBe('無効')
    })

    it('formats today slot with 本日 prefix', () => {
      const slot: ScheduleSlot = {
        start_at: '2024-12-17T14:00:00+09:00',
        end_at: '2024-12-17T15:00:00+09:00',
        status: 'open',
      }
      const result = formatSlotJp(slot, { now: mockNow })
      expect(result).toBe('本日 14:00〜')
    })

    it('formats tomorrow slot with 明日 prefix', () => {
      const slot: ScheduleSlot = {
        start_at: '2024-12-18T14:00:00+09:00',
        end_at: '2024-12-18T15:00:00+09:00',
        status: 'open',
      }
      const result = formatSlotJp(slot, { now: mockNow })
      expect(result).toBe('明日 14:00〜')
    })

    it('formats future slot with date', () => {
      const slot: ScheduleSlot = {
        start_at: '2024-12-25T14:00:00+09:00',
        end_at: '2024-12-25T15:00:00+09:00',
        status: 'open',
      }
      const result = formatSlotJp(slot, { now: mockNow })
      expect(result).toBe('12/25(水) 14:00〜')
    })

    it('formats morning slot correctly', () => {
      const slot: ScheduleSlot = {
        start_at: '2024-12-17T09:30:00+09:00',
        end_at: '2024-12-17T10:30:00+09:00',
        status: 'open',
      }
      const result = formatSlotJp(slot, { now: '2024-12-17T08:00:00+09:00' })
      expect(result).toBe('本日 09:30〜')
    })
  })

  describe('hasTodayAvailability', () => {
    it('returns false for empty slots', () => {
      const result = hasTodayAvailability([], { now: mockNow })
      expect(result).toBe(false)
    })

    it('returns false when all slots are blocked', () => {
      const slots: ScheduleSlot[] = [
        { start_at: '2024-12-17T14:00:00+09:00', end_at: '2024-12-17T15:00:00+09:00', status: 'blocked' },
      ]
      const result = hasTodayAvailability(slots, { now: mockNow })
      expect(result).toBe(false)
    })

    it('returns true when today has open slot', () => {
      const slots: ScheduleSlot[] = [
        { start_at: '2024-12-17T14:00:00+09:00', end_at: '2024-12-17T15:00:00+09:00', status: 'open' },
      ]
      const result = hasTodayAvailability(slots, { now: mockNow })
      expect(result).toBe(true)
    })

    it('returns true when today has tentative slot', () => {
      const slots: ScheduleSlot[] = [
        { start_at: '2024-12-17T14:00:00+09:00', end_at: '2024-12-17T15:00:00+09:00', status: 'tentative' },
      ]
      const result = hasTodayAvailability(slots, { now: mockNow })
      expect(result).toBe(true)
    })

    it('returns false when slot has already ended', () => {
      const slots: ScheduleSlot[] = [
        { start_at: '2024-12-17T08:00:00+09:00', end_at: '2024-12-17T09:00:00+09:00', status: 'open' },
      ]
      const result = hasTodayAvailability(slots, { now: mockNow })
      expect(result).toBe(false)
    })

    it('returns false when only future slots available', () => {
      const slots: ScheduleSlot[] = [
        { start_at: '2024-12-18T14:00:00+09:00', end_at: '2024-12-18T15:00:00+09:00', status: 'open' },
      ]
      const result = hasTodayAvailability(slots, { now: mockNow })
      expect(result).toBe(false)
    })

    it('handles invalid slot dates', () => {
      const slots: ScheduleSlot[] = [
        { start_at: 'invalid', end_at: 'invalid', status: 'open' },
      ]
      const result = hasTodayAvailability(slots, { now: mockNow })
      expect(result).toBe(false)
    })
  })
})
