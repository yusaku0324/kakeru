import { act, renderHook, waitFor } from '@testing-library/react'
import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest'

import { useDashboardReservationFeedState } from '../useDashboardReservationFeedState'

const dashboardMocks = vi.hoisted(() => ({
  fetchDashboardReservations: vi.fn(),
  updateDashboardReservation: vi.fn(),
}))

vi.mock('@/lib/dashboard-reservations', () => dashboardMocks)

vi.mock('@/lib/async-jobs', () => ({
  enqueueAsyncJob: vi.fn(),
}))

const toastMock = {
  toasts: [] as { id: string; type: string; message: string }[],
  push: vi.fn(),
  remove: vi.fn(),
}

vi.mock('@/components/useToast', () => ({
  useToast: () => toastMock,
}))

const routerMock = {
  replace: vi.fn(),
  refresh: vi.fn(),
}
let mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  usePathname: () => '/dashboard/profile',
  useSearchParams: () => mockSearchParams,
}))

function createReservation(
  id: string,
  name: string,
  status: 'pending' | 'confirmed' | 'declined' = 'pending',
  offsetMinutes = 0,
) {
  const now = new Date('2025-01-01T10:00:00Z')
  const start = new Date(now.getTime() + offsetMinutes * 60_000)
  const end = new Date(start.getTime() + 60 * 60_000)
  return {
    id,
    status,
    channel: 'web',
    desired_start: start.toISOString(),
    desired_end: end.toISOString(),
    customer_name: name,
    customer_phone: '09000000000',
    customer_email: `${name.toLowerCase()}@example.com`,
    notes: null,
    marketing_opt_in: false,
    staff_id: null,
    preferred_slots: [],
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  }
}

