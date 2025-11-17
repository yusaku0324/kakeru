'use client'

import { useEffect, useState } from 'react'

import {
  buildLatestReservationKey,
  loadLatestReservation,
  type LatestReservationSnapshot,
} from './storage'

export function useLatestReservation(shopId: string | null | undefined, slug?: string | null) {
  const [snapshot, setSnapshot] = useState<LatestReservationSnapshot | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!shopId) return

    const candidates = slug ? [shopId, slug] : [shopId]

    const hydrate = () => {
      for (const id of candidates) {
        const stored = loadLatestReservation(id)
        if (stored) {
          setSnapshot(stored)
          return
        }
      }
      setSnapshot(null)
    }

    hydrate()

    const handleStorage = (event: StorageEvent) => {
      if (event.key && !candidates.some((id) => event.key === buildLatestReservationKey(id))) {
        return
      }
      hydrate()
    }

    const handleCustom = (event: Event) => {
      const detail = (event as CustomEvent).detail as { shopId?: string } | undefined
      if (detail?.shopId && candidates.includes(detail.shopId)) {
        hydrate()
      }
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener('reservation:updated', handleCustom)
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('reservation:updated', handleCustom)
    }
  }, [shopId, slug])

  return snapshot
}
