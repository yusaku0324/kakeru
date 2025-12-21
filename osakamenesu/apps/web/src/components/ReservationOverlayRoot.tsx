'use client'

import dynamic from 'next/dynamic'
import { closeReservationOverlay, useReservationOverlayBus } from './reservationOverlayBus'

// Dynamically import the heavy ReservationOverlay component
// This reduces the initial bundle size since the overlay is only shown on demand
const ReservationOverlay = dynamic(
  () => import('@/components/ReservationOverlay'),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-xl">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-primary/30 border-t-brand-primary" />
        </div>
      </div>
    ),
  }
)

export default function ReservationOverlayRoot() {
  const payload = useReservationOverlayBus()

  if (!payload) return null

  return <ReservationOverlay {...payload} onClose={closeReservationOverlay} />
}
