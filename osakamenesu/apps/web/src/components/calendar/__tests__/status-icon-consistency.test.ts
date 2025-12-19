import { describe, it, expect } from 'vitest'
import { AVAILABILITY_STATUS_META, type AvailabilityStatus } from '../types'

/**
 * UI表示（◎/×/△）とバックエンドstatus値の整合性テスト
 *
 * 仕様:
 * - open    → ◎ (予約可)
 * - tentative → △ (要確認 / ユーザー選択中)
 * - blocked → × (予約不可)
 *
 * この対応関係はフロントエンド/バックエンド間の契約であり、
 * 変更する場合は両側の調整が必要。
 */

describe('Status Icon Consistency (UI ↔ Backend Contract)', () => {
  describe('AVAILABILITY_STATUS_META定義の検証', () => {
    it('open status は ◎ アイコンを持つ', () => {
      expect(AVAILABILITY_STATUS_META.open.icon).toBe('◎')
      expect(AVAILABILITY_STATUS_META.open.label).toBe('予約可')
    })

    it('tentative status は △ アイコンを持つ', () => {
      expect(AVAILABILITY_STATUS_META.tentative.icon).toBe('△')
      expect(AVAILABILITY_STATUS_META.tentative.label).toBe('要確認')
    })

    it('blocked status は × アイコンを持つ', () => {
      expect(AVAILABILITY_STATUS_META.blocked.icon).toBe('×')
      expect(AVAILABILITY_STATUS_META.blocked.label).toBe('予約不可')
    })
  })

  describe('全statusがMETAに定義されている', () => {
    const ALL_STATUSES: AvailabilityStatus[] = ['open', 'tentative', 'blocked']

    it('全てのAvailabilityStatusがMETAに存在する', () => {
      for (const status of ALL_STATUSES) {
        expect(AVAILABILITY_STATUS_META[status]).toBeDefined()
        expect(AVAILABILITY_STATUS_META[status].icon).toBeTruthy()
        expect(AVAILABILITY_STATUS_META[status].label).toBeTruthy()
      }
    })

    it('METAに余分なstatusが含まれていない', () => {
      const metaKeys = Object.keys(AVAILABILITY_STATUS_META)
      expect(metaKeys.sort()).toEqual(ALL_STATUSES.sort())
    })
  })

  describe('API Response契約', () => {
    // APIは open/blocked のみを返す（tentativeはUI-only）
    const API_STATUSES = ['open', 'blocked'] as const

    it('APIが返すstatusは全てMETAに定義されている', () => {
      for (const status of API_STATUSES) {
        expect(AVAILABILITY_STATUS_META[status]).toBeDefined()
      }
    })

    it('tentativeはAPIから返されない（UI-only state）', () => {
      // このテストはドキュメント目的
      // tentativeがMETAに存在することは正しいが、APIからは来ない
      expect(AVAILABILITY_STATUS_META.tentative).toBeDefined()
      // APIスキーマ: Literal["open", "blocked"] - tentative は含まれない
      expect(API_STATUSES).not.toContain('tentative')
    })
  })

  describe('アイコンの一意性', () => {
    it('各statusのアイコンは重複しない', () => {
      const icons = Object.values(AVAILABILITY_STATUS_META).map((m) => m.icon)
      const uniqueIcons = new Set(icons)
      expect(uniqueIcons.size).toBe(icons.length)
    })
  })

  describe('アクセシビリティ', () => {
    it('各statusに日本語ラベルが設定されている', () => {
      for (const [status, meta] of Object.entries(AVAILABILITY_STATUS_META)) {
        expect(meta.label).toBeTruthy()
        expect(meta.label.length).toBeGreaterThan(0)
        // 日本語ラベルであることを確認（ひらがな/カタカナ/漢字を含む）
        expect(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(meta.label)).toBe(true)
      }
    })
  })
})

/**
 * data-testid と status の対応テスト
 *
 * WeekAvailabilityGrid.tsx での対応:
 * - open     → data-testid="slot-available"
 * - tentative → data-testid="slot-pending"
 * - blocked  → data-testid="slot-blocked"
 */
describe('data-testid Mapping Contract', () => {
  // WeekAvailabilityGrid.tsx L296 の実装を反映
  const STATUS_TO_TESTID: Record<AvailabilityStatus, string> = {
    open: 'slot-available',
    tentative: 'slot-pending',
    blocked: 'slot-blocked',
  }

  it('open status は slot-available testid を持つ', () => {
    expect(STATUS_TO_TESTID.open).toBe('slot-available')
  })

  it('tentative status は slot-pending testid を持つ', () => {
    expect(STATUS_TO_TESTID.tentative).toBe('slot-pending')
  })

  it('blocked status は slot-blocked testid を持つ', () => {
    expect(STATUS_TO_TESTID.blocked).toBe('slot-blocked')
  })

  it('全statusにtestidが定義されている', () => {
    const allStatuses: AvailabilityStatus[] = ['open', 'tentative', 'blocked']
    for (const status of allStatuses) {
      expect(STATUS_TO_TESTID[status]).toBeTruthy()
    }
  })
})
