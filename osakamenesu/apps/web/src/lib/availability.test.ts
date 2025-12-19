import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  today,
  extractDate,
  isSameDate,
  isToday,
  formatDateISO,
} from './jst'
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
  type NormalizedSlot,
  type NormalizedAvailabilityDay,
} from './availability'

// =============================================================================
// 日付ユーティリティのテスト (lib/jst.ts)
// =============================================================================

describe('today (from lib/jst.ts)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('JST 基準で本日の日付を YYYY-MM-DD 形式で返す', () => {
    // 2024-12-15 10:00:00 UTC = 2024-12-15 19:00:00 JST
    vi.setSystemTime(new Date('2024-12-15T10:00:00Z'))
    expect(today()).toBe('2024-12-15')
  })

  it('UTC で日付が変わる境界でも JST で正しい日付を返す', () => {
    // 2024-12-15 23:30:00 UTC = 2024-12-16 08:30:00 JST
    vi.setSystemTime(new Date('2024-12-15T23:30:00Z'))
    expect(today()).toBe('2024-12-16')
  })

  it('JST の深夜（UTC では前日）でも正しい日付を返す', () => {
    // 2024-12-14 15:30:00 UTC = 2024-12-15 00:30:00 JST
    vi.setSystemTime(new Date('2024-12-14T15:30:00Z'))
    expect(today()).toBe('2024-12-15')
  })
})

describe('extractDate (from lib/jst.ts)', () => {
  it('ISO 文字列から日付部分を抽出する', () => {
    expect(extractDate('2024-12-15T10:30:00+09:00')).toBe('2024-12-15')
    expect(extractDate('2024-01-01T00:00:00Z')).toBe('2024-01-01')
  })

  it('日付のみの文字列でも動作する', () => {
    expect(extractDate('2024-12-15')).toBe('2024-12-15')
  })
})

describe('isSameDate (from lib/jst.ts)', () => {
  it('同じ日付の ISO 文字列を比較して true を返す', () => {
    expect(isSameDate('2024-12-15T10:00:00+09:00', '2024-12-15T23:59:59+09:00')).toBe(true)
  })

  it('異なる日付の ISO 文字列を比較して false を返す', () => {
    expect(isSameDate('2024-12-15T10:00:00+09:00', '2024-12-16T10:00:00+09:00')).toBe(false)
  })
})

describe('isToday (from lib/jst.ts)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-12-15T10:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('本日の日付なら true を返す', () => {
    expect(isToday('2024-12-15T10:00:00+09:00')).toBe(true)
  })

  it('本日以外の日付なら false を返す', () => {
    expect(isToday('2024-12-14T10:00:00+09:00')).toBe(false)
    expect(isToday('2024-12-16T10:00:00+09:00')).toBe(false)
  })
})

describe('isSameDate with Date objects (using formatDateISO)', () => {
  it('同じ日の Date オブジェクトを比較して true を返す', () => {
    const date1 = new Date('2024-12-15T00:00:00+09:00')
    const date2 = new Date('2024-12-15T23:59:59+09:00')
    expect(isSameDate(formatDateISO(date1), formatDateISO(date2))).toBe(true)
  })

  it('異なる日の Date オブジェクトを比較して false を返す', () => {
    const date1 = new Date('2024-12-15T00:00:00+09:00')
    const date2 = new Date('2024-12-16T00:00:00+09:00')
    expect(isSameDate(formatDateISO(date1), formatDateISO(date2))).toBe(false)
  })
})

// =============================================================================
// ステータス正規化のテスト
// =============================================================================

describe('normalizeSlotStatus', () => {
  it('open 系のステータスを "open" に正規化する', () => {
    expect(normalizeSlotStatus('open')).toBe('open')
    expect(normalizeSlotStatus('OPEN')).toBe('open')
    expect(normalizeSlotStatus('available')).toBe('open')
    expect(normalizeSlotStatus('ok')).toBe('open')
  })

  it('tentative 系のステータスを "tentative" に正規化する', () => {
    expect(normalizeSlotStatus('tentative')).toBe('tentative')
    expect(normalizeSlotStatus('TENTATIVE')).toBe('tentative')
    expect(normalizeSlotStatus('maybe')).toBe('tentative')
  })

  it('blocked 系のステータスを "blocked" に正規化する', () => {
    expect(normalizeSlotStatus('blocked')).toBe('blocked')
    expect(normalizeSlotStatus('unavailable')).toBe('blocked')
  })

  it('null/undefined はデフォルトで "open" を返す', () => {
    expect(normalizeSlotStatus(null)).toBe('open')
    expect(normalizeSlotStatus(undefined)).toBe('open')
  })

  it('未知のステータスはデフォルトで "open" を返す', () => {
    expect(normalizeSlotStatus('unknown')).toBe('open')
  })
})

