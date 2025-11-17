import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ReservationList } from '@/features/reservations/ui/ReservationList'
import type { DashboardReservationItem } from '@/lib/dashboard-reservations'

const baseReservation: DashboardReservationItem = {
  id: 'res-1',
  status: 'pending',
  channel: 'web',
  desired_start: '2025-01-01T09:00:00.000Z',
  desired_end: '2025-01-01T10:00:00.000Z',
  customer_name: 'テスト 太郎',
  customer_phone: '090-0000-0000',
  customer_email: 'test@example.com',
  notes: null,
  marketing_opt_in: false,
  staff_id: null,
  created_at: '2025-01-01T08:00:00.000Z',
  updated_at: '2025-01-01T08:00:00.000Z',
  approval_decision: null,
  approval_decided_at: null,
  approval_decided_by: null,
  reminder_scheduled_at: null,
  preferred_slots: [],
}

describe('ReservationList', () => {
  it('renders empty state when no reservations', () => {
    render(<ReservationList items={[]} conflictIds={new Set()} onSelect={vi.fn()} />)
    expect(screen.getByText('予約はまだありません。')).toBeInTheDocument()
  })

  it('renders reservations and handles selection', () => {
    const selectMock = vi.fn()
    render(
      <ReservationList
        items={[baseReservation]}
        conflictIds={new Set(['res-1'])}
        onSelect={selectMock}
      />,
    )
    expect(screen.getByText('テスト 太郎')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button'))
    expect(selectMock).toHaveBeenCalledWith(baseReservation)
  })
})
