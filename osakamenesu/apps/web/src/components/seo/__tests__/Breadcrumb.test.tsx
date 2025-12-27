/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock Next.js Link component
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  ChevronRight: () => <span data-testid="chevron-icon">›</span>,
}))

// Mock structured data functions
vi.mock('@/lib/seo/structured-data', () => ({
  generateBreadcrumbData: vi.fn(() => ({ '@type': 'BreadcrumbList' })),
  serializeStructuredData: vi.fn((data) => JSON.stringify(data)),
}))

import Breadcrumb from '../Breadcrumb'

describe('Breadcrumb', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.com')
  })

  it('renders home link', () => {
    render(<Breadcrumb items={[]} />)
    expect(screen.getByText('ホーム')).toBeInTheDocument()
  })

  it('renders items with names', () => {
    render(
      <Breadcrumb
        items={[
          { name: 'Category', url: '/category' },
          { name: 'Item' },
        ]}
      />
    )
    expect(screen.getByText('Category')).toBeInTheDocument()
    expect(screen.getByText('Item')).toBeInTheDocument()
  })

  it('renders links for items with url', () => {
    render(
      <Breadcrumb
        items={[
          { name: 'Category', url: '/category' },
          { name: 'Item' },
        ]}
      />
    )
    const categoryLink = screen.getByRole('link', { name: 'Category' })
    expect(categoryLink).toHaveAttribute('href', '/category')
  })

  it('does not render link for last item', () => {
    render(
      <Breadcrumb
        items={[
          { name: 'Category', url: '/category' },
          { name: 'Item', url: '/item' },
        ]}
      />
    )
    // Last item should be a span, not a link
    const item = screen.getByText('Item')
    expect(item.tagName).toBe('SPAN')
  })

  it('renders chevron icons between items', () => {
    render(
      <Breadcrumb
        items={[
          { name: 'Category' },
          { name: 'Item' },
        ]}
      />
    )
    const chevrons = screen.getAllByTestId('chevron-icon')
    expect(chevrons.length).toBe(2) // One after home, one after category
  })

  it('has navigation landmark', () => {
    render(<Breadcrumb items={[{ name: 'Test' }]} />)
    expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', 'パンくずリスト')
  })

  it('applies custom className', () => {
    render(<Breadcrumb items={[]} className="custom-class" />)
    const nav = screen.getByRole('navigation')
    expect(nav).toHaveClass('custom-class')
  })

  it('marks last item with aria-current', () => {
    render(
      <Breadcrumb
        items={[
          { name: 'Category' },
          { name: 'Current Page' },
        ]}
      />
    )
    const lastItem = screen.getByText('Current Page')
    expect(lastItem).toHaveAttribute('aria-current', 'page')
  })

  it('renders structured data script when showStructuredData is true', () => {
    const { container } = render(
      <Breadcrumb items={[{ name: 'Test' }]} showStructuredData={true} />
    )
    const script = container.querySelector('script[type="application/ld+json"]')
    expect(script).toBeInTheDocument()
  })

  it('does not render structured data when showStructuredData is false', () => {
    const { container } = render(
      <Breadcrumb items={[{ name: 'Test' }]} showStructuredData={false} />
    )
    const script = container.querySelector('script[type="application/ld+json"]')
    expect(script).not.toBeInTheDocument()
  })

  it('renders structured data by default', () => {
    const { container } = render(<Breadcrumb items={[{ name: 'Test' }]} />)
    const script = container.querySelector('script[type="application/ld+json"]')
    expect(script).toBeInTheDocument()
  })
})
