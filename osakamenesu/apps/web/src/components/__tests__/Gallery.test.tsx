import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Gallery from '../Gallery'

// Mock SafeImage component
vi.mock('@/components/SafeImage', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-testid="gallery-image" />
  ),
}))

describe('Gallery', () => {
  const mockPhotos = [
    '/images/photo1.jpg',
    '/images/photo2.jpg',
    '/images/photo3.jpg',
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders placeholder when photos array is empty', () => {
      render(<Gallery photos={[]} altBase="Test" />)
      // Empty gallery shows a gray placeholder
      const placeholder = document.querySelector('.bg-gray-100')
      expect(placeholder).toBeInTheDocument()
    })

    it('renders slides for each photo', () => {
      render(<Gallery photos={mockPhotos} altBase="Test" />)
      const slides = screen.getAllByTestId('gallery-slide')
      expect(slides).toHaveLength(3)
    })

    it('renders navigation dots for multiple photos', () => {
      render(<Gallery photos={mockPhotos} altBase="Test" />)
      const dots = screen.getAllByTestId('gallery-dot')
      expect(dots).toHaveLength(3)
    })

    it('renders thumbnails for mobile and desktop (2x photos count)', () => {
      render(<Gallery photos={mockPhotos} altBase="Test" />)
      // Thumbnails appear twice: desktop (md:) and mobile versions
      const thumbs = screen.getAllByTestId('gallery-thumb')
      expect(thumbs).toHaveLength(6) // 3 photos x 2 (desktop + mobile)
    })

    it('does not render gallery-view when no photos', () => {
      render(<Gallery photos={[]} altBase="Test" />)
      expect(screen.queryByTestId('gallery-view')).not.toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('has proper ARIA attributes on gallery view', () => {
      render(<Gallery photos={mockPhotos} altBase="Test" id="test-gallery" />)
      const view = screen.getByTestId('gallery-view')
      expect(view).toHaveAttribute('role', 'region')
      expect(view).toHaveAttribute('aria-roledescription', 'carousel')
      expect(view).toHaveAttribute('aria-label', 'Test gallery')
    })

    it('has aria-live for screen reader announcements', () => {
      render(<Gallery photos={mockPhotos} altBase="Test" />)
      const view = screen.getByTestId('gallery-view')
      expect(view).toHaveAttribute('aria-live', 'polite')
    })

    it('dots have proper ARIA attributes', () => {
      render(<Gallery photos={mockPhotos} altBase="Test" />)
      const dots = screen.getAllByTestId('gallery-dot')
      expect(dots[0]).toHaveAttribute('aria-label', '1枚目に移動')
      expect(dots[0]).toHaveAttribute('aria-current', 'true')
      expect(dots[1]).not.toHaveAttribute('aria-current')
    })

    it('thumbnails have proper ARIA attributes', () => {
      render(<Gallery photos={mockPhotos} altBase="Test" />)
      const thumbs = screen.getAllByTestId('gallery-thumb')
      expect(thumbs[0]).toHaveAttribute('aria-label', '1枚目を表示')
      expect(thumbs[0]).toHaveAttribute('aria-current', 'true')
    })

    it('gallery view is focusable for keyboard navigation', () => {
      render(<Gallery photos={mockPhotos} altBase="Test" />)
      const view = screen.getByTestId('gallery-view')
      expect(view).toHaveAttribute('tabIndex', '0')
    })
  })

  describe('keyboard navigation', () => {
    it('navigates to next photo on ArrowRight', () => {
      render(<Gallery photos={mockPhotos} altBase="Test" />)
      const view = screen.getByTestId('gallery-view')

      // Mock scrollTo
      const scrollToMock = vi.fn()
      view.scrollTo = scrollToMock

      fireEvent.keyDown(view, { key: 'ArrowRight' })
      expect(scrollToMock).toHaveBeenCalledWith({
        left: expect.any(Number),
        behavior: 'smooth',
      })
    })

    it('navigates to previous photo on ArrowLeft', () => {
      render(<Gallery photos={mockPhotos} altBase="Test" />)
      const view = screen.getByTestId('gallery-view')

      const scrollToMock = vi.fn()
      view.scrollTo = scrollToMock

      fireEvent.keyDown(view, { key: 'ArrowLeft' })
      expect(scrollToMock).toHaveBeenCalled()
    })

    it('navigates to first photo on Home', () => {
      render(<Gallery photos={mockPhotos} altBase="Test" />)
      const view = screen.getByTestId('gallery-view')

      const scrollToMock = vi.fn()
      view.scrollTo = scrollToMock

      fireEvent.keyDown(view, { key: 'Home' })
      expect(scrollToMock).toHaveBeenCalledWith({
        left: 0,
        behavior: 'smooth',
      })
    })

    it('navigates to last photo on End', () => {
      render(<Gallery photos={mockPhotos} altBase="Test" />)
      const view = screen.getByTestId('gallery-view')

      const scrollToMock = vi.fn()
      view.scrollTo = scrollToMock

      fireEvent.keyDown(view, { key: 'End' })
      expect(scrollToMock).toHaveBeenCalled()
    })
  })

  describe('dot navigation', () => {
    it('navigates to specific photo when dot is clicked', () => {
      render(<Gallery photos={mockPhotos} altBase="Test" />)
      const dots = screen.getAllByTestId('gallery-dot')
      const view = screen.getByTestId('gallery-view')

      const scrollToMock = vi.fn()
      view.scrollTo = scrollToMock

      fireEvent.click(dots[1])
      expect(scrollToMock).toHaveBeenCalled()
    })

    it('shows active state on current dot', () => {
      render(<Gallery photos={mockPhotos} altBase="Test" />)
      const dots = screen.getAllByTestId('gallery-dot')
      expect(dots[0]).toHaveAttribute('data-active', 'true')
      expect(dots[1]).toHaveAttribute('data-active', 'false')
    })
  })

  describe('thumbnail navigation', () => {
    it('navigates to specific photo when thumbnail is clicked', () => {
      render(<Gallery photos={mockPhotos} altBase="Test" />)
      const thumbs = screen.getAllByTestId('gallery-thumb')
      const view = screen.getByTestId('gallery-view')

      const scrollToMock = vi.fn()
      view.scrollTo = scrollToMock

      fireEvent.click(thumbs[2])
      expect(scrollToMock).toHaveBeenCalled()
    })

    it('shows active state on current thumbnail', () => {
      render(<Gallery photos={mockPhotos} altBase="Test" />)
      const thumbs = screen.getAllByTestId('gallery-thumb')
      expect(thumbs[0]).toHaveAttribute('data-active', 'true')
    })
  })
})
