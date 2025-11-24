'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type Options = {
  intervalMs?: number
  enabled?: boolean
}

type PollingResult<T> = {
  data: T | null
  error: Error | null
  loading: boolean
  refresh: () => void
}

export function usePolling<T>(
  fetcher: () => Promise<T>,
  { intervalMs = 30000, enabled = true }: Options = {},
): PollingResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const tick = useMemo(() => {
    const run = async () => {
      try {
        setLoading(true)
        const result = await fetcherRef.current()
        setData(result)
        setError(null)
      } catch (err) {
        if (err instanceof Error) setError(err)
        else setError(new Error('polling failed'))
      } finally {
        setLoading(false)
        if (enabled) {
          timerRef.current = setTimeout(run, intervalMs)
        }
      }
    }
    return run
  }, [enabled, intervalMs])

  const refresh = () => {
    clearTimer()
    tick()
  }

  useEffect(() => {
    if (!enabled) return
    tick()
    return () => {
      clearTimer()
    }
  }, [enabled, tick])

  return { data, error, loading, refresh }
}
