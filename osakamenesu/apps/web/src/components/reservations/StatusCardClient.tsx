'use client'

import ReservationStatusCard from './StatusCard'
import { useLatestReservation } from './useLatestReservation'

type Props = {
  shopId: string
  slug?: string | null
  className?: string
}

export default function ReservationStatusCardClient({ shopId, slug, className }: Props) {
  const snapshot = useLatestReservation(shopId, slug)
  return (
    <ReservationStatusCard
      shopId={shopId}
      slug={slug ?? undefined}
      snapshot={snapshot}
      className={className}
    />
  )
}
