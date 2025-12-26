import { describe, it, expect } from 'vitest'
import {
  formatNextAvailableSlotLabel,
  toNextAvailableSlotPayload,
  nextSlotPayloadToScheduleSlot,
  type NextAvailableSlotPayload,
} from '../nextAvailableSlot'

describe('nextAvailableSlot', () => {
  const mockNow = new Date('2024-12-17T10:00:00+09:00')

  describe('toNextAvailableSlotPayload', () => {
    it('returns null for null input', () => {
      expect(toNextAvailableSlotPayload(null)).toBeNull()
    })

    it('returns null for undefined input', () => {
      expect(toNextAvailableSlotPayload(undefined)).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(toNextAvailableSlotPayload('')).toBeNull()
    })

    it('creates payload with default ok status', () => {
      const result = toNextAvailableSlotPayload('2024-12-17T14:00:00+09:00')
      expect(result).toEqual({
        start_at: '2024-12-17T14:00:00+09:00',
        end_at: null,
        status: 'ok',
      })
    })

    it('creates payload with maybe status', () => {
      const result = toNextAvailableSlotPayload('2024-12-17T14:00:00+09:00', 'maybe')
      expect(result).toEqual({
        start_at: '2024-12-17T14:00:00+09:00',
        end_at: null,
        status: 'maybe',
      })
    })
  })

  describe('nextSlotPayloadToScheduleSlot', () => {
    it('returns null for null input', () => {
      expect(nextSlotPayloadToScheduleSlot(null)).toBeNull()
    })

    it('returns null for undefined input', () => {
      expect(nextSlotPayloadToScheduleSlot(undefined)).toBeNull()
    })

    it('returns null for payload without start_at', () => {
      expect(nextSlotPayloadToScheduleSlot({ start_at: '' } as NextAvailableSlotPayload)).toBeNull()
    })

    it('converts ok status to open', () => {
      const payload: NextAvailableSlotPayload = {
        start_at: '2024-12-17T14:00:00+09:00',
        end_at: '2024-12-17T15:00:00+09:00',
        status: 'ok',
      }
      const result = nextSlotPayloadToScheduleSlot(payload)
      expect(result).toEqual({
        start_at: '2024-12-17T14:00:00+09:00',
        end_at: '2024-12-17T15:00:00+09:00',
        status: 'open',
      })
    })

    it('converts maybe status to tentative', () => {
      const payload: NextAvailableSlotPayload = {
        start_at: '2024-12-17T14:00:00+09:00',
        end_at: '2024-12-17T15:00:00+09:00',
        status: 'maybe',
      }
      const result = nextSlotPayloadToScheduleSlot(payload)
      expect(result).toEqual({
        start_at: '2024-12-17T14:00:00+09:00',
        end_at: '2024-12-17T15:00:00+09:00',
        status: 'tentative',
      })
    })

    it('uses start_at as end_at when end_at is null', () => {
      const payload: NextAvailableSlotPayload = {
        start_at: '2024-12-17T14:00:00+09:00',
        end_at: null,
        status: 'ok',
      }
      const result = nextSlotPayloadToScheduleSlot(payload)
      expect(result?.end_at).toBe('2024-12-17T14:00:00+09:00')
    })
  })

  describe('formatNextAvailableSlotLabel', () => {
    it('returns null for null input without fallback', () => {
      expect(formatNextAvailableSlotLabel(null)).toBeNull()
    })

    it('returns fallback for null input', () => {
      expect(formatNextAvailableSlotLabel(null, { fallbackLabel: '空きなし' })).toBe('空きなし')
    })

    it('returns null for undefined input without fallback', () => {
      expect(formatNextAvailableSlotLabel(undefined)).toBeNull()
    })

    it('formats today slot with prefix', () => {
      const payload: NextAvailableSlotPayload = {
        start_at: '2024-12-17T14:00:00+09:00',
        status: 'ok',
      }
      const result = formatNextAvailableSlotLabel(payload, { now: mockNow })
      expect(result).toBe('最短の空き枠: 本日 14:00〜')
    })

    it('formats tomorrow slot with prefix', () => {
      const payload: NextAvailableSlotPayload = {
        start_at: '2024-12-18T14:00:00+09:00',
        status: 'ok',
      }
      const result = formatNextAvailableSlotLabel(payload, { now: mockNow })
      expect(result).toBe('最短の空き枠: 明日 14:00〜')
    })

    it('formats future slot with date', () => {
      const payload: NextAvailableSlotPayload = {
        start_at: '2024-12-25T14:00:00+09:00',
        status: 'ok',
      }
      const result = formatNextAvailableSlotLabel(payload, { now: mockNow })
      expect(result).toBe('最短の空き枠: 12/25(水) 14:00〜')
    })
  })
})
