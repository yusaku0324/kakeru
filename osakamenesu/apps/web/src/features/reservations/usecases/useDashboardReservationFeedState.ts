import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import {
  fetchDashboardReservations,
  updateDashboardReservation,
  type DashboardReservationItem,
} from '@/lib/dashboard-reservations'
import { enqueueAsyncJob } from '@/lib/async-jobs'
import { useToast } from '@/components/useToast'

type DashboardFilterState = {
  status: 'all' | 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'expired'
  sort: 'latest' | 'date'
  direction: 'desc' | 'asc'
  q: string
  start: string
  end: string
  limit: number
}

const DEFAULT_FILTERS: DashboardFilterState = {
  status: 'all',
  sort: 'latest',
  direction: 'desc',
  q: '',
  start: '',
  end: '',
  limit: 20,
}

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
  handleSearchSubmit: (event: FormEvent<HTMLFormElement>) => void
  handleClearSearch: () => void
  handleLoadMore: () => Promise<void>
  handleLoadPrevious: () => Promise<void>
  openReservation: (reservation: DashboardReservationItem) => void
  closeReservation: () => void
  decideReservation: (reservation: DashboardReservationItem, decision: 'approve' | 'decline') => Promise<void>
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
  const [items, setItems] = useState<DashboardReservationItem[]>([])
  const itemsRef = useRef<DashboardReservationItem[]>([])
  const [total, setTotal] = useState(0)
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeReservation, setActiveReservation] = useState<DashboardReservationItem | null>(null)

  const [statusFilter, setStatusFilter] = useState<DashboardFilterState['status']>('all')
  const [sortBy, setSortBy] = useState<DashboardFilterState['sort']>('latest')
  const [sortDirection, setSortDirection] = useState<DashboardFilterState['direction']>('desc')
  const [searchInput, setSearchInput] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [pageSize, setPageSize] = useState(limit)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [prevCursor, setPrevCursor] = useState<string | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isLoadingPrevious, setIsLoadingPrevious] = useState(false)

  const filtersRef = useRef<DashboardFilterState>({ ...DEFAULT_FILTERS, limit })
  const restoredRef = useRef(false)
  const scrollKeyRef = useRef(`dashboard:reservation-feed:scroll:${profileId}`)

  const { toasts, push, remove } = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const filterStorageKey = useMemo(() => `dashboard:reservation-feed:filters:${profileId}`, [profileId])
  const suppressParamsSyncRef = useRef(false)
  const lastParamsRef = useRef<string | null>(null)

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
        setItems(data.reservations)
        itemsRef.current = data.reservations
        setTotal(data.total)
        setNextCursor(data.next_cursor ?? null)
        setPrevCursor(data.prev_cursor ?? null)
        setFetchStatus('success')
        if (!silent) {
          push('success', '最新の予約情報を読み込みました。')
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : '予約リストの取得に失敗しました。時間をおいて再度お試しください。'
        setErrorMessage(message)
        setNextCursor(null)
        setPrevCursor(null)
        setFetchStatus(itemsRef.current.length ? 'success' : 'error')
        if (!silent) {
          push('error', message)
        }
      } finally {
        if (!silent) {
          setIsRefreshing(false)
        }
      }
    },
    [buildFetchParams, profileId, push],
  )

  const refresh = useCallback(() => refreshBase({ silent: false }), [refreshBase])

  const writeFiltersToStorage = useCallback(
    (filters: DashboardFilterState) => {
      if (typeof window === 'undefined') return
      sessionStorage.setItem(filterStorageKey, JSON.stringify(filters))
    },
    [filterStorageKey],
  )

  const buildSearchParams = useCallback((filters: DashboardFilterState) => {
    const params = new URLSearchParams()
    if (filters.status && filters.status !== DEFAULT_FILTERS.status) {
      params.set('status', filters.status)
    }
    if (filters.sort && filters.sort !== DEFAULT_FILTERS.sort) {
      params.set('sort', filters.sort)
    }
    if (filters.direction && filters.direction !== DEFAULT_FILTERS.direction) {
      params.set('direction', filters.direction)
    }
    if (filters.q) {
      params.set('q', filters.q)
    }
    if (filters.start) {
      params.set('start', filters.start)
    }
    if (filters.end) {
      params.set('end', filters.end)
    }
    if (filters.limit && filters.limit !== DEFAULT_FILTERS.limit) {
      params.set('limit', String(filters.limit))
    }
    return params
  }, [])

  const pushFiltersToUrl = useCallback(
    (filters: DashboardFilterState) => {
      const params = buildSearchParams(filters)
      const signature = params.toString()
      if (lastParamsRef.current === signature) {
        return
      }
      const url = signature ? `${pathname}?${signature}` : pathname
      suppressParamsSyncRef.current = true
      router.replace(url, { scroll: false })
      lastParamsRef.current = signature
    },
    [buildSearchParams, pathname, router],
  )

  const updateFilters = useCallback(
    (partial: Partial<DashboardFilterState>, options: { silent?: boolean } = {}) => {
      const next: DashboardFilterState = { ...filtersRef.current, ...partial }
      filtersRef.current = next
      if (Object.prototype.hasOwnProperty.call(partial, 'q')) {
        const nextValue = typeof partial.q === 'string' ? partial.q : ''
        setAppliedSearch(nextValue)
      }
      if (Object.prototype.hasOwnProperty.call(partial, 'limit') && typeof next.limit === 'number') {
        setPageSize(next.limit)
      }
      setNextCursor(null)
      setPrevCursor(null)
      setIsLoadingMore(false)
      setIsLoadingPrevious(false)
      writeFiltersToStorage(next)
      pushFiltersToUrl(next)
      void refreshBase({ silent: options.silent ?? true })
    },
    [pushFiltersToUrl, refreshBase, writeFiltersToStorage],
  )

  useEffect(() => {
    const signature = searchParams.toString()

    if (suppressParamsSyncRef.current) {
      suppressParamsSyncRef.current = false
      lastParamsRef.current = signature
    }

    let nextFilters: DashboardFilterState = { ...DEFAULT_FILTERS }

    const statusParam = searchParams.get('status')
    if (statusParam && ['all', 'pending', 'confirmed', 'declined', 'cancelled', 'expired'].includes(statusParam)) {
      nextFilters.status = statusParam as DashboardFilterState['status']
    }

    const sortParam = searchParams.get('sort')
    if (sortParam && ['latest', 'date'].includes(sortParam)) {
      nextFilters.sort = sortParam as DashboardFilterState['sort']
    }

    const directionParam = searchParams.get('direction')
    if (directionParam === 'asc' || directionParam === 'desc') {
      nextFilters.direction = directionParam
    }

    const qParam = searchParams.get('q')
    if (qParam) {
      nextFilters.q = qParam
    }

    const startParam = searchParams.get('start')
    if (startParam) {
      nextFilters.start = startParam
    }

    const endParam = searchParams.get('end')
    if (endParam) {
      nextFilters.end = endParam
    }

    const limitParam = searchParams.get('limit')
    if (limitParam) {
      const parsed = Number.parseInt(limitParam, 10)
      if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 100) {
        nextFilters.limit = parsed
      }
    }

    if (!signature && typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(filterStorageKey)
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as Partial<DashboardFilterState>
          if (parsed.status && ['all', 'pending', 'confirmed', 'declined', 'cancelled', 'expired'].includes(parsed.status)) {
            nextFilters.status = parsed.status as DashboardFilterState['status']
          }
          if (parsed.sort && ['latest', 'date'].includes(parsed.sort)) {
            nextFilters.sort = parsed.sort as DashboardFilterState['sort']
          }
          if (parsed.direction === 'asc' || parsed.direction === 'desc') {
            nextFilters.direction = parsed.direction
          }
          if (parsed.q) {
            nextFilters.q = parsed.q
          }
          if (parsed.start) {
            nextFilters.start = parsed.start
          }
          if (parsed.end) {
            nextFilters.end = parsed.end
          }
          if (typeof parsed.limit === 'number' && parsed.limit >= 1 && parsed.limit <= 100) {
            nextFilters.limit = parsed.limit
          }
        } catch {
          // ignore malformed storage
        }
      }
    }

    if (nextFilters.start && nextFilters.end && nextFilters.start > nextFilters.end) {
      nextFilters.end = ''
    }

    filtersRef.current = nextFilters
    setStatusFilter(nextFilters.status)
    setSortBy(nextFilters.sort)
    setSortDirection(nextFilters.direction)
    setSearchInput(nextFilters.q)
    setStartDate(nextFilters.start)
    setEndDate(nextFilters.end)
    setPageSize(nextFilters.limit)
    setAppliedSearch(nextFilters.q)
    writeFiltersToStorage(nextFilters)

    if (!signature) {
      const params = buildSearchParams(nextFilters)
      const storedSignature = params.toString()
      if (storedSignature) {
        suppressParamsSyncRef.current = true
        router.replace(`${pathname}?${storedSignature}`, { scroll: false })
        lastParamsRef.current = storedSignature
      } else {
        lastParamsRef.current = ''
      }
    } else {
      lastParamsRef.current = signature
    }

    const controller = new AbortController()
    refreshBase({ silent: true, signal: controller.signal }).catch(() => undefined)
    return () => controller.abort()
  }, [searchParams, buildSearchParams, filterStorageKey, pathname, profileId, refreshBase, router, writeFiltersToStorage])

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

  useEffect(() => {
    const handleScroll = () => {
      if (typeof window === 'undefined') return
      sessionStorage.setItem(scrollKeyRef.current, String(window.scrollY))
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [profileId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (restoredRef.current) return
    if (fetchStatus !== 'success' && fetchStatus !== 'error') return
    const stored = sessionStorage.getItem(scrollKeyRef.current)
    if (stored) {
      const top = Number.parseInt(stored, 10)
      if (!Number.isNaN(top)) {
        window.scrollTo({ top })
      }
    }
    restoredRef.current = true
  }, [fetchStatus])

  const handleStatusFilterChange = useCallback(
    (value: DashboardFilterState['status']) => {
      setStatusFilter(value)
      if (filtersRef.current.status === value) {
        return
      }
      updateFilters({ status: value }, { silent: true })
    },
    [updateFilters],
  )

  const handleSortChange = useCallback(
    (value: DashboardFilterState['sort']) => {
      setSortBy(value)
      if (filtersRef.current.sort === value) {
        return
      }
      updateFilters({ sort: value }, { silent: true })
    },
    [updateFilters],
  )

  const handleDirectionChange = useCallback(
    (value: DashboardFilterState['direction']) => {
      setSortDirection(value)
      if (filtersRef.current.direction === value) {
        return
      }
      updateFilters({ direction: value }, { silent: true })
    },
    [updateFilters],
  )

  const handleLimitChange = useCallback(
    (value: number) => {
      if (filtersRef.current.limit === value) {
        return
      }
      setPageSize(value)
      updateFilters({ limit: value }, { silent: true })
    },
    [updateFilters],
  )

  const handleStartDateChange = useCallback(
    (value: string) => {
      const trimmed = value.trim()
      const currentEnd = filtersRef.current.end
      if (trimmed && currentEnd && trimmed > currentEnd) {
        push('error', '開始日は終了日より前に設定してください。')
        return
      }
      setStartDate(trimmed)
      if (filtersRef.current.start === trimmed) {
        return
      }
      updateFilters({ start: trimmed }, { silent: true })
    },
    [push, updateFilters],
  )

  const handleEndDateChange = useCallback(
    (value: string) => {
      const trimmed = value.trim()
      const currentStart = filtersRef.current.start
      if (trimmed && currentStart && trimmed < currentStart) {
        push('error', '終了日は開始日と同じか後の日付を指定してください。')
        return
      }
      setEndDate(trimmed)
      if (filtersRef.current.end === trimmed) {
        return
      }
      updateFilters({ end: trimmed }, { silent: true })
    },
    [push, updateFilters],
  )

  const handleResetDateRange = useCallback(() => {
    if (!filtersRef.current.start && !filtersRef.current.end) {
      return
    }
    setStartDate('')
    setEndDate('')
    updateFilters({ start: '', end: '' }, { silent: true })
  }, [updateFilters])

  const handleSearchInputChange = useCallback((value: string) => {
    setSearchInput(value)
  }, [])

  const handleSearchSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const trimmed = searchInput.trim()
      setSearchInput(trimmed)
      if (filtersRef.current.q === trimmed) {
        return
      }
      updateFilters({ q: trimmed }, { silent: true })
    },
    [searchInput, updateFilters],
  )

  const handleClearSearch = useCallback(() => {
    setSearchInput('')
    if (filtersRef.current.q) {
      updateFilters({ q: '' }, { silent: true })
    }
  }, [updateFilters])

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) {
      return
    }
    setIsLoadingMore(true)
    try {
      const data = await fetchDashboardReservations(profileId, {
        ...buildFetchParams(),
        cursor: nextCursor,
        cursorDirection: 'forward',
      })
      const existingIds = new Set(itemsRef.current.map((item) => item.id))
      const appended = data.reservations.filter((item) => !existingIds.has(item.id))
      if (appended.length) {
        itemsRef.current = [...itemsRef.current, ...appended]
        setItems((prev) => [...prev, ...appended])
      }
      setNextCursor(data.next_cursor ?? null)
      if (!prevCursor && data.prev_cursor) {
        setPrevCursor(data.prev_cursor)
      }
      setTotal(data.total)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '追加の予約取得に失敗しました。時間をおいて再度お試しください。'
      push('error', message)
    } finally {
      setIsLoadingMore(false)
    }
  }, [buildFetchParams, isLoadingMore, nextCursor, prevCursor, profileId, push])

  const handleLoadPrevious = useCallback(async () => {
    if (!prevCursor || isLoadingPrevious) {
      return
    }
    setIsLoadingPrevious(true)
    try {
      const data = await fetchDashboardReservations(profileId, {
        ...buildFetchParams(),
        cursor: prevCursor,
        cursorDirection: 'backward',
      })
      const existingIds = new Set(itemsRef.current.map((item) => item.id))
      const prepended = data.reservations.filter((item) => !existingIds.has(item.id))
      if (prepended.length) {
        itemsRef.current = [...prepended, ...itemsRef.current]
        setItems((prev) => [...prepended, ...prev])
      }
      setPrevCursor(data.prev_cursor ?? null)
      if (data.next_cursor) {
        setNextCursor((current) => current ?? data.next_cursor ?? null)
      }
      setTotal(data.total)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '最新の予約取得に失敗しました。時間をおいて再度お試しください。'
      push('error', message)
    } finally {
      setIsLoadingPrevious(false)
    }
  }, [buildFetchParams, isLoadingPrevious, prevCursor, profileId, push])

  const openReservation = useCallback((reservation: DashboardReservationItem) => {
    setActiveReservation(reservation)
  }, [])

  const closeReservation = useCallback(() => {
    setActiveReservation(null)
  }, [])

  const decideReservation = useCallback(
    async (reservation: DashboardReservationItem, decision: 'approve' | 'decline') => {
      const nextStatus = decision === 'approve' ? 'confirmed' : 'declined'
      try {
        const { reservation: updated, conflict } = await updateDashboardReservation(profileId, reservation.id, {
          status: nextStatus,
        })
        push('success', `「${reservation.customer_name}」の予約を${decision === 'approve' ? '承認' : '辞退'}しました。`)
        if (conflict) {
          push('error', '他の予約と時間が重複しています。スケジュールをご確認ください。')
        }
        const asyncStatus = updated.async_job?.status
        if (asyncStatus === 'failed') {
          push('error', '通知の登録に失敗しました。再送信をお試しください。', {
            ttl: 0,
            actionLabel: '再送信',
            onAction: async () => {
              if (!updated.async_job?.error) return
              try {
                await enqueueAsyncJob({
                  type: 'reservation_notification',
                  notification: {
                    reservation_id: updated.id,
                    shop_id: profileId,
                    shop_name: updated.customer_name,
                    customer_name: updated.customer_name,
                    customer_phone: updated.customer_phone,
                    desired_start: updated.desired_start,
                    desired_end: updated.desired_end,
                    status: updated.status,
                  },
                })
                push('success', '通知を再登録しました。')
              } catch {
                push('error', '通知の再登録に失敗しました。時間をおいて再度お試しください。')
              }
            },
          })
        }
        closeReservation()
        await refresh()
        router.refresh()
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('reservation:updated', { detail: { shopId: profileId } }))
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : '予約の更新に失敗しました。時間をおいて再度お試しください。'
        push('error', message)
      }
    },
    [closeReservation, profileId, push, refresh, router],
  )

  const conflictIds = useMemo(() => {
    const set = new Set<string>()
    const relevant = items.filter((item) => ['pending', 'confirmed'].includes(item.status))
    for (let i = 0; i < relevant.length; i += 1) {
      const current = relevant[i]
      const currentStart = new Date(current.desired_start).getTime()
      const currentEnd = new Date(current.desired_end).getTime()
      for (let j = i + 1; j < relevant.length; j += 1) {
        const other = relevant[j]
        const otherStart = new Date(other.desired_start).getTime()
        const otherEnd = new Date(other.desired_end).getTime()
        if (currentStart < otherEnd && currentEnd > otherStart) {
          set.add(current.id)
          set.add(other.id)
        }
      }
    }
    return set
  }, [items])

  const filterSummary = useMemo(() => {
    const segments: string[] = []
    if (statusFilter !== DEFAULT_FILTERS.status) {
      const labelMap: Record<DashboardFilterState['status'], string> = {
        all: 'すべて',
        pending: '承認待ち',
        confirmed: '承認済み',
        declined: '辞退済み',
        cancelled: 'キャンセル',
        expired: '期限切れ',
      }
      segments.push(`ステータス: ${labelMap[statusFilter]}`)
    }
    if (startDate || endDate) {
      const startLabel = startDate || '指定なし'
      const endLabel = endDate || '指定なし'
      segments.push(`期間: ${startLabel}〜${endLabel}`)
    }
    if (appliedSearch) {
      segments.push(`検索: "${appliedSearch}"`)
    }
    return segments.length ? segments.join(' / ') : null
  }, [appliedSearch, endDate, startDate, statusFilter])

  const state: DashboardReservationFeedState = {
    items,
    total,
    fetchStatus,
    errorMessage,
    isRefreshing,
    isLoadingMore,
    isLoadingPrevious,
    nextCursor,
    prevCursor,
    statusFilter,
    sortBy,
    sortDirection,
    startDate,
    endDate,
    searchInput,
    appliedSearch,
    pageSize,
    activeReservation,
  }

  const derived: DashboardReservationFeedDerived = {
    conflictIds,
    filterSummary,
  }

  const actions: DashboardReservationFeedActions = {
    refresh,
    handleStatusFilterChange,
    handleSortChange,
    handleDirectionChange,
    handleLimitChange,
    handleStartDateChange,
    handleEndDateChange,
    handleResetDateRange,
    handleSearchInputChange,
    handleSearchSubmit,
    handleClearSearch,
    handleLoadMore,
    handleLoadPrevious,
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
