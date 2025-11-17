'use client'

import { useEffect } from 'react'

type Props = {
  reservationId?: string
  shopId?: string
}

function sendGtagEvent(event: string, params: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  const win = window as any
  if (typeof win.gtag === 'function') {
    win.gtag('event', event, params)
    return
  }
  win.dataLayer = win.dataLayer || []
  win.dataLayer.push({ event, ...params })
}

export default function ReservationThankYouTracker({ reservationId, shopId }: Props) {
  useEffect(() => {
    if (!reservationId && !shopId) return
    sendGtagEvent('reservation_complete', {
      reservation_id: reservationId || undefined,
      shop_id: shopId || undefined,
    })
  }, [reservationId, shopId])
  return null
}
