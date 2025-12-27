/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterChipsSection } from '../FilterChipsSection'

describe('FilterChipsSection', () => {
  const defaultProps = {
    todayOnly: false,
    onToggleToday: vi.fn(),
    promotionsOnly: false,
    onTogglePromotions: vi.fn(),
    discountsOnly: false,
    onToggleDiscounts: vi.fn(),
    diariesOnly: false,
    onToggleDiaries: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders header by default', () => {
      render(<FilterChipsSection {...defaultProps} />)
      expect(screen.getByText('こだわり条件')).toBeInTheDocument()
      expect(screen.getByText('チェックやタグで詳細に絞り込めます')).toBeInTheDocument()
    })

    it('renders header icon', () => {
      render(<FilterChipsSection {...defaultProps} />)
      expect(screen.getByText('✧')).toBeInTheDocument()
    })

    it('hides header when showHeader is false', () => {
      render(<FilterChipsSection {...defaultProps} showHeader={false} />)
      expect(screen.queryByText('こだわり条件')).not.toBeInTheDocument()
    })

    it('renders help text', () => {
      render(<FilterChipsSection {...defaultProps} />)
      expect(screen.getByText('※ 並び替えは検索結果上部から操作できます')).toBeInTheDocument()
    })
  })

  describe('checkboxes', () => {
    it('renders today only checkbox', () => {
      render(<FilterChipsSection {...defaultProps} />)
      expect(screen.getByLabelText('本日出勤のみ')).toBeInTheDocument()
    })

    it('renders promotions checkbox', () => {
      render(<FilterChipsSection {...defaultProps} />)
      expect(screen.getByLabelText('キャンペーンあり')).toBeInTheDocument()
    })

    it('renders discounts checkbox', () => {
      render(<FilterChipsSection {...defaultProps} />)
      expect(screen.getByLabelText('割引あり')).toBeInTheDocument()
    })

    it('renders diaries checkbox', () => {
      render(<FilterChipsSection {...defaultProps} />)
      expect(screen.getByLabelText('写メ日記あり')).toBeInTheDocument()
    })
  })

  describe('checkbox states', () => {
    it('reflects todayOnly state', () => {
      render(<FilterChipsSection {...defaultProps} todayOnly={true} />)
      expect(screen.getByLabelText('本日出勤のみ')).toBeChecked()
    })

    it('reflects promotionsOnly state', () => {
      render(<FilterChipsSection {...defaultProps} promotionsOnly={true} />)
      expect(screen.getByLabelText('キャンペーンあり')).toBeChecked()
    })

    it('reflects discountsOnly state', () => {
      render(<FilterChipsSection {...defaultProps} discountsOnly={true} />)
      expect(screen.getByLabelText('割引あり')).toBeChecked()
    })

    it('reflects diariesOnly state', () => {
      render(<FilterChipsSection {...defaultProps} diariesOnly={true} />)
      expect(screen.getByLabelText('写メ日記あり')).toBeChecked()
    })
  })

  describe('toggle interactions', () => {
    it('calls onToggleToday when today checkbox changes', () => {
      render(<FilterChipsSection {...defaultProps} />)
      fireEvent.click(screen.getByLabelText('本日出勤のみ'))
      expect(defaultProps.onToggleToday).toHaveBeenCalledWith(true)
    })

    it('calls onTogglePromotions when promotions checkbox changes', () => {
      render(<FilterChipsSection {...defaultProps} />)
      fireEvent.click(screen.getByLabelText('キャンペーンあり'))
      expect(defaultProps.onTogglePromotions).toHaveBeenCalledWith(true)
    })

    it('calls onToggleDiscounts when discounts checkbox changes', () => {
      render(<FilterChipsSection {...defaultProps} />)
      fireEvent.click(screen.getByLabelText('割引あり'))
      expect(defaultProps.onToggleDiscounts).toHaveBeenCalledWith(true)
    })

    it('calls onToggleDiaries when diaries checkbox changes', () => {
      render(<FilterChipsSection {...defaultProps} />)
      fireEvent.click(screen.getByLabelText('写メ日記あり'))
      expect(defaultProps.onToggleDiaries).toHaveBeenCalledWith(true)
    })

    it('calls toggle with false when unchecking', () => {
      render(<FilterChipsSection {...defaultProps} todayOnly={true} />)
      fireEvent.click(screen.getByLabelText('本日出勤のみ'))
      expect(defaultProps.onToggleToday).toHaveBeenCalledWith(false)
    })
  })

  describe('styling', () => {
    it('applies default styling when no className provided', () => {
      const { container } = render(<FilterChipsSection {...defaultProps} />)
      const section = container.querySelector('section')
      expect(section).toHaveClass('rounded-[32px]')
    })

    it('applies custom className when provided', () => {
      const { container } = render(
        <FilterChipsSection {...defaultProps} className="custom-class" />,
      )
      const section = container.querySelector('section')
      expect(section).toHaveClass('custom-class')
    })

    it('does not apply default styling when custom className is provided', () => {
      const { container } = render(
        <FilterChipsSection {...defaultProps} className="custom-class" />,
      )
      const section = container.querySelector('section')
      expect(section).not.toHaveClass('rounded-[32px]')
    })

    it('renders gradient background when no custom className', () => {
      const { container } = render(<FilterChipsSection {...defaultProps} />)
      const gradient = container.querySelector('[class*="bg-[radial-gradient"]')
      expect(gradient).toBeInTheDocument()
    })

    it('does not render gradient background with custom className', () => {
      const { container } = render(
        <FilterChipsSection {...defaultProps} className="custom-class" />,
      )
      const gradient = container.querySelector('[class*="bg-[radial-gradient"]')
      expect(gradient).not.toBeInTheDocument()
    })
  })
})
