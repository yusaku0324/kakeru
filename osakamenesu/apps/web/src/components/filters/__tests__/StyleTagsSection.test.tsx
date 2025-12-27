/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StyleTagsSection } from '../StyleTagsSection'
import { DEFAULT_TAG, HAIR_COLOR_OPTIONS, HAIR_STYLE_OPTIONS, BODY_TYPE_OPTIONS } from '../searchFiltersConstants'

describe('StyleTagsSection', () => {
  const defaultProps = {
    hairColor: DEFAULT_TAG,
    onHairColorChange: vi.fn(),
    hairStyle: DEFAULT_TAG,
    onHairStyleChange: vi.fn(),
    bodyShape: DEFAULT_TAG,
    onBodyShapeChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders hair color section', () => {
      render(<StyleTagsSection {...defaultProps} />)
      expect(screen.getByText('髪色')).toBeInTheDocument()
    })

    it('renders hair style section', () => {
      render(<StyleTagsSection {...defaultProps} />)
      expect(screen.getByText('髪型')).toBeInTheDocument()
    })

    it('renders body shape section', () => {
      render(<StyleTagsSection {...defaultProps} />)
      expect(screen.getByText('体型')).toBeInTheDocument()
    })

    it('renders hair color options', () => {
      render(<StyleTagsSection {...defaultProps} />)
      // Check for a few specific options (not default which appears multiple times)
      expect(screen.getByRole('button', { name: '黒髪' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '茶髪' })).toBeInTheDocument()
    })

    it('renders hair style options', () => {
      render(<StyleTagsSection {...defaultProps} />)
      expect(screen.getByRole('button', { name: 'ロング' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'ショート' })).toBeInTheDocument()
    })

    it('renders body type options', () => {
      render(<StyleTagsSection {...defaultProps} />)
      expect(screen.getByRole('button', { name: 'スレンダー' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'グラマー' })).toBeInTheDocument()
    })
  })

  describe('clear buttons', () => {
    it('shows clear button for hair color when not default', () => {
      render(<StyleTagsSection {...defaultProps} hairColor="黒髪" />)
      const clearButtons = screen.getAllByRole('button', { name: 'クリア' })
      expect(clearButtons.length).toBeGreaterThanOrEqual(1)
    })

    it('does not show clear button for hair color when default', () => {
      render(<StyleTagsSection {...defaultProps} hairColor={DEFAULT_TAG} hairStyle="ロング" bodyShape="スレンダー" />)
      // Should have 2 clear buttons (for hair style and body shape)
      const clearButtons = screen.getAllByRole('button', { name: 'クリア' })
      expect(clearButtons).toHaveLength(2)
    })

    it('calls onHairColorChange with default when clear clicked', () => {
      render(<StyleTagsSection {...defaultProps} hairColor="黒髪" />)
      const clearButtons = screen.getAllByRole('button', { name: 'クリア' })
      fireEvent.click(clearButtons[0])
      expect(defaultProps.onHairColorChange).toHaveBeenCalledWith(DEFAULT_TAG)
    })

    it('shows clear button for hair style when not default', () => {
      render(<StyleTagsSection {...defaultProps} hairStyle="ロング" />)
      const clearButtons = screen.getAllByRole('button', { name: 'クリア' })
      expect(clearButtons.length).toBeGreaterThanOrEqual(1)
    })

    it('shows clear button for body shape when not default', () => {
      render(<StyleTagsSection {...defaultProps} bodyShape="スレンダー" />)
      const clearButtons = screen.getAllByRole('button', { name: 'クリア' })
      expect(clearButtons.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('option selection', () => {
    it('calls onHairColorChange when hair color option clicked', () => {
      render(<StyleTagsSection {...defaultProps} />)
      fireEvent.click(screen.getByRole('button', { name: '黒髪' }))
      expect(defaultProps.onHairColorChange).toHaveBeenCalledWith('黒髪')
    })

    it('calls onHairStyleChange when hair style option clicked', () => {
      render(<StyleTagsSection {...defaultProps} />)
      fireEvent.click(screen.getByRole('button', { name: 'ロング' }))
      expect(defaultProps.onHairStyleChange).toHaveBeenCalledWith('ロング')
    })

    it('calls onBodyShapeChange when body shape option clicked', () => {
      render(<StyleTagsSection {...defaultProps} />)
      fireEvent.click(screen.getByRole('button', { name: 'スレンダー' }))
      expect(defaultProps.onBodyShapeChange).toHaveBeenCalledWith('スレンダー')
    })
  })

  describe('active state styling', () => {
    it('applies active styling to selected hair color', () => {
      render(<StyleTagsSection {...defaultProps} hairColor="黒髪" />)
      const button = screen.getByRole('button', { name: '黒髪' })
      expect(button).toHaveClass('border-brand-primary')
    })

    it('applies active styling to selected hair style', () => {
      render(<StyleTagsSection {...defaultProps} hairStyle="ロング" />)
      const button = screen.getByRole('button', { name: 'ロング' })
      expect(button).toHaveClass('border-brand-primary')
    })

    it('applies active styling to selected body shape', () => {
      render(<StyleTagsSection {...defaultProps} bodyShape="スレンダー" />)
      const button = screen.getByRole('button', { name: 'スレンダー' })
      expect(button).toHaveClass('border-brand-primary')
    })
  })

  describe('custom className', () => {
    it('applies custom className', () => {
      const { container } = render(
        <StyleTagsSection {...defaultProps} className="custom-class" />,
      )
      expect(container.firstChild).toHaveClass('custom-class')
    })
  })
})
