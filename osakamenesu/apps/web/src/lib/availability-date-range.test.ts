import { describe, it, expect } from 'vitest'
import {
  formatDateJST,
  getTodayJST,
  generateWeekDateRange,
  generateWeekDateRangeWithToday,
  isDateToday,
  isValidDateFormat,
  areDatesConsecutive,
  getDateRangeDebugInfo,
} from './availability-date-range'

describe('availability-date-range', () => {
  describe('formatDateJST', () => {
    it('formats date to YYYY-MM-DD in JST', () => {
      // 2025-01-15 12:00:00 UTC = 2025-01-15 21:00:00 JST
      const date = new Date('2025-01-15T12:00:00Z')
      const result = formatDateJST(date)
      expect(result).toBe('2025-01-15')
    })

    it('handles JST 00:00 boundary correctly (UTC前日23時 = JST翌日8時)', () => {
      // 2025-01-14 23:00:00 UTC = 2025-01-15 08:00:00 JST
      const utcBeforeMidnight = new Date('2025-01-14T23:00:00Z')
      expect(formatDateJST(utcBeforeMidnight)).toBe('2025-01-15')
    })

    it('handles UTC midnight crossing to next JST day', () => {
      // UTC 15:00 = JST 00:00 (next day)
      const utc15 = new Date('2025-01-14T15:00:00Z')
      expect(formatDateJST(utc15)).toBe('2025-01-15')

      // UTC 14:59 = JST 23:59 (same day)
      const utc1459 = new Date('2025-01-14T14:59:00Z')
      expect(formatDateJST(utc1459)).toBe('2025-01-14')
    })

    it('produces consistent results regardless of local timezone', () => {
      // この関数は常にJSTベースで日付を返す
      // UTC実行環境（Vercel）でもJST実行環境（ローカル）でも同じ結果
      const fixedDate = new Date('2025-12-12T00:00:00Z')
      const result = formatDateJST(fixedDate)
      // UTC 00:00 = JST 09:00, so still 2025-12-12
      expect(result).toBe('2025-12-12')
    })
  })

  describe('getTodayJST', () => {
    it('returns today in YYYY-MM-DD format', () => {
      const now = new Date('2025-12-12T10:00:00+09:00')
      const result = getTodayJST(now)
      expect(result).toBe('2025-12-12')
    })

    it('handles JST midnight boundary', () => {
      // Just before midnight JST (23:59 JST = 14:59 UTC)
      const beforeMidnight = new Date('2025-12-12T14:59:00Z')
      expect(getTodayJST(beforeMidnight)).toBe('2025-12-12')

      // Just after midnight JST (00:00 JST = 15:00 UTC)
      const afterMidnight = new Date('2025-12-12T15:00:00Z')
      expect(getTodayJST(afterMidnight)).toBe('2025-12-13')
    })
  })

  describe('generateWeekDateRange', () => {
    it('generates exactly 7 dates', () => {
      const now = new Date('2025-12-12T10:00:00+09:00')
      const dates = generateWeekDateRange(now)
      expect(dates).toHaveLength(7)
    })

    it('starts from today', () => {
      const now = new Date('2025-12-12T10:00:00+09:00')
      const dates = generateWeekDateRange(now)
      expect(dates[0]).toBe('2025-12-12')
    })

    it('generates consecutive dates', () => {
      const now = new Date('2025-12-12T10:00:00+09:00')
      const dates = generateWeekDateRange(now)
      expect(areDatesConsecutive(dates)).toBe(true)
    })

    it('generates expected date sequence', () => {
      const now = new Date('2025-12-12T10:00:00+09:00')
      const dates = generateWeekDateRange(now)
      expect(dates).toEqual([
        '2025-12-12',
        '2025-12-13',
        '2025-12-14',
        '2025-12-15',
        '2025-12-16',
        '2025-12-17',
        '2025-12-18',
      ])
    })

    it('handles month boundary correctly', () => {
      const now = new Date('2025-12-29T10:00:00+09:00')
      const dates = generateWeekDateRange(now)
      expect(dates).toEqual([
        '2025-12-29',
        '2025-12-30',
        '2025-12-31',
        '2026-01-01',
        '2026-01-02',
        '2026-01-03',
        '2026-01-04',
      ])
    })

    it('handles leap year February correctly', () => {
      const now = new Date('2024-02-27T10:00:00+09:00')
      const dates = generateWeekDateRange(now)
      expect(dates).toContain('2024-02-29')
      expect(dates).toContain('2024-03-01')
    })

    it('produces same results for UTC server (Vercel simulation)', () => {
      // Vercelサーバー（UTC）での実行をシミュレート
      // UTC 00:00 on 2025-12-12 = JST 09:00 on 2025-12-12
      const utcMidnight = new Date('2025-12-12T00:00:00Z')
      const dates = generateWeekDateRange(utcMidnight)
      expect(dates[0]).toBe('2025-12-12')
      expect(dates).toHaveLength(7)
      expect(areDatesConsecutive(dates)).toBe(true)
    })

    it('produces same results across JST midnight boundary from UTC', () => {
      // UTC 14:59 = JST 23:59 (still 12/12)
      const beforeJstMidnight = new Date('2025-12-12T14:59:00Z')
      const datesBeforeJstMidnight = generateWeekDateRange(beforeJstMidnight)
      expect(datesBeforeJstMidnight[0]).toBe('2025-12-12')

      // UTC 15:00 = JST 00:00 (now 12/13)
      const afterJstMidnight = new Date('2025-12-12T15:00:00Z')
      const datesAfterJstMidnight = generateWeekDateRange(afterJstMidnight)
      expect(datesAfterJstMidnight[0]).toBe('2025-12-13')
    })
  })

  describe('generateWeekDateRangeWithToday', () => {
    it('marks only the first date as is_today', () => {
      const now = new Date('2025-12-12T10:00:00+09:00')
      const dates = generateWeekDateRangeWithToday(now)

      expect(dates[0]).toEqual({ date: '2025-12-12', is_today: true })
      expect(dates[1]).toEqual({ date: '2025-12-13', is_today: false })
      expect(dates[6]).toEqual({ date: '2025-12-18', is_today: false })
    })

    it('has exactly one is_today: true', () => {
      const now = new Date('2025-12-12T10:00:00+09:00')
      const dates = generateWeekDateRangeWithToday(now)
      const todayCount = dates.filter((d) => d.is_today).length
      expect(todayCount).toBe(1)
    })
  })

  describe('isDateToday', () => {
    it('returns true for today date string', () => {
      const now = new Date('2025-12-12T10:00:00+09:00')
      expect(isDateToday('2025-12-12', now)).toBe(true)
    })

    it('returns false for other dates', () => {
      const now = new Date('2025-12-12T10:00:00+09:00')
      expect(isDateToday('2025-12-11', now)).toBe(false)
      expect(isDateToday('2025-12-13', now)).toBe(false)
    })
  })

  describe('isValidDateFormat', () => {
    it('validates correct YYYY-MM-DD format', () => {
      expect(isValidDateFormat('2025-12-12')).toBe(true)
      expect(isValidDateFormat('2024-01-01')).toBe(true)
    })

    it('rejects invalid formats', () => {
      expect(isValidDateFormat('12-12-2025')).toBe(false)
      expect(isValidDateFormat('2025/12/12')).toBe(false)
      expect(isValidDateFormat('2025-1-12')).toBe(false)
      expect(isValidDateFormat('invalid')).toBe(false)
    })
  })

  describe('areDatesConsecutive', () => {
    it('returns true for consecutive dates', () => {
      expect(areDatesConsecutive(['2025-12-12', '2025-12-13', '2025-12-14'])).toBe(true)
    })

    it('returns false for dates with gaps', () => {
      expect(areDatesConsecutive(['2025-12-12', '2025-12-14'])).toBe(false)
    })

    it('returns false for dates out of order', () => {
      expect(areDatesConsecutive(['2025-12-14', '2025-12-13'])).toBe(false)
    })

    it('returns true for single or empty array', () => {
      expect(areDatesConsecutive([])).toBe(true)
      expect(areDatesConsecutive(['2025-12-12'])).toBe(true)
    })

    it('handles month boundaries', () => {
      expect(areDatesConsecutive(['2025-12-31', '2026-01-01'])).toBe(true)
    })
  })

  describe('getDateRangeDebugInfo', () => {
    it('returns complete debug information', () => {
      const now = new Date('2025-12-12T10:00:00+09:00')
      const info = getDateRangeDebugInfo(now)

      expect(info.jstTodayStr).toBe('2025-12-12')
      expect(info.weekDates).toHaveLength(7)
      expect(info.weekDates[0]).toBe('2025-12-12')
      expect(info.isConsecutive).toBe(true)
      expect(info.inputTimestamp).toBeTypeOf('number')
      expect(info.utcIsoString).toContain('2025-12-12')
    })

    it('can be used for diagnosing timezone issues', () => {
      // UTC時刻でテスト（Vercel環境をシミュレート）
      const utcTime = new Date('2025-12-12T02:00:00Z') // UTC 02:00 = JST 11:00
      const info = getDateRangeDebugInfo(utcTime)

      // デバッグ情報が正しく生成されることを確認
      expect(info.utcIsoString).toBe('2025-12-12T02:00:00.000Z')
      expect(info.jstTodayStr).toBe('2025-12-12')
      expect(info.weekDates[0]).toBe('2025-12-12')
    })
  })

  // JST日付境界（23:30〜00:30）の詳細テスト
  // この時間帯は再発しやすい境界なので、複数のケースで担保
  describe('JST midnight boundary (23:30~00:30) edge cases', () => {
    it('JST 23:30 is still the same day', () => {
      // JST 23:30 = UTC 14:30
      const jst2330 = new Date('2025-12-12T14:30:00Z')
      expect(formatDateJST(jst2330)).toBe('2025-12-12')
      expect(getTodayJST(jst2330)).toBe('2025-12-12')

      const dates = generateWeekDateRange(jst2330)
      expect(dates[0]).toBe('2025-12-12')
    })

    it('JST 23:59 is still the same day', () => {
      // JST 23:59 = UTC 14:59
      const jst2359 = new Date('2025-12-12T14:59:00Z')
      expect(formatDateJST(jst2359)).toBe('2025-12-12')

      const dates = generateWeekDateRange(jst2359)
      expect(dates[0]).toBe('2025-12-12')
    })

    it('JST 00:00 is the next day', () => {
      // JST 00:00 (12/13) = UTC 15:00 (12/12)
      const jst0000 = new Date('2025-12-12T15:00:00Z')
      expect(formatDateJST(jst0000)).toBe('2025-12-13')

      const dates = generateWeekDateRange(jst0000)
      expect(dates[0]).toBe('2025-12-13')
    })

    it('JST 00:01 is the next day', () => {
      // JST 00:01 (12/13) = UTC 15:01 (12/12)
      const jst0001 = new Date('2025-12-12T15:01:00Z')
      expect(formatDateJST(jst0001)).toBe('2025-12-13')
    })

    it('JST 00:30 is the next day', () => {
      // JST 00:30 (12/13) = UTC 15:30 (12/12)
      const jst0030 = new Date('2025-12-12T15:30:00Z')
      expect(formatDateJST(jst0030)).toBe('2025-12-13')

      const dates = generateWeekDateRange(jst0030)
      expect(dates[0]).toBe('2025-12-13')
    })

    it('week range is consecutive across midnight boundary', () => {
      // JST 23:59 on 12/12
      const beforeMidnight = new Date('2025-12-12T14:59:00Z')
      const datesBefore = generateWeekDateRange(beforeMidnight)

      // JST 00:00 on 12/13
      const afterMidnight = new Date('2025-12-12T15:00:00Z')
      const datesAfter = generateWeekDateRange(afterMidnight)

      // Both should be consecutive
      expect(areDatesConsecutive(datesBefore)).toBe(true)
      expect(areDatesConsecutive(datesAfter)).toBe(true)

      // They should start with consecutive dates
      expect(datesBefore[0]).toBe('2025-12-12')
      expect(datesAfter[0]).toBe('2025-12-13')
    })

    it('handles year-end midnight boundary correctly', () => {
      // JST 23:59 on 12/31/2025
      const dec31_2359 = new Date('2025-12-31T14:59:00Z')
      expect(formatDateJST(dec31_2359)).toBe('2025-12-31')

      // JST 00:00 on 01/01/2026
      const jan1_0000 = new Date('2025-12-31T15:00:00Z')
      expect(formatDateJST(jan1_0000)).toBe('2026-01-01')

      // Week range should cross year boundary
      const datesAcrossYear = generateWeekDateRange(dec31_2359)
      expect(datesAcrossYear[0]).toBe('2025-12-31')
      expect(datesAcrossYear).toContain('2026-01-01')
      expect(areDatesConsecutive(datesAcrossYear)).toBe(true)
    })

    it('is_today flag is correct at midnight boundary', () => {
      // JST 23:59 on 12/12
      const jst2359 = new Date('2025-12-12T14:59:00Z')
      const datesWithToday1 = generateWeekDateRangeWithToday(jst2359)
      expect(datesWithToday1[0]).toEqual({ date: '2025-12-12', is_today: true })
      expect(datesWithToday1[1]).toEqual({ date: '2025-12-13', is_today: false })

      // JST 00:00 on 12/13
      const jst0000 = new Date('2025-12-12T15:00:00Z')
      const datesWithToday2 = generateWeekDateRangeWithToday(jst0000)
      expect(datesWithToday2[0]).toEqual({ date: '2025-12-13', is_today: true })
      expect(datesWithToday2[1]).toEqual({ date: '2025-12-14', is_today: false })
    })
  })
})