// =============================================================================
// normalizeAvailabilityDays のテスト
// =============================================================================

describe('normalizeAvailabilityDays', () => {
  const todayIso = '2024-12-15'

  it('null/undefined を渡すと null を返す', () => {
    expect(normalizeAvailabilityDays(null)).toBeNull()
    expect(normalizeAvailabilityDays(undefined)).toBeNull()
  })

  it('空配列を渡すと null を返す', () => {
    expect(normalizeAvailabilityDays([])).toBeNull()
  })

  it('フラットなスロット配列を日付ごとにグループ化する', () => {
    const slots = [
      { start_at: '2024-12-15T10:00:00+09:00', end_at: '2024-12-15T11:00:00+09:00', status: 'open' },
      { start_at: '2024-12-15T14:00:00+09:00', end_at: '2024-12-15T15:00:00+09:00', status: 'tentative' },
      { start_at: '2024-12-16T10:00:00+09:00', end_at: '2024-12-16T11:00:00+09:00', status: 'open' },
    ]

    const result = normalizeAvailabilityDays(slots, todayIso)

    expect(result).toHaveLength(2)
    expect(result![0].date).toBe('2024-12-15')
    expect(result![0].is_today).toBe(true)
    expect(result![0].slots).toHaveLength(2)
    expect(result![1].date).toBe('2024-12-16')
    expect(result![1].is_today).toBe(false)
    expect(result![1].slots).toHaveLength(1)
  })

  it('重複スロットを除去する', () => {
    const slots = [
      { start_at: '2024-12-15T10:00:00+09:00', end_at: '2024-12-15T11:00:00+09:00', status: 'open' },
      { start_at: '2024-12-15T10:00:00+09:00', end_at: '2024-12-15T11:00:00+09:00', status: 'open' },
    ]

    const result = normalizeAvailabilityDays(slots, todayIso)

    expect(result).toHaveLength(1)
    expect(result![0].slots).toHaveLength(1)
  })

  it('日付順にソートする', () => {
    const slots = [
      { start_at: '2024-12-17T10:00:00+09:00', end_at: '2024-12-17T11:00:00+09:00' },
      { start_at: '2024-12-15T10:00:00+09:00', end_at: '2024-12-15T11:00:00+09:00' },
      { start_at: '2024-12-16T10:00:00+09:00', end_at: '2024-12-16T11:00:00+09:00' },
    ]

    const result = normalizeAvailabilityDays(slots, todayIso)

    expect(result![0].date).toBe('2024-12-15')
    expect(result![1].date).toBe('2024-12-16')
    expect(result![2].date).toBe('2024-12-17')
  })

  it('ステータスを正規化する', () => {
    const slots = [
      { start_at: '2024-12-15T10:00:00+09:00', end_at: '2024-12-15T11:00:00+09:00', status: 'ok' },
      { start_at: '2024-12-15T14:00:00+09:00', end_at: '2024-12-15T15:00:00+09:00', status: 'maybe' },
    ]

    const result = normalizeAvailabilityDays(slots, todayIso)

    expect(result![0].slots[0].status).toBe('open')
    expect(result![0].slots[1].status).toBe('tentative')
  })
})

// =============================================================================
// ヘルパー関数のテスト
// =============================================================================

