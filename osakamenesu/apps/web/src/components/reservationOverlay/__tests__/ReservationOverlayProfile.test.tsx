'use client'

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import ReservationOverlayProfile from '../ReservationOverlayProfile'
import type { TherapistHit } from '@/components/staff/TherapistCard'

// Mock ProfileTagList
vi.mock('@/components/staff/ProfileTagList', () => ({
  ProfileTagList: ({
    mood_tag,
    style_tag,
    look_type,
  }: {
    mood_tag?: string | null
    style_tag?: string | null
    look_type?: string | null
  }) => (
    <div data-testid="profile-tag-list">
      {mood_tag && <span>mood: {mood_tag}</span>}
      {style_tag && <span>style: {style_tag}</span>}
      {look_type && <span>look: {look_type}</span>}
    </div>
  ),
}))

const mockHit: TherapistHit = {
  id: 'test-id',
  therapistId: 'therapist-uuid',
  staffId: 'staff-identifier',
  name: 'テストセラピスト',
  alias: null,
  headline: null,
  specialties: [],
  avatarUrl: null,
  rating: null,
  reviewCount: null,
  shopId: 'shop-uuid',
  shopSlug: null,
  shopName: 'テスト店舗',
  shopArea: '大阪',
  shopAreaName: null,
  todayAvailable: true,
  nextAvailableSlot: null,
}

const defaultProps = {
  hit: mockHit,
  summaryBio: null,
  specialties: [],
  detailItems: [],
  optionsList: [],
  summarySchedule: null,
  pricingItems: [],
}

