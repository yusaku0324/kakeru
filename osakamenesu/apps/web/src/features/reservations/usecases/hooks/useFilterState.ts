import { FormEvent, useCallback, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export type DashboardFilterState = {
  status: 'all' | 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'expired'
  sort: 'latest' | 'date'
  direction: 'desc' | 'asc'
  q: string
  start: string
  end: string
  limit: number
}

export const DEFAULT_FILTERS: DashboardFilterState = {
  status: 'all',
  sort: 'latest',
  direction: 'desc',
  q: '',
  start: '',
  end: '',
  limit: 20,
}

const VALID_STATUSES = ['all', 'pending', 'confirmed', 'declined', 'cancelled', 'expired'] as const
const VALID_SORTS = ['latest', 'date'] as const

type ToastPush = (type: 'success' | 'error', message: string) => void

type UseFilterStateOptions = {
  profileId: string
  limit: number
  push: ToastPush
  filtersRef: React.MutableRefObject<DashboardFilterState>
  onFiltersChange: (filters: DashboardFilterState, options?: { silent?: boolean }) => void
}

export type FilterStateValues = {
  statusFilter: DashboardFilterState['status']
  sortBy: DashboardFilterState['sort']
  sortDirection: DashboardFilterState['direction']
  startDate: string
  endDate: string
  searchInput: string
  appliedSearch: string
  pageSize: number
}

export type FilterStateActions = {
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
  updateFilters: (partial: Partial<DashboardFilterState>, options?: { silent?: boolean }) => void
  initializeFilters: () => DashboardFilterState
}

function parseFiltersFromParams(searchParams: URLSearchParams): Partial<DashboardFilterState> {
  const filters: Partial<DashboardFilterState> = {}

  const statusParam = searchParams.get('status')
  if (statusParam && VALID_STATUSES.includes(statusParam as DashboardFilterState['status'])) {
    filters.status = statusParam as DashboardFilterState['status']
  }

  const sortParam = searchParams.get('sort')
  if (sortParam && VALID_SORTS.includes(sortParam as DashboardFilterState['sort'])) {
    filters.sort = sortParam as DashboardFilterState['sort']
  }

  const directionParam = searchParams.get('direction')
  if (directionParam === 'asc' || directionParam === 'desc') {
    filters.direction = directionParam
  }

  const qParam = searchParams.get('q')
  if (qParam) filters.q = qParam

  const startParam = searchParams.get('start')
  if (startParam) filters.start = startParam

  const endParam = searchParams.get('end')
  if (endParam) filters.end = endParam

  const limitParam = searchParams.get('limit')
  if (limitParam) {
    const parsed = Number.parseInt(limitParam, 10)
    if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 100) {
      filters.limit = parsed
    }
  }

  return filters
}

function parseFiltersFromStorage(stored: string | null): Partial<DashboardFilterState> {
  if (!stored) return {}

  try {
    const parsed = JSON.parse(stored) as Partial<DashboardFilterState>
    const filters: Partial<DashboardFilterState> = {}

    if (parsed.status && VALID_STATUSES.includes(parsed.status)) {
      filters.status = parsed.status
    }
    if (parsed.sort && VALID_SORTS.includes(parsed.sort)) {
      filters.sort = parsed.sort
    }
    if (parsed.direction === 'asc' || parsed.direction === 'desc') {
      filters.direction = parsed.direction
    }
    if (parsed.q) filters.q = parsed.q
    if (parsed.start) filters.start = parsed.start
    if (parsed.end) filters.end = parsed.end
    if (typeof parsed.limit === 'number' && parsed.limit >= 1 && parsed.limit <= 100) {
      filters.limit = parsed.limit
    }

    return filters
  } catch {
    return {}
  }
}

/**
 * Manages filter state with URL and sessionStorage synchronization.
 * Handles status, sort, direction, date range, and search filters.
 */
