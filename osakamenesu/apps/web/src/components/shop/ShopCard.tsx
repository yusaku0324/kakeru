"use client"

import Image from 'next/image'
import Link from 'next/link'

import { FavoriteHeartIcon } from '@/components/FavoriteHeartIcon'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { useShopFavorites } from './ShopFavoritesProvider'

export type Promotion = {
  label: string
  description?: string | null
  expires_at?: string | null
  highlight?: string | null
}

export type ShopHit = {
  id: string
  slug?: string | null
  name: string
  store_name?: string | null
  area: string
  area_name?: string | null
  address?: string | null
  categories?: string[] | null
  service_tags?: string[] | null
  min_price: number
  max_price: number
  rating?: number | null
  review_count?: number | null
  lead_image_url?: string | null
  badges?: string[] | null
  today_available?: boolean | null
  next_available_at?: string | null
  distance_km?: number | null
  online_reservation?: boolean | null
  updated_at?: string | null
  promotions?: Promotion[] | null
  ranking_reason?: string | null
  price_band?: string | null
  price_band_label?: string | null
  has_promotions?: boolean | null
  has_discounts?: boolean | null
  promotion_count?: number | null
  ranking_score?: number | null
  diary_count?: number | null
  has_diaries?: boolean | null
  staff_preview?: Array<{
    id?: string
    name: string
    alias?: string | null
    headline?: string | null
    rating?: number | null
    review_count?: number | null
    avatar_url?: string | null
    specialties?: string[] | null
  }> | null
}

const formatter = new Intl.NumberFormat('ja-JP')
const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
  month: 'short',
  day: 'numeric',
  weekday: 'short',
})
const timeFormatter = new Intl.DateTimeFormat('ja-JP', {
  hour: '2-digit',
  minute: '2-digit',
})

function formatWaitLabel(nextAvailableAt?: string | null) {
  if (!nextAvailableAt) return null
  const now = new Date()
  const target = new Date(nextAvailableAt)
  if (Number.isNaN(target.getTime())) return null
  const diffMs = target.getTime() - now.getTime()
  if (diffMs <= 0) return 'すぐご案内'
  const totalMinutes = Math.round(diffMs / 60000)
  if (totalMinutes < 60) return `約${totalMinutes}分後`
  const totalHours = Math.floor(totalMinutes / 60)
  const remainMinutes = totalMinutes % 60
  if (totalHours < 24) {
    return `約${totalHours}時間${remainMinutes ? `${remainMinutes}分` : ''}後`
  }
  const days = Math.floor(totalHours / 24)
  const remainHours = totalHours % 24
  let label = `約${days}日`
  if (remainHours) label += `${remainHours}時間`
  if (remainMinutes && days < 3) label += `${remainMinutes}分`
  label += '後'
  return label
}

function getAvailability(hit: ShopHit): { label: string; tone: 'success' | 'danger' | 'neutral' } | null {
  const now = new Date()

  if (hit.next_available_at) {
    const at = new Date(hit.next_available_at)
    if (!Number.isNaN(at.getTime())) {
      if (at.getTime() <= now.getTime()) {
        return { label: 'ただいま案内可能', tone: 'success' }
      }

      const sameDay =
        at.getFullYear() === now.getFullYear() &&
        at.getMonth() === now.getMonth() &&
        at.getDate() === now.getDate()
      const timeLabel = timeFormatter.format(at)
      if (sameDay) {
        const waitLabel = formatWaitLabel(hit.next_available_at)
        return { label: waitLabel ? `最短 ${timeLabel}〜（${waitLabel}）` : `最短 ${timeLabel}〜`, tone: 'success' }
      }
      const waitLabel = formatWaitLabel(hit.next_available_at)
      return {
        label: waitLabel
          ? `${dateFormatter.format(at)} ${timeLabel}〜（${waitLabel}）`
          : `${dateFormatter.format(at)} ${timeLabel}〜`,
        tone: 'neutral',
      }
    }
  }

  if (hit.today_available) {
    const waitLabel = formatWaitLabel(hit.next_available_at) ?? 'まもなく'
    return { label: `本日空きあり（${waitLabel}）`, tone: 'success' }
  }
  return null
}

function getProfileHref(hit: ShopHit) {
  if (hit.slug) return `/profiles/${hit.slug}`
  return `/profiles/${hit.id}`
}

