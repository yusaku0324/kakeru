'use client'

import Link from 'next/link'
import { useCallback, useMemo, useState } from 'react'

import SafeImage from '@/components/SafeImage'
import { openReservationOverlay } from '@/components/reservationOverlayBus'
import { normalizeAvailabilityDays } from '@/lib/availability'
import { type NextAvailableSlotPayload } from '@/lib/nextAvailableSlot'
import { formatSlotJp, type ScheduleSlot } from '@/lib/schedule'
import { useTherapistFavorites } from '@/features/favorites'

type AvailabilityDay = {
  date: string
  is_today?: boolean | null
  slots: Array<{ start_at: string; end_at: string; status: 'open' | 'tentative' | 'blocked' }>
}

/**
 * セラピストの空き状況を API から取得
 */
async function fetchTherapistAvailability(therapistId: string): Promise<AvailabilityDay[]> {
  try {
    const resp = await fetch(`/api/guest/therapists/${therapistId}/availability_slots`)
    if (!resp.ok) return []
    const data = await resp.json()
    return Array.isArray(data?.days) ? data.days : []
  } catch {
    return []
  }
}

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
  // API から取得した全てのスロット情報（ReservationOverlay に渡す用）
  availabilitySlots?: Array<{ start_at: string; end_at: string; status?: string }> | null
  mood_tag?: string | null
  style_tag?: string | null
  look_type?: string | null
  contact_style?: string | null
  hobby_tags?: string[] | null
  talk_level?: string | null
}

/**
 * NextAvailableSlotPayloadをScheduleSlot形式に変換する
 */
function toScheduleSlot(slot: NextAvailableSlotPayload | null): ScheduleSlot | null {
  if (!slot?.start_at) return null
  return {
    start_at: slot.start_at,
    end_at: slot.end_at ?? slot.start_at, // end_atがある場合はそれを使用、なければstart_atで代用
    status: slot.status === 'ok' ? 'open' : 'tentative',
  }
}

/**
 * 次回予約可能スロットのラベルを生成する
 *
 * 表示優先度:
 * 1. slot.start_at が存在 → "本日 18:00〜" / "明日 20:30〜" / "12月9日 14:00〜"
 * 2. todayAvailable === true & slot なし → "本日空きあり"
 * 3. それ以外 → null（表示なし）
 *
 * @param slot - APIから返却される next_available_slot オブジェクト
 * @param todayAvailable - 本日空きありフラグ（slotがない場合のfallback用）
 */
function formatNextSlotLabel(
  slot: NextAvailableSlotPayload | null,
  todayAvailable: boolean | null,
): string | null {
  // 優先度1: slot があれば formatSlotJp を使って "本日 18:00〜" 形式で表示
  const scheduleSlot = toScheduleSlot(slot)
  if (scheduleSlot) {
    const label = formatSlotJp(scheduleSlot, { fallbackLabel: null })
    if (label) return label
  }
  // slot がない場合は todayAvailable フラグで fallback
  if (todayAvailable) return '本日空きあり'
  return null
}

function buildStaffHref(hit: TherapistHit) {
  const base = hit.shopSlug || hit.shopId
  return `/profiles/${base}/staff/${encodeURIComponent(hit.staffId)}`
}

