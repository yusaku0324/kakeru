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
      // Show after scrolling past 100px (quicker access)
      const shouldShow = window.scrollY > 100
      setIsVisible(shouldShow)

      // Hide when near the footer (last 100px of page)
      const scrollBottom = window.scrollY + window.innerHeight
      const documentHeight = document.documentElement.scrollHeight
      const nearBottom = documentHeight - scrollBottom < 100
      setIsAtBottom(nearBottom)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // Initial check
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  if (!isVisible || isAtBottom) return null

  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-300 md:hidden">
      <div className="flex items-center gap-1 rounded-full border border-white/20 bg-black/80 p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.25)] backdrop-blur-md">
        <button
          type="button"
          onClick={() => openReservationOverlay(overlay)}
          className="flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary px-6 py-3 text-sm font-bold text-white transition-all active:scale-95"
        >
          <span>Web予約</span>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </button>

        {tel && (
          <a
            href={`tel:${tel}`}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 active:scale-95"
            aria-label="電話予約"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"
              />
            </svg>
          </a>
        )}
      </div>
    </div>
  )
}
