import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MobileFilterDrawer } from './MobileFilterDrawer'

describe('MobileFilterDrawer', () => {
  const defaultProps = {
    isOpen: false,
    onClose: vi.fn(),
    onApply: vi.fn(),
    children: <div data-testid="filter-content">Filter Content</div>,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Reset body overflow
    document.body.style.overflow = ''
  })

  describe('rendering', () => {
    it('renders children when open', () => {
      render(<MobileFilterDrawer {...defaultProps} isOpen={true} />)
      expect(screen.getByTestId('filter-content')).toBeInTheDocument()
    })

    it('shows result count when provided', () => {
      render(
        <MobileFilterDrawer
          {...defaultProps}
          isOpen={true}
          resultCount={42}
          resultUnit="件"
        />
      )
      // Result count and unit are in the same span element
      const resultSpan = screen.getByText((content, element) => {
        return element?.tagName === 'SPAN' && content.includes('42')
      })
      expect(resultSpan).toBeInTheDocument()
      expect(resultSpan).toHaveTextContent('42')
      expect(resultSpan).toHaveTextContent('件')
    })

    it('shows active filter count badge', () => {
      render(
        <MobileFilterDrawer
          {...defaultProps}
          isOpen={true}
          activeFilterCount={3}
        />
      )
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('does not show badge when activeFilterCount is 0', () => {
      render(
        <MobileFilterDrawer
          {...defaultProps}
          isOpen={true}
          activeFilterCount={0}
        />
      )
      // The badge should not be present
      expect(screen.queryByText('0')).not.toBeInTheDocument()
    })
  })

  describe('visibility and animation', () => {
    it('has translate-y-full class when closed', () => {
      render(<MobileFilterDrawer {...defaultProps} isOpen={false} />)
      const drawer = screen.getByRole('dialog')
      expect(drawer).toHaveClass('translate-y-full')
    })

    it('has translate-y-0 class when open', () => {
      render(<MobileFilterDrawer {...defaultProps} isOpen={true} />)
      const drawer = screen.getByRole('dialog')
      expect(drawer).toHaveClass('translate-y-0')
    })
  })

  describe('body scroll lock', () => {
    it('locks body scroll when open', () => {
      render(<MobileFilterDrawer {...defaultProps} isOpen={true} />)
      expect(document.body.style.overflow).toBe('hidden')
    })

    it('unlocks body scroll when closed', () => {
      const { rerender } = render(
        <MobileFilterDrawer {...defaultProps} isOpen={true} />
      )
      expect(document.body.style.overflow).toBe('hidden')

      rerender(<MobileFilterDrawer {...defaultProps} isOpen={false} />)
      expect(document.body.style.overflow).toBe('')
    })

    it('cleans up body scroll on unmount', () => {
      const { unmount } = render(
        <MobileFilterDrawer {...defaultProps} isOpen={true} />
      )
      expect(document.body.style.overflow).toBe('hidden')

      unmount()
      expect(document.body.style.overflow).toBe('')
    })
  })

  describe('interactions', () => {
    it('calls onClose when backdrop is clicked', async () => {
      const onClose = vi.fn()
      render(
        <MobileFilterDrawer {...defaultProps} isOpen={true} onClose={onClose} />
      )

      // Find backdrop by its classes
      const backdrop = document.querySelector('.fixed.inset-0.z-50.bg-black\\/40')
      expect(backdrop).toBeInTheDocument()
      fireEvent.click(backdrop!)
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('calls onClose when close button is clicked', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(
        <MobileFilterDrawer {...defaultProps} isOpen={true} onClose={onClose} />
      )

      const closeButton = screen.getByLabelText('フィルターを閉じる')
      await user.click(closeButton)
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('calls onApply and onClose when apply button is clicked', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      const onApply = vi.fn()
      render(
        <MobileFilterDrawer
          {...defaultProps}
          isOpen={true}
          onClose={onClose}
          onApply={onApply}
        />
      )

      const applyButton = screen.getByText('この条件で検索する')
      await user.click(applyButton)
      expect(onApply).toHaveBeenCalledTimes(1)
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('closes on Escape key press', () => {
      const onClose = vi.fn()
      render(
        <MobileFilterDrawer {...defaultProps} isOpen={true} onClose={onClose} />
      )

      fireEvent.keyDown(window, { key: 'Escape' })
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('does not call onClose on Escape when closed', () => {
      const onClose = vi.fn()
      render(
        <MobileFilterDrawer {...defaultProps} isOpen={false} onClose={onClose} />
      )

      fireEvent.keyDown(window, { key: 'Escape' })
      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('accessibility', () => {
    it('has correct ARIA attributes', () => {
      render(<MobileFilterDrawer {...defaultProps} isOpen={true} />)

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      expect(dialog).toHaveAttribute('aria-label', '検索フィルター')
    })

    it('has proper heading', () => {
      render(<MobileFilterDrawer {...defaultProps} isOpen={true} />)
      expect(screen.getByRole('heading', { name: '絞り込み' })).toBeInTheDocument()
    })
  })

  describe('number formatting', () => {
    it('formats large numbers with Japanese locale', () => {
      render(
        <MobileFilterDrawer
          {...defaultProps}
          isOpen={true}
          resultCount={1234}
        />
      )
      // Number is formatted with comma separator
      expect(screen.getByText(/1,234/)).toBeInTheDocument()
    })
  })
})
