'use client'

import ReservationOverlay from '@/components/ReservationOverlay'

import { closeReservationOverlay, useReservationOverlayBus } from './reservationOverlayBus'

export default function ReservationOverlayRoot() {
  const payload = useReservationOverlayBus()

  if (!payload) return null

  return <ReservationOverlay {...payload} onClose={closeReservationOverlay} />
}
