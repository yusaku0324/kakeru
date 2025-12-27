/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TherapistShopTabs } from '../TherapistShopTabs'

// Mock next/link
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    className,
    ...props
  }: {
    children: React.ReactNode
    href: string
    className?: string
    'aria-current'?: 'page' | undefined
  }) => (
    <a href={href} className={className} {...props}>
      {children}
    </a>
  ),
}))

describe('TherapistShopTabs', () => {
  describe('rendering', () => {
    it('renders therapist and shop tabs', () => {
      render(<TherapistShopTabs current="therapists" />)

      expect(screen.getByText('セラピスト')).toBeInTheDocument()
      expect(screen.getByText('店舗')).toBeInTheDocument()
    })

    it('has navigation aria label', () => {
      render(<TherapistShopTabs current="therapists" />)

      expect(screen.getByRole('navigation', { name: '検索モード切替' })).toBeInTheDocument()
    })
  })

  describe('active state', () => {
    it('marks therapist tab as active when current is therapists', () => {
      render(<TherapistShopTabs current="therapists" />)

      const therapistTab = screen.getByRole('link', { name: 'セラピスト' })
      const shopTab = screen.getByRole('link', { name: '店舗' })

      expect(therapistTab).toHaveAttribute('aria-current', 'page')
      expect(shopTab).not.toHaveAttribute('aria-current')
    })

    it('marks shop tab as active when current is shops', () => {
      render(<TherapistShopTabs current="shops" />)

      const therapistTab = screen.getByRole('link', { name: 'セラピスト' })
      const shopTab = screen.getByRole('link', { name: '店舗' })

      expect(therapistTab).not.toHaveAttribute('aria-current')
      expect(shopTab).toHaveAttribute('aria-current', 'page')
    })
  })

  describe('links', () => {
    it('therapist tab links to /therapists when no shopSlug', () => {
      render(<TherapistShopTabs current="shops" />)

      const therapistTab = screen.getByRole('link', { name: 'セラピスト' })
      expect(therapistTab).toHaveAttribute('href', '/therapists')
    })

    it('shop tab links to /shops', () => {
      render(<TherapistShopTabs current="therapists" />)

      const shopTab = screen.getByRole('link', { name: '店舗' })
      expect(shopTab).toHaveAttribute('href', '/shops')
    })

    it('therapist tab preserves shop_slug when provided', () => {
      render(<TherapistShopTabs current="shops" shopSlug="test-shop" />)

      const therapistTab = screen.getByRole('link', { name: 'セラピスト' })
      expect(therapistTab).toHaveAttribute(
        'href',
        '/therapists?shop_slug=test-shop'
      )
    })

    it('encodes special characters in shopSlug', () => {
      render(<TherapistShopTabs current="shops" shopSlug="shop with spaces" />)

      const therapistTab = screen.getByRole('link', { name: 'セラピスト' })
      expect(therapistTab).toHaveAttribute(
        'href',
        '/therapists?shop_slug=shop%20with%20spaces'
      )
    })

    it('does not add shop_slug when shopSlug is null', () => {
      render(<TherapistShopTabs current="shops" shopSlug={null} />)

      const therapistTab = screen.getByRole('link', { name: 'セラピスト' })
      expect(therapistTab).toHaveAttribute('href', '/therapists')
    })
  })

  describe('styling', () => {
    it('active tab has different styling', () => {
      render(<TherapistShopTabs current="therapists" />)

      const therapistTab = screen.getByRole('link', { name: 'セラピスト' })
      const shopTab = screen.getByRole('link', { name: '店舗' })

      // Active tab should have brand-primary background
      expect(therapistTab.className).toContain('bg-brand-primary')
      expect(therapistTab.className).toContain('text-white')

      // Inactive tab should not have the active styling
      expect(shopTab.className).not.toContain('bg-brand-primary')
    })

    it('inactive tab has hover styling class', () => {
      render(<TherapistShopTabs current="therapists" />)

      const shopTab = screen.getByRole('link', { name: '店舗' })

      expect(shopTab.className).toContain('hover:text-brand-primary')
    })
  })
})
