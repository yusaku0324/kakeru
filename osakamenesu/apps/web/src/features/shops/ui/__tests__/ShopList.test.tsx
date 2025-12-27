/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ShopList } from '../ShopList'
import type { ShopSummary } from '@/features/shops/model'

describe('ShopList', () => {
  const mockShops: ShopSummary[] = [
    { id: 'shop-1', name: 'Shop One', area: 'Tokyo', status: 'active', service_type: 'store' },
    { id: 'shop-2', name: 'Shop Two', area: 'Osaka', status: 'inactive', service_type: 'dispatch' },
  ]

  const defaultProps = {
    shops: mockShops,
    selectedId: null,
    isCreating: false,
    onSelectShop: vi.fn(),
    onCreateShop: vi.fn(),
  }

  it('renders shop list header', () => {
    render(<ShopList {...defaultProps} />)
    expect(screen.getByText('店舗一覧')).toBeInTheDocument()
  })

  it('renders create shop button', () => {
    render(<ShopList {...defaultProps} />)
    expect(screen.getByRole('button', { name: '新規' })).toBeInTheDocument()
  })

  it('calls onCreateShop when create button is clicked', async () => {
    const onCreateShop = vi.fn()
    render(<ShopList {...defaultProps} onCreateShop={onCreateShop} />)

    await userEvent.click(screen.getByRole('button', { name: '新規' }))

    expect(onCreateShop).toHaveBeenCalledTimes(1)
  })

  it('renders empty state when no shops', () => {
    render(<ShopList {...defaultProps} shops={[]} />)
    expect(screen.getByText('登録済みの店舗がありません。')).toBeInTheDocument()
  })

  it('renders all shops', () => {
    render(<ShopList {...defaultProps} />)

    expect(screen.getByText('Shop One')).toBeInTheDocument()
    expect(screen.getByText('Shop Two')).toBeInTheDocument()
  })

  it('renders shop area and status', () => {
    render(<ShopList {...defaultProps} />)

    expect(screen.getByText('Tokyo / active')).toBeInTheDocument()
    expect(screen.getByText('Osaka / inactive')).toBeInTheDocument()
  })

  it('calls onSelectShop with shop id when clicked', async () => {
    const onSelectShop = vi.fn()
    render(<ShopList {...defaultProps} onSelectShop={onSelectShop} />)

    await userEvent.click(screen.getByText('Shop One'))

    expect(onSelectShop).toHaveBeenCalledWith('shop-1')
  })

  it('highlights selected shop', () => {
    render(<ShopList {...defaultProps} selectedId="shop-1" />)

    const selectedButton = screen.getByText('Shop One').closest('button')
    expect(selectedButton).toHaveClass('bg-blue-50', 'font-semibold')
  })

  it('does not highlight selected shop when isCreating is true', () => {
    render(<ShopList {...defaultProps} selectedId="shop-1" isCreating />)

    const selectedButton = screen.getByText('Shop One').closest('button')
    expect(selectedButton).not.toHaveClass('bg-blue-50')
  })

  it('does not highlight non-selected shop', () => {
    render(<ShopList {...defaultProps} selectedId="shop-1" />)

    const nonSelectedButton = screen.getByText('Shop Two').closest('button')
    expect(nonSelectedButton).not.toHaveClass('bg-blue-50')
  })
})