describe('useDashboardReservationFeedState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams = new URLSearchParams()
    sessionStorage.clear()
    dashboardMocks.fetchDashboardReservations.mockResolvedValue({
      profile_id: 'profile-1',
      total: 0,
      reservations: [],
      next_cursor: null,
      prev_cursor: null,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('initializes with default state', async () => {
      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1' }),
      )

      expect(result.current.state.items).toEqual([])
      // fetchStatus might be 'idle' or 'loading' depending on timing
      expect(['idle', 'loading']).toContain(result.current.state.fetchStatus)
      expect(result.current.state.statusFilter).toBe('all')
      expect(result.current.state.sortBy).toBe('latest')
      expect(result.current.state.sortDirection).toBe('desc')

      await waitFor(() =>
        expect(dashboardMocks.fetchDashboardReservations).toHaveBeenCalled(),
      )
    })

    it('loads reservations on mount', async () => {
      const reservation = createReservation('res-1', 'Customer One')
      dashboardMocks.fetchDashboardReservations.mockResolvedValue({
        profile_id: 'profile-1',
        total: 1,
        reservations: [reservation],
        next_cursor: null,
        prev_cursor: null,
      })

      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1' }),
      )

      await waitFor(() => expect(result.current.state.items).toHaveLength(1))
      expect(result.current.state.items[0].customer_name).toBe('Customer One')
      expect(result.current.state.total).toBe(1)
    })
  })

  describe('filter handlers', () => {
    it('handleStatusFilterChange updates filter and fetches', async () => {
      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1' }),
      )

      await waitFor(() =>
        expect(dashboardMocks.fetchDashboardReservations).toHaveBeenCalled(),
      )
      dashboardMocks.fetchDashboardReservations.mockClear()

      act(() => {
        result.current.actions.handleStatusFilterChange('pending')
      })

      expect(result.current.state.statusFilter).toBe('pending')
      await waitFor(() =>
        expect(dashboardMocks.fetchDashboardReservations).toHaveBeenCalled(),
      )
    })

    it('handleSortChange updates sort and fetches', async () => {
      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1' }),
      )

      await waitFor(() =>
        expect(dashboardMocks.fetchDashboardReservations).toHaveBeenCalled(),
      )
      dashboardMocks.fetchDashboardReservations.mockClear()

      act(() => {
        result.current.actions.handleSortChange('date')
      })

      expect(result.current.state.sortBy).toBe('date')
      await waitFor(() =>
        expect(dashboardMocks.fetchDashboardReservations).toHaveBeenCalled(),
      )
    })

    it('handleDirectionChange updates direction and fetches', async () => {
      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1' }),
      )

      await waitFor(() =>
        expect(dashboardMocks.fetchDashboardReservations).toHaveBeenCalled(),
      )
      dashboardMocks.fetchDashboardReservations.mockClear()

      act(() => {
        result.current.actions.handleDirectionChange('asc')
      })

      expect(result.current.state.sortDirection).toBe('asc')
      await waitFor(() =>
        expect(dashboardMocks.fetchDashboardReservations).toHaveBeenCalled(),
      )
    })

    it('handleLimitChange updates page size', async () => {
      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1', limit: 8 }),
      )

      await waitFor(() =>
        expect(dashboardMocks.fetchDashboardReservations).toHaveBeenCalled(),
      )
      dashboardMocks.fetchDashboardReservations.mockClear()

      act(() => {
        result.current.actions.handleLimitChange(50)
      })

      expect(result.current.state.pageSize).toBe(50)
      await waitFor(() =>
        expect(dashboardMocks.fetchDashboardReservations).toHaveBeenCalled(),
      )
    })
  })

  describe('date range handlers', () => {
    it('handleStartDateChange updates start date', async () => {
      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1' }),
      )

      await waitFor(() =>
        expect(dashboardMocks.fetchDashboardReservations).toHaveBeenCalled(),
      )
      dashboardMocks.fetchDashboardReservations.mockClear()

      act(() => {
        result.current.actions.handleStartDateChange('2025-01-01')
      })

      expect(result.current.state.startDate).toBe('2025-01-01')
    })

    it('handleStartDateChange rejects invalid date range', async () => {
      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1' }),
      )

      await waitFor(() =>
        expect(dashboardMocks.fetchDashboardReservations).toHaveBeenCalled(),
      )

      act(() => {
        result.current.actions.handleEndDateChange('2025-01-01')
      })

      act(() => {
        result.current.actions.handleStartDateChange('2025-01-10')
      })

      expect(toastMock.push).toHaveBeenCalledWith(
        'error',
        '開始日は終了日より前に設定してください。',
      )
    })

    it('handleEndDateChange updates end date', async () => {
      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1' }),
      )

      await waitFor(() =>
        expect(dashboardMocks.fetchDashboardReservations).toHaveBeenCalled(),
      )

      act(() => {
        result.current.actions.handleEndDateChange('2025-01-31')
      })

      expect(result.current.state.endDate).toBe('2025-01-31')
    })

    it('handleEndDateChange rejects invalid date range', async () => {
      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1' }),
      )

      await waitFor(() =>
        expect(dashboardMocks.fetchDashboardReservations).toHaveBeenCalled(),
      )

      act(() => {
        result.current.actions.handleStartDateChange('2025-01-15')
      })

      act(() => {
        result.current.actions.handleEndDateChange('2025-01-01')
      })

      expect(toastMock.push).toHaveBeenCalledWith(
        'error',
        '終了日は開始日と同じか後の日付を指定してください。',
      )
    })

    it('handleResetDateRange clears both dates', async () => {
      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1' }),
      )

      await waitFor(() =>
        expect(dashboardMocks.fetchDashboardReservations).toHaveBeenCalled(),
      )

      act(() => {
        result.current.actions.handleStartDateChange('2025-01-01')
        result.current.actions.handleEndDateChange('2025-01-31')
      })

      act(() => {
        result.current.actions.handleResetDateRange()
      })

      expect(result.current.state.startDate).toBe('')
      expect(result.current.state.endDate).toBe('')
    })
  })

  describe('search handlers', () => {
    it('handleSearchInputChange updates search input', async () => {
      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1' }),
      )

      await waitFor(() =>
        expect(dashboardMocks.fetchDashboardReservations).toHaveBeenCalled(),
      )

      act(() => {
        result.current.actions.handleSearchInputChange('test query')
      })

      expect(result.current.state.searchInput).toBe('test query')
    })

    it('handleSearchSubmit applies search', async () => {
      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1' }),
      )

      await waitFor(() =>
        expect(dashboardMocks.fetchDashboardReservations).toHaveBeenCalled(),
      )
      dashboardMocks.fetchDashboardReservations.mockClear()

      act(() => {
        result.current.actions.handleSearchInputChange('customer name')
      })

      // Wait for state update
      await waitFor(() => expect(result.current.state.searchInput).toBe('customer name'))

      const mockEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent<HTMLFormElement>
      act(() => {
        result.current.actions.handleSearchSubmit(mockEvent)
      })

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      await waitFor(() => expect(result.current.state.appliedSearch).toBe('customer name'))
    })

    it('handleClearSearch clears search', async () => {
      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1' }),
      )

      await waitFor(() =>
        expect(dashboardMocks.fetchDashboardReservations).toHaveBeenCalled(),
      )

      act(() => {
        result.current.actions.handleSearchInputChange('test')
      })

      await waitFor(() => expect(result.current.state.searchInput).toBe('test'))

      act(() => {
        const mockEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent<HTMLFormElement>
        result.current.actions.handleSearchSubmit(mockEvent)
      })

      await waitFor(() => expect(result.current.state.appliedSearch).toBe('test'))

      act(() => {
        result.current.actions.handleClearSearch()
      })

      expect(result.current.state.searchInput).toBe('')
    })
  })

  describe('reservation actions', () => {
    it('openReservation sets active reservation', async () => {
      const reservation = createReservation('res-1', 'Customer')
      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1' }),
      )

      await waitFor(() =>
        expect(dashboardMocks.fetchDashboardReservations).toHaveBeenCalled(),
      )

      act(() => {
        result.current.actions.openReservation(reservation)
      })

      expect(result.current.state.activeReservation).toEqual(reservation)
    })

    it('closeReservation clears active reservation', async () => {
      const reservation = createReservation('res-1', 'Customer')
      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1' }),
      )

      await waitFor(() =>
        expect(dashboardMocks.fetchDashboardReservations).toHaveBeenCalled(),
      )

      act(() => {
        result.current.actions.openReservation(reservation)
      })

      act(() => {
        result.current.actions.closeReservation()
      })

      expect(result.current.state.activeReservation).toBeNull()
    })

    it('decideReservation approves and refreshes', async () => {
      const reservation = createReservation('res-1', 'Customer')
      dashboardMocks.updateDashboardReservation.mockResolvedValue({
        reservation: { ...reservation, status: 'confirmed' },
        conflict: false,
      })

      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1' }),
      )

      await waitFor(() =>
        expect(dashboardMocks.fetchDashboardReservations).toHaveBeenCalled(),
      )

      await act(async () => {
        await result.current.actions.decideReservation(reservation, 'approve')
      })

      expect(dashboardMocks.updateDashboardReservation).toHaveBeenCalledWith(
        'profile-1',
        'res-1',
        { status: 'confirmed' },
      )
      expect(toastMock.push).toHaveBeenCalledWith(
        'success',
        '「Customer」の予約を承認しました。',
      )
    })

    it('decideReservation declines and refreshes', async () => {
      const reservation = createReservation('res-1', 'Customer')
      dashboardMocks.updateDashboardReservation.mockResolvedValue({
        reservation: { ...reservation, status: 'declined' },
        conflict: false,
      })

      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1' }),
      )

      await waitFor(() =>
        expect(dashboardMocks.fetchDashboardReservations).toHaveBeenCalled(),
      )

      await act(async () => {
        await result.current.actions.decideReservation(reservation, 'decline')
      })

      expect(dashboardMocks.updateDashboardReservation).toHaveBeenCalledWith(
        'profile-1',
        'res-1',
        { status: 'declined' },
      )
      expect(toastMock.push).toHaveBeenCalledWith(
        'success',
        '「Customer」の予約を辞退しました。',
      )
    })

    it('decideReservation shows conflict warning', async () => {
      const reservation = createReservation('res-1', 'Customer')
      dashboardMocks.updateDashboardReservation.mockResolvedValue({
        reservation: { ...reservation, status: 'confirmed' },
        conflict: true,
      })

      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1' }),
      )

      await waitFor(() =>
        expect(dashboardMocks.fetchDashboardReservations).toHaveBeenCalled(),
      )

      await act(async () => {
        await result.current.actions.decideReservation(reservation, 'approve')
      })

      expect(toastMock.push).toHaveBeenCalledWith(
        'error',
        '他の予約と時間が重複しています。スケジュールをご確認ください。',
      )
    })

    it('decideReservation handles error', async () => {
      const reservation = createReservation('res-1', 'Customer')
      dashboardMocks.updateDashboardReservation.mockRejectedValue(
        new Error('Update failed'),
      )

      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1' }),
      )

      await waitFor(() =>
        expect(dashboardMocks.fetchDashboardReservations).toHaveBeenCalled(),
      )

      await act(async () => {
        await result.current.actions.decideReservation(reservation, 'approve')
      })

      expect(toastMock.push).toHaveBeenCalledWith('error', 'Update failed')
    })
  })

  describe('derived state', () => {
    it('calculates conflictIds for overlapping reservations', async () => {
      const res1 = createReservation('res-1', 'Customer One', 'pending', 0)
      const res2 = createReservation('res-2', 'Customer Two', 'confirmed', 30)
      const res3 = createReservation('res-3', 'Customer Three', 'pending', 120)

      dashboardMocks.fetchDashboardReservations.mockResolvedValue({
        profile_id: 'profile-1',
        total: 3,
        reservations: [res1, res2, res3],
        next_cursor: null,
        prev_cursor: null,
      })

      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1' }),
      )

      await waitFor(() => expect(result.current.state.items).toHaveLength(3))

      expect(result.current.derived.conflictIds.has('res-1')).toBe(true)
      expect(result.current.derived.conflictIds.has('res-2')).toBe(true)
      expect(result.current.derived.conflictIds.has('res-3')).toBe(false)
    })

    it('returns filterSummary with status filter', async () => {
      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1' }),
      )

      await waitFor(() =>
        expect(dashboardMocks.fetchDashboardReservations).toHaveBeenCalled(),
      )

      act(() => {
        result.current.actions.handleStatusFilterChange('pending')
      })

      await waitFor(() =>
        expect(result.current.derived.filterSummary).toContain('ステータス: 承認待ち'),
      )
    })

    it('returns filterSummary with date range', async () => {
      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1' }),
      )

      await waitFor(() =>
        expect(dashboardMocks.fetchDashboardReservations).toHaveBeenCalled(),
      )

      act(() => {
        result.current.actions.handleStartDateChange('2025-01-01')
        result.current.actions.handleEndDateChange('2025-01-31')
      })

      await waitFor(() =>
        expect(result.current.derived.filterSummary).toContain('期間: 2025-01-01〜2025-01-31'),
      )
    })

    it('returns filterSummary with search', async () => {
      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1' }),
      )

      await waitFor(() =>
        expect(dashboardMocks.fetchDashboardReservations).toHaveBeenCalled(),
      )

      act(() => {
        result.current.actions.handleSearchInputChange('test')
      })

      await waitFor(() => expect(result.current.state.searchInput).toBe('test'))

      act(() => {
        const mockEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent<HTMLFormElement>
        result.current.actions.handleSearchSubmit(mockEvent)
      })

      await waitFor(() =>
        expect(result.current.state.appliedSearch).toBe('test'),
      )

      expect(result.current.derived.filterSummary).toContain('検索: "test"')
    })

    it('returns null filterSummary when no filters applied', async () => {
      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1' }),
      )

      await waitFor(() =>
        expect(dashboardMocks.fetchDashboardReservations).toHaveBeenCalled(),
      )

      expect(result.current.derived.filterSummary).toBeNull()
    })
  })

  describe('pagination', () => {
    it('handleLoadMore loads next page', async () => {
      dashboardMocks.fetchDashboardReservations
        .mockResolvedValueOnce({
          profile_id: 'profile-1',
          total: 2,
          reservations: [createReservation('res-1', 'Customer One')],
          next_cursor: 'cursor-next',
          prev_cursor: null,
        })
        .mockResolvedValueOnce({
          profile_id: 'profile-1',
          total: 2,
          reservations: [createReservation('res-2', 'Customer Two')],
          next_cursor: null,
          prev_cursor: 'cursor-prev',
        })

      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1' }),
      )

      await waitFor(() => expect(result.current.state.items).toHaveLength(1))
      expect(result.current.state.nextCursor).toBe('cursor-next')

      await act(async () => {
        await result.current.actions.handleLoadMore()
      })

      expect(result.current.state.items).toHaveLength(2)
      expect(result.current.state.nextCursor).toBeNull()
    })

    it('handleLoadMore does nothing without nextCursor', async () => {
      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1' }),
      )

      await waitFor(() =>
        expect(dashboardMocks.fetchDashboardReservations).toHaveBeenCalled(),
      )
      dashboardMocks.fetchDashboardReservations.mockClear()

      await act(async () => {
        await result.current.actions.handleLoadMore()
      })

      expect(dashboardMocks.fetchDashboardReservations).not.toHaveBeenCalled()
    })

    it('handleLoadPrevious loads previous page', async () => {
      dashboardMocks.fetchDashboardReservations
        .mockResolvedValueOnce({
          profile_id: 'profile-1',
          total: 2,
          reservations: [createReservation('res-2', 'Customer Two')],
          next_cursor: null,
          prev_cursor: 'cursor-prev',
        })
        .mockResolvedValueOnce({
          profile_id: 'profile-1',
          total: 2,
          reservations: [createReservation('res-1', 'Customer One')],
          next_cursor: 'cursor-next',
          prev_cursor: null,
        })

      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1' }),
      )

      await waitFor(() => expect(result.current.state.items).toHaveLength(1))
      expect(result.current.state.prevCursor).toBe('cursor-prev')

      await act(async () => {
        await result.current.actions.handleLoadPrevious()
      })

      expect(result.current.state.items).toHaveLength(2)
      expect(result.current.state.items[0].customer_name).toBe('Customer One')
    })

    it('handleLoadMore handles error', async () => {
      dashboardMocks.fetchDashboardReservations
        .mockResolvedValueOnce({
          profile_id: 'profile-1',
          total: 2,
          reservations: [createReservation('res-1', 'Customer One')],
          next_cursor: 'cursor-next',
          prev_cursor: null,
        })
        .mockRejectedValueOnce(new Error('Load failed'))

      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1' }),
      )

      await waitFor(() => expect(result.current.state.items).toHaveLength(1))

      await act(async () => {
        await result.current.actions.handleLoadMore()
      })

      expect(toastMock.push).toHaveBeenCalledWith('error', 'Load failed')
    })

    it('handleLoadPrevious handles error', async () => {
      dashboardMocks.fetchDashboardReservations
        .mockResolvedValueOnce({
          profile_id: 'profile-1',
          total: 2,
          reservations: [createReservation('res-2', 'Customer Two')],
          next_cursor: null,
          prev_cursor: 'cursor-prev',
        })
        .mockRejectedValueOnce(new Error('Load previous failed'))

      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1' }),
      )

      await waitFor(() => expect(result.current.state.items).toHaveLength(1))

      await act(async () => {
        await result.current.actions.handleLoadPrevious()
      })

      expect(toastMock.push).toHaveBeenCalledWith('error', 'Load previous failed')
    })
  })

  describe('refresh', () => {
    it('refresh shows success toast', async () => {
      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1' }),
      )

      await waitFor(() =>
        expect(dashboardMocks.fetchDashboardReservations).toHaveBeenCalled(),
      )
      toastMock.push.mockClear()

      await act(async () => {
        await result.current.actions.refresh()
      })

      expect(toastMock.push).toHaveBeenCalledWith(
        'success',
        '最新の予約情報を読み込みました。',
      )
    })

    it('refresh shows error toast on failure', async () => {
      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1' }),
      )

      await waitFor(() =>
        expect(dashboardMocks.fetchDashboardReservations).toHaveBeenCalled(),
      )

      dashboardMocks.fetchDashboardReservations.mockRejectedValueOnce(
        new Error('Refresh failed'),
      )
      toastMock.push.mockClear()

      await act(async () => {
        await result.current.actions.refresh()
      })

      expect(toastMock.push).toHaveBeenCalledWith('error', 'Refresh failed')
    })
  })

  describe('URL params sync', () => {
    it('restores filters from URL params', async () => {
      mockSearchParams = new URLSearchParams({
        status: 'confirmed',
        sort: 'date',
        direction: 'asc',
        q: 'search term',
        start: '2025-01-01',
        end: '2025-01-31',
        limit: '50',
      })

      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1' }),
      )

      await waitFor(() =>
        expect(dashboardMocks.fetchDashboardReservations).toHaveBeenCalled(),
      )

      expect(result.current.state.statusFilter).toBe('confirmed')
      expect(result.current.state.sortBy).toBe('date')
      expect(result.current.state.sortDirection).toBe('asc')
      expect(result.current.state.startDate).toBe('2025-01-01')
      expect(result.current.state.endDate).toBe('2025-01-31')
      expect(result.current.state.pageSize).toBe(50)
    })
  })

  describe('no-op guards', () => {
    it('handleStatusFilterChange does nothing when value unchanged', async () => {
      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1' }),
      )

      await waitFor(() =>
        expect(dashboardMocks.fetchDashboardReservations).toHaveBeenCalled(),
      )
      dashboardMocks.fetchDashboardReservations.mockClear()

      act(() => {
        result.current.actions.handleStatusFilterChange('all')
      })

      expect(dashboardMocks.fetchDashboardReservations).not.toHaveBeenCalled()
    })

    it('handleSortChange does nothing when value unchanged', async () => {
      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1' }),
      )

      await waitFor(() =>
        expect(dashboardMocks.fetchDashboardReservations).toHaveBeenCalled(),
      )
      dashboardMocks.fetchDashboardReservations.mockClear()

      act(() => {
        result.current.actions.handleSortChange('latest')
      })

      expect(dashboardMocks.fetchDashboardReservations).not.toHaveBeenCalled()
    })

    it('handleDirectionChange does nothing when value unchanged', async () => {
      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1' }),
      )

      await waitFor(() =>
        expect(dashboardMocks.fetchDashboardReservations).toHaveBeenCalled(),
      )
      dashboardMocks.fetchDashboardReservations.mockClear()

      act(() => {
        result.current.actions.handleDirectionChange('desc')
      })

      expect(dashboardMocks.fetchDashboardReservations).not.toHaveBeenCalled()
    })

    it('handleLimitChange does nothing when value unchanged', async () => {
      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1' }),
      )

      await waitFor(() =>
        expect(dashboardMocks.fetchDashboardReservations).toHaveBeenCalled(),
      )

      // First change to a different value
      act(() => {
        result.current.actions.handleLimitChange(50)
      })

      await waitFor(() => expect(result.current.state.pageSize).toBe(50))
      dashboardMocks.fetchDashboardReservations.mockClear()

      // Now set the same value again - should not trigger fetch
      act(() => {
        result.current.actions.handleLimitChange(50)
      })

      expect(dashboardMocks.fetchDashboardReservations).not.toHaveBeenCalled()
    })

    it('handleResetDateRange does nothing when both empty', async () => {
      const { result } = renderHook(() =>
        useDashboardReservationFeedState({ profileId: 'profile-1' }),
      )

      await waitFor(() =>
        expect(dashboardMocks.fetchDashboardReservations).toHaveBeenCalled(),
      )
      dashboardMocks.fetchDashboardReservations.mockClear()

      act(() => {
        result.current.actions.handleResetDateRange()
      })

      expect(dashboardMocks.fetchDashboardReservations).not.toHaveBeenCalled()
    })
  })
})
