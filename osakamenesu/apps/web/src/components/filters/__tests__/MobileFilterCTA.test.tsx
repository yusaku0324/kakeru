/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileFilterCTA } from '../MobileFilterCTA'

describe('MobileFilterCTA', () => {
  const defaultProps = {
    onSubmit: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders submit button', () => {
      render(<MobileFilterCTA {...defaultProps} />)
      expect(screen.getByRole('button', { name: 'この条件で検索する' })).toBeInTheDocument()
    })

    it('renders search icon', () => {
      const { container } = render(<MobileFilterCTA {...defaultProps} />)
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })
  })

  describe('result count', () => {
    it('displays result count when provided', () => {
      render(<MobileFilterCTA {...defaultProps} resultCount={123} />)
      expect(screen.getByText('123件')).toBeInTheDocument()
    })

    it('formats large numbers', () => {
      render(<MobileFilterCTA {...defaultProps} resultCount={1234} />)
      expect(screen.getByText('1,234件')).toBeInTheDocument()
    })

    it('uses custom result unit', () => {
      render(<MobileFilterCTA {...defaultProps} resultCount={50} resultUnit="人" />)
      expect(screen.getByText('50人')).toBeInTheDocument()
    })

    it('does not show result count when undefined', () => {
      render(<MobileFilterCTA {...defaultProps} />)
      expect(screen.queryByText(/\d+件/)).not.toBeInTheDocument()
    })
  })

  describe('pending state', () => {
    it('shows loading text when pending', () => {
      render(<MobileFilterCTA {...defaultProps} isPending={true} />)
      expect(screen.getByRole('button', { name: '検索中...' })).toBeInTheDocument()
    })

    it('disables button when pending', () => {
      render(<MobileFilterCTA {...defaultProps} isPending={true} />)
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('enables button when not pending', () => {
      render(<MobileFilterCTA {...defaultProps} isPending={false} />)
      expect(screen.getByRole('button')).not.toBeDisabled()
    })
  })

  describe('interaction', () => {
    it('calls onSubmit when button is clicked', () => {
      render(<MobileFilterCTA {...defaultProps} />)
      fireEvent.click(screen.getByRole('button'))
      expect(defaultProps.onSubmit).toHaveBeenCalled()
    })

    it('does not call onSubmit when pending', () => {
      render(<MobileFilterCTA {...defaultProps} isPending={true} />)
      fireEvent.click(screen.getByRole('button'))
      // Button is disabled, so it shouldn't fire
      expect(defaultProps.onSubmit).not.toHaveBeenCalled()
    })
  })

  describe('styling', () => {
    it('applies fixed positioning', () => {
      const { container } = render(<MobileFilterCTA {...defaultProps} />)
      const wrapper = container.firstChild as HTMLElement
      expect(wrapper).toHaveClass('fixed')
    })

    it('applies custom className', () => {
      const { container } = render(
        <MobileFilterCTA {...defaultProps} className="custom-class" />,
      )
      const wrapper = container.firstChild as HTMLElement
      expect(wrapper).toHaveClass('custom-class')
    })

    it('applies md:hidden for mobile only', () => {
      const { container } = render(<MobileFilterCTA {...defaultProps} />)
      const wrapper = container.firstChild as HTMLElement
      expect(wrapper).toHaveClass('md:hidden')
    })
  })
})
