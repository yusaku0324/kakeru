import type { FormEvent } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  DashboardReservationFilters,
  STATUS_OPTIONS,
  SORT_OPTIONS,
  DIRECTION_OPTIONS,
  PAGE_SIZE_OPTIONS,
} from '@/features/reservations/ui/DashboardReservationFilters'

describe('DashboardReservationFilters', () => {
  const defaultProps = {
    statusFilter: STATUS_OPTIONS[0].value,
    sortBy: SORT_OPTIONS[0].value,
    sortDirection: DIRECTION_OPTIONS[0].value,
    pageSize: PAGE_SIZE_OPTIONS[0],
    startDate: '',
    endDate: '',
    searchInput: '',
    onStatusChange: vi.fn(),
    onSortChange: vi.fn(),
    onDirectionChange: vi.fn(),
    onLimitChange: vi.fn(),
    onStartDateChange: vi.fn(),
    onEndDateChange: vi.fn(),
    onResetDateRange: vi.fn(),
    onSearchInputChange: vi.fn(),
    onSearchSubmit: vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault()),
    onClearSearch: vi.fn(),
  }

  it('renders selectors and dispatches callbacks', () => {
    render(<DashboardReservationFilters {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('ステータス'), {
      target: { value: STATUS_OPTIONS[1].value },
    })
    expect(defaultProps.onStatusChange).toHaveBeenCalledWith(STATUS_OPTIONS[1].value)

    fireEvent.change(screen.getByLabelText('並び替え'), {
      target: { value: SORT_OPTIONS[1].value },
    })
    expect(defaultProps.onSortChange).toHaveBeenCalledWith(SORT_OPTIONS[1].value)

    fireEvent.change(screen.getByLabelText('順序'), {
      target: { value: DIRECTION_OPTIONS[1].value },
    })
    expect(defaultProps.onDirectionChange).toHaveBeenCalledWith(DIRECTION_OPTIONS[1].value)

    fireEvent.change(screen.getByLabelText('表示件数'), {
      target: { value: `${PAGE_SIZE_OPTIONS[1]}` },
    })
    expect(defaultProps.onLimitChange).toHaveBeenCalledWith(PAGE_SIZE_OPTIONS[1])
  })

  it('handles date range and search actions', () => {
    render(<DashboardReservationFilters {...defaultProps} />)

    fireEvent.change(screen.getByLabelText('開始日'), { target: { value: '2024-01-01' } })
    expect(defaultProps.onStartDateChange).toHaveBeenCalledWith('2024-01-01')

    fireEvent.change(screen.getByLabelText('終了日'), { target: { value: '2024-01-07' } })
    expect(defaultProps.onEndDateChange).toHaveBeenCalledWith('2024-01-07')

    fireEvent.click(screen.getByRole('button', { name: '期間リセット' }))
    expect(defaultProps.onResetDateRange).toHaveBeenCalled()

    const searchInput = screen.getByRole('searchbox')
    fireEvent.change(searchInput, { target: { value: '山田' } })
    expect(defaultProps.onSearchInputChange).toHaveBeenCalledWith('山田')

    const form = searchInput.closest('form')
    expect(form).not.toBeNull()
    fireEvent.submit(form!)
    expect(defaultProps.onSearchSubmit).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'クリア' }))
    expect(defaultProps.onClearSearch).toHaveBeenCalled()
  })
})
