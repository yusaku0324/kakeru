'use client'

import { useCallback, useEffect, useRef, useState, KeyboardEvent } from 'react'

import SafeImage from '@/components/SafeImage'

type Props = {
  photos: string[]
  altBase: string
  /** Unique ID for ARIA attributes */
  id?: string
}

// Simple, tiny gradient LQIP (no Buffer dependency on client)
const BLUR_SVG = (() => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='8' height='6'><defs><linearGradient id='g' x1='0' x2='1'><stop stop-color='#e5e7eb'/><stop offset='1' stop-color='#cbd5e1'/></linearGradient></defs><rect width='8' height='6' fill='url(#g)'/></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
})()

export default function Gallery({ photos, altBase, id }: Props) {
  const viewRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const count = photos.length

  const goTo = useCallback(
    (i: number) => {
      const el = viewRef.current
      if (!el) return
      const w = el.clientWidth
      const clamped = Math.max(0, Math.min(count - 1, i))
      el.scrollTo({ left: clamped * w, behavior: 'smooth' })
    },
    [count],
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          goTo(index - 1)
          break
        case 'ArrowRight':
          e.preventDefault()
          goTo(index + 1)
          break
        case 'Home':
          e.preventDefault()
          goTo(0)
          break
        case 'End':
          e.preventDefault()
          goTo(count - 1)
          break
      }
    },
    [goTo, index, count],
  )

  // sync index when scrolling
  useEffect(() => {
    const el = viewRef.current
    if (!el) return
    const onScroll = () => {
      const w = el.clientWidth || 1
      const i = Math.round(el.scrollLeft / w)
      setIndex(Math.max(0, Math.min(count - 1, i)))
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [count])

  // drag to scroll with snapping + flick detection
  useEffect(() => {
    const el = viewRef.current
    if (!el) return
    let isDown = false
    let startX = 0
    let startLeft = 0
    let lastX = 0
    let lastT = 0
    let startT = 0
    const onPointerDown = (e: PointerEvent) => {
      isDown = true
      startX = e.clientX
      startLeft = el.scrollLeft
      lastX = e.clientX
      startT = lastT = performance.now()
      el.setPointerCapture(e.pointerId)
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!isDown) return
      const dx = e.clientX - startX
      el.scrollLeft = startLeft - dx
      lastX = e.clientX
      lastT = performance.now()
      e.preventDefault()
    }
    const onPointerUp = (e: PointerEvent) => {
      if (!isDown) return
      isDown = false
      const w = el.clientWidth || 1
      // velocity-based fling
      const dx = lastX - startX
      const dt = Math.max(1, lastT - startT)
      const v = dx / dt // px per ms
      const current = Math.round(el.scrollLeft / w)
      const target = Math.abs(dx) > 40 && Math.abs(v) > 0.3 ? current + (dx < 0 ? 1 : -1) : current
      goTo(target)
      try {
        el.releasePointerCapture(e.pointerId)
      } catch {}
    }
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerUp)
    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
    }
  }, [goTo])

  if (count === 0) {
    return <div className="relative aspect-[4/3] bg-gray-100" />
  }

  return (
    <div className="md:grid md:grid-cols-[96px_1fr] md:gap-3">
      {/* vertical thumbnails on md+ */}
      <div className="hidden md:flex md:flex-col md:gap-2 md:overflow-y-auto no-scrollbar">
        {photos.map((src, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            data-testid="gallery-thumb"
            data-active={i === index}
            className={`relative w-24 aspect-[4/3] shrink-0 rounded overflow-hidden ring-1 ${i === index ? 'ring-slate-900' : 'ring-slate-200'}`}
          >
            <SafeImage
              src={src}
              alt={`${altBase} thumbnail ${i + 1}`}
              fill
              sizes="96px"
              placeholder="blur"
              blurDataURL={BLUR_SVG}
              className="object-cover"
            />
          </button>
        ))}
      </div>

      {/* main slider + dots + mobile thumbnails */}
      <div className="space-y-2">
        <div
          ref={viewRef}
          data-testid="gallery-view"
          role="region"
          aria-roledescription="carousel"
          aria-label={`${altBase} gallery`}
          aria-live="polite"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          className="flex overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-smooth rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        >
          {photos.map((src, i) => (
            <div
              key={i}
              data-testid="gallery-slide"
              data-index={i}
              className="shrink-0 w-full snap-center"
            >
              <div className="relative aspect-[4/3] bg-gray-100">
                <SafeImage
                  src={src}
                  alt={`${altBase} ${i + 1}`}
                  fill
                  sizes="(max-width: 768px) 100vw, 672px"
                  placeholder="blur"
                  blurDataURL={BLUR_SVG}
                  className="object-cover"
                />
              </div>
            </div>
          ))}
        </div>

        {/* dots */}
        <div className="flex items-center justify-center gap-1">
          {photos.map((_, i) => (
            <button
              key={i}
              aria-label={`go to ${i + 1}`}
              onClick={() => goTo(i)}
              data-testid="gallery-dot"
              data-active={i === index}
              className={`h-2 w-2 rounded-full ${i === index ? 'bg-slate-900' : 'bg-slate-300'}`}
            />
          ))}
        </div>

        {/* thumbnails on mobile (horizontal) */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar md:hidden">
          {photos.map((src, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              data-testid="gallery-thumb"
              data-active={i === index}
              className={`relative h-16 w-20 shrink-0 rounded overflow-hidden ring-1 ${i === index ? 'ring-slate-900' : 'ring-slate-200'}`}
            >
              <SafeImage
                src={src}
                alt={`${altBase} thumbnail ${i + 1}`}
                fill
                sizes="80px"
                placeholder="blur"
                blurDataURL={BLUR_SVG}
                className="object-cover"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
