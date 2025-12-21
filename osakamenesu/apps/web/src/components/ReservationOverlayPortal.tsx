'use client'

import dynamic from 'next/dynamic'
import { useReservationOverlayBus, closeReservationOverlay } from './reservationOverlayBus'

// Dynamically import the heavy ReservationOverlay component
const ReservationOverlay = dynamic(
  () => import('./ReservationOverlay'),
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

export default function ReservationOverlayPortal() {
  const overlayState = useReservationOverlayBus()

  if (!overlayState) {
    return null
  }

  return <ReservationOverlay {...overlayState} onClose={closeReservationOverlay} />
}
