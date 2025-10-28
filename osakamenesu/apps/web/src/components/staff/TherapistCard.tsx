"use client"

import Image from 'next/image'
import Link from 'next/link'
import { useMemo } from 'react'

import { FavoriteHeartIcon } from '@/components/FavoriteHeartIcon'
import { Badge } from '@/components/ui/Badge'
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
}

const formatter = new Intl.NumberFormat('ja-JP')

function buildShopHref(hit: TherapistHit) {
  const base = hit.shopSlug || hit.shopId
  return `/profiles/${base}`
}

function buildStaffHref(hit: TherapistHit) {
  const base = hit.shopSlug || hit.shopId
  return `/profiles/${base}/staff/${encodeURIComponent(hit.staffId)}`
}


export function TherapistCard({ hit }: { hit: TherapistHit }) {
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

  return (
    <Card className="relative h-full" interactive data-testid="therapist-card">
      <button
        type="button"
        disabled={!therapistId || processing}
        aria-pressed={favorite}
        aria-label={favorite ? 'お気に入りから削除' : 'お気に入りに追加'}
        title={favorite ? 'お気に入りから削除' : 'お気に入りに追加'}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          if (therapistId) {
            void toggleFavorite({ therapistId, shopId: hit.shopId })
          }
        }}
        className={`absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-borderLight bg-white/90 text-brand-primary shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary ${
          favorite ? 'text-red-500' : ''
        } ${processing ? 'opacity-60' : 'hover:bg-white'}`}
      >
        <FavoriteHeartIcon filled={favorite} />
        <span className="sr-only">{favorite ? 'お気に入りから削除' : 'お気に入りに追加'}</span>
      </button>
      <Link href={staffHref} className="block focus:outline-none group">
        <div className="relative h-48 overflow-hidden rounded-t-card bg-neutral-surfaceAlt">
          {hit.avatarUrl ? (
            <Image
              src={hit.avatarUrl}
              alt={`${hit.name}の写真`}
              fill
              className="object-cover transition duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-neutral-surfaceAlt text-neutral-textMuted">
              <span className="text-4xl font-semibold">{hit.name.slice(0, 1)}</span>
            </div>
          )}
        </div>
      </Link>
      <div className="space-y-3 p-4">
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-lg font-semibold text-neutral-text">
              <Link href={staffHref} className="transition hover:text-brand-primary">
                {hit.name}
              </Link>
            </h3>
            {hit.rating ? (
              <span className="flex items-center gap-1 text-sm text-neutral-text">
                <span aria-hidden className="text-amber-400">★</span>
                <span className="font-semibold">{hit.rating.toFixed(1)}</span>
                {typeof hit.reviewCount === 'number' ? (
                  <span className="text-xs text-neutral-textMuted">({formatter.format(hit.reviewCount)}件)</span>
                ) : null}
              </span>
            ) : null}
          </div>
          {hit.alias ? <p className="text-xs text-neutral-textMuted">{hit.alias}</p> : null}
          {hit.headline ? <p className="text-sm text-neutral-textMuted line-clamp-2">{hit.headline}</p> : null}
        </div>

        {hit.specialties.length ? (
          <div className="flex flex-wrap gap-2">
            {hit.specialties.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-badge border border-neutral-borderLight bg-neutral-surfaceAlt px-2 py-0.5 text-[12px] text-neutral-text"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 text-sm text-neutral-text">
          <div>
            <Link href={shopHref} className="font-semibold text-brand-primaryDark hover:underline">
              {hit.shopName}
            </Link>
            <div className="text-xs text-neutral-textMuted">
              {hit.shopAreaName || hit.shopArea}
            </div>
          </div>
          <Badge variant="outline">セラピスト</Badge>
        </div>
      </div>
    </Card>
  )
}

export default TherapistCard
