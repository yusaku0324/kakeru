import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ReservationScheduleHeader } from '../ReservationScheduleHeader'

describe('ReservationScheduleHeader', () => {
  const defaultProps = {
    scheduleRangeLabel: '12/1 - 12/7',
    currentMonthLabel: '2024年12月',
    schedulePage: 0,
    schedulePageCount: 4,
    canGoPrev: true,
    canGoNext: false,
    onPrev: vi.fn(),
    onNext: vi.fn(),
    onReset: vi.fn(),
    hasAvailability: true,
  }

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders schedule range label', () => {
    render(<ReservationScheduleHeader {...defaultProps} />)
    expect(screen.getByText('12/1 - 12/7')).toBeInTheDocument()
  })

  it('renders current month label', () => {
    render(<ReservationScheduleHeader {...defaultProps} />)
    expect(screen.getByText('2024年12月')).toBeInTheDocument()
  })

  it('shows "公開枠あり" when hasAvailability is true', () => {
    render(<ReservationScheduleHeader {...defaultProps} hasAvailability={true} />)
    expect(screen.getByText(/公開枠あり/)).toBeInTheDocument()
  })

  it('shows "お問い合わせで調整" when hasAvailability is false', () => {
    render(<ReservationScheduleHeader {...defaultProps} hasAvailability={false} />)
    expect(screen.getByText(/お問い合わせで調整/)).toBeInTheDocument()
  })

  it('calls onPrev when previous button is clicked', () => {
    const onPrev = vi.fn()
    render(<ReservationScheduleHeader {...defaultProps} canGoPrev={false} onPrev={onPrev} />)
    fireEvent.click(screen.getByLabelText('前の週を表示'))
    expect(onPrev).toHaveBeenCalled()
  })

  it('calls onNext when next button is clicked', () => {
    const onNext = vi.fn()
    render(<ReservationScheduleHeader {...defaultProps} canGoNext={false} onNext={onNext} />)
    fireEvent.click(screen.getByLabelText('次の週を表示'))
    expect(onNext).toHaveBeenCalled()
  })

  it('calls onReset when reset button is clicked', () => {
    const onReset = vi.fn()
    render(<ReservationScheduleHeader {...defaultProps} canGoPrev={false} onReset={onReset} />)
    fireEvent.click(screen.getByText('今週'))
    expect(onReset).toHaveBeenCalled()
  })

  it('disables prev button when canGoPrev is true', () => {
    render(<ReservationScheduleHeader {...defaultProps} canGoPrev={true} />)
    expect(screen.getByLabelText('前の週を表示')).toBeDisabled()
  })

  it('disables next button when canGoNext is true', () => {
    render(<ReservationScheduleHeader {...defaultProps} canGoNext={true} />)
    expect(screen.getByLabelText('次の週を表示')).toBeDisabled()
  })

  it('shows page indicator', () => {
    render(<ReservationScheduleHeader {...defaultProps} schedulePage={1} schedulePageCount={4} />)
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      '4週中2週目を表示中',
    )
  })

  it('shows refreshing spinner when isRefreshing is true', () => {
    render(<ReservationScheduleHeader {...defaultProps} isRefreshing={true} />)
    expect(screen.getByText('更新中')).toBeInTheDocument()
  })

  it('shows refresh button when onRefresh is provided and not refreshing', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    render(<ReservationScheduleHeader {...defaultProps} onRefresh={onRefresh} />)
    expect(screen.getByLabelText('空き状況を更新')).toBeInTheDocument()
  })

  it('calls onRefresh when refresh button is clicked', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    render(<ReservationScheduleHeader {...defaultProps} onRefresh={onRefresh} />)
    await act(async () => {
      fireEvent.click(screen.getByLabelText('空き状況を更新'))
    })
    expect(onRefresh).toHaveBeenCalled()
  })

  it('shows "たった今" for recent refresh', () => {
    const now = Date.now()
    render(
      <ReservationScheduleHeader
        {...defaultProps}
        lastRefreshAt={now}
        onRefresh={vi.fn()}
      />,
    )
    expect(screen.getByText('たった今')).toBeInTheDocument()
  })

  it('shows seconds ago for refresh within a minute', () => {
    const now = Date.now()
    render(
      <ReservationScheduleHeader
        {...defaultProps}
        lastRefreshAt={now - 30000}
        onRefresh={vi.fn()}
      />,
    )
    expect(screen.getByText('30秒前')).toBeInTheDocument()
  })

  it('shows minutes ago for refresh within an hour', () => {
    const now = Date.now()
    render(
      <ReservationScheduleHeader
        {...defaultProps}
        lastRefreshAt={now - 300000}
        onRefresh={vi.fn()}
      />,
    )
    expect(screen.getByText('5分前')).toBeInTheDocument()
  })

  it('shows "1時間以上前" for old refresh', () => {
    const now = Date.now()
    render(
      <ReservationScheduleHeader
        {...defaultProps}
        lastRefreshAt={now - 3600000}
        onRefresh={vi.fn()}
      />,
    )
    expect(screen.getByText('1時間以上前')).toBeInTheDocument()
  })

  it('updates relative time every 10 seconds', () => {
    const now = Date.now()
    vi.setSystemTime(now)
    render(
      <ReservationScheduleHeader
        {...defaultProps}
        lastRefreshAt={now}
        onRefresh={vi.fn()}
      />,
    )
    expect(screen.getByText('たった今')).toBeInTheDocument()

    // Advance time by 10 seconds to trigger interval
    act(() => {
      vi.advanceTimersByTime(10000)
    })
    expect(screen.getByText('10秒前')).toBeInTheDocument()
  })

  it('shows "更新" when no lastRefreshAt', () => {
    render(
      <ReservationScheduleHeader
        {...defaultProps}
        lastRefreshAt={null}
        onRefresh={vi.fn()}
      />,
    )
    expect(screen.getByText('更新')).toBeInTheDocument()
  })
})
