import { useEffect, useRef } from 'react'

import type { FetchStatus } from '../useDashboardReservationFeedState'

type UseScrollRestorationOptions = {
  profileId: string
  fetchStatus: FetchStatus
}

/**
 * Handles scroll position persistence and restoration for dashboard views.
 * Saves scroll position to sessionStorage on scroll and restores it after data loads.
 */
export function useScrollRestoration({ profileId, fetchStatus }: UseScrollRestorationOptions) {
  const restoredRef = useRef(false)
  const scrollKeyRef = useRef(`dashboard:reservation-feed:scroll:${profileId}`)

  // Save scroll position on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (typeof window === 'undefined') return
      sessionStorage.setItem(scrollKeyRef.current, String(window.scrollY))
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [profileId])

  // Restore scroll position after data loads
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
}
