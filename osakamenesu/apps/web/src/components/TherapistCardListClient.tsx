"use client"

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import TherapistCard, { type TherapistHit } from '@/components/staff/TherapistCard'

import ReservationOverlay from './ReservationOverlay'

type TherapistCardListClientProps = {
  therapists: TherapistHit[]
  className?: string
  variant?: 'grid' | 'featured'
}

export function TherapistCardListClient({ therapists, className, variant = 'grid' }: TherapistCardListClientProps) {
  const [selected, setSelected] = useState<TherapistHit | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (!selected) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [selected])

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  return (
    <>
      <div className={className}>
        {therapists.map((hit) => (
          <TherapistCard key={hit.id} hit={hit} variant={variant} onReserve={() => setSelected(hit)} />
        ))}
      </div>
      {mounted && selected
        ? createPortal(<ReservationOverlay hit={selected} onClose={() => setSelected(null)} />, document.body)
        : null}
    </>
  )
}
