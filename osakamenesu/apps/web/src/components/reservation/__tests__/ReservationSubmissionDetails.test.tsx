import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import ReservationSubmissionDetails from '../ReservationSubmissionDetails'

// Mock the ReservationContactBar
vi.mock('../../ReservationContactBar', () => ({
  default: function MockContactBar() {
    return <div data-testid="contact-bar">ContactBar</div>
  },
}))

describe('ReservationSubmissionDetails', () => {
  const defaultProps = {
    contactCount: 0,
    lastSuccess: null,
    lastReservationId: null,
    shopId: 'shop-1',
    tel: null,
    lineId: null,
    shopName: null,
    lastPayload: null,
    summaryText: null,
    copySummary: vi.fn().mockResolvedValue(true),
    canSubmit: true,
    hasContactChannels: false,
  }

  it('shows waiting message when no previous submission', () => {
    render(<ReservationSubmissionDetails {...defaultProps} />)
    expect(screen.getByText(/店舗からの折り返しをお待ちください/)).toBeInTheDocument()
  })

  it('shows last submission time when there is previous submission', () => {
    const lastSuccess = new Date('2024-12-01T10:00:00')
    render(
      <ReservationSubmissionDetails
        {...defaultProps}
        contactCount={1}
        lastSuccess={lastSuccess}
      />,
    )
    expect(screen.getByText(/直近の送信:/)).toBeInTheDocument()
  })

  it('shows thank you page link when reservation id exists', () => {
    const lastSuccess = new Date('2024-12-01T10:00:00')
    render(
      <ReservationSubmissionDetails
        {...defaultProps}
        contactCount={1}
        lastSuccess={lastSuccess}
        lastReservationId="res-123"
      />,
    )
    const link = screen.getByRole('link', { name: 'サンクスページを見る' })
    expect(link).toHaveAttribute('href', '/thank-you?reservation=res-123&shop=shop-1')
  })

  it('shows summary text when provided', () => {
    render(
      <ReservationSubmissionDetails
        {...defaultProps}
        summaryText="Test summary content"
      />,
    )
    expect(screen.getByText('送信内容メモ')).toBeInTheDocument()
    expect(screen.getByText('Test summary content')).toBeInTheDocument()
  })

  it('calls copySummary and shows copied state when copy button is clicked', async () => {
    const copySummary = vi.fn().mockResolvedValue(true)
    render(
      <ReservationSubmissionDetails
        {...defaultProps}
        summaryText="Test summary"
        copySummary={copySummary}
      />,
    )
    const copyButton = screen.getByRole('button', { name: 'コピーする' })
    await act(async () => {
      fireEvent.click(copyButton)
    })
    expect(copySummary).toHaveBeenCalled()
    expect(screen.getByText('コピーしました')).toBeInTheDocument()
  })

  it('does not change state when copySummary fails', async () => {
    const copySummary = vi.fn().mockResolvedValue(false)
    render(
      <ReservationSubmissionDetails
        {...defaultProps}
        summaryText="Test summary"
        copySummary={copySummary}
      />,
    )
    const copyButton = screen.getByRole('button', { name: 'コピーする' })
    await act(async () => {
      fireEvent.click(copyButton)
    })
    expect(screen.getByText('コピーする')).toBeInTheDocument()
  })

  it('resets copy state after timeout', async () => {
    vi.useFakeTimers()
    const copySummary = vi.fn().mockResolvedValue(true)
    render(
      <ReservationSubmissionDetails
        {...defaultProps}
        summaryText="Test summary"
        copySummary={copySummary}
      />,
    )
    const copyButton = screen.getByRole('button', { name: 'コピーする' })
    await act(async () => {
      fireEvent.click(copyButton)
    })
    expect(screen.getByText('コピーしました')).toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByText('コピーする')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('shows contact bar when hasContactChannels is true', () => {
    render(
      <ReservationSubmissionDetails
        {...defaultProps}
        hasContactChannels={true}
      />,
    )
    expect(screen.getByTestId('contact-bar')).toBeInTheDocument()
  })

  it('does not show contact bar when hasContactChannels is false', () => {
    render(<ReservationSubmissionDetails {...defaultProps} hasContactChannels={false} />)
    expect(screen.queryByTestId('contact-bar')).not.toBeInTheDocument()
  })

  it('shows demo warning when canSubmit is false', () => {
    render(<ReservationSubmissionDetails {...defaultProps} canSubmit={false} />)
    expect(screen.getByText(/この店舗はデモデータのため/)).toBeInTheDocument()
  })

  it('does not show demo warning when canSubmit is true', () => {
    render(<ReservationSubmissionDetails {...defaultProps} canSubmit={true} />)
    expect(screen.queryByText(/この店舗はデモデータのため/)).not.toBeInTheDocument()
  })
})
