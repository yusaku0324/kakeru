import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { MenuItem } from '@/features/shops/model'
import { ShopMenusSection } from '@/features/shops/ui/ShopMenusSection'

describe('ShopMenusSection', () => {
  const sampleMenus: MenuItem[] = [
    {
      id: 'menu-1',
      name: 'アロマ 60分',
      price: 12000,
      duration_minutes: 60,
      description: 'リンパメニュー',
      tags: ['アロマ'],
      is_reservable_online: true,
    },
  ]

  it('renders menu rows and triggers callbacks', () => {
    const onUpdateMenu = vi.fn()
    const onAddMenu = vi.fn()
    const onRemoveMenu = vi.fn()

    render(
      <ShopMenusSection
        menus={sampleMenus}
        onUpdateMenu={onUpdateMenu}
        onAddMenu={onAddMenu}
        onRemoveMenu={onRemoveMenu}
      />,
    )

    expect(screen.getAllByTestId('menu-item')).toHaveLength(1)

    fireEvent.change(screen.getAllByPlaceholderText('メニュー名')[0], {
      target: { value: 'ホットストーン' },
    })
    expect(onUpdateMenu).toHaveBeenCalledWith(0, { name: 'ホットストーン' })

    fireEvent.change(screen.getAllByPlaceholderText('価格')[0], { target: { value: '15000' } })
    expect(onUpdateMenu).toHaveBeenCalledWith(0, { price: 15000 })

    fireEvent.click(screen.getByRole('button', { name: 'メニューを追加' }))
    expect(onAddMenu).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getAllByText('削除')[0])
    expect(onRemoveMenu).toHaveBeenCalledWith(0)
  })
})
