/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ShopFilterHeader } from '../ShopFilterHeader'

// Mock next/link
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode
    href: string
    className?: string
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

// Mock SafeImage
vi.mock('@/components/SafeImage', () => ({
  default: ({
    alt,
    src,
  }: {
    alt: string
    src: string
    fill?: boolean
    className?: string
    sizes?: string
    fallbackSrc?: string
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-testid="safe-image" />
  ),
}))

describe('ShopFilterHeader', () => {
  const defaultShop = {
    name: 'テストショップ',
    slug: 'test-shop',
  }

  describe('rendering', () => {
    it('renders shop name with suffix', () => {
      render(<ShopFilterHeader shop={defaultShop} />)
      expect(screen.getByText('テストショップのセラピスト一覧')).toBeInTheDocument()
    })

    it('renders clear filter button', () => {
      render(<ShopFilterHeader shop={defaultShop} />)
      expect(screen.getByText('絞り込み解除')).toBeInTheDocument()
    })

    it('clear filter button links to therapists page', () => {
      render(<ShopFilterHeader shop={defaultShop} />)
      const link = screen.getByRole('link', { name: '絞り込み解除' })
      expect(link).toHaveAttribute('href', '/therapists')
    })
  })

  describe('shop image', () => {
    it('renders SafeImage when leadImageUrl is provided', () => {
      const shop = {
        ...defaultShop,
        leadImageUrl: '/images/shop.jpg',
      }
      render(<ShopFilterHeader shop={shop} />)
      expect(screen.getByTestId('safe-image')).toBeInTheDocument()
      expect(screen.getByTestId('safe-image')).toHaveAttribute('src', '/images/shop.jpg')
    })

    it('renders first character of shop name when no image', () => {
      render(<ShopFilterHeader shop={defaultShop} />)
      expect(screen.getByText('テ')).toBeInTheDocument()
    })

    it('handles empty shop name gracefully', () => {
      const shop = {
        name: '',
        slug: 'empty-shop',
      }
      render(<ShopFilterHeader shop={shop} />)
      // Should render empty string for first character
      expect(screen.getByText('のセラピスト一覧')).toBeInTheDocument()
    })
  })

  describe('area display', () => {
    it('renders area when provided', () => {
      const shop = {
        ...defaultShop,
        area: '渋谷区',
      }
      render(<ShopFilterHeader shop={shop} />)
      expect(screen.getByText('渋谷区')).toBeInTheDocument()
    })

    it('does not render area when null', () => {
      const shop = {
        ...defaultShop,
        area: null,
      }
      render(<ShopFilterHeader shop={shop} />)
      expect(screen.queryByText('渋谷区')).not.toBeInTheDocument()
    })

    it('does not render area when undefined', () => {
      render(<ShopFilterHeader shop={defaultShop} />)
      // Should not have any area text
      const paragraph = screen.queryByText('渋谷区')
      expect(paragraph).not.toBeInTheDocument()
    })
  })

  describe('full shop info', () => {
    it('renders all shop information', () => {
      const shop = {
        name: '大阪メネス本店',
        slug: 'osaka-menesu',
        area: '大阪市中央区',
        leadImageUrl: '/images/osaka.jpg',
      }
      render(<ShopFilterHeader shop={shop} />)

      expect(screen.getByText('大阪メネス本店のセラピスト一覧')).toBeInTheDocument()
      expect(screen.getByText('大阪市中央区')).toBeInTheDocument()
      expect(screen.getByTestId('safe-image')).toHaveAttribute('src', '/images/osaka.jpg')
      expect(screen.getByRole('link', { name: '絞り込み解除' })).toBeInTheDocument()
    })
  })
})
