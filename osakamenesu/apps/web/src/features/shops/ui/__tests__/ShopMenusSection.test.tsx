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

  it('updates duration_minutes', () => {
    const onUpdateMenu = vi.fn()
    render(
      <ShopMenusSection
        menus={sampleMenus}
        onUpdateMenu={onUpdateMenu}
        onAddMenu={vi.fn()}
        onRemoveMenu={vi.fn()}
      />,
    )

    fireEvent.change(screen.getAllByPlaceholderText('時間(分)')[0], {
      target: { value: '90' },
    })
    expect(onUpdateMenu).toHaveBeenCalledWith(0, { duration_minutes: 90 })
  })

  it('clears duration_minutes when empty', () => {
    const onUpdateMenu = vi.fn()
    render(
      <ShopMenusSection
        menus={sampleMenus}
        onUpdateMenu={onUpdateMenu}
        onAddMenu={vi.fn()}
        onRemoveMenu={vi.fn()}
      />,
    )

    fireEvent.change(screen.getAllByPlaceholderText('時間(分)')[0], {
      target: { value: '' },
    })
    expect(onUpdateMenu).toHaveBeenCalledWith(0, { duration_minutes: undefined })
  })

  it('updates description', () => {
    const onUpdateMenu = vi.fn()
    render(
      <ShopMenusSection
        menus={sampleMenus}
        onUpdateMenu={onUpdateMenu}
        onAddMenu={vi.fn()}
        onRemoveMenu={vi.fn()}
      />,
    )

    fireEvent.change(screen.getAllByPlaceholderText('説明')[0], {
      target: { value: '新しい説明文' },
    })
    expect(onUpdateMenu).toHaveBeenCalledWith(0, { description: '新しい説明文' })
  })

  it('updates tags', () => {
    const onUpdateMenu = vi.fn()
    render(
      <ShopMenusSection
        menus={sampleMenus}
        onUpdateMenu={onUpdateMenu}
        onAddMenu={vi.fn()}
        onRemoveMenu={vi.fn()}
      />,
    )

    fireEvent.change(screen.getAllByPlaceholderText('タグ (カンマ区切り)')[0], {
      target: { value: 'アロマ, ボディ, リラックス' },
    })
    expect(onUpdateMenu).toHaveBeenCalledWith(0, {
      tags: ['アロマ', 'ボディ', 'リラックス'],
    })
  })

  it('filters empty tags', () => {
    const onUpdateMenu = vi.fn()
    render(
      <ShopMenusSection
        menus={sampleMenus}
        onUpdateMenu={onUpdateMenu}
        onAddMenu={vi.fn()}
        onRemoveMenu={vi.fn()}
      />,
    )

    fireEvent.change(screen.getAllByPlaceholderText('タグ (カンマ区切り)')[0], {
      target: { value: 'アロマ, , ボディ, ' },
    })
    expect(onUpdateMenu).toHaveBeenCalledWith(0, {
      tags: ['アロマ', 'ボディ'],
    })
  })

  it('renders multiple menus', () => {
    const multipleMenus: MenuItem[] = [
      { id: 'menu-1', name: 'メニュー1', price: 10000 },
      { id: 'menu-2', name: 'メニュー2', price: 15000 },
      { id: 'menu-3', name: 'メニュー3', price: 20000 },
    ]

    render(
      <ShopMenusSection
        menus={multipleMenus}
        onUpdateMenu={vi.fn()}
        onAddMenu={vi.fn()}
        onRemoveMenu={vi.fn()}
      />,
    )

    expect(screen.getAllByTestId('menu-item')).toHaveLength(3)
  })

  it('renders empty state', () => {
    render(
      <ShopMenusSection
        menus={[]}
        onUpdateMenu={vi.fn()}
        onAddMenu={vi.fn()}
        onRemoveMenu={vi.fn()}
      />,
    )

    expect(screen.queryAllByTestId('menu-item')).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'メニューを追加' })).toBeInTheDocument()
  })

  it('handles menu without tags', () => {
    const menuWithoutTags: MenuItem[] = [
      { id: 'menu-1', name: 'メニュー1', price: 10000 },
    ]

    render(
      <ShopMenusSection
        menus={menuWithoutTags}
        onUpdateMenu={vi.fn()}
        onAddMenu={vi.fn()}
        onRemoveMenu={vi.fn()}
      />,
    )

    const tagsInput = screen.getAllByPlaceholderText('タグ (カンマ区切り)')[0] as HTMLInputElement
    expect(tagsInput.value).toBe('')
  })
})
