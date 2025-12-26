import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  JST_TIMEZONE,
  now,
  setNowForTesting,
  formatDateISO,
  formatDateTimeISO,
  formatTimeHM,
  today,
  isToday,
  parseJstDateAtMidnight,
  addDays,
  weekRange,
  extractDate,
  extractTime,
  isSameDate,
  formatReservationRange,
} from '../jst'

describe('jst', () => {
  afterEach(() => {
    setNowForTesting(null)
  })

  describe('JST_TIMEZONE', () => {
    it('is Asia/Tokyo', () => {
      expect(JST_TIMEZONE).toBe('Asia/Tokyo')
    })
  })

  describe('now', () => {
    it('returns current time by default', () => {
      const before = Date.now()
      const result = now()
      const after = Date.now()
      expect(result.getTime()).toBeGreaterThanOrEqual(before)
      expect(result.getTime()).toBeLessThanOrEqual(after)
    })

    it('returns test time when set', () => {
      const testDate = new Date('2024-06-15T10:00:00Z')
      setNowForTesting(testDate)
      expect(now()).toEqual(testDate)
    })
  })

  describe('setNowForTesting', () => {
    it('sets and resets test time', () => {
      const testDate = new Date('2024-01-01T00:00:00Z')
      setNowForTesting(testDate)
      expect(now()).toEqual(testDate)

      setNowForTesting(null)
      expect(now().getTime()).toBeGreaterThan(0)
    })
  })

  describe('formatDateISO', () => {
    it('formats UTC date to JST YYYY-MM-DD', () => {
      // 2024-12-17 15:00 UTC = 2024-12-18 00:00 JST
      const date = new Date('2024-12-17T15:00:00Z')
      expect(formatDateISO(date)).toBe('2024-12-18')
    })

    it('formats same day in JST', () => {
      // 2024-12-17 00:00 UTC = 2024-12-17 09:00 JST
      const date = new Date('2024-12-17T00:00:00Z')
      expect(formatDateISO(date)).toBe('2024-12-17')
    })
  })

  describe('formatDateTimeISO', () => {
    it('formats to JST ISO format with +09:00', () => {
      const date = new Date('2024-12-17T09:30:00Z')
      // 09:30 UTC = 18:30 JST
      expect(formatDateTimeISO(date)).toBe('2024-12-17T18:30:00+09:00')
    })

    it('formats midnight correctly', () => {
      const date = new Date('2024-12-17T15:00:00Z')
      // 15:00 UTC = 00:00 JST next day
      expect(formatDateTimeISO(date)).toBe('2024-12-18T00:00:00+09:00')
    })
  })

  describe('formatTimeHM', () => {
    it('formats to HH:mm in JST', () => {
      const date = new Date('2024-12-17T09:30:00Z')
      expect(formatTimeHM(date)).toBe('18:30')
    })

    it('pads single digit hours and minutes', () => {
      const date = new Date('2024-12-17T00:05:00Z')
      // 00:05 UTC = 09:05 JST
      expect(formatTimeHM(date)).toBe('09:05')
    })
  })

  describe('today', () => {
    it('returns today in YYYY-MM-DD format', () => {
      setNowForTesting(new Date('2024-12-17T10:00:00+09:00'))
      expect(today()).toBe('2024-12-17')
    })

    it('handles timezone boundary', () => {
      // 23:30 JST should still be the same day
      setNowForTesting(new Date('2024-12-17T14:30:00Z')) // 23:30 JST
      expect(today()).toBe('2024-12-17')
    })
  })

  describe('isToday', () => {
    beforeEach(() => {
      setNowForTesting(new Date('2024-12-17T10:00:00+09:00'))
    })

    it('returns true for today', () => {
      expect(isToday('2024-12-17')).toBe(true)
    })

    it('returns true for today with ISO string', () => {
      expect(isToday('2024-12-17T18:00:00+09:00')).toBe(true)
    })

    it('returns false for other days', () => {
      expect(isToday('2024-12-18')).toBe(false)
      expect(isToday('2024-12-16')).toBe(false)
    })
  })

  describe('parseJstDateAtMidnight', () => {
    it('parses date as JST midnight', () => {
      const result = parseJstDateAtMidnight('2024-12-17')
      // 2024-12-17 00:00 JST = 2024-12-16 15:00 UTC
      expect(result.toISOString()).toBe('2024-12-16T15:00:00.000Z')
    })
  })

  describe('addDays', () => {
    it('adds positive days', () => {
      expect(addDays('2024-12-17', 3)).toBe('2024-12-20')
    })

    it('handles month boundary', () => {
      expect(addDays('2024-12-31', 1)).toBe('2025-01-01')
    })

    it('handles negative days', () => {
      expect(addDays('2024-12-17', -5)).toBe('2024-12-12')
    })

    it('handles zero days', () => {
      expect(addDays('2024-12-17', 0)).toBe('2024-12-17')
    })
  })

  describe('weekRange', () => {
    it('returns 7 days starting from given date', () => {
      const result = weekRange('2024-12-17')
      expect(result).toEqual([
        '2024-12-17',
        '2024-12-18',
        '2024-12-19',
        '2024-12-20',
        '2024-12-21',
        '2024-12-22',
        '2024-12-23',
      ])
    })

    it('returns 7 days from today when no argument', () => {
      setNowForTesting(new Date('2024-12-17T10:00:00+09:00'))
      const result = weekRange()
      expect(result.length).toBe(7)
      expect(result[0]).toBe('2024-12-17')
      expect(result[6]).toBe('2024-12-23')
    })

    it('handles month boundary', () => {
      const result = weekRange('2024-12-28')
      expect(result).toEqual([
        '2024-12-28',
        '2024-12-29',
        '2024-12-30',
        '2024-12-31',
        '2025-01-01',
        '2025-01-02',
        '2025-01-03',
      ])
    })
  })

  describe('extractDate', () => {
    it('extracts date from ISO string', () => {
      expect(extractDate('2024-12-17T18:00:00+09:00')).toBe('2024-12-17')
    })

    it('returns date string unchanged', () => {
      expect(extractDate('2024-12-17')).toBe('2024-12-17')
    })
  })

  describe('extractTime', () => {
    it('extracts time from ISO string', () => {
      expect(extractTime('2024-12-17T18:30:00+09:00')).toBe('18:30')
    })

    it('extracts time with single digits', () => {
      expect(extractTime('2024-12-17T09:05:00+09:00')).toBe('09:05')
    })
  })

  describe('isSameDate', () => {
    it('returns true for same YYYY-MM-DD', () => {
      expect(isSameDate('2024-12-17', '2024-12-17')).toBe(true)
    })

    it('returns true for ISO string and date string', () => {
      expect(isSameDate('2024-12-17', '2024-12-17T18:00:00+09:00')).toBe(true)
    })

    it('returns false for different dates', () => {
      expect(isSameDate('2024-12-17', '2024-12-18')).toBe(false)
    })

    it('compares two ISO strings', () => {
      expect(isSameDate('2024-12-17T10:00:00+09:00', '2024-12-17T23:00:00+09:00')).toBe(true)
    })
  })

  describe('formatReservationRange', () => {
    it('formats same-day range', () => {
      const result = formatReservationRange(
        '2024-12-17T18:00:00+09:00',
        '2024-12-17T19:30:00+09:00'
      )
      expect(result).toBe('2024/12/17 18:00〜19:30')
    })

    it('formats cross-day range', () => {
      const result = formatReservationRange(
        '2024-12-17T23:00:00+09:00',
        '2024-12-18T01:00:00+09:00'
      )
      expect(result).toBe('2024/12/17 23:00〜2024/12/18 01:00')
    })

    it('handles invalid start date', () => {
      const result = formatReservationRange('invalid', '2024-12-17T19:30:00+09:00')
      expect(result).toBe('invalid〜2024-12-17T19:30:00+09:00')
    })

    it('handles invalid end date', () => {
      const result = formatReservationRange('2024-12-17T18:00:00+09:00', 'invalid')
      expect(result).toBe('2024-12-17T18:00:00+09:00〜invalid')
    })

    it('handles both invalid dates', () => {
      const result = formatReservationRange('invalid-start', 'invalid-end')
      expect(result).toBe('invalid-start〜invalid-end')
    })

    it('formats UTC times correctly in JST', () => {
      // 09:00 UTC = 18:00 JST
      const result = formatReservationRange(
        '2024-12-17T09:00:00Z',
        '2024-12-17T10:30:00Z'
      )
      expect(result).toBe('2024/12/17 18:00〜19:30')
    })
  })
})
