/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ShopCard, type ShopHit } from '../ShopCard'

// Mock IntersectionObserver
beforeAll(() => {
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))
})

// Mock Next.js Link
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

// Mock Next.js Image
vi.mock('next/image', () => ({
  default: (props: { src: string; alt: string; fill?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={props.src} alt={props.alt} data-fill={props.fill} />
  ),
}))

// Mock SafeImage
vi.mock('@/components/SafeImage', () => ({
  default: (props: { src?: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={props.src ?? ''} alt={props.alt} data-testid="safe-image" />
  ),
}))

// Mock date functions
vi.mock('@/utils/date', () => ({
  getJaFormatter: () => ({
    format: (date: Date) => `${date.getMonth() + 1}/${date.getDate()}`,
  }),
}))

vi.mock('@/lib/timezone', () => ({
  toZonedDate: (dateStr: string) => new Date(dateStr),
}))

vi.mock('@/lib/schedule', () => ({
  formatSlotJp: (slot: unknown) => (slot ? '10:00〜11:00' : null),
}))

vi.mock('@/lib/nextAvailableSlot', () => ({
  nextSlotPayloadToScheduleSlot: (payload: unknown) => payload,
}))

const createMinimalHit = (overrides: Partial<ShopHit> = {}): ShopHit => ({
  id: 'shop-1',
  name: 'Test Shop',
  area: '新宿',
  min_price: 5000,
  max_price: 10000,
  ...overrides,
})

describe('ShopCard', () => {
  it('renders shop name', () => {
    render(<ShopCard hit={createMinimalHit({ name: 'テストショップ' })} />)
    expect(screen.getByText('テストショップ')).toBeInTheDocument()
  })

  it('renders area', () => {
    render(<ShopCard hit={createMinimalHit({ area: '渋谷' })} />)
    expect(screen.getByText('渋谷')).toBeInTheDocument()
  })

  it('renders area_name when provided', () => {
    render(<ShopCard hit={createMinimalHit({ area: 'shibuya', area_name: '渋谷エリア' })} />)
    expect(screen.getByText('渋谷エリア')).toBeInTheDocument()
  })

  it('renders price range', () => {
    render(<ShopCard hit={createMinimalHit({ min_price: 5000, max_price: 10000 })} />)
    expect(screen.getByText('¥5,000 〜 ¥10,000')).toBeInTheDocument()
  })

  it('renders same price when min and max are equal', () => {
    render(<ShopCard hit={createMinimalHit({ min_price: 5000, max_price: 5000 })} />)
    expect(screen.getByText('¥5,000')).toBeInTheDocument()
  })

  it('renders "料金情報なし" when no prices', () => {
    render(<ShopCard hit={createMinimalHit({ min_price: 0, max_price: 0 })} />)
    expect(screen.getByText('料金情報なし')).toBeInTheDocument()
  })

  it('renders store_name when provided', () => {
    render(<ShopCard hit={createMinimalHit({ store_name: 'ストア名' })} />)
    expect(screen.getByText('ストア名')).toBeInTheDocument()
  })

  it('renders availability badge when today_available is true', () => {
    render(<ShopCard hit={createMinimalHit({ today_available: true })} />)
    expect(screen.getByText('本日空きあり')).toBeInTheDocument()
  })

  it('renders closed message when today_available is false', () => {
    render(<ShopCard hit={createMinimalHit({ today_available: false })} />)
    expect(screen.getByText('本日の受付は終了しました')).toBeInTheDocument()
  })

  it('renders badges when provided', () => {
    render(<ShopCard hit={createMinimalHit({ badges: ['人気', 'おすすめ'] })} />)
    expect(screen.getByText('人気')).toBeInTheDocument()
    expect(screen.getByText('おすすめ')).toBeInTheDocument()
  })

  it('renders rating when provided', () => {
    render(<ShopCard hit={createMinimalHit({ rating: 4.5, review_count: 10 })} />)
    expect(screen.getByText('4.5')).toBeInTheDocument()
    expect(screen.getByText('(10件)')).toBeInTheDocument()
  })

  it('renders distance when provided', () => {
    render(<ShopCard hit={createMinimalHit({ distance_km: 1.5 })} />)
    expect(screen.getByText('1.5km')).toBeInTheDocument()
  })

  it('renders "駅チカ" when distance is less than 0.1km', () => {
    render(<ShopCard hit={createMinimalHit({ distance_km: 0.05 })} />)
    expect(screen.getByText('駅チカ')).toBeInTheDocument()
  })

  it('renders online reservation badge when enabled', () => {
    render(<ShopCard hit={createMinimalHit({ online_reservation: true })} />)
    expect(screen.getByText('オンライン予約OK')).toBeInTheDocument()
  })

  it('renders service tags when provided', () => {
    render(<ShopCard hit={createMinimalHit({ service_tags: ['マッサージ', 'リラクゼーション'] })} />)
    expect(screen.getByText('マッサージ')).toBeInTheDocument()
    expect(screen.getByText('リラクゼーション')).toBeInTheDocument()
  })

  it('renders ranking reason when provided', () => {
    render(<ShopCard hit={createMinimalHit({ ranking_reason: '人気上昇中のお店です' })} />)
    expect(screen.getByText('人気上昇中のお店です')).toBeInTheDocument()
  })

  it('renders price band label when provided', () => {
    render(<ShopCard hit={createMinimalHit({ price_band_label: 'お手頃' })} />)
    expect(screen.getByText('お手頃')).toBeInTheDocument()
  })

  it('renders discount badge when has_discounts is true', () => {
    render(<ShopCard hit={createMinimalHit({ has_discounts: true })} />)
    expect(screen.getByText('クーポン')).toBeInTheDocument()
  })

  it('renders promotion label when has_promotions is true', () => {
    render(<ShopCard hit={createMinimalHit({ has_promotions: true })} />)
    expect(screen.getByText('特典あり')).toBeInTheDocument()
  })

  it('renders primary promotion label', () => {
    render(
      <ShopCard
        hit={createMinimalHit({
          promotions: [{ label: '初回限定割引' }],
        })}
      />,
    )
    expect(screen.getByText('初回限定割引')).toBeInTheDocument()
  })

  it('renders diary count when provided', () => {
    render(<ShopCard hit={createMinimalHit({ diary_count: 5 })} />)
    expect(screen.getByText('写メ日記 5件掲載')).toBeInTheDocument()
  })

  it('links to profile page using slug', () => {
    render(<ShopCard hit={createMinimalHit({ slug: 'test-shop' })} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/profiles/test-shop')
  })

  it('links to profile page using id when no slug', () => {
    render(<ShopCard hit={createMinimalHit({ id: 'shop-123', slug: null })} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/profiles/shop-123')
  })

  it('renders address when provided', () => {
    render(<ShopCard hit={createMinimalHit({ address: '東京都新宿区1-2-3' })} />)
    expect(screen.getByText(/東京都新宿区1-2-3/)).toBeInTheDocument()
  })

  it('renders image with alt text', () => {
    render(<ShopCard hit={createMinimalHit({ name: 'Test Shop' })} />)
    const img = screen.getByTestId('safe-image')
    expect(img).toHaveAttribute('alt', 'Test Shop の写真')
  })

  it('renders next slot label when slot is available', () => {
    render(
      <ShopCard
        hit={createMinimalHit({
          next_available_slot: { start_at: '2024-12-27T10:00:00', status: 'ok' },
        })}
      />,
    )
    expect(screen.getByText(/最短の空き枠/)).toBeInTheDocument()
  })

  it('renders additional promotion count', () => {
    render(
      <ShopCard
        hit={createMinimalHit({
          promotions: [
            { label: 'プロモ1' },
            { label: 'プロモ2' },
            { label: 'プロモ3' },
          ],
          promotion_count: 3,
        })}
      />,
    )
    expect(screen.getByText(/プロモ1 \+2/)).toBeInTheDocument()
  })

  it('renders as interactive card', () => {
    render(<ShopCard hit={createMinimalHit()} />)
    const card = screen.getByTestId('shop-card')
    expect(card).toBeInTheDocument()
  })
})
