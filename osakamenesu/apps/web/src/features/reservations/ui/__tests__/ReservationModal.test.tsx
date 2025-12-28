import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ReservationModal } from '../ReservationModal'
import type { DashboardReservationItem } from '@/lib/dashboard-reservations'

const mockReservation: DashboardReservationItem = {
  id: 'res-123',
  status: 'pending',
  desired_start: '2024-12-01T10:00:00+09:00',
  desired_end: '2024-12-01T11:00:00+09:00',
  customer_name: '山田太郎',
  customer_phone: '090-1234-5678',
  customer_email: 'yamada@example.com',
  notes: 'テストメモ',
  created_at: '2024-11-30T09:00:00+09:00',
  updated_at: '2024-11-30T09:00:00+09:00',
  preferred_slots: [],
}

describe('ReservationModal', () => {
  const defaultProps = {
    open: true,
    reservation: mockReservation,
    onClose: vi.fn(),
    onApprove: vi.fn().mockResolvedValue(undefined),
    onDecline: vi.fn().mockResolvedValue(undefined),
  }

  it('returns null when open is false', () => {
    const { container } = render(<ReservationModal {...defaultProps} open={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null when reservation is null', () => {
    const { container } = render(<ReservationModal {...defaultProps} reservation={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders modal with reservation details', () => {
    render(<ReservationModal {...defaultProps} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('予約詳細')).toBeInTheDocument()
    expect(screen.getByText('予約ID: res-123')).toBeInTheDocument()
    expect(screen.getByText('山田太郎')).toBeInTheDocument()
  })

  it('displays customer contact info', () => {
    render(<ReservationModal {...defaultProps} />)
    expect(screen.getByText(/090-1234-5678/)).toBeInTheDocument()
    expect(screen.getByText(/yamada@example.com/)).toBeInTheDocument()
  })

  it('displays notes when present', () => {
    render(<ReservationModal {...defaultProps} />)
    expect(screen.getByText('テストメモ')).toBeInTheDocument()
  })

  it('does not show email when not present', () => {
    const reservationWithoutEmail = { ...mockReservation, customer_email: null }
    render(<ReservationModal {...defaultProps} reservation={reservationWithoutEmail} />)
    expect(screen.queryByText(/✉️/)).not.toBeInTheDocument()
  })

  it('does not show notes section when not present', () => {
    const reservationWithoutNotes = { ...mockReservation, notes: null }
    render(<ReservationModal {...defaultProps} reservation={reservationWithoutNotes} />)
    expect(screen.queryByText('メモ')).not.toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<ReservationModal {...defaultProps} onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('予約詳細モーダルを閉じる'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    render(<ReservationModal {...defaultProps} onClose={onClose} />)
    const backdrop = document.querySelector('[aria-hidden="true"]')
    fireEvent.click(backdrop!)
    expect(onClose).toHaveBeenCalled()
  })

  it('displays filter summary when provided', () => {
    render(<ReservationModal {...defaultProps} filterSummary="今日の予約" />)
    expect(screen.getByText(/現在の表示条件: 今日の予約/)).toBeInTheDocument()
  })

  it('handles approve action', async () => {
    const onApprove = vi.fn().mockResolvedValue(undefined)
    render(<ReservationModal {...defaultProps} onApprove={onApprove} />)
    await act(async () => {
      fireEvent.click(screen.getByText('承認する'))
    })
    expect(onApprove).toHaveBeenCalledWith(mockReservation)
  })

  it('handles decline action', async () => {
    const onDecline = vi.fn().mockResolvedValue(undefined)
    render(<ReservationModal {...defaultProps} onDecline={onDecline} />)
    await act(async () => {
      fireEvent.click(screen.getByText('辞退する'))
    })
    expect(onDecline).toHaveBeenCalledWith(mockReservation)
  })

  it('shows loading state during approve', async () => {
    const onApprove = vi.fn(() => new Promise<void>(() => {})) // Never resolves
    render(<ReservationModal {...defaultProps} onApprove={onApprove} />)
    await act(async () => {
      fireEvent.click(screen.getByText('承認する'))
    })
    expect(screen.getByText('承認処理中…')).toBeInTheDocument()
  })

  it('shows loading state during decline', async () => {
    const onDecline = vi.fn(() => new Promise<void>(() => {})) // Never resolves
    render(<ReservationModal {...defaultProps} onDecline={onDecline} />)
    await act(async () => {
      fireEvent.click(screen.getByText('辞退する'))
    })
    expect(screen.getByText('辞退処理中…')).toBeInTheDocument()
  })

  it('handles copy action successfully', async () => {
    const mockClipboard = { writeText: vi.fn().mockResolvedValue(undefined) }
    Object.assign(navigator, { clipboard: mockClipboard })
    render(<ReservationModal {...defaultProps} />)
    await act(async () => {
      fireEvent.click(screen.getByText('詳細をコピー'))
    })
    await waitFor(() => {
      expect(screen.getByText('複製しました')).toBeInTheDocument()
    })
  })

  it('handles copy action failure', async () => {
    const mockClipboard = { writeText: vi.fn().mockRejectedValue(new Error('Failed')) }
    Object.assign(navigator, { clipboard: mockClipboard })
    render(<ReservationModal {...defaultProps} />)
    await act(async () => {
      fireEvent.click(screen.getByText('詳細をコピー'))
    })
    // Should return to idle state after failure
    await waitFor(() => {
      expect(screen.getByText('詳細をコピー')).toBeInTheDocument()
    })
  })

  it('displays preferred slots when present', () => {
    const reservationWithSlots: DashboardReservationItem = {
      ...mockReservation,
      preferred_slots: [
        {
          desired_start: '2024-12-01T10:00:00+09:00',
          desired_end: '2024-12-01T11:00:00+09:00',
          status: 'open',
        },
        {
          desired_start: '2024-12-02T14:00:00+09:00',
          desired_end: '2024-12-02T15:00:00+09:00',
          status: 'tentative',
        },
      ],
    }
    render(<ReservationModal {...defaultProps} reservation={reservationWithSlots} />)
    expect(screen.getByText('候補日時')).toBeInTheDocument()
    expect(screen.getByText(/第1候補/)).toBeInTheDocument()
    expect(screen.getByText(/◎ 予約可/)).toBeInTheDocument()
    expect(screen.getByText(/△ 要確認/)).toBeInTheDocument()
  })

  it('displays blocked slot status', () => {
    const reservationWithBlockedSlot: DashboardReservationItem = {
      ...mockReservation,
      preferred_slots: [
        {
          desired_start: '2024-12-01T10:00:00+09:00',
          desired_end: '2024-12-01T11:00:00+09:00',
          status: 'blocked',
        },
      ],
    }
    render(<ReservationModal {...defaultProps} reservation={reservationWithBlockedSlot} />)
    expect(screen.getByText(/× 予約不可/)).toBeInTheDocument()
  })

  it('handles approve error gracefully', async () => {
    const onApprove = vi.fn().mockRejectedValue(new Error('Approval failed'))
    render(<ReservationModal {...defaultProps} onApprove={onApprove} />)
    await act(async () => {
      fireEvent.click(screen.getByText('承認する'))
    })
    // Should return to idle state after error
    await waitFor(() => {
      expect(screen.getByText('承認する')).toBeInTheDocument()
    })
  })

  it('handles decline error gracefully', async () => {
    const onDecline = vi.fn().mockRejectedValue(new Error('Decline failed'))
    render(<ReservationModal {...defaultProps} onDecline={onDecline} />)
    await act(async () => {
      fireEvent.click(screen.getByText('辞退する'))
    })
    // Should return to idle state after error
    await waitFor(() => {
      expect(screen.getByText('辞退する')).toBeInTheDocument()
    })
  })

  it('disables buttons during action processing', async () => {
    const onApprove = vi.fn(() => new Promise<void>(() => {}))
    render(<ReservationModal {...defaultProps} onApprove={onApprove} />)
    await act(async () => {
      fireEvent.click(screen.getByText('承認する'))
    })
    expect(screen.getByText('辞退する').closest('button')).toBeDisabled()
  })
})
