import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { AvailabilityDay } from '@/features/shops/model'
import { ShopReservationSummary } from '@/features/shops/ui/ShopReservationSummary'

describe('ShopReservationSummary', () => {
  const availability: AvailabilityDay[] = [
    {
      date: '2024-12-01',
      slots: [{ start_at: '2024-12-01T10:00', end_at: '2024-12-01T11:00', status: 'open' }],
    },
  ]

  const defaultProps = {
    availability,
    onAddDay: vi.fn(),
    onDeleteDay: vi.fn(),
    onUpdateDate: vi.fn(),
    onAddSlot: vi.fn(),
    onUpdateSlot: vi.fn(),
    onRemoveSlot: vi.fn(),
    onSaveDay: vi.fn(),
  }

  it('wires reservation actions to callbacks', () => {
    const handlers = {
      onAddDay: vi.fn(),
      onDeleteDay: vi.fn(),
      onUpdateDate: vi.fn(),
      onAddSlot: vi.fn(),
      onUpdateSlot: vi.fn(),
      onRemoveSlot: vi.fn(),
      onSaveDay: vi.fn(),
    }

    render(
      <ShopReservationSummary
        availability={availability}
        onAddDay={handlers.onAddDay}
        onDeleteDay={handlers.onDeleteDay}
        onUpdateDate={handlers.onUpdateDate}
        onAddSlot={handlers.onAddSlot}
        onUpdateSlot={handlers.onUpdateSlot}
        onRemoveSlot={handlers.onRemoveSlot}
        onSaveDay={handlers.onSaveDay}
      />,
    )

    expect(screen.getAllByTestId('availability-day')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: '日を追加' }))
    expect(handlers.onAddDay).toHaveBeenCalled()

    fireEvent.change(screen.getByTestId('availability-date'), { target: { value: '2024-12-02' } })
    expect(handlers.onUpdateDate).toHaveBeenCalledWith(0, '2024-12-02')

    fireEvent.change(screen.getByTestId('slot-start'), { target: { value: '2024-12-01T09:30' } })
    expect(handlers.onUpdateSlot).toHaveBeenCalledWith(0, 0, 'start_at', '2024-12-01T09:30')

    fireEvent.change(screen.getByTestId('slot-status'), { target: { value: 'blocked' } })
    expect(handlers.onUpdateSlot).toHaveBeenCalledWith(0, 0, 'status', 'blocked')

    fireEvent.click(screen.getByTestId('add-slot'))
    expect(handlers.onAddSlot).toHaveBeenCalledWith(0)

    fireEvent.click(screen.getByText('枠を削除'))
    expect(handlers.onRemoveSlot).toHaveBeenCalledWith(0, 0)

    fireEvent.click(screen.getByRole('button', { name: '日を削除' }))
    expect(handlers.onDeleteDay).toHaveBeenCalledWith(0)

    fireEvent.click(screen.getByTestId('save-availability'))
    expect(handlers.onSaveDay).toHaveBeenCalledWith('2024-12-01', availability[0]!.slots)
  })

  it('renders empty message when no availability', () => {
    render(<ShopReservationSummary {...defaultProps} availability={[]} />)
    expect(screen.getByText('登録された空き枠はありません。')).toBeInTheDocument()
  })

  it('renders section header', () => {
    render(<ShopReservationSummary {...defaultProps} />)
    expect(screen.getByText('出勤・空き枠')).toBeInTheDocument()
  })

  it('renders help text', () => {
    render(<ShopReservationSummary {...defaultProps} />)
    expect(screen.getByText(/日付を選び、時間帯とステータスを編集/)).toBeInTheDocument()
  })

  it('renders slot end input change handler', () => {
    const onUpdateSlot = vi.fn()
    render(<ShopReservationSummary {...defaultProps} onUpdateSlot={onUpdateSlot} />)

    fireEvent.change(screen.getByTestId('slot-end'), { target: { value: '2024-12-01T12:00' } })
    expect(onUpdateSlot).toHaveBeenCalledWith(0, 0, 'end_at', '2024-12-01T12:00')
  })

  it('renders multiple days correctly', () => {
    const multiDayAvailability: AvailabilityDay[] = [
      {
        date: '2024-12-01',
        slots: [{ start_at: '2024-12-01T10:00', end_at: '2024-12-01T11:00', status: 'open' }],
      },
      {
        date: '2024-12-02',
        slots: [{ start_at: '2024-12-02T14:00', end_at: '2024-12-02T15:00', status: 'tentative' }],
      },
    ]

    render(<ShopReservationSummary {...defaultProps} availability={multiDayAvailability} />)
    expect(screen.getAllByTestId('availability-day')).toHaveLength(2)
    expect(screen.getAllByTestId('availability-slot')).toHaveLength(2)
  })

  it('handles multiple slots per day', () => {
    const multiSlotAvailability: AvailabilityDay[] = [
      {
        date: '2024-12-01',
        slots: [
          { start_at: '2024-12-01T10:00', end_at: '2024-12-01T11:00', status: 'open' },
          { start_at: '2024-12-01T14:00', end_at: '2024-12-01T15:00', status: 'tentative' },
          { start_at: '2024-12-01T18:00', end_at: '2024-12-01T19:00', status: 'blocked' },
        ],
      },
    ]

    render(<ShopReservationSummary {...defaultProps} availability={multiSlotAvailability} />)
    expect(screen.getAllByTestId('availability-slot')).toHaveLength(3)
    expect(screen.getAllByText('枠を削除')).toHaveLength(3)
  })

  it('renders all status options in select', () => {
    render(<ShopReservationSummary {...defaultProps} />)
    const select = screen.getByTestId('slot-status')
    expect(select.children).toHaveLength(3)
    expect(screen.getByText('空きあり')).toBeInTheDocument()
    expect(screen.getByText('調整中')).toBeInTheDocument()
    expect(screen.getByText('受付停止')).toBeInTheDocument()
  })
})
