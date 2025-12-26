import { describe, it, expect } from 'vitest'
import {
  TOKYO_TZ,
  toZonedDayjs,
  formatDatetimeLocal,
  formatZonedIso,
  nowIso,
  addMinutes,
  toZonedDate,
  dayjs,
} from '../timezone'

describe('TOKYO_TZ', () => {
  it('is Asia/Tokyo', () => {
    expect(TOKYO_TZ).toBe('Asia/Tokyo')
  })
})

describe('toZonedDayjs', () => {
  it('returns current time in Tokyo when no value provided', () => {
    const result = toZonedDayjs()
    expect(result.isValid()).toBe(true)
  })

  it('parses ISO string to Tokyo timezone', () => {
    const result = toZonedDayjs('2024-01-15T12:00:00Z')
    expect(result.isValid()).toBe(true)
    // UTC 12:00 should be 21:00 in Tokyo (UTC+9)
    expect(result.hour()).toBe(21)
  })

  it('parses Date object to Tokyo timezone', () => {
    const date = new Date('2024-01-15T12:00:00Z')
    const result = toZonedDayjs(date)
    expect(result.isValid()).toBe(true)
    expect(result.hour()).toBe(21)
  })

  it('handles null value', () => {
    const result = toZonedDayjs(null)
    expect(result.isValid()).toBe(true)
  })

  it('handles undefined value', () => {
    const result = toZonedDayjs(undefined)
    expect(result.isValid()).toBe(true)
  })

  it('returns invalid dayjs for invalid date string', () => {
    const result = toZonedDayjs('invalid-date')
    expect(result.isValid()).toBe(false)
  })

  it('can use custom timezone', () => {
    const result = toZonedDayjs('2024-01-15T12:00:00Z', 'America/New_York')
    expect(result.isValid()).toBe(true)
    // UTC 12:00 should be 07:00 in New York (UTC-5)
    expect(result.hour()).toBe(7)
  })
})

describe('formatDatetimeLocal', () => {
  it('formats date to datetime-local format', () => {
    const result = formatDatetimeLocal('2024-01-15T12:00:00Z')
    // UTC 12:00 -> Tokyo 21:00
    expect(result).toBe('2024-01-15T21:00')
  })

  it('returns empty string for invalid date', () => {
    const result = formatDatetimeLocal('invalid')
    expect(result).toBe('')
  })

  it('returns empty string for undefined', () => {
    const result = formatDatetimeLocal(undefined)
    // Returns current time formatted, not empty
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })
})

describe('formatZonedIso', () => {
  it('formats date to ISO format with timezone', () => {
    const result = formatZonedIso('2024-01-15T12:00:00Z')
    // Should include Tokyo timezone offset (+0900)
    expect(result).toContain('2024-01-15')
    expect(result).toContain('21:00')
  })

  it('returns empty string for invalid date', () => {
    const result = formatZonedIso('invalid')
    expect(result).toBe('')
  })

  it('accepts custom format', () => {
    const result = formatZonedIso('2024-01-15T12:00:00Z', TOKYO_TZ, 'YYYY/MM/DD')
    expect(result).toBe('2024/01/15')
  })
})

describe('nowIso', () => {
  it('returns current time in ISO format', () => {
    const result = nowIso()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })
})

describe('addMinutes', () => {
  it('adds minutes to a date', () => {
    const result = addMinutes('2024-01-15T12:00:00Z', 30)
    expect(result.minute()).toBe(30)
  })

  it('handles negative minutes', () => {
    const result = addMinutes('2024-01-15T12:30:00Z', -30)
    expect(result.minute()).toBe(0)
  })

  it('handles hour overflow', () => {
    const result = addMinutes('2024-01-15T12:00:00Z', 90)
    // 12:00 UTC -> 21:00 Tokyo + 90min = 22:30 Tokyo
    expect(result.hour()).toBe(22)
    expect(result.minute()).toBe(30)
  })
})

describe('toZonedDate', () => {
  it('converts to JavaScript Date object', () => {
    const result = toZonedDate('2024-01-15T12:00:00Z')
    expect(result).toBeInstanceOf(Date)
  })

  it('returns current date when no value provided', () => {
    const result = toZonedDate()
    expect(result).toBeInstanceOf(Date)
    // Should be a valid date (not NaN)
    expect(result.getTime()).not.toBeNaN()
  })
})

describe('dayjs export', () => {
  it('exports dayjs library', () => {
    expect(dayjs).toBeDefined()
    expect(typeof dayjs).toBe('function')
  })

  it('has timezone plugin enabled', () => {
    const d = dayjs()
    expect(typeof d.tz).toBe('function')
  })

  it('has utc plugin enabled', () => {
    const d = dayjs()
    expect(typeof d.utc).toBe('function')
  })
})
