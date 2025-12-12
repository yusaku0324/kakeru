import { describe, it, expect } from 'vitest'
import {
  normalizeTimeToMinutes,
  minutesToTimeString,
  areTimesEqual,
  getTimeDifferenceMinutes,
  formatTimeJST,
} from './time-normalize'

describe('time-normalize', () => {
  describe('normalizeTimeToMinutes', () => {
    it('normalizes "HH:MM" format', () => {
      expect(normalizeTimeToMinutes('00:00')).toBe(0)
      expect(normalizeTimeToMinutes('09:00')).toBe(540)
      expect(normalizeTimeToMinutes('12:30')).toBe(750)
      expect(normalizeTimeToMinutes('23:59')).toBe(1439)
    })

    it('normalizes "H:MM" format (single digit hour)', () => {
      expect(normalizeTimeToMinutes('9:00')).toBe(540)
      expect(normalizeTimeToMinutes('0:00')).toBe(0)
    })

    it('normalizes "HH:MM:SS" format (ignores seconds)', () => {
      expect(normalizeTimeToMinutes('09:00:00')).toBe(540)
      expect(normalizeTimeToMinutes('09:00:30')).toBe(540)
      expect(normalizeTimeToMinutes('09:00:59')).toBe(540)
    })

    it('normalizes ISO string (converts to JST)', () => {
      // UTC 00:00 = JST 09:00
      expect(normalizeTimeToMinutes('2025-12-12T00:00:00Z')).toBe(540)
      // JST 09:00
      expect(normalizeTimeToMinutes('2025-12-12T09:00:00+09:00')).toBe(540)
      // JST 00:00 = UTC 15:00 previous day
      expect(normalizeTimeToMinutes('2025-12-11T15:00:00Z')).toBe(0)
    })

    it('returns -1 for invalid input', () => {
      expect(normalizeTimeToMinutes('')).toBe(-1)
      expect(normalizeTimeToMinutes('invalid')).toBe(-1)
      expect(normalizeTimeToMinutes('25:00')).toBe(-1)
      expect(normalizeTimeToMinutes('12:60')).toBe(-1)
      expect(normalizeTimeToMinutes('abc:def')).toBe(-1)
      expect(normalizeTimeToMinutes(null as unknown as string)).toBe(-1)
      expect(normalizeTimeToMinutes(undefined as unknown as string)).toBe(-1)
    })

    it('handles edge cases', () => {
      // Midnight
      expect(normalizeTimeToMinutes('00:00')).toBe(0)
      // Last minute of day
      expect(normalizeTimeToMinutes('23:59')).toBe(1439)
      // With leading zeros
      expect(normalizeTimeToMinutes('01:01')).toBe(61)
    })
  })

  describe('minutesToTimeString', () => {
    it('converts minutes to HH:MM format', () => {
      expect(minutesToTimeString(0)).toBe('00:00')
      expect(minutesToTimeString(540)).toBe('09:00')
      expect(minutesToTimeString(750)).toBe('12:30')
      expect(minutesToTimeString(1439)).toBe('23:59')
    })

    it('returns N/A for invalid input', () => {
      expect(minutesToTimeString(-1)).toBe('N/A')
      expect(minutesToTimeString(1440)).toBe('N/A')
      expect(minutesToTimeString(-100)).toBe('N/A')
    })

    it('pads single digits with zeros', () => {
      expect(minutesToTimeString(61)).toBe('01:01')
      expect(minutesToTimeString(5)).toBe('00:05')
    })
  })

  describe('areTimesEqual', () => {
    it('compares times correctly', () => {
      expect(areTimesEqual('09:00', '09:00')).toBe(true)
      expect(areTimesEqual('09:00', '09:00:00')).toBe(true)
      expect(areTimesEqual('9:00', '09:00')).toBe(true)
      expect(areTimesEqual('09:00', '09:30')).toBe(false)
    })

    it('compares ISO strings correctly', () => {
      // Both represent JST 09:00
      expect(areTimesEqual('2025-12-12T00:00:00Z', '09:00')).toBe(true)
      expect(areTimesEqual('2025-12-12T09:00:00+09:00', '09:00')).toBe(true)
    })

    it('returns false for null/invalid input', () => {
      expect(areTimesEqual(null, '09:00')).toBe(false)
      expect(areTimesEqual('09:00', null)).toBe(false)
      expect(areTimesEqual(null, null)).toBe(false)
      expect(areTimesEqual('invalid', '09:00')).toBe(false)
    })
  })

  describe('getTimeDifferenceMinutes', () => {
    it('calculates difference correctly', () => {
      expect(getTimeDifferenceMinutes('09:00', '09:30')).toBe(30)
      expect(getTimeDifferenceMinutes('09:30', '09:00')).toBe(-30)
      expect(getTimeDifferenceMinutes('00:00', '23:59')).toBe(1439)
    })

    it('returns null for invalid input', () => {
      expect(getTimeDifferenceMinutes(null, '09:00')).toBe(null)
      expect(getTimeDifferenceMinutes('09:00', null)).toBe(null)
      expect(getTimeDifferenceMinutes('invalid', '09:00')).toBe(null)
    })
  })

  describe('formatTimeJST', () => {
    it('formats ISO string to JST HH:MM', () => {
      // UTC 00:00 = JST 09:00
      expect(formatTimeJST('2025-12-12T00:00:00Z')).toBe('09:00')
      // JST 15:30
      expect(formatTimeJST('2025-12-12T15:30:00+09:00')).toBe('15:30')
    })

    it('returns N/A for invalid input', () => {
      expect(formatTimeJST('')).toBe('N/A')
      expect(formatTimeJST('invalid')).toBe('N/A')
    })
  })
})
