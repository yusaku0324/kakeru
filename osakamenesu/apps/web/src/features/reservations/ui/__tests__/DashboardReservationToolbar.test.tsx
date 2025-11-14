import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DashboardReservationToolbar } from '@/features/reservations/ui/DashboardReservationToolbar'

describe('DashboardReservationToolbar', () => {
  it('renders counts and buttons and triggers callbacks', () => {
    const loadPrev = vi.fn()
    const refresh = vi.fn()
    render(
      <DashboardReservationToolbar
        total={10}
        visibleCount={5}
        hasPrevCursor
        isLoadingPrevious={false}
        isRefreshing={false}
        onLoadPrevious={loadPrev}
        onRefresh={refresh}
      />,
    )

    expect(screen.getByText('全 10 件中 5 件を表示中')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '新しい予約を読み込む' }))
    expect(loadPrev).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: '最新の情報に更新' }))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('disables and hides load previous button when appropriate', () => {
    const loadPrev = vi.fn()
    render(
      <DashboardReservationToolbar
        total={3}
        visibleCount={1}
        hasPrevCursor={false}
        isLoadingPrevious
        isRefreshing
        onLoadPrevious={loadPrev}
        onRefresh={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: '新しい予約を読み込む' })).toBeNull()
    const refreshButton = screen.getByRole('button', { name: '更新中…' }) as HTMLButtonElement
    expect(refreshButton.disabled).toBe(true)
  })
})
