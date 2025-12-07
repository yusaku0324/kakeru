'use client'

import Link from 'next/link'
import { useCallback, useMemo } from 'react'

import SafeImage from '@/components/SafeImage'
import { openReservationOverlay } from '@/components/reservationOverlayBus'
import { type NextAvailableSlotPayload } from '@/lib/nextAvailableSlot'
import { useTherapistFavorites } from './TherapistFavoritesProvider'

export type TherapistHit = {
  id: string
  therapistId: string | null
  staffId: string
  name: string
  alias: string | null
  headline: string | null
  specialties: string[]
  avatarUrl: string | null
  rating: number | null
  reviewCount: number | null
  shopId: string
  shopSlug: string | null
  shopName: string
  shopArea: string
  shopAreaName: string | null
  todayAvailable: boolean | null
  nextAvailableSlot: NextAvailableSlotPayload | null
  mood_tag?: string | null
  style_tag?: string | null
  look_type?: string | null
  contact_style?: string | null
  hobby_tags?: string[] | null
  talk_level?: string | null
}

function formatNextSlotLabel(
  slot: NextAvailableSlotPayload | null,
  todayAvailable: boolean | null,
): string | null {
  if (todayAvailable) return '本日空きあり'
  if (!slot?.start_at) return null
  const startDate = new Date(slot.start_at)
  if (Number.isNaN(startDate.getTime())) return null
  const now = new Date()
  const isToday =
    startDate.getFullYear() === now.getFullYear() &&
    startDate.getMonth() === now.getMonth() &&
    startDate.getDate() === now.getDate()
  const hours = startDate.getHours()
  const minutes = startDate.getMinutes()
  const timeStr = minutes === 0 ? `${hours}時` : `${hours}時${minutes}分`

  if (isToday) {
    return `次回 ${timeStr}から`
  }
  const month = startDate.getMonth() + 1
  const day = startDate.getDate()
  return `${month}月${day}日 ${timeStr}から`
}

function buildStaffHref(hit: TherapistHit) {
  const base = hit.shopSlug || hit.shopId
  return `/profiles/${base}/staff/${encodeURIComponent(hit.staffId)}`
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
      fill={filled ? '#ef4444' : 'none'}
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.318 6.318a4.5 4.5 0 0 1 6.364 0L12 7.636l1.318-1.318a4.5 4.5 0 1 1 6.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 0 1 0-6.364z"
      />
    </svg>
  )
}

type TherapistCardProps = {
  hit: TherapistHit
  variant?: 'grid' | 'featured'
  onReserve?: (hit: TherapistHit) => void
  showReserveLink?: boolean
  useOverlay?: boolean
}

