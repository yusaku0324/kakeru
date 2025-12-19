import { describe, it, expect } from 'vitest'
import { normalizeSlotStatus, normalizeAvailabilityDays } from '../availability'

/**
 * バックエンド/フロントエンド間の open/blocked ステータス契約テスト
 *
 * 契約:
 * - API Response: "open" | "blocked" のみ
 * - "tentative" は API から返されない (UI-only state)
 * - フロントエンドは API の status をそのまま使用
 *
 * このテストはバックエンドの test_availability_status_contract.py と対になる
 */

describe('API Status Contract', () => {
  describe('normalizeSlotStatus - API互換性', () => {
    it('API "open" → フロント "open"', () => {
      expect(normalizeSlotStatus('open')).toBe('open')
    })

    it('API "blocked" → フロント "blocked"', () => {
      expect(normalizeSlotStatus('blocked')).toBe('blocked')
    })

    it('APIが返さない "tentative" は "open" として扱う', () => {
      // Final Decision: tentative は UI-only state
      // 万が一 API から来ても open として扱う
      expect(normalizeSlotStatus('tentative')).toBe('open')
    })
  })

  describe('DB語彙の正規化（バックエンドと同じロジック）', () => {
    it('DB "available" → "open"', () => {
      expect(normalizeSlotStatus('available')).toBe('open')
    })

    it('DB "ok" → "open"', () => {
      expect(normalizeSlotStatus('ok')).toBe('open')
    })

    it('DB "busy" → "blocked"', () => {
      expect(normalizeSlotStatus('busy')).toBe('blocked')
    })

    it('DB "unavailable" → "blocked"', () => {
      expect(normalizeSlotStatus('unavailable')).toBe('blocked')
    })
  })

  describe('エッジケース', () => {
    it('null/undefined はデフォルト "open"', () => {
      expect(normalizeSlotStatus(null)).toBe('open')
      expect(normalizeSlotStatus(undefined)).toBe('open')
    })

    it('未知のステータスは "open"（安全側に倒す）', () => {
      expect(normalizeSlotStatus('unknown')).toBe('open')
      expect(normalizeSlotStatus('foo')).toBe('open')
    })

    it('大文字小文字を区別しない', () => {
      expect(normalizeSlotStatus('OPEN')).toBe('open')
      expect(normalizeSlotStatus('Blocked')).toBe('blocked')
      expect(normalizeSlotStatus('AVAILABLE')).toBe('open')
    })
  })
})

describe('normalizeAvailabilityDays - API Response 正規化', () => {
  const todayIso = '2026-06-01'

  it('API Response のスロットを正規化する', () => {
    const apiResponse = [
      { start_at: '2026-06-01T10:00:00+09:00', end_at: '2026-06-01T12:00:00+09:00', status: 'open' },
      { start_at: '2026-06-01T14:00:00+09:00', end_at: '2026-06-01T16:00:00+09:00', status: 'blocked' },
    ]

    const result = normalizeAvailabilityDays(apiResponse, todayIso)

    expect(result).not.toBeNull()
    expect(result).toHaveLength(1)
    expect(result![0].slots).toHaveLength(2)
    expect(result![0].slots[0].status).toBe('open')
    expect(result![0].slots[1].status).toBe('blocked')
  })

  it('空の slots 配列 → null', () => {
    expect(normalizeAvailabilityDays([])).toBeNull()
  })

  it('全て blocked のスロットも正しく処理', () => {
    const apiResponse = [
      { start_at: '2026-06-01T10:00:00+09:00', end_at: '2026-06-01T12:00:00+09:00', status: 'blocked' },
      { start_at: '2026-06-01T14:00:00+09:00', end_at: '2026-06-01T16:00:00+09:00', status: 'blocked' },
    ]

    const result = normalizeAvailabilityDays(apiResponse, todayIso)

    expect(result).not.toBeNull()
    expect(result![0].slots.every(s => s.status === 'blocked')).toBe(true)
  })
})

describe('UI表示との対応関係', () => {
  /**
   * WeekAvailabilityGrid.tsx の AVAILABILITY_STATUS_META との対応:
   * - open → ◎ (予約可)
   * - blocked → × (予約不可)
   * - tentative → △ (UI選択中、APIからは来ない)
   */

  it('open/blocked のみが API から返される（仕様）', () => {
    const validApiStatuses = ['open', 'blocked']

    for (const status of validApiStatuses) {
      const normalized = normalizeSlotStatus(status)
      expect(['open', 'blocked']).toContain(normalized)
    }
  })

  it('tentative は UI-only state（仕様）', () => {
    // tentative が API から来た場合は open として扱う
    // これは仕様であり、テストで明示的に文書化
    expect(normalizeSlotStatus('tentative')).toBe('open')
  })
})

describe('バックエンドとの整合性', () => {
  /**
   * バックエンド (test_availability_status_contract.py) で検証される契約:
   *
   * 1. シフトあり + 予約なし → slots に "open" が含まれる
   * 2. シフトあり + 予約あり（全時間） → slots = []
   * 3. シフトあり + 予約あり（一部時間） → 残りが "open"
   * 4. シフトなし → slots = []
   * 5. pending 予約 → ブロック
   * 6. cancelled 予約 → ブロックしない
   * 7. 過去のスロット → blocked
   *
   * フロントエンドはこれらの結果を正しく表示する責任がある
   */

  it('フロントエンドはバックエンドの status をそのまま使用する', () => {
    // バックエンドが "open" を返したら、フロントエンドも "open" として表示
    expect(normalizeSlotStatus('open')).toBe('open')

    // バックエンドが "blocked" を返したら、フロントエンドも "blocked" として表示
    expect(normalizeSlotStatus('blocked')).toBe('blocked')
  })

  it('フロントエンドは独自の open/blocked 判定をしない', () => {
    // フロントエンドは時刻比較や予約有無の判定をしない
    // バックエンドの判定結果に完全に依存する
    // このテストは仕様の明文化が目的

    // API Response の例
    const apiOpenSlot = { start_at: '2026-06-01T10:00:00+09:00', end_at: '2026-06-01T12:00:00+09:00', status: 'open' }
    const apiBlockedSlot = { start_at: '2026-06-01T14:00:00+09:00', end_at: '2026-06-01T16:00:00+09:00', status: 'blocked' }

    // フロントエンドは API の status をそのまま使用
    expect(normalizeSlotStatus(apiOpenSlot.status)).toBe('open')
    expect(normalizeSlotStatus(apiBlockedSlot.status)).toBe('blocked')
  })
})
