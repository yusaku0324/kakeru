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
})
