/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilterSummaryBar, type FilterBadgeData } from '../FilterSummaryBar'

describe('FilterSummaryBar', () => {
  const defaultProps = {
    badges: [] as FilterBadgeData[],
    isFilterOpen: false,
    onToggleFilter: vi.fn(),
  }

  it('renders "すべて表示中" when no badges', () => {
    render(<FilterSummaryBar {...defaultProps} />)

    expect(screen.getByText('すべて表示中')).toBeInTheDocument()
  })

  it('renders badges when provided', () => {
    const badges: FilterBadgeData[] = [
      { key: '1', label: 'Filter 1' },
      { key: '2', label: 'Filter 2' },
    ]

    render(<FilterSummaryBar {...defaultProps} badges={badges} />)

    expect(screen.getByText('現在の条件:')).toBeInTheDocument()
    expect(screen.getByText('Filter 1')).toBeInTheDocument()
    expect(screen.getByText('Filter 2')).toBeInTheDocument()
  })

  it('shows "+N件" when more than 4 badges', () => {
    const badges: FilterBadgeData[] = [
      { key: '1', label: 'Badge 1' },
      { key: '2', label: 'Badge 2' },
      { key: '3', label: 'Badge 3' },
      { key: '4', label: 'Badge 4' },
      { key: '5', label: 'Badge 5' },
      { key: '6', label: 'Badge 6' },
    ]

    render(<FilterSummaryBar {...defaultProps} badges={badges} />)

    expect(screen.getByText('+2件')).toBeInTheDocument()
  })

  it('shows remove button when onRemove is provided', () => {
    const onRemove = vi.fn()
    const badges: FilterBadgeData[] = [
      { key: '1', label: 'Filter 1', onRemove },
    ]

    render(<FilterSummaryBar {...defaultProps} badges={badges} />)

    const removeButton = screen.getByRole('button', { name: 'Filter 1を解除' })
    expect(removeButton).toBeInTheDocument()
  })

  it('calls onRemove when remove button is clicked', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    const badges: FilterBadgeData[] = [
      { key: '1', label: 'Filter 1', onRemove },
    ]

    render(<FilterSummaryBar {...defaultProps} badges={badges} />)

    await user.click(screen.getByRole('button', { name: 'Filter 1を解除' }))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it('calls onToggleFilter when filter button is clicked', async () => {
    const user = userEvent.setup()
    const onToggleFilter = vi.fn()

    render(<FilterSummaryBar {...defaultProps} onToggleFilter={onToggleFilter} />)

    const filterButton = screen.getByRole('button', { name: /フィルター/i })
    await user.click(filterButton)
    expect(onToggleFilter).toHaveBeenCalledTimes(1)
  })

  it('shows result count when provided', () => {
    render(
      <FilterSummaryBar
        {...defaultProps}
        resultCount={100}
      />
    )

    expect(screen.getByText(/100/)).toBeInTheDocument()
    expect(screen.getByText(/件/)).toBeInTheDocument()
  })

  it('uses custom resultUnit', () => {
    render(
      <FilterSummaryBar
        {...defaultProps}
        resultCount={50}
        resultUnit="人"
      />
    )

    expect(screen.getByText(/50/)).toBeInTheDocument()
    expect(screen.getByText(/人/)).toBeInTheDocument()
  })

  it('formats large numbers with Japanese formatting', () => {
    render(
      <FilterSummaryBar
        {...defaultProps}
        resultCount={12345}
      />
    )

    expect(screen.getByText(/12,345/)).toBeInTheDocument()
  })

  it('shows clear button when badges exist and onClearAll is provided', () => {
    const onClearAll = vi.fn()
    const badges: FilterBadgeData[] = [
      { key: '1', label: 'Filter 1' },
    ]

    render(
      <FilterSummaryBar
        {...defaultProps}
        badges={badges}
        onClearAll={onClearAll}
      />
    )

    expect(screen.getByRole('button', { name: /クリア/i })).toBeInTheDocument()
  })

  it('calls onClearAll when clear button is clicked', async () => {
    const user = userEvent.setup()
    const onClearAll = vi.fn()
    const badges: FilterBadgeData[] = [
      { key: '1', label: 'Filter 1' },
    ]

    render(
      <FilterSummaryBar
        {...defaultProps}
        badges={badges}
        onClearAll={onClearAll}
      />
    )

    await user.click(screen.getByRole('button', { name: /クリア/i }))
    expect(onClearAll).toHaveBeenCalledTimes(1)
  })

  it('does not show clear button when no badges', () => {
    render(
      <FilterSummaryBar
        {...defaultProps}
        badges={[]}
        onClearAll={vi.fn()}
      />
    )

    expect(screen.queryByRole('button', { name: /クリア/i })).not.toBeInTheDocument()
  })

  it('applies sticky styling when sticky is true', () => {
    const { container } = render(
      <FilterSummaryBar {...defaultProps} sticky={true} />
    )

    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveClass('sticky')
    expect(wrapper).toHaveClass('top-0')
  })

  it('applies custom className', () => {
    const { container } = render(
      <FilterSummaryBar {...defaultProps} className="custom-class" />
    )

    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveClass('custom-class')
  })

  it('shows different styling when filter is open', () => {
    render(<FilterSummaryBar {...defaultProps} isFilterOpen={true} />)

    const filterButton = screen.getByRole('button', { name: /フィルター/i })
    expect(filterButton).toHaveClass('bg-brand-primary')
    expect(filterButton).toHaveClass('text-white')
  })

  it('shows different styling when filter is closed', () => {
    render(<FilterSummaryBar {...defaultProps} isFilterOpen={false} />)

    const filterButton = screen.getByRole('button', { name: /フィルター/i })
    expect(filterButton).toHaveClass('bg-white')
    expect(filterButton).toHaveClass('text-neutral-700')
  })

  it('does not show remove button when onRemove is not provided', () => {
    const badges: FilterBadgeData[] = [
      { key: '1', label: 'Filter 1' },
    ]

    render(<FilterSummaryBar {...defaultProps} badges={badges} />)

    expect(screen.queryByRole('button', { name: 'Filter 1を解除' })).not.toBeInTheDocument()
  })

  it('stops propagation when badge remove button is clicked', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    const parentClick = vi.fn()
    const badges: FilterBadgeData[] = [
      { key: '1', label: 'Filter 1', onRemove },
    ]

    render(
      <div onClick={parentClick}>
        <FilterSummaryBar {...defaultProps} badges={badges} />
      </div>
    )

    await user.click(screen.getByRole('button', { name: 'Filter 1を解除' }))
    expect(onRemove).toHaveBeenCalled()
    expect(parentClick).not.toHaveBeenCalled()
  })
})
