import { describe, expect, it } from 'vitest'

import { formatLocalDate, getJaFormatter, pad, toIsoWithOffset } from '@/utils/date'

describe('pad', () => {
  it('pads single digit to two digits', () => {
    expect(pad(0)).toBe('00')
    expect(pad(1)).toBe('01')
    expect(pad(9)).toBe('09')
  })

  it('keeps two digit numbers as is', () => {
    expect(pad(10)).toBe('10')
    expect(pad(99)).toBe('99')
  })

  it('keeps three digit numbers as is', () => {
    expect(pad(100)).toBe('100')
  })
})

describe('getJaFormatter', () => {
  it('returns cached instances for each formatter type', () => {
    const types = [
      'day',
      'time',
      'weekday',
      'monthShort',
      'dateTimeShort',
      'dateNumeric',
      'monthShortDay',
      'dateMediumTimeShort',
    ] as const

    const firstPass = types.map((type) => getJaFormatter(type))
    const secondPass = types.map((type) => getJaFormatter(type))

    firstPass.forEach((formatter, index) => {
      expect(formatter).toBe(secondPass[index])
    })
    expect(firstPass[0]).not.toBe(firstPass[1])
  })

  it('formats dates with the extended formatter types without errors', () => {
    const date = new Date('2024-01-01T12:34:00Z')
    expect(() => getJaFormatter('dateTimeShort').format(date)).not.toThrow()
    expect(() => getJaFormatter('dateNumeric').format(date)).not.toThrow()
    expect(() => getJaFormatter('monthShortDay').format(date)).not.toThrow()
    expect(() => getJaFormatter('dateMediumTimeShort').format(date)).not.toThrow()
  })
})

describe('format helpers', () => {
  it('formats local date strings consistently', () => {
    const date = new Date(2024, 0, 1, 9, 45)
    expect(formatLocalDate(date)).toBe('2024-01-01')
  })

  it('formats ISO strings with +09:00 offset', () => {
    const date = new Date(2024, 2, 5, 21, 15)
    expect(toIsoWithOffset(date)).toBe('2024-03-05T21:15:00+09:00')
  })

  it('handles midnight correctly', () => {
    const date = new Date('2024-12-17T00:00:00+09:00')
    expect(toIsoWithOffset(date)).toBe('2024-12-17T00:00:00+09:00')
  })

  it('handles end of day correctly', () => {
    const date = new Date('2024-12-17T23:59:00+09:00')
    expect(toIsoWithOffset(date)).toBe('2024-12-17T23:59:00+09:00')
  })
})

describe('getJaFormatter output', () => {
  it('formats time correctly', () => {
    const formatter = getJaFormatter('time')
    const date = new Date('2024-12-17T14:30:00+09:00')
    expect(formatter.format(date)).toBe('14:30')
  })

  it('formats weekday in Japanese', () => {
    const formatter = getJaFormatter('weekday')
    // Tuesday in JST
    const date = new Date('2024-12-17T12:00:00+09:00')
    expect(formatter.format(date)).toBe('火')
  })

  it('formats monthShort in Japanese', () => {
    const formatter = getJaFormatter('monthShort')
    const date = new Date('2024-12-17T12:00:00+09:00')
    expect(formatter.format(date)).toBe('12月')
  })

  it('formats dateNumeric correctly', () => {
    const formatter = getJaFormatter('dateNumeric')
    const date = new Date('2024-12-17T12:00:00+09:00')
    expect(formatter.format(date)).toBe('2024/12/17')
  })
})