describe('ReservationOverlayProfile', () => {
  describe('basic rendering', () => {
    it('renders profile header', () => {
      render(<ReservationOverlayProfile {...defaultProps} />)
      expect(screen.getByText('プロフィール')).toBeInTheDocument()
      expect(screen.getByText('得意分野や基本情報をまとめています')).toBeInTheDocument()
    })

    it('renders schedule section header', () => {
      render(<ReservationOverlayProfile {...defaultProps} />)
      expect(screen.getByText('出勤予定')).toBeInTheDocument()
    })

    it('renders pricing section header', () => {
      render(<ReservationOverlayProfile {...defaultProps} />)
      expect(screen.getByText('コース料金')).toBeInTheDocument()
      expect(screen.getByText('サロンの代表的なコースをご覧ください')).toBeInTheDocument()
    })

    it('renders ProfileTagList component', () => {
      render(<ReservationOverlayProfile {...defaultProps} />)
      expect(screen.getByTestId('profile-tag-list')).toBeInTheDocument()
    })
  })

  describe('review count badge', () => {
    it('does not show review badge when reviewCount is null', () => {
      render(<ReservationOverlayProfile {...defaultProps} />)
      expect(screen.queryByText(/★/)).not.toBeInTheDocument()
    })

    it('shows review badge with rating when reviewCount is provided', () => {
      const hitWithReviews = {
        ...mockHit,
        rating: 4.5,
        reviewCount: 10,
      }
      render(<ReservationOverlayProfile {...defaultProps} hit={hitWithReviews} />)
      expect(screen.getByText(/★/)).toBeInTheDocument()
      expect(screen.getByText(/4.5/)).toBeInTheDocument()
      expect(screen.getByText(/10件/)).toBeInTheDocument()
    })

    it('shows -- for rating when rating is null but reviewCount exists', () => {
      const hitWithReviewsNoRating = {
        ...mockHit,
        rating: null,
        reviewCount: 5,
      }
      render(<ReservationOverlayProfile {...defaultProps} hit={hitWithReviewsNoRating} />)
      expect(screen.getByText(/--/)).toBeInTheDocument()
    })
  })

  describe('summaryBio', () => {
    it('shows default text when summaryBio is null', () => {
      render(<ReservationOverlayProfile {...defaultProps} summaryBio={null} />)
      expect(screen.getByText('プロフィール情報は順次掲載予定です。')).toBeInTheDocument()
    })

    it('shows provided summaryBio text', () => {
      render(
        <ReservationOverlayProfile {...defaultProps} summaryBio="テストのプロフィール文です。" />,
      )
      expect(screen.getByText('テストのプロフィール文です。')).toBeInTheDocument()
    })
  })

  describe('specialties', () => {
    it('does not render specialties when array is empty', () => {
      render(<ReservationOverlayProfile {...defaultProps} specialties={[]} />)
      expect(screen.queryByText(/#/)).not.toBeInTheDocument()
    })

    it('renders specialties as tags', () => {
      render(
        <ReservationOverlayProfile {...defaultProps} specialties={['オイル', 'アロマ', '指圧']} />,
      )
      expect(screen.getByText('#オイル')).toBeInTheDocument()
      expect(screen.getByText('#アロマ')).toBeInTheDocument()
      expect(screen.getByText('#指圧')).toBeInTheDocument()
    })
  })

  describe('detailItems', () => {
    it('does not render detail section when both detailItems and optionsList are empty', () => {
      render(<ReservationOverlayProfile {...defaultProps} detailItems={[]} optionsList={[]} />)
      expect(screen.queryByText('オプション・対応メニュー')).not.toBeInTheDocument()
    })

    it('renders detail items', () => {
      const detailItems = [
        { label: '身長', value: '165cm' },
        { label: '年齢', value: '28歳' },
      ]
      render(<ReservationOverlayProfile {...defaultProps} detailItems={detailItems} />)
      expect(screen.getByText('身長')).toBeInTheDocument()
      expect(screen.getByText('165cm')).toBeInTheDocument()
      expect(screen.getByText('年齢')).toBeInTheDocument()
      expect(screen.getByText('28歳')).toBeInTheDocument()
    })
  })

  describe('optionsList', () => {
    it('renders options list when provided', () => {
      const optionsList = ['深夜対応', '出張可能', '自宅施術']
      render(<ReservationOverlayProfile {...defaultProps} optionsList={optionsList} />)
      expect(screen.getByText('オプション・対応メニュー')).toBeInTheDocument()
      expect(screen.getByText('深夜対応')).toBeInTheDocument()
      expect(screen.getByText('出張可能')).toBeInTheDocument()
      expect(screen.getByText('自宅施術')).toBeInTheDocument()
    })

    it('renders options with detail items', () => {
      const detailItems = [{ label: '経験', value: '5年' }]
      const optionsList = ['リンパ']
      render(
        <ReservationOverlayProfile
          {...defaultProps}
          detailItems={detailItems}
          optionsList={optionsList}
        />,
      )
      expect(screen.getByText('経験')).toBeInTheDocument()
      expect(screen.getByText('5年')).toBeInTheDocument()
      expect(screen.getByText('リンパ')).toBeInTheDocument()
    })
  })

  describe('summarySchedule', () => {
    it('shows default text when summarySchedule is null', () => {
      render(<ReservationOverlayProfile {...defaultProps} summarySchedule={null} />)
      expect(screen.getByText('最新スケジュールはお問い合わせください。')).toBeInTheDocument()
    })

    it('shows provided summarySchedule text', () => {
      render(
        <ReservationOverlayProfile
          {...defaultProps}
          summarySchedule="月〜金 10:00-22:00、土日祝 12:00-20:00"
        />,
      )
      expect(screen.getByText('月〜金 10:00-22:00、土日祝 12:00-20:00')).toBeInTheDocument()
    })
  })

  describe('pricingItems', () => {
    it('shows default text when pricingItems is empty', () => {
      render(<ReservationOverlayProfile {...defaultProps} pricingItems={[]} />)
      expect(screen.getByText('料金情報はお問い合わせください。')).toBeInTheDocument()
    })

    it('renders pricing items with all fields', () => {
      const pricingItems = [
        { title: 'スタンダードコース', duration: '60分', price: '¥8,000' },
        { title: 'ロングコース', duration: '90分', price: '¥12,000' },
      ]
      render(<ReservationOverlayProfile {...defaultProps} pricingItems={pricingItems} />)
      expect(screen.getByText('スタンダードコース')).toBeInTheDocument()
      expect(screen.getByText('60分')).toBeInTheDocument()
      expect(screen.getByText('¥8,000')).toBeInTheDocument()
      expect(screen.getByText('ロングコース')).toBeInTheDocument()
      expect(screen.getByText('90分')).toBeInTheDocument()
      expect(screen.getByText('¥12,000')).toBeInTheDocument()
    })

    it('renders pricing items without duration', () => {
      const pricingItems = [{ title: 'お試しコース', duration: null, price: '¥5,000' }]
      render(<ReservationOverlayProfile {...defaultProps} pricingItems={pricingItems} />)
      expect(screen.getByText('お試しコース')).toBeInTheDocument()
      expect(screen.getByText('¥5,000')).toBeInTheDocument()
    })

    it('renders pricing items without price', () => {
      const pricingItems = [{ title: '要相談コース', duration: '応相談', price: null }]
      render(<ReservationOverlayProfile {...defaultProps} pricingItems={pricingItems} />)
      expect(screen.getByText('要相談コース')).toBeInTheDocument()
      expect(screen.getByText('応相談')).toBeInTheDocument()
      expect(screen.queryByText('¥')).not.toBeInTheDocument()
    })

    it('renders pricing items without both duration and price', () => {
      const pricingItems = [{ title: '特別コース', duration: null, price: null }]
      render(<ReservationOverlayProfile {...defaultProps} pricingItems={pricingItems} />)
      expect(screen.getByText('特別コース')).toBeInTheDocument()
    })
  })

  describe('ProfileTagList props', () => {
    it('passes tag props to ProfileTagList', () => {
      const hitWithTags = {
        ...mockHit,
        mood_tag: 'リラックス',
        style_tag: 'ソフト',
        look_type: 'クール系',
        contact_style: 'おしゃべり好き',
        hobby_tags: ['読書', '映画'],
      }
      render(<ReservationOverlayProfile {...defaultProps} hit={hitWithTags} />)

      const tagList = screen.getByTestId('profile-tag-list')
      expect(tagList).toHaveTextContent('mood: リラックス')
      expect(tagList).toHaveTextContent('style: ソフト')
      expect(tagList).toHaveTextContent('look: クール系')
    })
  })
})