function formatHourlyPrice(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) return null
  return `¥${formatter.format(Math.round(value))}`
}

export function ShopCard({ hit }: { hit: ShopHit }) {
  const availability = getAvailability(hit)
  const { isFavorite, toggleFavorite, isProcessing } = useShopFavorites()
  const favorite = isFavorite(hit.id)
  const processing = isProcessing(hit.id)
  const distanceLabel = (() => {
    if (hit.distance_km == null) return null
    if (hit.distance_km < 0.1) return '駅チカ'
    return `${hit.distance_km.toFixed(1)}km`
  })()

  const updatedLabel = (() => {
    if (!hit.updated_at) return null
    const dt = new Date(hit.updated_at)
    if (Number.isNaN(dt.getTime())) return null
    return `更新 ${dateFormatter.format(dt)}`
  })()

  const primaryPromotion = Array.isArray(hit.promotions)
    ? hit.promotions.find((promo) => promo && promo.label)
    : undefined
  const promotionLabel = primaryPromotion?.label || (hit.has_promotions ? '特典あり' : null)
  const additionalPromotionCount = Math.max(
    (hit.promotion_count ?? (primaryPromotion ? hit.promotions?.length ?? 1 : 0)) - (primaryPromotion ? 1 : 0),
    0,
  )

  const buttonLabel = favorite ? 'お気に入りから削除' : 'お気に入りに追加'
  const shopHref = getProfileHref(hit)
  const availabilityBadgeClasses = availability
    ? availability.tone === 'success'
      ? 'bg-emerald-500 text-white'
      : 'bg-brand-primary/90 text-white'
    : ''
  const hourlyMin = formatHourlyPrice(hit.min_price)
  const hourlyMax = formatHourlyPrice(hit.max_price)

  return (
    <Card
      interactive
      className="relative flex h-full flex-col overflow-hidden border border-brand-primary/15 bg-white/95 shadow-[0_20px_50px_rgba(15,155,180,0.12)] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_28px_60px_rgba(15,155,180,0.18)]"
      data-testid="shop-card"
    >
      <div className="relative">
        <Link href={shopHref} className="block focus:outline-none group/card" prefetch>
          <div className="relative aspect-[4/5] overflow-hidden bg-neutral-surfaceAlt">
            {hit.lead_image_url ? (
              <Image
                src={hit.lead_image_url}
                alt={`${hit.name} の写真`}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 20vw"
                className="object-cover transition duration-500 group-hover/card:scale-105"
                priority={false}
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-brand-primary/10 to-brand-secondary/10 text-3xl font-bold text-brand-primary">
                {hit.name.slice(0, 1)}
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40 opacity-0 transition duration-500 group-hover/card:opacity-100" />
            {Array.isArray(hit.badges) && hit.badges.length ? (
              <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                {hit.badges.slice(0, 2).map((badge) => (
                  <Badge key={badge} variant="brand" className="bg-brand-primary/95 px-2 shadow-md shadow-brand-primary/40">
                    {badge}
                  </Badge>
                ))}
              </div>
            ) : null}
            {distanceLabel ? (
              <div className="absolute right-2 top-2">
                <Badge variant="outline" className="bg-black/60 text-white shadow-sm shadow-black/40">
                  {distanceLabel}
                </Badge>
              </div>
            ) : null}
            {(availability || updatedLabel) ? (
              <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-2 px-3 pb-3 text-white">
                {availability ? (
                  <Badge variant="brand" className={`${availabilityBadgeClasses} shadow-sm`}>
                    {availability.label}
                  </Badge>
                ) : null}
                {updatedLabel ? (
                  <span className="rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium">{updatedLabel}</span>
                ) : null}
              </div>
            ) : null}
          </div>
        </Link>
        <button
          type="button"
          aria-pressed={favorite}
          aria-label={buttonLabel}
          title={buttonLabel}
          disabled={processing}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void toggleFavorite(hit.id)
          }}
          className={`absolute right-3 top-3 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-white/95 text-brand-primary shadow-[0_10px_24px_rgba(15,155,180,0.25)] transition ${
            favorite ? 'text-red-500' : ''
          } ${processing ? 'opacity-60' : 'hover:bg-white'}`}
        >
          <FavoriteHeartIcon filled={favorite} />
          <span className="sr-only">{buttonLabel}</span>
        </button>
      </div>

      <Link href={shopHref} className="flex flex-1 flex-col focus:outline-none" prefetch>
        <div className="flex flex-1 flex-col gap-3 px-3 pb-4 pt-4">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-base font-semibold text-neutral-text transition hover:text-brand-primary">{hit.name}</h3>
              {hit.rating ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[12px] font-semibold text-amber-600">
                  <span aria-hidden>★</span>
                  {hit.rating.toFixed(1)}
                  {typeof hit.review_count === 'number' ? (
                    <span className="text-[11px] font-medium text-amber-500/90">({formatter.format(hit.review_count)})</span>
                  ) : null}
                </span>
              ) : null}
            </div>
            <div className="text-[12px] text-neutral-textMuted">
              {hit.store_name ? <span className="font-medium text-neutral-text">{hit.store_name}</span> : null}
              {hit.store_name && (hit.area_name || hit.area) ? <span> ｜ </span> : null}
              {hit.area_name || hit.area ? <span>{hit.area_name || hit.area}</span> : null}
              {hit.address ? <span>・{hit.address}</span> : null}
            </div>
            {hit.ranking_reason ? (
              <p className="text-[11px] text-neutral-textMuted line-clamp-2">{hit.ranking_reason}</p>
            ) : null}
            {availability ? (
              <div className="inline-flex items-center gap-2 text-[12px] font-semibold text-brand-primary">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${availabilityBadgeClasses}`}>
                  {availability.label}
                </span>
              </div>
            ) : null}
          </div>

          <div className="space-y-2 text-[12px]">
            <div className="rounded-2xl border border-brand-primary/25 bg-brand-primary/8 px-3 py-3 text-brand-primaryDark">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-primary">一時間あたり</span>
              <div className="mt-1 text-lg font-semibold text-brand-primaryDark">
                {hourlyMin ?? '---'}
                <span className="mx-1 text-[11px] font-medium text-brand-primary">〜</span>
                {hourlyMax ?? hourlyMin ?? '---'}
              </div>
              <div className="text-[11px] text-brand-primaryDark/75">下限 / 上限</div>
            </div>
            <div className="flex flex-wrap items-center gap-2 font-semibold text-brand-primary">
              {hit.price_band_label ? (
                <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-brand-primaryDark">
                  {hit.price_band_label}
                </span>
              ) : hit.price_band ? (
                <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-brand-primaryDark">{hit.price_band}</span>
              ) : null}
              {hit.online_reservation ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-600">
                  <span aria-hidden>⏱</span>
                  予約可
                </span>
              ) : null}
              {hit.has_discounts ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-secondary/10 px-2 py-0.5 text-brand-secondary">
                  <span aria-hidden>💎</span>
                  クーポン
                </span>
              ) : null}
            </div>
          </div>

          {promotionLabel ? (
            <div className="rounded-2xl border border-brand-primary/35 bg-brand-primary/10 px-3 py-2 text-[12px] text-brand-primaryDark">
              <p className="font-semibold">{promotionLabel}</p>
              {additionalPromotionCount > 0 ? (
                <p className="text-[11px] text-brand-primaryDark/80">他 {additionalPromotionCount} 件のキャンペーンあり</p>
              ) : null}
            </div>
          ) : null}

          {Array.isArray(hit.service_tags) && hit.service_tags.length ? (
            <div className="flex flex-wrap gap-1.5">
              {hit.service_tags.slice(0, 4).map((tag) => (
                <Chip key={tag} size="sm" className="border-brand-primary/15 bg-white/90 text-[11px] text-neutral-text">
                  {tag}
                </Chip>
              ))}
            </div>
          ) : null}

          {hit.diary_count ? (
            <div className="text-[11px] text-neutral-textMuted">写メ日記 {formatter.format(hit.diary_count)}件掲載</div>
          ) : null}
        </div>
      </Link>

      <div className="border-t border-brand-primary/10 bg-brand-primary/90 px-3 py-2 text-[12px] text-white">
        <div className="flex items-center justify-between">
          <span className="font-semibold">{hit.store_name || hit.name}</span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-white/90">
            くわしく見る
            <span aria-hidden>→</span>
          </span>
        </div>
      </div>
    </Card>
  )
}

export default ShopCard
