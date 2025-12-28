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

    fireEvent.change(screen.getByLabelText('雰囲気タグ'), { target: { value: 'calm' } })
    expect(onUpdateStaff).toHaveBeenCalledWith(0, { mood_tag: 'calm' })

    fireEvent.change(screen.getByPlaceholderText('趣味タグを入力して追加'), {
      target: { value: '映画' },
    })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    expect(onUpdateStaff).toHaveBeenCalledWith(0, { hobby_tags: ['映画'] })

    fireEvent.click(screen.getByRole('button', { name: 'スタッフを追加' }))
    expect(onAddStaff).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getAllByText('削除')[0])
    expect(onRemoveStaff).toHaveBeenCalledWith(0)
  })

  it('updates alias field', () => {
    const onUpdateStaff = vi.fn()
    render(
      <ShopStaffSection
        staff={staff}
        onUpdateStaff={onUpdateStaff}
        onAddStaff={vi.fn()}
        onRemoveStaff={vi.fn()}
      />,
    )

    fireEvent.change(screen.getAllByPlaceholderText('表示名')[0], {
      target: { value: '新しい表示名' },
    })
    expect(onUpdateStaff).toHaveBeenCalledWith(0, { alias: '新しい表示名' })
  })

  it('updates headline field', () => {
    const onUpdateStaff = vi.fn()
    render(
      <ShopStaffSection
        staff={staff}
        onUpdateStaff={onUpdateStaff}
        onAddStaff={vi.fn()}
        onRemoveStaff={vi.fn()}
      />,
    )

    fireEvent.change(screen.getAllByPlaceholderText('紹介文')[0], {
      target: { value: '新しい紹介文' },
    })
    expect(onUpdateStaff).toHaveBeenCalledWith(0, { headline: '新しい紹介文' })
  })

  it('clears select value when empty is selected', () => {
    const onUpdateStaff = vi.fn()
    render(
      <ShopStaffSection
        staff={staff}
        onUpdateStaff={onUpdateStaff}
        onAddStaff={vi.fn()}
        onRemoveStaff={vi.fn()}
      />,
    )

    // Set a value first, then clear it
    fireEvent.change(screen.getByLabelText('雰囲気タグ'), { target: { value: '' } })
    expect(onUpdateStaff).toHaveBeenCalledWith(0, { mood_tag: null })
  })

  it('updates style_tag select field', () => {
    const onUpdateStaff = vi.fn()
    render(
      <ShopStaffSection
        staff={staff}
        onUpdateStaff={onUpdateStaff}
        onAddStaff={vi.fn()}
        onRemoveStaff={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText('施術スタイル'), { target: { value: 'strong' } })
    expect(onUpdateStaff).toHaveBeenCalledWith(0, { style_tag: 'strong' })
  })

  it('updates look_type select field', () => {
    const onUpdateStaff = vi.fn()
    render(
      <ShopStaffSection
        staff={staff}
        onUpdateStaff={onUpdateStaff}
        onAddStaff={vi.fn()}
        onRemoveStaff={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText('第一印象のタイプ'), { target: { value: 'cute' } })
    expect(onUpdateStaff).toHaveBeenCalledWith(0, { look_type: 'cute' })
  })

  it('updates contact_style select field', () => {
    const onUpdateStaff = vi.fn()
    render(
      <ShopStaffSection
        staff={staff}
        onUpdateStaff={onUpdateStaff}
        onAddStaff={vi.fn()}
        onRemoveStaff={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText('距離感スタイル'), { target: { value: 'relaxed' } })
    expect(onUpdateStaff).toHaveBeenCalledWith(0, { contact_style: 'relaxed' })
  })

  it('updates talk_level select field', () => {
    const onUpdateStaff = vi.fn()
    render(
      <ShopStaffSection
        staff={staff}
        onUpdateStaff={onUpdateStaff}
        onAddStaff={vi.fn()}
        onRemoveStaff={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText('会話のテンポ'), { target: { value: 'quiet' } })
    expect(onUpdateStaff).toHaveBeenCalledWith(0, { talk_level: 'quiet' })
  })

  it('adds hobby tag with Enter key', () => {
    const onUpdateStaff = vi.fn()
    render(
      <ShopStaffSection
        staff={staff}
        onUpdateStaff={onUpdateStaff}
        onAddStaff={vi.fn()}
        onRemoveStaff={vi.fn()}
      />,
    )

    const input = screen.getByPlaceholderText('趣味タグを入力して追加')
    fireEvent.change(input, { target: { value: 'カフェ巡り' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onUpdateStaff).toHaveBeenCalledWith(0, { hobby_tags: ['カフェ巡り'] })
  })

  it('does not add duplicate hobby tag', () => {
    const staffWithHobbies: StaffItem[] = [
      {
        id: 'staff-1',
        name: 'Kana',
        hobby_tags: ['映画'],
      },
    ]
    const onUpdateStaff = vi.fn()
    render(
      <ShopStaffSection
        staff={staffWithHobbies}
        onUpdateStaff={onUpdateStaff}
        onAddStaff={vi.fn()}
        onRemoveStaff={vi.fn()}
      />,
    )

    const input = screen.getByPlaceholderText('趣味タグを入力して追加')
    fireEvent.change(input, { target: { value: '映画' } })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))

    // Should not call onUpdateStaff because it's a duplicate
    expect(onUpdateStaff).not.toHaveBeenCalled()
  })

  it('does not add empty hobby tag', () => {
    const onUpdateStaff = vi.fn()
    render(
      <ShopStaffSection
        staff={staff}
        onUpdateStaff={onUpdateStaff}
        onAddStaff={vi.fn()}
        onRemoveStaff={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    expect(onUpdateStaff).not.toHaveBeenCalled()
  })

  it('removes hobby tag', () => {
    const staffWithHobbies: StaffItem[] = [
      {
        id: 'staff-1',
        name: 'Kana',
        hobby_tags: ['映画', 'カフェ巡り'],
      },
    ]
    const onUpdateStaff = vi.fn()
    render(
      <ShopStaffSection
        staff={staffWithHobbies}
        onUpdateStaff={onUpdateStaff}
        onAddStaff={vi.fn()}
        onRemoveStaff={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '映画 を削除' }))
    expect(onUpdateStaff).toHaveBeenCalledWith(0, { hobby_tags: ['カフェ巡り'] })
  })

  it('displays existing hobby tags', () => {
    const staffWithHobbies: StaffItem[] = [
      {
        id: 'staff-1',
        name: 'Kana',
        hobby_tags: ['映画', 'カフェ巡り', 'スポーツ観戦'],
      },
    ]
    render(
      <ShopStaffSection
        staff={staffWithHobbies}
        onUpdateStaff={vi.fn()}
        onAddStaff={vi.fn()}
        onRemoveStaff={vi.fn()}
      />,
    )

    expect(screen.getByText('映画')).toBeInTheDocument()
    expect(screen.getByText('カフェ巡り')).toBeInTheDocument()
    expect(screen.getByText('スポーツ観戦')).toBeInTheDocument()
  })

  it('shows placeholder when no hobby tags', () => {
    render(
      <ShopStaffSection
        staff={staff}
        onUpdateStaff={vi.fn()}
        onAddStaff={vi.fn()}
        onRemoveStaff={vi.fn()}
      />,
    )

    expect(screen.getByText(/例: 映画 \/ カフェ巡り \/ スポーツ観戦/)).toBeInTheDocument()
  })

  it('renders multiple staff members', () => {
    const multipleStaff: StaffItem[] = [
      { id: 'staff-1', name: 'Kana' },
      { id: 'staff-2', name: 'Rio' },
      { id: 'staff-3', name: 'Mio' },
    ]
    render(
      <ShopStaffSection
        staff={multipleStaff}
        onUpdateStaff={vi.fn()}
        onAddStaff={vi.fn()}
        onRemoveStaff={vi.fn()}
      />,
    )

    expect(screen.getAllByTestId('staff-item')).toHaveLength(3)
  })

  it('renders empty state', () => {
    render(
      <ShopStaffSection
        staff={[]}
        onUpdateStaff={vi.fn()}
        onAddStaff={vi.fn()}
        onRemoveStaff={vi.fn()}
      />,
    )

    expect(screen.queryAllByTestId('staff-item')).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'スタッフを追加' })).toBeInTheDocument()
  })
})