export function useFilterState({
  profileId,
  limit,
  push,
  filtersRef,
  onFiltersChange,
}: UseFilterStateOptions): FilterStateValues & FilterStateActions {
  const [statusFilter, setStatusFilter] = useState<DashboardFilterState['status']>('all')
  const [sortBy, setSortBy] = useState<DashboardFilterState['sort']>('latest')
  const [sortDirection, setSortDirection] = useState<DashboardFilterState['direction']>('desc')
  const [searchInput, setSearchInput] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [pageSize, setPageSize] = useState(limit)

  // filtersRef is now passed in from the parent to allow sharing with other hooks
  const suppressParamsSyncRef = useRef(false)
  const lastParamsRef = useRef<string | null>(null)

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const filterStorageKey = useMemo(
    () => `dashboard:reservation-feed:filters:${profileId}`,
    [profileId],
  )

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
    if (filters.q) params.set('q', filters.q)
    if (filters.start) params.set('start', filters.start)
    if (filters.end) params.set('end', filters.end)
    if (filters.limit && filters.limit !== DEFAULT_FILTERS.limit) {
      params.set('limit', String(filters.limit))
    }
    return params
  }, [])

  const pushFiltersToUrl = useCallback(
    (filters: DashboardFilterState) => {
      const params = buildSearchParams(filters)
      const signature = params.toString()
      if (lastParamsRef.current === signature) return

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
        setAppliedSearch(typeof partial.q === 'string' ? partial.q : '')
      }
      if (Object.prototype.hasOwnProperty.call(partial, 'limit') && typeof next.limit === 'number') {
        setPageSize(next.limit)
      }

      writeFiltersToStorage(next)
      pushFiltersToUrl(next)
      onFiltersChange(next, options)
    },
    [filtersRef, onFiltersChange, pushFiltersToUrl, writeFiltersToStorage],
  )

  // Initialize filters from URL or storage
  const initializeFilters = useCallback(() => {
    const signature = searchParams.toString()

    if (suppressParamsSyncRef.current) {
      suppressParamsSyncRef.current = false
      lastParamsRef.current = signature
    }

    let nextFilters: DashboardFilterState = { ...DEFAULT_FILTERS }

    // Parse from URL params first
    const urlFilters = parseFiltersFromParams(searchParams)
    nextFilters = { ...nextFilters, ...urlFilters }

    // Fall back to storage if no URL params
    if (!signature && typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(filterStorageKey)
      const storageFilters = parseFiltersFromStorage(stored)
      nextFilters = { ...nextFilters, ...storageFilters }
    }

    // Validate date range
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

    // Sync URL if needed
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

    return nextFilters
  }, [buildSearchParams, filterStorageKey, filtersRef, pathname, router, searchParams, writeFiltersToStorage])

  const handleStatusFilterChange = useCallback(
    (value: DashboardFilterState['status']) => {
      setStatusFilter(value)
      if (filtersRef.current.status === value) return
      updateFilters({ status: value }, { silent: true })
    },
    [filtersRef, updateFilters],
  )

  const handleSortChange = useCallback(
    (value: DashboardFilterState['sort']) => {
      setSortBy(value)
      if (filtersRef.current.sort === value) return
      updateFilters({ sort: value }, { silent: true })
    },
    [filtersRef, updateFilters],
  )

  const handleDirectionChange = useCallback(
    (value: DashboardFilterState['direction']) => {
      setSortDirection(value)
      if (filtersRef.current.direction === value) return
      updateFilters({ direction: value }, { silent: true })
    },
    [filtersRef, updateFilters],
  )

  const handleLimitChange = useCallback(
    (value: number) => {
      if (filtersRef.current.limit === value) return
      setPageSize(value)
      updateFilters({ limit: value }, { silent: true })
    },
    [filtersRef, updateFilters],
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
      if (filtersRef.current.start === trimmed) return
      updateFilters({ start: trimmed }, { silent: true })
    },
    [filtersRef, push, updateFilters],
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
      if (filtersRef.current.end === trimmed) return
      updateFilters({ end: trimmed }, { silent: true })
    },
    [filtersRef, push, updateFilters],
  )

  const handleResetDateRange = useCallback(() => {
    if (!filtersRef.current.start && !filtersRef.current.end) return
    setStartDate('')
    setEndDate('')
    updateFilters({ start: '', end: '' }, { silent: true })
  }, [filtersRef, updateFilters])

  const handleSearchInputChange = useCallback((value: string) => {
    setSearchInput(value)
  }, [])

  const handleSearchSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const trimmed = searchInput.trim()
      setSearchInput(trimmed)
      if (filtersRef.current.q === trimmed) return
      updateFilters({ q: trimmed }, { silent: true })
    },
    [filtersRef, searchInput, updateFilters],
  )

  const handleClearSearch = useCallback(() => {
    setSearchInput('')
    if (filtersRef.current.q) {
      updateFilters({ q: '' }, { silent: true })
    }
  }, [filtersRef, updateFilters])

  return {
    statusFilter,
    sortBy,
    sortDirection,
    startDate,
    endDate,
    searchInput,
    appliedSearch,
    pageSize,
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
    updateFilters,
    initializeFilters,
  }
}
