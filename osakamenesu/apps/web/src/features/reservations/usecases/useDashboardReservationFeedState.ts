import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  fetchDashboardReservations,
  type DashboardReservationItem,
} from '@/lib/dashboard-reservations'
import { useToast } from '@/components/useToast'
import { RESERVATION_ERRORS, extractErrorMessage } from '@/lib/error-messages'
import {
  useFilterState,
  usePagination,
  useReservationDecisions,
  useScrollRestoration,
  DEFAULT_FILTERS,
  type DashboardFilterState,
} from './hooks'

export type FetchStatus = 'idle' | 'loading' | 'success' | 'error'

export type DashboardReservationFeedState = {
  items: DashboardReservationItem[]
  total: number
  fetchStatus: FetchStatus
  errorMessage: string | null
  isRefreshing: boolean
  isLoadingMore: boolean
  isLoadingPrevious: boolean
  nextCursor: string | null
  prevCursor: string | null
  statusFilter: DashboardFilterState['status']
  sortBy: DashboardFilterState['sort']
  sortDirection: DashboardFilterState['direction']
  startDate: string
  endDate: string
  searchInput: string
  appliedSearch: string
  pageSize: number
  activeReservation: DashboardReservationItem | null
}

export type DashboardReservationFeedDerived = {
  conflictIds: Set<string>
  filterSummary: string | null
}

export type DashboardReservationFeedActions = {
  refresh: () => Promise<void>
  handleStatusFilterChange: (value: DashboardFilterState['status']) => void
  handleSortChange: (value: DashboardFilterState['sort']) => void
  handleDirectionChange: (value: DashboardFilterState['direction']) => void
  handleLimitChange: (value: number) => void
  handleStartDateChange: (value: string) => void
  handleEndDateChange: (value: string) => void
  handleResetDateRange: () => void
  handleSearchInputChange: (value: string) => void
  handleSearchSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  handleClearSearch: () => void
  handleLoadMore: () => Promise<void>
  handleLoadPrevious: () => Promise<void>
  openReservation: (reservation: DashboardReservationItem) => void
  closeReservation: () => void
  decideReservation: (
    reservation: DashboardReservationItem,
    decision: 'approve' | 'decline' | 'cancel',
  ) => Promise<void>
}

export type DashboardReservationFeedToast = {
  toasts: ReturnType<typeof useToast>['toasts']
  remove: ReturnType<typeof useToast>['remove']
}

type UseDashboardReservationFeedStateOptions = {
  profileId: string
  slug?: string | null
  limit?: number
}

