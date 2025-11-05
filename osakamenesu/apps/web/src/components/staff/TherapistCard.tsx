"use client"

import clsx from 'clsx'
import Image from 'next/image'
import Link from 'next/link'
import { useMemo } from 'react'

import { FavoriteHeartIcon } from '@/components/FavoriteHeartIcon'
import { Card } from '@/components/ui/Card'
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
  nextAvailableAt: string | null
}

const formatter = new Intl.NumberFormat('ja-JP')

function formatWaitLabel(nextAvailableAt?: string | null) {
  if (!nextAvailableAt) return null
  const now = new Date()
  const target = new Date(nextAvailableAt)
  if (Number.isNaN(target.getTime())) return null
  const diffMs = target.getTime() - now.getTime()
  if (diffMs <= 0) return 'まもなく'
  const totalMinutes = Math.round(diffMs / 60_000)
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

type AvailabilityTone = 'success' | 'neutral'

function getAvailability(hit: TherapistHit): { label: string; tone: AvailabilityTone } | null {
  const waitLabel = formatWaitLabel(hit.nextAvailableAt)
  if (hit.nextAvailableAt) {
    return {
      label: waitLabel ? `最短ご案内 ${waitLabel}` : '最短ご案内まもなく',
      tone: 'success',
    }
  }
  if (hit.todayAvailable) {
    return {
      label: waitLabel ? `本日空きあり（${waitLabel}）` : '本日空きあり（まもなく）',
      tone: 'success',
    }
  }
  return null
}

function buildShopHref(hit: TherapistHit) {
  const base = hit.shopSlug || hit.shopId
  return `/profiles/${base}`
}

function buildStaffHref(hit: TherapistHit) {
  const base = hit.shopSlug || hit.shopId
  return `/profiles/${base}/staff/${encodeURIComponent(hit.staffId)}`
}

type TherapistCardProps = {
  hit: TherapistHit
  variant?: 'grid' | 'featured'
  onReserve?: (hit: TherapistHit) => void
}

export function TherapistCard({ hit, variant = 'grid', onReserve }: TherapistCardProps) {
  const { isFavorite, toggleFavorite, isProcessing } = useTherapistFavorites()
  const staffHref = buildStaffHref(hit)
  const shopHref = buildShopHref(hit)
  const therapistId = useMemo(() => {
    const candidate = hit.therapistId?.trim()
    if (!candidate) return null
    return candidate
  }, [hit.therapistId])
  const favorite = therapistId ? isFavorite(therapistId) : false
  const processing = therapistId ? isProcessing(therapistId) : false
  const areaLabel = hit.shopAreaName || hit.shopArea || null
  const reviewLabel = typeof hit.reviewCount === 'number' ? formatter.format(hit.reviewCount) : null
  const specialties = hit.specialties || []
  const availability = getAvailability(hit)
  const waitLabel = availability?.label ?? (hit.todayAvailable ? 'すぐ案内可' : null)
  const isFeatured = variant === 'featured'

  const availabilityBadge = waitLabel ? (
    <span
      className={clsx(
        'inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold shadow-lg',
        availability?.tone === 'success'
          ? 'border border-emerald-100 bg-emerald-50 text-emerald-700 shadow-emerald-100/60'
          : 'border border-neutral-borderLight bg-white text-neutral-text shadow-neutral-borderLight/40',
      )}
    >
      <span aria-hidden>⏱</span>
      {waitLabel}
    </span>
  ) : null

  const coverContent = (
    <div className="relative aspect-[3/4] overflow-hidden rounded-[28px] bg-neutral-surfaceAlt">
      {hit.avatarUrl ? (
        <Image
          src={hit.avatarUrl}
          alt={`${hit.name}の写真`}
          fill
          className="object-cover transition duration-500 group-hover:scale-[1.03]"
          sizes={isFeatured ? '(max-width: 1024px) 60vw, 392px' : '(max-width: 640px) 100vw, 288px'}
        />
      ) : (
        <div className="flex h-full items-center justify-center bg-gradient-to-br from-brand-primary/15 to-brand-secondary/20 text-4xl font-semibold text-brand-primary">
          <span>{hit.name.slice(0, 1)}</span>
        </div>
      )}
      {isFeatured ? (
        <span className="pointer-events-none absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary px-3 py-1 text-xs font-semibold text-white shadow-brand-primary/30 shadow">
          <span aria-hidden>✦</span>
          人気
        </span>
      ) : null}
      {availabilityBadge ? (
        <div className="pointer-events-none absolute left-4 bottom-4">{availabilityBadge}</div>
      ) : null}
    </div>
  )

  return (
    <Card
      interactive
      data-testid="therapist-card"
      className={clsx(
        'flex h-full flex-col rounded-[32px] border-white/40 bg-white/95 p-4 shadow-[0_20px_40px_-8px_rgba(21,93,252,0.15),0_8px_16px_-4px_rgba(21,93,252,0.1),0_0_0_1px_rgba(21,93,252,0.08)] backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_28px_70px_-12px_rgba(21,93,252,0.22)]',
        isFeatured ? 'p-6' : 'p-4',
      )}
    >
      <div className="flex h-full flex-col gap-4">
        <div className="relative">
          {onReserve ? (
            <button
              type="button"
              onClick={() => onReserve(hit)}
              className="group block w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-primary/40"
              aria-label={`${hit.name}の予約詳細を開く`}
            >
              {coverContent}
            </button>
          ) : (
            <Link
              href={staffHref}
              className="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-primary/40"
            >
              <span className="sr-only">{hit.name}のプロフィールを見る</span>
              {coverContent}
            </Link>
          )}

          <button
            type="button"
            disabled={!therapistId || processing}
            aria-pressed={favorite}
            aria-label={favorite ? 'お気に入りから削除' : 'お気に入りに追加'}
            title={favorite ? 'お気に入りから削除' : 'お気に入りに追加'}
            data-therapist-id={therapistId ?? undefined}
            data-shop-id={hit.shopId}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              if (therapistId) {
                void toggleFavorite({ therapistId, shopId: hit.shopId })
              }
            }}
            className={clsx(
              'absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/90 text-brand-primary shadow-md shadow-brand-primary/20 transition hover:scale-105',
              favorite && 'text-red-500',
              processing && 'opacity-60',
            )}
          >
            <FavoriteHeartIcon filled={favorite} />
            <span className="sr-only">{favorite ? 'お気に入りから削除' : 'お気に入りに追加'}</span>
          </button>
        </div>

        <div className={clsx('flex flex-1 flex-col', isFeatured ? 'gap-5' : 'gap-4')}>
          <div className="space-y-3">
            <div className="space-y-2">
              <Link
                href={staffHref}
                className="inline-flex items-center gap-2 text-xl font-semibold tracking-tight text-neutral-text transition hover:text-brand-primary"
              >
                {hit.name}
                {hit.alias ? (
                  <span className="rounded-full bg-brand-primary/10 px-3 py-1 text-[11px] font-medium text-brand-primary">
                    {hit.alias}
                  </span>
                ) : null}
              </Link>
              <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-textMuted">
                {areaLabel ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-primary/10 px-3 py-1 font-semibold text-brand-primary">
                    <span aria-hidden>📍</span>
                    {areaLabel}
                  </span>
                ) : null}
                {areaLabel ? <span className="text-neutral-borderLight">•</span> : null}
                <span>{hit.shopName}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-primary/10 px-3 py-1 text-sm font-semibold text-brand-primary">
                <span aria-hidden>★</span>
                {hit.rating ? hit.rating.toFixed(1) : '--'}
              </span>
              {reviewLabel ? (
                <span className="text-xs text-neutral-textMuted">口コミ {reviewLabel}件</span>
              ) : null}
            </div>

            {hit.headline ? (
              <p className="text-sm leading-relaxed text-neutral-textMuted line-clamp-3">{hit.headline}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {specialties.length ? (
              specialties.slice(0, isFeatured ? 4 : 3).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full bg-brand-primary/10 px-3 py-1 text-[11px] font-medium text-brand-primary"
                >
                  {tag}
                </span>
              ))
            ) : (
              <span className="inline-flex items-center rounded-full bg-neutral-surfaceAlt px-3 py-1 text-[11px] text-neutral-text">
                セラピスト
              </span>
            )}
          </div>

          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
            <div className="flex items-center gap-2">
              {onReserve ? (
                <button
                  type="button"
                  onClick={() => onReserve(hit)}
                  className="inline-flex items-center rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary px-4 py-1.5 text-sm font-semibold text-white shadow-md shadow-brand-primary/25 transition hover:from-brand-primary/90 hover:to-brand-secondary/90"
                >
                  予約する
                </button>
              ) : (
                <Link
                  href={`${shopHref}#web-reservation`}
                  className="inline-flex rounded-full border border-white/60 bg-white/85 px-3 py-1.5 text-xs font-semibold text-brand-primary transition hover:border-brand-primary hover:bg-brand-primary/10"
                >
                  予約する
                </Link>
              )}
              <Link
                href={staffHref}
                className="inline-flex rounded-full border border-white/60 bg-white/85 px-3 py-1.5 text-xs text-brand-primary transition hover:border-brand-primary hover:bg-brand-primary/10"
              >
                プロフィールを見る
              </Link>
            </div>
            <Link
              href={shopHref}
              className="inline-flex text-neutral-textMuted transition hover:text-brand-primary"
            >
              店舗ページへ
            </Link>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default TherapistCard
