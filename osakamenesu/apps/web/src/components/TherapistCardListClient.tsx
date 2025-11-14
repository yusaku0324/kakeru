"use client"

import TherapistCard, { type TherapistHit } from '@/components/staff/TherapistCard'

import { openReservationOverlay } from './reservationOverlayBus'

type TherapistCardListClientProps = {
  therapists: TherapistHit[]
  className?: string
  variant?: 'grid' | 'featured'
}

export function TherapistCardListClient({ therapists, className, variant = 'grid' }: TherapistCardListClientProps) {
  return (
    <div className={className}>
      {therapists.map((hit) => (
        <TherapistCard
          key={hit.id}
          hit={hit}
          variant={variant}
          onReserve={(target) => {
            openReservationOverlay({ hit: target })
          }}
        />
      ))}
    </div>
  )
}
