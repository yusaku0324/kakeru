'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type AvailabilitySlot = {
  start_at: string
  end_at: string
  status: 'open' | 'tentative' | 'blocked'
}

type AvailabilityDay = {
  date: string
  is_today?: boolean | null
  slots: AvailabilitySlot[]
}

type UseAvailabilityPollingOptions = {
  /** Therapist ID to fetch availability for */
  therapistId: string | null | undefined
  /** Polling interval in milliseconds (default: 30000 = 30s) */
  intervalMs?: number
  /** Whether polling is enabled (default: true when therapistId exists) */
  enabled?: boolean
  /** Callback when new availability data is fetched */
  onUpdate: (days: AvailabilityDay[]) => void
}

type UseAvailabilityPollingResult = {
  /** Whether a refresh is in progress */
  isRefreshing: boolean
  /** Last refresh timestamp */
  lastRefreshAt: number | null
  /** Error message if last fetch failed */
  error: string | null
  /** Manually trigger a refresh */
  refresh: () => Promise<void>
}

/**
 * Polls availability data for a therapist at regular intervals.
 * Uses the existing /api/guest/therapists/[therapistId]/availability_slots endpoint.
 */
export function useAvailabilityPolling({
  therapistId,
  intervalMs = 30000,
  enabled = true,
  onUpdate,
}: UseAvailabilityPollingOptions): UseAvailabilityPollingResult {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Use ref to avoid stale closure in interval callback
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  const fetchAvailability = useCallback(async () => {
    if (!therapistId) return

    setIsRefreshing(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/guest/therapists/${therapistId}/availability_slots`,
        { cache: 'no-store' }
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch availability: ${response.status}`)
      }

      const data = await response.json()

      // The API returns { days: AvailabilityDay[] }
      if (data && Array.isArray(data.days)) {
        onUpdateRef.current(data.days)
        setLastRefreshAt(Date.now())
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      console.error('[useAvailabilityPolling] Error:', message)
    } finally {
      setIsRefreshing(false)
    }
  }, [therapistId])

  // Set up polling interval
  useEffect(() => {
    if (!enabled || !therapistId) return

    // Initial fetch after a short delay (to avoid blocking initial render)
    const initialTimeout = setTimeout(() => {
      void fetchAvailability()
    }, 1000)

    // Set up interval for subsequent fetches
    const intervalId = setInterval(() => {
      void fetchAvailability()
    }, intervalMs)

    return () => {
      clearTimeout(initialTimeout)
      clearInterval(intervalId)
    }
  }, [enabled, therapistId, intervalMs, fetchAvailability])

  return {
    isRefreshing,
    lastRefreshAt,
    error,
    refresh: fetchAvailability,
  }
}
