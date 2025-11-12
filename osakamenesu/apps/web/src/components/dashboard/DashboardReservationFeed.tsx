"use client"

import clsx from 'clsx'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  fetchDashboardReservations,
  updateDashboardReservation,
  type DashboardReservationItem,
} from '@/lib/dashboard-reservations'
import { enqueueAsyncJob } from '@/lib/async-jobs'
import {
  getReservationStatusDisplay,
  RESERVATION_STATUS_BADGES,
  RESERVATION_STATUS_ICONS,
} from '@/components/reservations/status'
import { ReservationModal } from '@/components/dashboard/ReservationModal'
import { ToastContainer, useToast } from '@/components/useToast'

type DashboardReservationFeedProps = {
  profileId: string
  slug?: string | null
  limit?: number
  className?: string
}

type FetchStatus = 'idle' | 'loading' | 'success' | 'error'

const STATUS_OPTIONS: Array<{ value: 'all' | 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'expired'; label: string }> = [
  { value: 'all', label: 'すべて' },
  { value: 'pending', label: '承認待ち' },
  { value: 'confirmed', label: '承認済み' },
  { value: 'declined', label: '辞退済み' },
  { value: 'cancelled', label: 'キャンセル' },
  { value: 'expired', label: '期限切れ' },
]

const SORT_OPTIONS: Array<{ value: 'latest' | 'date'; label: string }> = [
  { value: 'latest', label: '受付日時' },
  { value: 'date', label: '希望日時' },
]

const DIRECTION_OPTIONS: Array<{ value: 'desc' | 'asc'; label: string }> = [
  { value: 'desc', label: '新しい順' },
  { value: 'asc', label: '古い順' },
]

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

