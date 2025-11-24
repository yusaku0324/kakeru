'use client'

import clsx from 'clsx'
import Image from 'next/image'

export type ReservationHeroCardProps = {
  name: string
  images: (string | null)[]
  activeIndex: number
  onPrev: () => void
  onNext: () => void
  rating?: number | null
  reviewCount?: number | null
}

export function ReservationHeroCard({
  name,
  images,
  activeIndex,
  onPrev,
  onNext,
  rating,
  reviewCount,
}: ReservationHeroCardProps) {
  const showNavigation = images.length > 1
  const activeImage = images[activeIndex] ?? null

  return (
    <div className="relative overflow-hidden rounded-[36px] border border-white/45 bg-white/25 shadow-[0_28px_90px_rgba(21,93,252,0.28)] backdrop-blur-[28px]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(147,197,253,0.24)_0%,rgba(147,197,253,0)_60%),linear-gradient(200deg,rgba(255,255,255,0.75)_0%,rgba(240,248,255,0.35)_55%,rgba(227,233,255,0.25)_100%),url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22 viewBox=%220 0 40 40%22%3E%3Cpath d=%22M0 39h1v1H0zM39 0h1v1h-1z%22 fill=%22%23ffffff33%22/%3E%3C/svg%3E')]" />
      <div className="relative aspect-[4/3] overflow-hidden sm:aspect-[5/4] lg:aspect-square">
        {activeImage ? (
          <Image
            key={activeImage}
            src={activeImage}
            alt={`${name}の写真`}
            fill
            className="object-cover transition duration-500"
            sizes="(max-width: 768px) 80vw, 480px"
            priority
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-brand-primary/15 to-brand-secondary/20 text-4xl font-semibold text-brand-primary">
            <span>{name.slice(0, 1)}</span>
          </div>
        )}

        {showNavigation ? (
          <>
            <button
              type="button"
              onClick={onPrev}
              className="absolute left-4 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/85 text-lg text-brand-primary shadow-sm shadow-brand-primary/20 transition hover:bg-white"
              aria-label="前の写真"
            >
              ←
            </button>
            <button
              type="button"
              onClick={onNext}
              className="absolute right-4 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/85 text-lg text-brand-primary shadow-sm shadow-brand-primary/20 transition hover:bg-white"
              aria-label="次の写真"
            >
              →
            </button>
            <div className="pointer-events-none absolute inset-x-0 bottom-5 flex items-center justify-center gap-2">
              {images.map((_, index) => (
                <span
                  key={`hero-indicator-${index}`}
                  className={clsx(
                    'inline-flex h-1.5 w-8 rounded-full transition',
                    index === activeIndex ? 'bg-white' : 'bg-white/50',
                  )}
                />
              ))}
            </div>
          </>
        ) : null}

        <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-1 text-xs font-semibold text-brand-primary shadow-sm shadow-brand-primary/25">
          <span aria-hidden>★</span>
          {typeof rating === 'number' ? rating.toFixed(1) : '評価準備中'}
          {reviewCount ? (
            <span className="text-[11px] font-medium text-neutral-textMuted">
              口コミ {reviewCount}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
