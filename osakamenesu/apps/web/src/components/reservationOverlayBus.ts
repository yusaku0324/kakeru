"use client"

import { useEffect, useState } from 'react'

import type { ReservationOverlayProps } from '@/components/ReservationOverlay'

type OverlayPayload = Omit<ReservationOverlayProps, 'onClose'>

type Listener = (payload: OverlayPayload | null) => void

const listeners = new Set<Listener>()

export function openReservationOverlay(payload: OverlayPayload) {
  for (const listener of listeners) {
    listener(payload)
  }
}

export function closeReservationOverlay() {
  for (const listener of listeners) {
    listener(null)
  }
}

export function useReservationOverlayBus() {
  const [state, setState] = useState<OverlayPayload | null>(null)

  useEffect(() => {
    const listener: Listener = (payload) => setState(payload)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  return state
}

