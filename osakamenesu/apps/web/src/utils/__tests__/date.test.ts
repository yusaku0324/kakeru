import { describe, expect, it } from 'vitest'

import { formatLocalDate, getJaFormatter, toIsoWithOffset } from '@/utils/date'

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
})