describe('hasTodayAvailability', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-12-15T10:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('本日に open/tentative スロットがあれば true を返す', () => {
    const days: NormalizedAvailabilityDay[] = [
      {
        date: '2024-12-15',
        is_today: true,
        slots: [{ start_at: '2024-12-15T10:00:00+09:00', end_at: '2024-12-15T11:00:00+09:00', status: 'open' }],
      },
    ]
    expect(hasTodayAvailability(days)).toBe(true)
  })

  it('本日に blocked スロットのみなら false を返す', () => {
    const days: NormalizedAvailabilityDay[] = [
      {
        date: '2024-12-15',
        is_today: true,
        slots: [{ start_at: '2024-12-15T10:00:00+09:00', end_at: '2024-12-15T11:00:00+09:00', status: 'blocked' }],
      },
    ]
    expect(hasTodayAvailability(days)).toBe(false)
  })

  it('本日のデータがなければ false を返す', () => {
    const days: NormalizedAvailabilityDay[] = [
      {
        date: '2024-12-16',
        is_today: false,
        slots: [{ start_at: '2024-12-16T10:00:00+09:00', end_at: '2024-12-16T11:00:00+09:00', status: 'open' }],
      },
    ]
    expect(hasTodayAvailability(days)).toBe(false)
  })

  it('null/undefined を渡すと false を返す', () => {
    expect(hasTodayAvailability(null)).toBe(false)
    expect(hasTodayAvailability(undefined)).toBe(false)
  })
})

describe('getFirstAvailableSlot', () => {
  it('最初の open/tentative スロットを返す', () => {
    const days: NormalizedAvailabilityDay[] = [
      {
        date: '2024-12-15',
        is_today: true,
        slots: [
          { start_at: '2024-12-15T10:00:00+09:00', end_at: '2024-12-15T11:00:00+09:00', status: 'blocked' },
          { start_at: '2024-12-15T14:00:00+09:00', end_at: '2024-12-15T15:00:00+09:00', status: 'open' },
        ],
      },
    ]

    const result = getFirstAvailableSlot(days)

    expect(result).not.toBeNull()
    expect(result!.slot.start_at).toBe('2024-12-15T14:00:00+09:00')
    expect(result!.slot.status).toBe('open')
  })

  it('空配列を渡すと null を返す', () => {
    expect(getFirstAvailableSlot([])).toBeNull()
    expect(getFirstAvailableSlot(null)).toBeNull()
  })

  it('全て blocked なら null を返す', () => {
    const days: NormalizedAvailabilityDay[] = [
      {
        date: '2024-12-15',
        is_today: true,
        slots: [{ start_at: '2024-12-15T10:00:00+09:00', end_at: '2024-12-15T11:00:00+09:00', status: 'blocked' }],
      },
    ]
    expect(getFirstAvailableSlot(days)).toBeNull()
  })
})

describe('findSlotByStartAt', () => {
  const days: NormalizedAvailabilityDay[] = [
    {
      date: '2024-12-15',
      is_today: true,
      slots: [
        { start_at: '2024-12-15T10:00:00+09:00', end_at: '2024-12-15T11:00:00+09:00', status: 'open' },
        { start_at: '2024-12-15T14:00:00+09:00', end_at: '2024-12-15T15:00:00+09:00', status: 'tentative' },
      ],
    },
  ]

  it('一致する start_at のスロットを返す', () => {
    const result = findSlotByStartAt(days, '2024-12-15T14:00:00+09:00')

    expect(result).not.toBeNull()
    expect(result!.slot.status).toBe('tentative')
  })

  it('一致しない start_at なら null を返す', () => {
    expect(findSlotByStartAt(days, '2024-12-15T16:00:00+09:00')).toBeNull()
  })

  it('空文字列を渡すと null を返す', () => {
    expect(findSlotByStartAt(days, '')).toBeNull()
  })

  it('無効な日付文字列を渡すと null を返す', () => {
    expect(findSlotByStartAt(days, 'invalid')).toBeNull()
  })
})

// =============================================================================
// 型ガード・選択用ヘルパーのテスト
// =============================================================================

describe('isSelectableSlot', () => {
  it('open スロットは true を返す', () => {
    const slot: NormalizedSlot = { start_at: '2024-12-15T10:00:00+09:00', end_at: '2024-12-15T11:00:00+09:00', status: 'open' }
    expect(isSelectableSlot(slot)).toBe(true)
  })

  it('tentative スロットは true を返す', () => {
    const slot: NormalizedSlot = { start_at: '2024-12-15T10:00:00+09:00', end_at: '2024-12-15T11:00:00+09:00', status: 'tentative' }
    expect(isSelectableSlot(slot)).toBe(true)
  })

  it('blocked スロットは false を返す', () => {
    const slot: NormalizedSlot = { start_at: '2024-12-15T10:00:00+09:00', end_at: '2024-12-15T11:00:00+09:00', status: 'blocked' }
    expect(isSelectableSlot(slot)).toBe(false)
  })
})