type DashboardFilterState = {
  status: (typeof STATUS_OPTIONS)[number]['value']
  sort: (typeof SORT_OPTIONS)[number]['value']
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

export default function DashboardReservationFeed({
  profileId,
  slug,
  limit = 8,
  className,
}: DashboardReservationFeedProps) {
  const [items, setItems] = useState<DashboardReservationItem[]>([])
  const itemsRef = useRef<DashboardReservationItem[]>([])
  const [total, setTotal] = useState(0)
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeReservation, setActiveReservation] = useState<DashboardReservationItem | null>(null)

  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]['value']>('all')
  const [sortBy, setSortBy] = useState<(typeof SORT_OPTIONS)[number]['value']>('latest')
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc')
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

  const refresh = useCallback(
    async ({ silent = false, signal }: { silent?: boolean; signal?: AbortSignal } = {}) => {
      if (process.env.NODE_ENV === 'development') {
        console.debug('[DashboardReservationFeed] refresh()', {
          profileId,
          silent,
          filters: filtersRef.current,
          params: buildFetchParams(),
          paramsJson: JSON.stringify(buildFetchParams()),
        })
      }
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
        if (process.env.NODE_ENV === 'development') {
          console.log('[DashboardReservationFeed] fetched', {
            profileId,
            fetchParams,
            fetchParamsJson: JSON.stringify(fetchParams),
            count: data.reservations.length,
            total: data.total,
            next: data.next_cursor,
            prev: data.prev_cursor,
          })
        }
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
        if (process.env.NODE_ENV === 'development') {
          console.error('[DashboardReservationFeed] fetch error', { profileId, message, error })
        }
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
    [profileId, buildFetchParams, push],
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
      void refresh({ silent: options.silent ?? true })
    },
    [pushFiltersToUrl, refresh, setAppliedSearch, writeFiltersToStorage],
  )

  useEffect(() => {
    const signature = searchParams.toString()
    if (process.env.NODE_ENV === 'development') {
      console.debug('[DashboardReservationFeed] effect start', { profileId, signature })
    }

    if (suppressParamsSyncRef.current) {
      suppressParamsSyncRef.current = false
      lastParamsRef.current = signature
    }

    let nextFilters: DashboardFilterState = { ...DEFAULT_FILTERS }

    const statusParam = searchParams.get('status')
    if (statusParam && STATUS_OPTIONS.some((option) => option.value === statusParam)) {
      nextFilters.status = statusParam as DashboardFilterState['status']
    }

    const sortParam = searchParams.get('sort')
    if (sortParam && SORT_OPTIONS.some((option) => option.value === sortParam)) {
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
          if (parsed.status && STATUS_OPTIONS.some((option) => option.value === parsed.status)) {
            nextFilters.status = parsed.status as DashboardFilterState['status']
          }
          if (parsed.sort && SORT_OPTIONS.some((option) => option.value === parsed.sort)) {
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
          // ignore broken storage
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
    refresh({ silent: true, signal: controller.signal })
      .catch(() => undefined)
    return () => controller.abort()
  }, [
    searchParams,
    buildSearchParams,
    filterStorageKey,
    pathname,
    profileId,
    refresh,
    router,
    writeFiltersToStorage,
  ])

  useEffect(() => {
    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail as { shopId?: string } | undefined
      if (!detail?.shopId) return
      const candidates = [profileId, slug].filter(Boolean)
      if (candidates.includes(detail.shopId)) {
        refresh()
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

  const handleOpenReservation = useCallback((reservation: DashboardReservationItem) => {
    setActiveReservation(reservation)
  }, [])

  const handleCloseModal = useCallback(() => {
    console.debug('[DashboardReservationFeed] close modal')
    setActiveReservation(null)
  }, [])

  const broadcastUpdate = useCallback(() => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(
      new CustomEvent('reservation:updated', {
        detail: { shopId: profileId },
      }),
    )
  }, [profileId])

  const handleDecision = useCallback(
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
        handleCloseModal()
        await refresh({ silent: true })
        router.refresh()
        broadcastUpdate()
      } catch (error) {
        const message =
          error instanceof Error ? error.message : '予約の更新に失敗しました。時間をおいて再度お試しください。'
        push('error', message)
      }
    },
    [profileId, push, handleCloseModal, refresh, broadcastUpdate, router],
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

  const body = useMemo(() => {
    if (fetchStatus === 'loading' && itemsRef.current.length === 0) {
      return (
        <div className="space-y-3">
          {Array.from({ length: Math.min(3, limit) }).map((_, idx) => (
            <div key={idx} className="animate-pulse rounded-[18px] bg-neutral-100 px-4 py-3">
              <div className="h-3 w-1/2 rounded bg-neutral-200" />
            </div>
          ))}
        </div>
      )
    }

    if (fetchStatus === 'error' && items.length === 0) {
      return (
        <div className="rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorMessage}
        </div>
      )
    }

    if (items.length === 0) {
      return (
        <div className="rounded-[18px] border border-neutral-borderLight/70 bg-white/80 px-4 py-3 text-sm text-neutral-textMuted">
          最新の予約リクエストはまだ登録されていません。Web 予約が届くと、ここに最新のステータスが表示されます。
        </div>
      )
    }

    return (
      <ul className="space-y-3">
        {items.map((item) => {
          const statusDisplay = getReservationStatusDisplay(item.status) ?? item.status
          const badgeClass =
            RESERVATION_STATUS_BADGES[item.status] ?? 'bg-neutral-200 text-neutral-600 border border-neutral-300'
          const statusIcon = RESERVATION_STATUS_ICONS[item.status] ?? 'ℹ️'
          const desiredStart = new Date(item.desired_start)
          const desiredEnd = new Date(item.desired_end)
          const createdAt = new Date(item.created_at)
          const desiredLabel = `${desiredStart.toLocaleString('ja-JP', {
            month: 'numeric',
            day: 'numeric',
            weekday: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}〜${desiredEnd.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`
          const createdAtLabel = createdAt.toLocaleString('ja-JP')
          const hasConflict = conflictIds.has(item.id)

          return (
            <li
              key={item.id}
              className="space-y-3 rounded-[20px] border border-neutral-borderLight/70 bg-white/90 px-4 py-3 shadow-sm shadow-brand-primary/5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-neutral-text">{item.customer_name}</div>
                <span className={clsx('inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold', badgeClass)}>
                  <span aria-hidden>{statusIcon}</span>
                  {statusDisplay}
                </span>
              </div>
              <dl className="grid gap-2 text-xs text-neutral-textMuted sm:grid-cols-2">
                <div className="space-y-1">
                  <dt className="font-semibold text-neutral-text">希望日時</dt>
                  <dd>{desiredLabel}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="font-semibold text-neutral-text">受付日時</dt>
                  <dd>{createdAtLabel}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="font-semibold text-neutral-text">連絡先</dt>
                  <dd>
                    <div>{item.customer_phone}</div>
                    {item.customer_email ? <div>{item.customer_email}</div> : null}
                  </dd>
                </div>
                {item.notes ? (
                  <div className="space-y-1 sm:col-span-2">
                    <dt className="font-semibold text-neutral-text">メモ</dt>
                    <dd className="whitespace-pre-line text-neutral-text">{item.notes}</dd>
                  </div>
                ) : null}
              </dl>
              {hasConflict ? (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  <span aria-hidden>⚠️</span>
                  <span>他の予約と時間が重複しています。スケジュールを調整してください。</span>
                </div>
              ) : null}
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => handleOpenReservation(item)}
                  className="inline-flex items-center gap-1 rounded-full border border-brand-primary/40 px-3 py-1 text-xs font-semibold text-brand-primary transition hover:bg-brand-primary/10"
                >
                  詳細を確認
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    )
  }, [items, conflictIds, limit, fetchStatus, errorMessage, handleOpenReservation])

  const handleStatusFilterChange = useCallback(
    (value: (typeof STATUS_OPTIONS)[number]['value']) => {
      setStatusFilter(value)
      if (filtersRef.current.status === value) {
        return
      }
      updateFilters({ status: value }, { silent: true })
    },
    [updateFilters],
  )

  const handleSortChange = useCallback(
    (value: (typeof SORT_OPTIONS)[number]['value']) => {
      setSortBy(value)
      if (filtersRef.current.sort === value) {
        return
      }
      updateFilters({ sort: value }, { silent: true })
    },
    [updateFilters],
  )

  const handleDirectionChange = useCallback(
    (value: 'desc' | 'asc') => {
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
  }, [nextCursor, isLoadingMore, profileId, buildFetchParams, prevCursor, push])

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
  }, [prevCursor, isLoadingPrevious, profileId, buildFetchParams, push])

  const filterSummary = useMemo(() => {
    const segments: string[] = []
    if (statusFilter !== DEFAULT_FILTERS.status) {
      const label = STATUS_OPTIONS.find((option) => option.value === statusFilter)?.label ?? statusFilter
      segments.push(`ステータス: ${label}`)
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

  return (
    <section className={clsx('space-y-5 rounded-xl border border-neutral-borderLight/60 bg-white/90 p-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-neutral-text">最近の予約リクエスト</h3>
          <p className="text-xs text-neutral-500">全 {total} 件中 {items.length} 件を表示中</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {prevCursor ? (
            <button
              type="button"
              onClick={handleLoadPrevious}
              disabled={isLoadingPrevious}
              className="inline-flex items-center gap-2 rounded-full border border-brand-primary/40 px-3 py-1.5 text-sm font-semibold text-brand-primary transition hover:bg-brand-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoadingPrevious ? (
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-primary/30 border-t-brand-primary" />
                  最新分を取得中…
                </span>
              ) : (
                '新しい予約を読み込む'
              )}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => refresh()}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-full border border-brand-primary/40 px-3 py-1.5 text-sm font-semibold text-brand-primary transition hover:bg-brand-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRefreshing ? (
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-primary/30 border-t-brand-primary" />
                更新中…
              </span>
            ) : (
              '最新の情報に更新'
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-neutral-600">
        <label className="flex items-center gap-2">
          <span className="font-semibold">ステータス</span>
          <select
            value={statusFilter}
            onChange={(event) => handleStatusFilterChange(event.target.value as (typeof STATUS_OPTIONS)[number]['value'])}
            className="rounded-full border border-neutral-300 bg-white px-2 py-1 text-xs"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className="font-semibold">並び替え</span>
          <select
            value={sortBy}
            onChange={(event) => handleSortChange(event.target.value as (typeof SORT_OPTIONS)[number]['value'])}
            className="rounded-full border border-neutral-300 bg-white px-2 py-1 text-xs"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className="font-semibold">順序</span>
          <select
            value={sortDirection}
            onChange={(event) => handleDirectionChange(event.target.value as 'desc' | 'asc')}
            className="rounded-full border border-neutral-300 bg-white px-2 py-1 text-xs"
          >
            {DIRECTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className="font-semibold">表示件数</span>
          <select
            value={pageSize}
            onChange={(event) => handleLimitChange(Number.parseInt(event.target.value, 10))}
            className="rounded-full border border-neutral-300 bg-white px-2 py-1 text-xs"
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option} 件
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-2">
          <span className="font-semibold">期間</span>
          <input
            type="date"
          value={startDate}
          onChange={(event) => handleStartDateChange(event.target.value)}
          className="rounded-full border border-neutral-300 px-3 py-1 text-xs focus:border-brand-primary focus:outline-none"
          aria-label="開始日"
        />
        <span className="text-neutral-400">〜</span>
        <input
          type="date"
          value={endDate}
          onChange={(event) => handleEndDateChange(event.target.value)}
          className="rounded-full border border-neutral-300 px-3 py-1 text-xs focus:border-brand-primary focus:outline-none"
          aria-label="終了日"
        />
        <button
          type="button"
          onClick={handleResetDateRange}
          className="rounded-full border border-neutral-300 px-2 py-1 text-xs text-neutral-500 transition hover:bg-neutral-100"
        >
          期間リセット
        </button>
      </div>

      <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
        <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="顧客名・電話・メールで検索"
            className="w-48 rounded-full border border-neutral-300 px-3 py-1 text-xs focus:border-brand-primary focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-full border border-brand-primary/40 px-3 py-1 text-xs font-semibold text-brand-primary transition hover:bg-brand-primary/10"
          >
            検索
          </button>
          <button
            type="button"
            onClick={handleClearSearch}
            className="rounded-full border border-neutral-300 px-2 py-1 text-xs text-neutral-500 transition hover:bg-neutral-100"
          >
            クリア
          </button>
        </form>
      </div>

      {body}

      {nextCursor && items.length ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="inline-flex items-center gap-2 rounded-full border border-neutral-borderLight/70 px-4 py-2 text-sm font-semibold text-neutral-text transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoadingMore ? '読み込み中…' : 'さらに読み込む'}
          </button>
        </div>
      ) : null}
      <ToastContainer toasts={toasts} onDismiss={remove} />
      <ReservationModal
        open={Boolean(activeReservation)}
        reservation={activeReservation}
        onClose={handleCloseModal}
        onApprove={(reservation) => handleDecision(reservation, 'approve')}
        onDecline={(reservation) => handleDecision(reservation, 'decline')}
        filterSummary={filterSummary}
      />
    </section>
  )
}
