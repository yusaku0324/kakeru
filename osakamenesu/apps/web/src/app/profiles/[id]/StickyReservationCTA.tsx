'use client'

import { useEffect, useState } from 'react'

import type { ReservationOverlayProps } from '@/components/ReservationOverlay'
import { openReservationOverlay } from '@/components/reservationOverlayBus'

type StickyReservationCTAProps = {
  overlay: Omit<ReservationOverlayProps, 'onClose'>
  tel?: string | null
}

export default function StickyReservationCTA({ overlay, tel }: StickyReservationCTAProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      // Show after scrolling past 400px
      const shouldShow = window.scrollY > 400
      setIsVisible(shouldShow)

      // Hide when near the footer (last 200px of page)
      const scrollBottom = window.scrollY + window.innerHeight
      const documentHeight = document.documentElement.scrollHeight
      const nearBottom = documentHeight - scrollBottom < 200
      setIsAtBottom(nearBottom)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // Initial check
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  if (!isVisible || isAtBottom) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-borderLight bg-white/95 px-4 py-3 backdrop-blur-sm md:hidden">
      <div className="mx-auto flex max-w-lg items-center gap-3">
        <button
          type="button"
          onClick={() => openReservationOverlay(overlay)}
          className="flex-1 rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:from-brand-primary/90 hover:to-brand-secondary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary/60"
        >
          Web予約する
        </button>
        {tel ? (
          <a
            href={`tel:${tel}`}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-neutral-borderLight bg-white text-neutral-text shadow-sm transition hover:bg-neutral-surface"
            aria-label="電話する"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"
              />
            </svg>
          </a>
        ) : null}
      </div>
    </div>
  )
}
