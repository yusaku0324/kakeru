import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  normalizeSlotStatus,
  normalizeAvailabilityDays,
  hasTodayAvailability,
  getFirstAvailableSlot,
  findSlotByStartAt,
  isSelectableSlot,
  findSelectableSlotByStartAt,
  getFirstSelectableSlot,
  findDefaultSelectableSlot,
  toDisplayAvailabilityDays,
  findDisplaySelectableSlot,
  getFirstDisplaySelectableSlot,
  findDefaultDisplaySelectableSlot,
  type NormalizedSlot,
  type NormalizedAvailabilityDay,
  type DisplayAvailabilityDay,
} from '../availability'

// Mock jst module
vi.mock('../jst', () => ({
  today: () => '2024-12-27',
  extractDate: (dateStr: string) => dateStr.split('T')[0],
  extractTime: (dateStr: string) => {
    const match = dateStr.match(/T(\d{2}:\d{2})/)
    return match ? match[1] : '00:00'
  },
  parseJstDateAtMidnight: (dateStr: string) => new Date(dateStr + 'T00:00:00+09:00'),
}))

describe('availability', () => {
  describe('normalizeSlotStatus', () => {
    it('returns "open" for null', () => {
      expect(normalizeSlotStatus(null)).toBe('open')
    })

    it('returns "open" for undefined', () => {
      expect(normalizeSlotStatus(undefined)).toBe('open')
    })

    it('returns "open" for "open"', () => {
      expect(normalizeSlotStatus('open')).toBe('open')
    })

    it('returns "open" for "available"', () => {
      expect(normalizeSlotStatus('available')).toBe('open')
    })

    it('returns "open" for "ok"', () => {
      expect(normalizeSlotStatus('ok')).toBe('open')
    })

    it('returns "blocked" for "blocked"', () => {
      expect(normalizeSlotStatus('blocked')).toBe('blocked')
    })

    it('returns "blocked" for "busy"', () => {
      expect(normalizeSlotStatus('busy')).toBe('blocked')
    })

    it('returns "blocked" for "unavailable"', () => {
      expect(normalizeSlotStatus('unavailable')).toBe('blocked')
    })

    it('is case insensitive', () => {
      expect(normalizeSlotStatus('OPEN')).toBe('open')
      expect(normalizeSlotStatus('BLOCKED')).toBe('blocked')
    })

    it('returns "open" for unknown status', () => {
      expect(normalizeSlotStatus('unknown')).toBe('open')
    })
  })

  describe('normalizeAvailabilityDays', () => {
    it('returns null for null slots', () => {
      expect(normalizeAvailabilityDays(null)).toBeNull()
    })

    it('returns null for undefined slots', () => {
      expect(normalizeAvailabilityDays(undefined)).toBeNull()
    })

    it('returns null for empty array', () => {
      expect(normalizeAvailabilityDays([])).toBeNull()
    })

    it('groups slots by date', () => {
      const slots = [
        { start_at: '2024-12-27T10:00:00+09:00', end_at: '2024-12-27T12:00:00+09:00', status: 'open' },
        { start_at: '2024-12-27T14:00:00+09:00', end_at: '2024-12-27T16:00:00+09:00', status: 'open' },
        { start_at: '2024-12-28T10:00:00+09:00', end_at: '2024-12-28T12:00:00+09:00', status: 'open' },
      ]

      const result = normalizeAvailabilityDays(slots, '2024-12-27')

      expect(result).toHaveLength(2)
      expect(result![0].date).toBe('2024-12-27')
      expect(result![0].slots).toHaveLength(2)
      expect(result![1].date).toBe('2024-12-28')
      expect(result![1].slots).toHaveLength(1)
    })

    it('marks today correctly', () => {
      const slots = [
        { start_at: '2024-12-27T10:00:00+09:00', end_at: '2024-12-27T12:00:00+09:00', status: 'open' },
        { start_at: '2024-12-28T10:00:00+09:00', end_at: '2024-12-28T12:00:00+09:00', status: 'open' },
      ]

      const result = normalizeAvailabilityDays(slots, '2024-12-27')

      expect(result![0].is_today).toBe(true)
      expect(result![1].is_today).toBe(false)
    })

    it('skips slots without start_at', () => {
      const slots = [
        { start_at: '', end_at: '2024-12-27T12:00:00+09:00', status: 'open' },
        { start_at: '2024-12-27T14:00:00+09:00', end_at: '2024-12-27T16:00:00+09:00', status: 'open' },
      ]

      const result = normalizeAvailabilityDays(slots, '2024-12-27')

      expect(result).toHaveLength(1)
      expect(result![0].slots).toHaveLength(1)
    })

    it('removes duplicate slots', () => {
      const slots = [
        { start_at: '2024-12-27T10:00:00+09:00', end_at: '2024-12-27T12:00:00+09:00', status: 'open' },
        { start_at: '2024-12-27T10:00:00+09:00', end_at: '2024-12-27T12:00:00+09:00', status: 'open' },
      ]

      const result = normalizeAvailabilityDays(slots, '2024-12-27')

      expect(result![0].slots).toHaveLength(1)
    })

    it('sorts days by date', () => {
      const slots = [
        { start_at: '2024-12-29T10:00:00+09:00', end_at: '2024-12-29T12:00:00+09:00', status: 'open' },
        { start_at: '2024-12-27T10:00:00+09:00', end_at: '2024-12-27T12:00:00+09:00', status: 'open' },
        { start_at: '2024-12-28T10:00:00+09:00', end_at: '2024-12-28T12:00:00+09:00', status: 'open' },
      ]

      const result = normalizeAvailabilityDays(slots, '2024-12-27')

      expect(result![0].date).toBe('2024-12-27')
      expect(result![1].date).toBe('2024-12-28')
      expect(result![2].date).toBe('2024-12-29')
    })
  })

  describe('hasTodayAvailability', () => {
    it('returns false for null', () => {
      expect(hasTodayAvailability(null)).toBe(false)
    })

    it('returns false for undefined', () => {
      expect(hasTodayAvailability(undefined)).toBe(false)
    })

    it('returns false for empty array', () => {
      expect(hasTodayAvailability([])).toBe(false)
    })

    it('returns false when today has no slots', () => {
      const days: NormalizedAvailabilityDay[] = [
        { date: '2024-12-28', is_today: false, slots: [{ start_at: '2024-12-28T10:00:00+09:00', end_at: '2024-12-28T12:00:00+09:00', status: 'open' }] },
      ]
      expect(hasTodayAvailability(days)).toBe(false)
    })

    it('returns false when today has only blocked slots', () => {
      const days: NormalizedAvailabilityDay[] = [
        { date: '2024-12-27', is_today: true, slots: [{ start_at: '2024-12-27T10:00:00+09:00', end_at: '2024-12-27T12:00:00+09:00', status: 'blocked' }] },
      ]
      expect(hasTodayAvailability(days)).toBe(false)
    })

    it('returns true when today has open slots', () => {
      const days: NormalizedAvailabilityDay[] = [
        { date: '2024-12-27', is_today: true, slots: [{ start_at: '2024-12-27T10:00:00+09:00', end_at: '2024-12-27T12:00:00+09:00', status: 'open' }] },
      ]
      expect(hasTodayAvailability(days)).toBe(true)
    })

    it('returns true when today has tentative slots', () => {
      const days: NormalizedAvailabilityDay[] = [
        { date: '2024-12-27', is_today: true, slots: [{ start_at: '2024-12-27T10:00:00+09:00', end_at: '2024-12-27T12:00:00+09:00', status: 'tentative' }] },
      ]
      expect(hasTodayAvailability(days)).toBe(true)
    })
  })

  describe('getFirstAvailableSlot', () => {
    it('returns null for null', () => {
      expect(getFirstAvailableSlot(null)).toBeNull()
    })

    it('returns null for empty array', () => {
      expect(getFirstAvailableSlot([])).toBeNull()
    })

    it('returns null when all slots are blocked', () => {
      const days: NormalizedAvailabilityDay[] = [
        { date: '2024-12-27', is_today: true, slots: [{ start_at: '2024-12-27T10:00:00+09:00', end_at: '2024-12-27T12:00:00+09:00', status: 'blocked' }] },
      ]
      expect(getFirstAvailableSlot(days)).toBeNull()
    })

    it('returns first open slot', () => {
      const days: NormalizedAvailabilityDay[] = [
        { date: '2024-12-27', is_today: true, slots: [
          { start_at: '2024-12-27T10:00:00+09:00', end_at: '2024-12-27T12:00:00+09:00', status: 'blocked' },
          { start_at: '2024-12-27T14:00:00+09:00', end_at: '2024-12-27T16:00:00+09:00', status: 'open' },
        ] },
      ]
      const result = getFirstAvailableSlot(days)
      expect(result?.slot.start_at).toBe('2024-12-27T14:00:00+09:00')
    })
  })

  describe('findSlotByStartAt', () => {
    const days: NormalizedAvailabilityDay[] = [
      { date: '2024-12-27', is_today: true, slots: [
        { start_at: '2024-12-27T10:00:00+09:00', end_at: '2024-12-27T12:00:00+09:00', status: 'open' },
        { start_at: '2024-12-27T14:00:00+09:00', end_at: '2024-12-27T16:00:00+09:00', status: 'open' },
      ] },
    ]

    it('returns null for null days', () => {
      expect(findSlotByStartAt(null, '2024-12-27T10:00:00+09:00')).toBeNull()
    })

    it('returns null for empty startAt', () => {
      expect(findSlotByStartAt(days, '')).toBeNull()
    })

    it('returns null for invalid startAt', () => {
      expect(findSlotByStartAt(days, 'invalid')).toBeNull()
    })

    it('returns null when slot not found', () => {
      expect(findSlotByStartAt(days, '2024-12-27T18:00:00+09:00')).toBeNull()
    })

    it('finds slot by start_at', () => {
      const result = findSlotByStartAt(days, '2024-12-27T14:00:00+09:00')
      expect(result?.slot.start_at).toBe('2024-12-27T14:00:00+09:00')
    })
  })

  describe('isSelectableSlot', () => {
    it('returns true for open slot', () => {
      const slot: NormalizedSlot = { start_at: '2024-12-27T10:00:00+09:00', end_at: '2024-12-27T12:00:00+09:00', status: 'open' }
      expect(isSelectableSlot(slot)).toBe(true)
    })

    it('returns true for tentative slot', () => {
      const slot: NormalizedSlot = { start_at: '2024-12-27T10:00:00+09:00', end_at: '2024-12-27T12:00:00+09:00', status: 'tentative' }
      expect(isSelectableSlot(slot)).toBe(true)
    })

    it('returns false for blocked slot', () => {
      const slot: NormalizedSlot = { start_at: '2024-12-27T10:00:00+09:00', end_at: '2024-12-27T12:00:00+09:00', status: 'blocked' }
      expect(isSelectableSlot(slot)).toBe(false)
    })
  })

  describe('findSelectableSlotByStartAt', () => {
    const days: NormalizedAvailabilityDay[] = [
      { date: '2024-12-27', is_today: true, slots: [
        { start_at: '2024-12-27T10:00:00+09:00', end_at: '2024-12-27T12:00:00+09:00', status: 'blocked' },
        { start_at: '2024-12-27T14:00:00+09:00', end_at: '2024-12-27T16:00:00+09:00', status: 'open' },
      ] },
    ]

    it('returns null for null days', () => {
      expect(findSelectableSlotByStartAt(null, '2024-12-27T10:00:00+09:00')).toBeNull()
    })

    it('returns null for null startAt', () => {
      expect(findSelectableSlotByStartAt(days, null)).toBeNull()
    })

    it('returns null for blocked slot', () => {
      expect(findSelectableSlotByStartAt(days, '2024-12-27T10:00:00+09:00')).toBeNull()
    })

    it('finds selectable slot', () => {
      const result = findSelectableSlotByStartAt(days, '2024-12-27T14:00:00+09:00')
      expect(result?.slot.start_at).toBe('2024-12-27T14:00:00+09:00')
    })

    it('returns null for invalid startAt', () => {
      expect(findSelectableSlotByStartAt(days, 'invalid')).toBeNull()
    })
  })

  describe('getFirstSelectableSlot', () => {
    it('returns null for null', () => {
      expect(getFirstSelectableSlot(null)).toBeNull()
    })

    it('returns null for empty array', () => {
      expect(getFirstSelectableSlot([])).toBeNull()
    })

    it('skips blocked slots', () => {
      const days: NormalizedAvailabilityDay[] = [
        { date: '2024-12-27', is_today: true, slots: [
          { start_at: '2024-12-27T10:00:00+09:00', end_at: '2024-12-27T12:00:00+09:00', status: 'blocked' },
          { start_at: '2024-12-27T14:00:00+09:00', end_at: '2024-12-27T16:00:00+09:00', status: 'open' },
        ] },
      ]
      const result = getFirstSelectableSlot(days)
      expect(result?.slot.start_at).toBe('2024-12-27T14:00:00+09:00')
    })
  })

  describe('findDefaultSelectableSlot', () => {
    const days: NormalizedAvailabilityDay[] = [
      { date: '2024-12-27', is_today: true, slots: [
        { start_at: '2024-12-27T10:00:00+09:00', end_at: '2024-12-27T12:00:00+09:00', status: 'open' },
        { start_at: '2024-12-27T14:00:00+09:00', end_at: '2024-12-27T16:00:00+09:00', status: 'open' },
      ] },
    ]

    it('returns matching slot when defaultStart is provided', () => {
      const result = findDefaultSelectableSlot(days, '2024-12-27T14:00:00+09:00')
      expect(result?.slot.start_at).toBe('2024-12-27T14:00:00+09:00')
    })

    it('returns first slot when defaultStart not found', () => {
      const result = findDefaultSelectableSlot(days, '2024-12-27T18:00:00+09:00')
      expect(result?.slot.start_at).toBe('2024-12-27T10:00:00+09:00')
    })

    it('returns first slot when defaultStart is null', () => {
      const result = findDefaultSelectableSlot(days, null)
      expect(result?.slot.start_at).toBe('2024-12-27T10:00:00+09:00')
    })
  })

  describe('toDisplayAvailabilityDays', () => {
    it('returns empty array for null', () => {
      expect(toDisplayAvailabilityDays(null, () => '')).toEqual([])
    })

    it('returns empty array for empty array', () => {
      expect(toDisplayAvailabilityDays([], () => '')).toEqual([])
    })

    it('converts days to display format', () => {
      const days: NormalizedAvailabilityDay[] = [
        { date: '2024-12-27', is_today: true, slots: [
          { start_at: '2024-12-27T10:00:00+09:00', end_at: '2024-12-27T12:00:00+09:00', status: 'open' },
        ] },
      ]
      const result = toDisplayAvailabilityDays(days, (date) => `${date.getMonth() + 1}月${date.getDate()}日`)

      expect(result).toHaveLength(1)
      expect(result[0].isToday).toBe(true)
      expect(result[0].label).toBe('12月27日')
      expect(result[0].slots[0].timeKey).toBe('10:00')
    })

    it('uses provided label if available', () => {
      const days: NormalizedAvailabilityDay[] = [
        { date: '2024-12-27', is_today: true, label: 'Custom Label', slots: [] },
      ]
      const result = toDisplayAvailabilityDays(days, () => 'Default')
      expect(result[0].label).toBe('Custom Label')
    })

    it('uses provided timeKey if available', () => {
      const days: NormalizedAvailabilityDay[] = [
        { date: '2024-12-27', is_today: true, slots: [
          { start_at: '2024-12-27T10:00:00+09:00', end_at: '2024-12-27T12:00:00+09:00', status: 'open', timeKey: '10:00' },
        ] },
      ]
      const result = toDisplayAvailabilityDays(days, () => '')
      expect(result[0].slots[0].timeKey).toBe('10:00')
    })
  })

  describe('findDisplaySelectableSlot', () => {
    const days: DisplayAvailabilityDay[] = [
      { date: '2024-12-27', isToday: true, label: '12月27日', slots: [
        { start_at: '2024-12-27T10:00:00+09:00', end_at: '2024-12-27T12:00:00+09:00', status: 'blocked', timeKey: '10:00' },
        { start_at: '2024-12-27T14:00:00+09:00', end_at: '2024-12-27T16:00:00+09:00', status: 'open', timeKey: '14:00' },
      ] },
    ]

    it('returns null for null days', () => {
      expect(findDisplaySelectableSlot(null, '2024-12-27T10:00:00+09:00')).toBeNull()
    })

    it('returns null for null startAt', () => {
      expect(findDisplaySelectableSlot(days, null)).toBeNull()
    })

    it('returns null for blocked slot', () => {
      expect(findDisplaySelectableSlot(days, '2024-12-27T10:00:00+09:00')).toBeNull()
    })

    it('finds selectable display slot', () => {
      const result = findDisplaySelectableSlot(days, '2024-12-27T14:00:00+09:00')
      expect(result?.slot.start_at).toBe('2024-12-27T14:00:00+09:00')
    })

    it('returns null for invalid startAt', () => {
      expect(findDisplaySelectableSlot(days, 'invalid')).toBeNull()
    })
  })

  describe('getFirstDisplaySelectableSlot', () => {
    it('returns null for null', () => {
      expect(getFirstDisplaySelectableSlot(null)).toBeNull()
    })

    it('returns null for empty array', () => {
      expect(getFirstDisplaySelectableSlot([])).toBeNull()
    })

    it('skips blocked slots', () => {
      const days: DisplayAvailabilityDay[] = [
        { date: '2024-12-27', isToday: true, label: '12月27日', slots: [
          { start_at: '2024-12-27T10:00:00+09:00', end_at: '2024-12-27T12:00:00+09:00', status: 'blocked', timeKey: '10:00' },
          { start_at: '2024-12-27T14:00:00+09:00', end_at: '2024-12-27T16:00:00+09:00', status: 'open', timeKey: '14:00' },
        ] },
      ]
      const result = getFirstDisplaySelectableSlot(days)
      expect(result?.slot.start_at).toBe('2024-12-27T14:00:00+09:00')
    })
  })

  describe('findDefaultDisplaySelectableSlot', () => {
    const days: DisplayAvailabilityDay[] = [
      { date: '2024-12-27', isToday: true, label: '12月27日', slots: [
        { start_at: '2024-12-27T10:00:00+09:00', end_at: '2024-12-27T12:00:00+09:00', status: 'open', timeKey: '10:00' },
        { start_at: '2024-12-27T14:00:00+09:00', end_at: '2024-12-27T16:00:00+09:00', status: 'open', timeKey: '14:00' },
      ] },
    ]

    it('returns matching slot when defaultStart is provided', () => {
      const result = findDefaultDisplaySelectableSlot(days, '2024-12-27T14:00:00+09:00')
      expect(result?.slot.start_at).toBe('2024-12-27T14:00:00+09:00')
    })

    it('returns first slot when defaultStart not found', () => {
      const result = findDefaultDisplaySelectableSlot(days, '2024-12-27T18:00:00+09:00')
      expect(result?.slot.start_at).toBe('2024-12-27T10:00:00+09:00')
    })

    it('returns first slot when defaultStart is null', () => {
      const result = findDefaultDisplaySelectableSlot(days, null)
      expect(result?.slot.start_at).toBe('2024-12-27T10:00:00+09:00')
    })
  })
})
