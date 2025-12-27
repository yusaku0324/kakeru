/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActiveFilterBadges, type FilterBadge } from '../ActiveFilterBadges'

describe('ActiveFilterBadges', () => {
  it('renders nothing when badges array is empty', () => {
    const { container } = render(<ActiveFilterBadges badges={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders badges when provided', () => {
    const badges: FilterBadge[] = [
      { key: '1', label: 'Filter 1', onRemove: vi.fn() },
      { key: '2', label: 'Filter 2', onRemove: vi.fn() },
    ]

    render(<ActiveFilterBadges badges={badges} />)

    expect(screen.getByText('Filter 1')).toBeInTheDocument()
    expect(screen.getByText('Filter 2')).toBeInTheDocument()
  })

  it('calls onRemove when remove button is clicked', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    const badges: FilterBadge[] = [
      { key: '1', label: 'Filter 1', onRemove },
    ]

    render(<ActiveFilterBadges badges={badges} />)

    const removeButton = screen.getByRole('button', { name: 'Filter 1を解除' })
    await user.click(removeButton)

    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it('stops propagation when remove button is clicked', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    const parentClick = vi.fn()
    const badges: FilterBadge[] = [
      { key: '1', label: 'Filter 1', onRemove },
    ]

    render(
      <div onClick={parentClick}>
        <ActiveFilterBadges badges={badges} />
      </div>
    )

    const removeButton = screen.getByRole('button', { name: 'Filter 1を解除' })
    await user.click(removeButton)

    expect(onRemove).toHaveBeenCalled()
    expect(parentClick).not.toHaveBeenCalled()
  })

  it('applies custom className', () => {
    const badges: FilterBadge[] = [
      { key: '1', label: 'Filter 1', onRemove: vi.fn() },
    ]

    render(<ActiveFilterBadges badges={badges} className="custom-class" />)

    const container = screen.getByRole('list')
    expect(container).toHaveClass('custom-class')
  })

  it('has correct accessibility attributes', () => {
    const badges: FilterBadge[] = [
      { key: '1', label: 'Filter 1', onRemove: vi.fn() },
    ]

    render(<ActiveFilterBadges badges={badges} />)

    const list = screen.getByRole('list')
    expect(list).toHaveAttribute('aria-label', '適用中のフィルター')

    const listItem = screen.getByRole('listitem')
    expect(listItem).toBeInTheDocument()
  })

  it('renders multiple badges with unique keys', () => {
    const badges: FilterBadge[] = [
      { key: 'area', label: '渋谷', onRemove: vi.fn() },
      { key: 'price', label: '5000円以上', onRemove: vi.fn() },
      { key: 'style', label: 'リラックス', onRemove: vi.fn() },
    ]

    render(<ActiveFilterBadges badges={badges} />)

    expect(screen.getByText('渋谷')).toBeInTheDocument()
    expect(screen.getByText('5000円以上')).toBeInTheDocument()
    expect(screen.getByText('リラックス')).toBeInTheDocument()
  })

  it('calls correct onRemove for each badge', async () => {
    const user = userEvent.setup()
    const onRemove1 = vi.fn()
    const onRemove2 = vi.fn()
    const badges: FilterBadge[] = [
      { key: '1', label: 'Filter 1', onRemove: onRemove1 },
      { key: '2', label: 'Filter 2', onRemove: onRemove2 },
    ]

    render(<ActiveFilterBadges badges={badges} />)

    await user.click(screen.getByRole('button', { name: 'Filter 2を解除' }))

    expect(onRemove1).not.toHaveBeenCalled()
    expect(onRemove2).toHaveBeenCalledTimes(1)
  })
})