export function useDashboardReservationFeedState({
  profileId,
  slug,
  limit = 8,
}: UseDashboardReservationFeedStateOptions) {
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeReservation, setActiveReservation] = useState<DashboardReservationItem | null>(null)

  const { toasts, push, remove } = useToast()

  // Create a stable ref for filters that will be shared with child hooks
  const filtersRef = useRef<DashboardFilterState>({ ...DEFAULT_FILTERS, limit })

  // Build fetch params from current filter state
  const buildFetchParams = useCallback(() => {
    const current = filtersRef.current
    return {
      status: current.status === 'all' ? undefined : current.status,
      limit: current.limit || limit,
      sort: current.sort,
      direction: current.direction,
      q: current.q || undefined,
      start: current.start || undefined,
      end: current.end || undefined,
    } as const
  }, [limit])

  // Pagination state and actions
  const pagination = usePagination({
    profileId,
    push,
    buildFetchParams,
  })

  // Refresh data from API
  const refreshBase = useCallback(
    async ({ silent = false, signal }: { silent?: boolean; signal?: AbortSignal } = {}) => {
      if (!silent) {
        setIsRefreshing(true)
        setFetchStatus('loading')
      } else {
        setFetchStatus((prev) => (prev === 'idle' ? 'loading' : prev))
      }
      setErrorMessage(null)

      try {
        const fetchParams = buildFetchParams()
        const data = await fetchDashboardReservations(profileId, { ...fetchParams, signal })
        pagination.setItems(data.reservations)
        pagination.itemsRef.current = data.reservations
        pagination.setTotal(data.total)
        pagination.setNextCursor(data.next_cursor ?? null)
        pagination.setPrevCursor(data.prev_cursor ?? null)
        setFetchStatus('success')
        if (!silent) {
          push('success', '最新の予約情報を読み込みました。')
        }
      } catch (error) {
        const message = extractErrorMessage(error, RESERVATION_ERRORS.LIST_FETCH_FAILED)
        setErrorMessage(message)
        pagination.setNextCursor(null)
        pagination.setPrevCursor(null)
        setFetchStatus(pagination.itemsRef.current.length ? 'success' : 'error')
        if (!silent) {
          push('error', message)
        }
      } finally {
        if (!silent) {
          setIsRefreshing(false)
        }
      }
    },
    [buildFetchParams, pagination, profileId, push],
  )

  const refresh = useCallback(() => refreshBase({ silent: false }), [refreshBase])

  // Handle filter changes callback
  const handleFiltersChange = useCallback(
    (_filters: DashboardFilterState, options?: { silent?: boolean }) => {
      pagination.setNextCursor(null)
      pagination.setPrevCursor(null)
      void refreshBase({ silent: options?.silent ?? true })
    },
    [pagination, refreshBase],
  )

  // Filter state and actions
  const filterState = useFilterState({
    profileId,
    limit,
    push,
    filtersRef,
    onFiltersChange: handleFiltersChange,
  })

  // Initialize filters and fetch data on mount
  useEffect(() => {
    filterState.initializeFilters()
    const controller = new AbortController()
    refreshBase({ silent: true, signal: controller.signal }).catch(() => undefined)
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Listen for reservation update events
  useEffect(() => {
    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail as { shopId?: string } | undefined
      if (!detail?.shopId) return
      const candidates = [profileId, slug].filter(Boolean)
      if (candidates.includes(detail.shopId)) {
        void refresh()
      }
    }
    window.addEventListener('reservation:updated', handleUpdate)
    return () => window.removeEventListener('reservation:updated', handleUpdate)
  }, [profileId, slug, refresh])

  // Scroll restoration
  useScrollRestoration({ profileId, fetchStatus })

  // Reservation modal actions
  const openReservation = useCallback((reservation: DashboardReservationItem) => {
    setActiveReservation(reservation)
  }, [])

  const closeReservation = useCallback(() => {
    setActiveReservation(null)
  }, [])

  // Reservation decision actions
  const { decideReservation } = useReservationDecisions({
    profileId,
    push,
    refresh,
    closeReservation,
  })

  // Compute conflict IDs
  const conflictIds = useMemo(() => {
    const set = new Set<string>()
    const relevant = pagination.items
      .filter((item) => item.status === 'pending' || item.status === 'confirmed')
      .map((item) => ({
        id: item.id,
        start: new Date(item.desired_start).getTime(),
        end: new Date(item.desired_end).getTime(),
      }))
      .sort((a, b) => a.start - b.start)

    for (let i = 0; i < relevant.length; i += 1) {
      const current = relevant[i]
      for (let j = i + 1; j < relevant.length; j += 1) {
        const other = relevant[j]
        if (other.start >= current.end) break
        set.add(current.id)
        set.add(other.id)
      }
    }
    return set
  }, [pagination.items])

  // Compute filter summary
  const filterSummary = useMemo(() => {
    const segments: string[] = []
    if (filterState.statusFilter !== DEFAULT_FILTERS.status) {
      const labelMap: Record<DashboardFilterState['status'], string> = {
        all: 'すべて',
        pending: '承認待ち',
        confirmed: '承認済み',
        declined: '辞退済み',
        cancelled: 'キャンセル',
        expired: '期限切れ',
      }
      segments.push(`ステータス: ${labelMap[filterState.statusFilter]}`)
    }
    if (filterState.startDate || filterState.endDate) {
      const startLabel = filterState.startDate || '指定なし'
      const endLabel = filterState.endDate || '指定なし'
      segments.push(`期間: ${startLabel}〜${endLabel}`)
    }
    if (filterState.appliedSearch) {
      segments.push(`検索: "${filterState.appliedSearch}"`)
    }
    return segments.length ? segments.join(' / ') : null
  }, [filterState.appliedSearch, filterState.endDate, filterState.startDate, filterState.statusFilter])

  const state: DashboardReservationFeedState = {
    items: pagination.items,
    total: pagination.total,
    fetchStatus,
    errorMessage,
    isRefreshing,
    isLoadingMore: pagination.isLoadingMore,
    isLoadingPrevious: pagination.isLoadingPrevious,
    nextCursor: pagination.nextCursor,
    prevCursor: pagination.prevCursor,
    statusFilter: filterState.statusFilter,
    sortBy: filterState.sortBy,
    sortDirection: filterState.sortDirection,
    startDate: filterState.startDate,
    endDate: filterState.endDate,
    searchInput: filterState.searchInput,
    appliedSearch: filterState.appliedSearch,
    pageSize: filterState.pageSize,
    activeReservation,
  }

  const derived: DashboardReservationFeedDerived = {
    conflictIds,
    filterSummary,
  }

  const actions: DashboardReservationFeedActions = {
    refresh,
    handleStatusFilterChange: filterState.handleStatusFilterChange,
    handleSortChange: filterState.handleSortChange,
    handleDirectionChange: filterState.handleDirectionChange,
    handleLimitChange: filterState.handleLimitChange,
    handleStartDateChange: filterState.handleStartDateChange,
    handleEndDateChange: filterState.handleEndDateChange,
    handleResetDateRange: filterState.handleResetDateRange,
    handleSearchInputChange: filterState.handleSearchInputChange,
    handleSearchSubmit: filterState.handleSearchSubmit,
    handleClearSearch: filterState.handleClearSearch,
    handleLoadMore: pagination.handleLoadMore,
    handleLoadPrevious: pagination.handleLoadPrevious,
    openReservation,
    closeReservation,
    decideReservation,
  }

  const toast: DashboardReservationFeedToast = {
    toasts,
    remove,
  }

  return { state, derived, actions, toast }
}
