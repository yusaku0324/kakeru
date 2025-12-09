'use client'

import { useReservationOverlayBus, closeReservationOverlay } from './reservationOverlayBus'
import ReservationOverlay from './ReservationOverlay'

export default function ReservationOverlayPortal() {
  const overlayState = useReservationOverlayBus()

  if (!overlayState) {
    return null
  }

  return <ReservationOverlay {...overlayState} onClose={closeReservationOverlay} />
}
