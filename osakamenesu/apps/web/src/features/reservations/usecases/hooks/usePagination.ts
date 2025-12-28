import { useCallback, useRef, useState } from 'react'

import {
  fetchDashboardReservations,
  type DashboardReservationItem,
} from '@/lib/dashboard-reservations'
import { RESERVATION_ERRORS, extractErrorMessage } from '@/lib/error-messages'

type ToastPush = (type: 'success' | 'error', message: string) => void

export type FetchParams = {
  status?: DashboardReservationItem['status']
  limit: number
  sort: 'latest' | 'date'
  direction: 'desc' | 'asc'
  q?: string
  start?: string
  end?: string
}

type UsePaginationOptions = {
  profileId: string
  push: ToastPush
  buildFetchParams: () => FetchParams
}

export type PaginationState = {
  items: DashboardReservationItem[]
  total: number
  nextCursor: string | null
  prevCursor: string | null
  isLoadingMore: boolean
  isLoadingPrevious: boolean
}

export type PaginationActions = {
  handleLoadMore: () => Promise<void>
  handleLoadPrevious: () => Promise<void>
  setItems: React.Dispatch<React.SetStateAction<DashboardReservationItem[]>>
  setTotal: React.Dispatch<React.SetStateAction<number>>
  setNextCursor: React.Dispatch<React.SetStateAction<string | null>>
  setPrevCursor: React.Dispatch<React.SetStateAction<string | null>>
  itemsRef: React.MutableRefObject<DashboardReservationItem[]>
}

/**
 * Handles cursor-based pagination for reservation lists.
 * Supports loading more items forward and backward.
 */
export function usePagination({
  profileId,
  push,
  buildFetchParams,
}: UsePaginationOptions): PaginationState & PaginationActions {
  const [items, setItems] = useState<DashboardReservationItem[]>([])
  const itemsRef = useRef<DashboardReservationItem[]>([])
  const [total, setTotal] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [prevCursor, setPrevCursor] = useState<string | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isLoadingPrevious, setIsLoadingPrevious] = useState(false)

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return

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
      const message = extractErrorMessage(error, RESERVATION_ERRORS.LOAD_MORE_FAILED)
      push('error', message)
    } finally {
      setIsLoadingMore(false)
    }
  }, [buildFetchParams, isLoadingMore, nextCursor, prevCursor, profileId, push])

  const handleLoadPrevious = useCallback(async () => {
    if (!prevCursor || isLoadingPrevious) return

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
      const message = extractErrorMessage(error, RESERVATION_ERRORS.LOAD_PREVIOUS_FAILED)
      push('error', message)
    } finally {
      setIsLoadingPrevious(false)
    }
  }, [buildFetchParams, isLoadingPrevious, prevCursor, profileId, push])

  return {
    items,
    total,
    nextCursor,
    prevCursor,
    isLoadingMore,
    isLoadingPrevious,
    handleLoadMore,
    handleLoadPrevious,
    setItems,
    setTotal,
    setNextCursor,
    setPrevCursor,
    itemsRef,
  }
}
