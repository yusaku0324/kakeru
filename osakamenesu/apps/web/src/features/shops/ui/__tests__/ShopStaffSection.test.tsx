import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { StaffItem } from '@/features/shops/model'
import { ShopStaffSection } from '@/features/shops/ui/ShopStaffSection'

describe('ShopStaffSection', () => {
  const staff: StaffItem[] = [
    {
      id: 'staff-1',
      name: 'Kana',
      alias: 'かな',
      headline: 'リンパ専門',
      specialties: ['リンパ'],
    },
  ]

  it('renders staff list and handles edits', () => {
    const onUpdateStaff = vi.fn()
    const onAddStaff = vi.fn()
    const onRemoveStaff = vi.fn()

    render(
      <ShopStaffSection
        staff={staff}
        onUpdateStaff={onUpdateStaff}
        onAddStaff={onAddStaff}
        onRemoveStaff={onRemoveStaff}
      />,
    )

    expect(screen.getAllByTestId('staff-item')).toHaveLength(1)

    fireEvent.change(screen.getAllByPlaceholderText('名前')[0], { target: { value: 'Rio' } })
    expect(onUpdateStaff).toHaveBeenCalledWith(0, { name: 'Rio' })

    fireEvent.change(screen.getAllByPlaceholderText('得意分野 (カンマ区切り)')[0], {
      target: { value: 'オイル, ストレッチ' },
    })
    expect(onUpdateStaff).toHaveBeenCalledWith(0, { specialties: ['オイル', 'ストレッチ'] })

    fireEvent.click(screen.getByRole('button', { name: 'スタッフを追加' }))
    expect(onAddStaff).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getAllByText('削除')[0])
    expect(onRemoveStaff).toHaveBeenCalledWith(0)
  })
})