export function TherapistCard({ hit, onReserve, useOverlay = false }: TherapistCardProps) {
  const { isFavorite, toggleFavorite, isProcessing } = useTherapistFavorites()
  const staffHref = buildStaffHref(hit)
  const therapistId = useMemo(() => {
    const candidate = hit.therapistId?.trim()
    if (!candidate) return null
    return candidate
  }, [hit.therapistId])
  const favorite = therapistId ? isFavorite(therapistId) : false
  const processing = therapistId ? isProcessing(therapistId) : false
  const dataTherapistId = therapistId ?? hit.staffId ?? null
  const ariaPressed = favorite ? 'true' : 'false'
  const nextSlotPayload = hit.nextAvailableSlot ?? null
  const availabilityLabel = formatNextSlotLabel(nextSlotPayload, hit.todayAvailable ?? null)

  const handleOverlayReserve = useCallback(() => {
    openReservationOverlay({
      hit,
      defaultStart: nextSlotPayload?.start_at ?? null,
    })
  }, [hit, nextSlotPayload])

  // When useOverlay or onReserve is set, clicking anywhere on the card opens the overlay/calls onReserve
  const isClickableCard = useOverlay || !!onReserve

  const handleCardClick = useCallback(() => {
    if (onReserve) {
      onReserve(hit)
    } else if (useOverlay) {
      handleOverlayReserve()
    }
  }, [onReserve, useOverlay, hit, handleOverlayReserve])

  return (
    <div
      className={`group relative rounded-xl bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow ${isClickableCard ? 'cursor-pointer' : ''}`}
      data-testid="therapist-card"
      onClick={isClickableCard ? handleCardClick : undefined}
      role={isClickableCard ? 'button' : undefined}
      tabIndex={isClickableCard ? 0 : undefined}
      onKeyDown={isClickableCard ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick() } } : undefined}
    >
      {/* Favorite button */}
      <button
        type="button"
        disabled={!therapistId || processing}
        aria-pressed={ariaPressed}
        aria-label={favorite ? 'お気に入りから削除' : 'お気に入りに追加'}
        title={favorite ? 'お気に入りから削除' : 'お気に入りに追加'}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          if (therapistId) {
            void toggleFavorite({ therapistId, shopId: hit.shopId })
          }
        }}
        className={`absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-brand-primary shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary ${
          favorite ? 'text-red-500' : ''
        } ${processing ? 'opacity-60' : 'hover:bg-white'}`}
        data-testid="therapist-favorite-toggle"
        data-therapist-id={dataTherapistId ?? undefined}
      >
        <HeartIcon filled={favorite} />
        <span className="sr-only">{favorite ? 'お気に入りから削除' : 'お気に入りに追加'}</span>
      </button>

      {/* Image */}
      {isClickableCard ? (
        <div className="relative aspect-square overflow-hidden bg-neutral-100">
          {hit.avatarUrl ? (
            <SafeImage
              src={hit.avatarUrl}
              alt={`${hit.name}の写真`}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              fallbackSrc="/images/placeholder-avatar.svg"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-4xl font-semibold text-neutral-textMuted">
              {hit.name.slice(0, 1)}
            </div>
          )}
        </div>
      ) : (
        <Link href={staffHref} className="block">
          <div className="relative aspect-square overflow-hidden bg-neutral-100">
            {hit.avatarUrl ? (
              <SafeImage
                src={hit.avatarUrl}
                alt={`${hit.name}の写真`}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                fallbackSrc="/images/placeholder-avatar.svg"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-4xl font-semibold text-neutral-textMuted">
                {hit.name.slice(0, 1)}
              </div>
            )}
          </div>
        </Link>
      )}

      {/* Info & Button */}
      <div className="p-2.5 space-y-2">
        <div className="text-center">
          {isClickableCard ? (
            <span className="text-sm font-semibold text-neutral-text">
              {hit.name}
            </span>
          ) : (
            <Link
              href={staffHref}
              className="text-sm font-semibold text-neutral-text hover:text-brand-primary transition"
            >
              {hit.name}
            </Link>
          )}
          {hit.rating && (
            <div className="flex items-center justify-center gap-1 text-xs text-neutral-text mt-0.5">
              <span className="text-amber-400">★</span>
              <span className="font-semibold">{hit.rating.toFixed(1)}</span>
            </div>
          )}
          {availabilityLabel && (
            <p className={`mt-1 text-[11px] font-medium ${
              hit.todayAvailable
                ? 'text-green-600'
                : 'text-amber-600'
            }`}>
              {availabilityLabel}
            </p>
          )}
        </div>
        {isClickableCard ? (
          <div
            className="w-full rounded-lg bg-brand-primary py-2 text-xs font-semibold text-white text-center transition hover:bg-brand-primary/90 active:scale-[0.98]"
          >
            予約する
          </div>
        ) : (
          <Link
            href={staffHref}
            className="block w-full rounded-lg bg-brand-primary py-2 text-center text-xs font-semibold text-white transition hover:bg-brand-primary/90 active:scale-[0.98]"
          >
            詳細を見る
          </Link>
        )}
      </div>
    </div>
  )
}

export default TherapistCard
