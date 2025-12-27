/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ShopCardNavigateToTherapists } from '../ShopCardNavigateToTherapists'
import type { ShopHit } from '../ShopCard'

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

// Mock SafeImage
vi.mock('@/components/SafeImage', () => ({
  default: (props: { src?: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={props.src ?? ''} alt={props.alt} data-testid="safe-image" />
  ),
}))

const createMinimalHit = (overrides: Partial<ShopHit> = {}): ShopHit => ({
  id: 'shop-1',
  name: 'Test Shop',
  area: '新宿',
  min_price: 5000,
  max_price: 10000,
  ...overrides,
})

describe('ShopCardNavigateToTherapists', () => {
  describe('rendering', () => {
    it('renders shop name', () => {
      render(<ShopCardNavigateToTherapists hit={createMinimalHit({ name: 'テストショップ' })} />)
      expect(screen.getByText('テストショップ')).toBeInTheDocument()
    })

    it('renders store_name when provided', () => {
      render(
        <ShopCardNavigateToTherapists
          hit={createMinimalHit({ name: 'Shop Name', store_name: 'ストア名' })}
        />,
      )
      expect(screen.getByText('ストア名')).toBeInTheDocument()
    })

    it('renders area', () => {
      render(<ShopCardNavigateToTherapists hit={createMinimalHit({ area: '渋谷' })} />)
      expect(screen.getByText('渋谷')).toBeInTheDocument()
    })

    it('renders area_name when provided', () => {
      render(
        <ShopCardNavigateToTherapists
          hit={createMinimalHit({ area: 'shibuya', area_name: '渋谷エリア' })}
        />,
      )
      expect(screen.getByText('渋谷エリア')).toBeInTheDocument()
    })
  })

  describe('price display', () => {
    it('renders price range', () => {
      render(
        <ShopCardNavigateToTherapists
          hit={createMinimalHit({ min_price: 5000, max_price: 10000 })}
        />,
      )
      expect(screen.getByText('¥5,000 〜 ¥10,000')).toBeInTheDocument()
    })

    it('renders same price when min and max are equal', () => {
      render(
        <ShopCardNavigateToTherapists hit={createMinimalHit({ min_price: 5000, max_price: 5000 })} />,
      )
      expect(screen.getByText('¥5,000')).toBeInTheDocument()
    })

    it('renders "料金情報なし" when no prices', () => {
      render(
        <ShopCardNavigateToTherapists hit={createMinimalHit({ min_price: 0, max_price: 0 })} />,
      )
      expect(screen.getByText('料金情報なし')).toBeInTheDocument()
    })
  })

  describe('availability', () => {
    it('renders availability badge when today_available is true', () => {
      render(<ShopCardNavigateToTherapists hit={createMinimalHit({ today_available: true })} />)
      expect(screen.getByText('本日空きあり')).toBeInTheDocument()
    })

    it('does not render availability badge when today_available is false', () => {
      render(<ShopCardNavigateToTherapists hit={createMinimalHit({ today_available: false })} />)
      expect(screen.queryByText('本日空きあり')).not.toBeInTheDocument()
    })
  })

  describe('rating', () => {
    it('renders rating when provided', () => {
      render(<ShopCardNavigateToTherapists hit={createMinimalHit({ rating: 4.5 })} />)
      expect(screen.getByText('4.5')).toBeInTheDocument()
    })

    it('does not render rating when not provided', () => {
      render(<ShopCardNavigateToTherapists hit={createMinimalHit({ rating: null })} />)
      expect(screen.queryByText('★')).not.toBeInTheDocument()
    })
  })

  describe('badges', () => {
    it('renders badges when provided', () => {
      render(
        <ShopCardNavigateToTherapists hit={createMinimalHit({ badges: ['人気', 'おすすめ'] })} />,
      )
      expect(screen.getByText('人気')).toBeInTheDocument()
      expect(screen.getByText('おすすめ')).toBeInTheDocument()
    })

    it('limits to 2 badges', () => {
      render(
        <ShopCardNavigateToTherapists
          hit={createMinimalHit({ badges: ['人気', 'おすすめ', '新着'] })}
        />,
      )
      expect(screen.getByText('人気')).toBeInTheDocument()
      expect(screen.getByText('おすすめ')).toBeInTheDocument()
      expect(screen.queryByText('新着')).not.toBeInTheDocument()
    })
  })

  describe('staff preview', () => {
    it('renders staff count when staff_preview is provided', () => {
      render(
        <ShopCardNavigateToTherapists
          hit={createMinimalHit({
            staff_preview: [
              { name: 'Therapist 1' },
              { name: 'Therapist 2' },
            ],
          })}
        />,
      )
      expect(screen.getByText('2名のセラピストを見る →')).toBeInTheDocument()
    })

    it('does not render staff count when staff_preview is empty', () => {
      render(<ShopCardNavigateToTherapists hit={createMinimalHit({ staff_preview: [] })} />)
      expect(screen.queryByText(/セラピストを見る/)).not.toBeInTheDocument()
    })

    it('does not render staff count when staff_preview is null', () => {
      render(<ShopCardNavigateToTherapists hit={createMinimalHit({ staff_preview: null })} />)
      expect(screen.queryByText(/セラピストを見る/)).not.toBeInTheDocument()
    })
  })

  describe('links', () => {
    it('links to therapist list using slug', () => {
      render(<ShopCardNavigateToTherapists hit={createMinimalHit({ slug: 'test-shop' })} />)
      const link = screen.getByRole('link')
      expect(link).toHaveAttribute('href', '/therapists?shop_slug=test-shop')
    })

    it('links to therapist list using id when no slug', () => {
      render(<ShopCardNavigateToTherapists hit={createMinimalHit({ id: 'shop-123', slug: null })} />)
      const link = screen.getByRole('link')
      expect(link).toHaveAttribute('href', '/therapists?shop_slug=shop-123')
    })
  })

  describe('image', () => {
    it('renders image with alt text', () => {
      render(<ShopCardNavigateToTherapists hit={createMinimalHit({ name: 'Test Shop' })} />)
      const img = screen.getByTestId('safe-image')
      expect(img).toHaveAttribute('alt', 'Test Shop の写真')
    })
  })

  describe('card', () => {
    it('renders as interactive card', () => {
      render(<ShopCardNavigateToTherapists hit={createMinimalHit()} />)
      const card = screen.getByTestId('shop-card-navigate')
      expect(card).toBeInTheDocument()
    })
  })
})
