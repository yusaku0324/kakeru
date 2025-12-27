/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuickFilters } from '../QuickFilters'

describe('QuickFilters', () => {
  const defaultProps = {
    todayOnly: false,
    onToggleToday: vi.fn(),
    promotionsOnly: false,
    onTogglePromotions: vi.fn(),
  }

  it('renders today only and promotions filters by default', () => {
    render(<QuickFilters {...defaultProps} />)

    expect(screen.getByRole('button', { name: /本日空きあり/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /キャンペーン中/i })).toBeInTheDocument()
  })

  it('toggles today filter when clicked', async () => {
    const user = userEvent.setup()
    const onToggleToday = vi.fn()

    render(
      <QuickFilters
        {...defaultProps}
        todayOnly={false}
        onToggleToday={onToggleToday}
      />
    )

    await user.click(screen.getByRole('button', { name: /本日空きあり/i }))
    expect(onToggleToday).toHaveBeenCalledWith(true)
  })

  it('toggles promotions filter when clicked', async () => {
    const user = userEvent.setup()
    const onTogglePromotions = vi.fn()

    render(
      <QuickFilters
        {...defaultProps}
        promotionsOnly={false}
        onTogglePromotions={onTogglePromotions}
      />
    )

    await user.click(screen.getByRole('button', { name: /キャンペーン中/i }))
    expect(onTogglePromotions).toHaveBeenCalledWith(true)
  })

  it('toggles off when already active', async () => {
    const user = userEvent.setup()
    const onToggleToday = vi.fn()

    render(
      <QuickFilters
        {...defaultProps}
        todayOnly={true}
        onToggleToday={onToggleToday}
      />
    )

    await user.click(screen.getByRole('button', { name: /本日空きあり/i }))
    expect(onToggleToday).toHaveBeenCalledWith(false)
  })

  it('shows discounts filter when onToggleDiscounts is provided', () => {
    render(
      <QuickFilters
        {...defaultProps}
        discountsOnly={false}
        onToggleDiscounts={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /割引あり/i })).toBeInTheDocument()
  })

  it('does not show discounts filter when onToggleDiscounts is not provided', () => {
    render(<QuickFilters {...defaultProps} />)

    expect(screen.queryByRole('button', { name: /割引あり/i })).not.toBeInTheDocument()
  })

  it('toggles discounts filter when clicked', async () => {
    const user = userEvent.setup()
    const onToggleDiscounts = vi.fn()

    render(
      <QuickFilters
        {...defaultProps}
        discountsOnly={false}
        onToggleDiscounts={onToggleDiscounts}
      />
    )

    await user.click(screen.getByRole('button', { name: /割引あり/i }))
    expect(onToggleDiscounts).toHaveBeenCalledWith(true)
  })

  it('shows diaries filter when onToggleDiaries is provided', () => {
    render(
      <QuickFilters
        {...defaultProps}
        diariesOnly={false}
        onToggleDiaries={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /写メ日記あり/i })).toBeInTheDocument()
  })

  it('does not show diaries filter when onToggleDiaries is not provided', () => {
    render(<QuickFilters {...defaultProps} />)

    expect(screen.queryByRole('button', { name: /写メ日記あり/i })).not.toBeInTheDocument()
  })

  it('toggles diaries filter when clicked', async () => {
    const user = userEvent.setup()
    const onToggleDiaries = vi.fn()

    render(
      <QuickFilters
        {...defaultProps}
        diariesOnly={false}
        onToggleDiaries={onToggleDiaries}
      />
    )

    await user.click(screen.getByRole('button', { name: /写メ日記あり/i }))
    expect(onToggleDiaries).toHaveBeenCalledWith(true)
  })

  it('applies custom className', () => {
    const { container } = render(
      <QuickFilters {...defaultProps} className="custom-class" />
    )

    const wrapper = container.querySelector('.custom-class')
    expect(wrapper).toBeInTheDocument()
  })

  it('shows aria-pressed attribute based on active state', () => {
    render(
      <QuickFilters
        {...defaultProps}
        todayOnly={true}
        promotionsOnly={false}
      />
    )

    const todayButton = screen.getByRole('button', { name: /本日空きあり/i })
    const promotionsButton = screen.getByRole('button', { name: /キャンペーン中/i })

    expect(todayButton).toHaveAttribute('aria-pressed', 'true')
    expect(promotionsButton).toHaveAttribute('aria-pressed', 'false')
  })

  it('renders all four filters when all handlers are provided', () => {
    render(
      <QuickFilters
        {...defaultProps}
        discountsOnly={false}
        onToggleDiscounts={vi.fn()}
        diariesOnly={false}
        onToggleDiaries={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /本日空きあり/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /キャンペーン中/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /割引あり/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /写メ日記あり/i })).toBeInTheDocument()
  })

  it('handles undefined optional boolean props', () => {
    render(
      <QuickFilters
        {...defaultProps}
        discountsOnly={undefined}
        onToggleDiscounts={vi.fn()}
      />
    )

    const discountsButton = screen.getByRole('button', { name: /割引あり/i })
    expect(discountsButton).toHaveAttribute('aria-pressed', 'false')
  })
})