describe('findSelectableSlotByStartAt', () => {
  const days: NormalizedAvailabilityDay[] = [
    {
      date: '2024-12-15',
      is_today: true,
      slots: [
        { start_at: '2024-12-15T10:00:00+09:00', end_at: '2024-12-15T11:00:00+09:00', status: 'blocked' },
        { start_at: '2024-12-15T14:00:00+09:00', end_at: '2024-12-15T15:00:00+09:00', status: 'open' },
      ],
    },
  ]

  it('選択可能なスロットを返す', () => {
    const result = findSelectableSlotByStartAt(days, '2024-12-15T14:00:00+09:00')
    expect(result).not.toBeNull()
    expect(result!.slot.status).toBe('open')
  })

  it('blocked スロットはスキップして null を返す', () => {
    const result = findSelectableSlotByStartAt(days, '2024-12-15T10:00:00+09:00')
    expect(result).toBeNull()
  })

  it('null/undefined を渡すと null を返す', () => {
    expect(findSelectableSlotByStartAt(days, null)).toBeNull()
    expect(findSelectableSlotByStartAt(days, undefined)).toBeNull()
  })
})

describe('getFirstSelectableSlot', () => {
  it('最初の選択可能なスロットを返す（blocked をスキップ）', () => {
    const days: NormalizedAvailabilityDay[] = [
      {
        date: '2024-12-15',
        is_today: true,
        slots: [
          { start_at: '2024-12-15T10:00:00+09:00', end_at: '2024-12-15T11:00:00+09:00', status: 'blocked' },
          { start_at: '2024-12-15T14:00:00+09:00', end_at: '2024-12-15T15:00:00+09:00', status: 'tentative' },
        ],
      },
    ]

    const result = getFirstSelectableSlot(days)
    expect(result).not.toBeNull()
    expect(result!.slot.start_at).toBe('2024-12-15T14:00:00+09:00')
    expect(result!.slot.status).toBe('tentative')
  })
})

describe('findDefaultSelectableSlot', () => {
  const days: NormalizedAvailabilityDay[] = [
    {
      date: '2024-12-15',
      is_today: true,
      slots: [
        { start_at: '2024-12-15T10:00:00+09:00', end_at: '2024-12-15T11:00:00+09:00', status: 'open' },
        { start_at: '2024-12-15T14:00:00+09:00', end_at: '2024-12-15T15:00:00+09:00', status: 'tentative' },
      ],
    },
  ]

  it('defaultStart に一致するスロットがあれば返す', () => {
    const result = findDefaultSelectableSlot(days, '2024-12-15T14:00:00+09:00')
    expect(result).not.toBeNull()
    expect(result!.slot.start_at).toBe('2024-12-15T14:00:00+09:00')
  })

  it('defaultStart が見つからなければ最初の選択可能スロットを返す', () => {
    const result = findDefaultSelectableSlot(days, '2024-12-15T18:00:00+09:00')
    expect(result).not.toBeNull()
    expect(result!.slot.start_at).toBe('2024-12-15T10:00:00+09:00')
  })

  it('defaultStart が null なら最初の選択可能スロットを返す', () => {
    const result = findDefaultSelectableSlot(days, null)
    expect(result).not.toBeNull()
    expect(result!.slot.start_at).toBe('2024-12-15T10:00:00+09:00')
  })

  it('全て blocked で defaultStart も見つからなければ null を返す', () => {
    const blockedDays: NormalizedAvailabilityDay[] = [
      {
        date: '2024-12-15',
        is_today: true,
        slots: [{ start_at: '2024-12-15T10:00:00+09:00', end_at: '2024-12-15T11:00:00+09:00', status: 'blocked' }],
      },
    ]
    const result = findDefaultSelectableSlot(blockedDays, '2024-12-15T14:00:00+09:00')
    expect(result).toBeNull()
  })
})
