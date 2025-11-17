import { describe, expect, it } from 'vitest'

import { getJaFormatter } from '@/utils/date'

describe('getJaFormatter', () => {
  it('returns cached instances for each formatter type', () => {
    const dayA = getJaFormatter('day')
    const dayB = getJaFormatter('day')
    const timeA = getJaFormatter('time')
    const timeB = getJaFormatter('time')

    expect(dayA).toBe(dayB)
    expect(timeA).toBe(timeB)
    expect(dayA).not.toBe(timeA)
  })
})