function HeartIcon({ filled, animate }: { filled: boolean; animate?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
      fill={filled ? '#ef4444' : 'none'}
      className={`h-4 w-4 transition-transform duration-200 ${animate ? 'scale-110' : 'scale-100'} ${filled ? 'drop-shadow-[0_0_3px_rgba(239,68,68,0.5)]' : ''}`}
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

type MenuOption = {
  id: string
  name: string
  price: number
  duration_minutes?: number | null
  description?: string | null
}

type TherapistCardProps = {
  hit: TherapistHit
  variant?: 'grid' | 'featured'
  onReserve?: (hit: TherapistHit) => void
  showReserveLink?: boolean
  useOverlay?: boolean
  menus?: MenuOption[] | null
  /** デモ店舗でも予約送信を許可する（force_demo_submit=1 用） */
  allowDemoSubmission?: boolean
}

export function TherapistCard({ hit, onReserve, useOverlay = false, menus, allowDemoSubmission }: TherapistCardProps) {
  const { isFavorite, toggleFavorite, isProcessing } = useTherapistFavorites()
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false)
  const [heartAnimate, setHeartAnimate] = useState(false)
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
  const todayLabelTestId = availabilityLabel?.includes('本日') ? 'today-label' : undefined

  // ラベルに「本日」が含まれていれば今日の空きあり（色判定用）
  const isTodayAvailable = availabilityLabel?.includes('本日') ?? false

  // API から取得した availabilitySlots を availabilityDays 形式に変換（統一ユーティリティ使用）
  const availabilityDays = useMemo(
    () => normalizeAvailabilityDays(hit.availabilitySlots),
    [hit.availabilitySlots],
  )

  const handleOverlayReserve = useCallback(async () => {
    // hit.availabilitySlots がある場合はそれを使用、ない場合は API から取得
    if (availabilityDays && availabilityDays.length > 0) {
      openReservationOverlay({
        hit,
        defaultStart: nextSlotPayload?.start_at ?? null,
        availabilityDays,
        menus: menus ?? undefined,
        allowDemoSubmission,
      })
      return
    }

    // API から空き状況を取得
    // 優先順位: therapistId (UUID) > staffId > name (バックエンドで名前からUUIDを解決)
    const targetId = therapistId ?? hit.staffId ?? hit.name
    if (!targetId) {
      // ID も名前もない場合は fallback なしでオーバーレイを開く
      openReservationOverlay({
        hit,
        defaultStart: nextSlotPayload?.start_at ?? null,
        menus: menus ?? undefined,
        allowDemoSubmission,
      })
      return
    }

    setIsLoadingAvailability(true)
    try {
      const fetchedDays = await fetchTherapistAvailability(targetId)
      openReservationOverlay({
        hit,
        defaultStart: nextSlotPayload?.start_at ?? null,
        availabilityDays: fetchedDays.length > 0 ? fetchedDays : undefined,
        menus: menus ?? undefined,
        allowDemoSubmission,
      })
    } finally {
      setIsLoadingAvailability(false)
    }
  }, [hit, nextSlotPayload, availabilityDays, therapistId, menus, allowDemoSubmission])

  // When useOverlay or onReserve is set, clicking anywhere on the card opens the overlay/calls onReserve
  const isClickableCard = useOverlay || !!onReserve

  const handleCardClick = useCallback(async () => {
    if (isLoadingAvailability) return
    if (onReserve) {
      onReserve(hit)
    } else if (useOverlay) {
      await handleOverlayReserve()
    }
  }, [onReserve, useOverlay, hit, handleOverlayReserve, isLoadingAvailability])

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-white/60 bg-white/80 shadow-[0_8px_32px_rgba(37,99,235,0.12)] backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_20px_48px_rgba(37,99,235,0.22)] hover:border-brand-primary/30 focus-within:ring-2 focus-within:ring-brand-primary/40 focus-within:ring-offset-2 ${isClickableCard ? 'cursor-pointer' : ''}`}
      data-testid="therapist-card"
      data-therapist-id={dataTherapistId ?? undefined}
      onClick={isClickableCard ? handleCardClick : undefined}
      role={isClickableCard ? 'button' : undefined}
      tabIndex={isClickableCard ? 0 : undefined}
      onKeyDown={isClickableCard ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick() } } : undefined}
    >
      {/* Glassmorphic background effect */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.08),transparent_50%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

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
            setHeartAnimate(true)
            setTimeout(() => setHeartAnimate(false), 300)
            void toggleFavorite({ therapistId, shopId: hit.shopId })
          }
        }}
        className={`absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-white/90 shadow-[0_4px_12px_rgba(0,0,0,0.1)] backdrop-blur-sm transition-all duration-200 hover:scale-110 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary/30 ${favorite ? 'text-red-500 border-red-200 bg-red-50/90' : 'text-neutral-400 hover:text-red-400 hover:border-red-200'
          } ${processing ? 'opacity-60' : ''}`}
        data-testid="therapist-favorite-toggle"
        data-therapist-id={dataTherapistId ?? undefined}
      >
        <HeartIcon filled={favorite} animate={heartAnimate} />
        <span className="sr-only">{favorite ? 'お気に入りから削除' : 'お気に入りに追加'}</span>
      </button>

      {/* Image */}
      {isClickableCard ? (
        <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-neutral-100 to-neutral-50">
          {hit.avatarUrl ? (
            <SafeImage
              src={hit.avatarUrl}
              alt={`${hit.name}の写真`}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-110"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              fallbackSrc="/images/placeholder-avatar.svg"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-brand-primary/10 to-brand-secondary/10 text-4xl font-semibold text-brand-primary/60">
              {hit.name.slice(0, 1)}
            </div>
          )}
          {/* Gradient overlay for text readability */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/40 to-transparent" />
          {/* Availability badge on image */}
          {availabilityLabel && (
            <div className={`absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold shadow-lg backdrop-blur-sm ${isTodayAvailable
                ? 'bg-emerald-500/90 text-white'
                : 'bg-amber-500/90 text-white'
              }`} data-testid="therapist-availability-badge">
              <span className={`h-1.5 w-1.5 rounded-full ${isTodayAvailable ? 'bg-white animate-pulse' : 'bg-white/80'}`} aria-hidden="true" />
              <span data-testid={todayLabelTestId}>{availabilityLabel}</span>
            </div>
          )}
        </div>
      ) : (
        <Link href={staffHref} className="block" prefetch>
          <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-neutral-100 to-neutral-50">
            {hit.avatarUrl ? (
              <SafeImage
                src={hit.avatarUrl}
                alt={`${hit.name}の写真`}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-110"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                fallbackSrc="/images/placeholder-avatar.svg"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-brand-primary/10 to-brand-secondary/10 text-4xl font-semibold text-brand-primary/60">
                {hit.name.slice(0, 1)}
              </div>
            )}
            {/* Gradient overlay for text readability */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/40 to-transparent" />
            {/* Availability badge on image */}
            {availabilityLabel && (
              <div className={`absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold shadow-lg backdrop-blur-sm ${isTodayAvailable
                  ? 'bg-emerald-500/90 text-white'
                  : 'bg-amber-500/90 text-white'
                }`} data-testid="therapist-availability-badge">
                <span className={`h-1.5 w-1.5 rounded-full ${isTodayAvailable ? 'bg-white animate-pulse' : 'bg-white/80'}`} aria-hidden="true" />
                <span data-testid={todayLabelTestId}>{availabilityLabel}</span>
              </div>
            )}
          </div>
        </Link>
      )}

      {/* Info & Button */}
      <div className="relative space-y-2.5 p-3">
        <div className="text-center">
          {isClickableCard ? (
            <h3 className="text-sm font-bold text-neutral-text tracking-wide truncate">
              {hit.name}
            </h3>
          ) : (
            <Link
              href={staffHref}
              prefetch
              className="block text-sm font-bold text-neutral-text tracking-wide transition-colors hover:text-brand-primary truncate"
            >
              {hit.name}
            </Link>
          )}
          {hit.shopAreaName && (
            <p className="mt-0.5 text-[10px] text-neutral-textMuted truncate">
              {hit.shopAreaName}
            </p>
          )}
          {/* 得意施術タグ */}
          {hit.specialties && hit.specialties.length > 0 && (
            <div className="mt-1.5 flex flex-wrap justify-center gap-1">
              {hit.specialties.slice(0, 3).map((specialty, idx) => (
                <span
                  key={idx}
                  className="inline-block rounded-full bg-brand-primary/10 px-2 py-0.5 text-[10px] font-medium text-brand-primary"
                >
                  {specialty}
                </span>
              ))}
            </div>
          )}
          {/* 一言PR */}
          {hit.headline && (
            <p className="mt-1.5 text-[10px] text-neutral-textMuted line-clamp-2 leading-relaxed">
              {hit.headline}
            </p>
          )}
          {hit.rating && (
            <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs">
              <span className="text-amber-500">★</span>
              <span className="font-bold text-amber-700">{hit.rating.toFixed(1)}</span>
              {hit.reviewCount && (
                <span className="text-amber-600/70">({hit.reviewCount})</span>
              )}
            </div>
          )}
        </div>
        {isClickableCard ? (
          <div
            className={`flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary py-2.5 text-xs font-bold text-white text-center shadow-[0_4px_16px_rgba(37,99,235,0.3)] transition-all duration-200 hover:shadow-[0_6px_20px_rgba(37,99,235,0.4)] active:scale-[0.98] ${isLoadingAvailability ? 'opacity-80' : ''}`}
            data-testid="therapist-cta"
          >
            {isLoadingAvailability ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                読み込み中...
              </>
            ) : (
              '予約する'
            )}
          </div>
        ) : (
          <Link
            href={staffHref}
            className="block w-full rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary py-2.5 text-center text-xs font-bold text-white shadow-[0_4px_16px_rgba(37,99,235,0.3)] transition-all duration-200 hover:shadow-[0_6px_20px_rgba(37,99,235,0.4)] active:scale-[0.98]"
            data-testid="therapist-cta"
          >
            詳細を見る
          </Link>
        )}
      </div>
    </div>
  )
}

export default TherapistCard
