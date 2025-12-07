'use client'

import Link from 'next/link'

import SafeImage from '@/components/SafeImage'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { type ShopHit } from './ShopCard'

const formatter = new Intl.NumberFormat('ja-JP')

function formatPriceRange(min: number, max: number) {
  if (!min && !max) return '料金情報なし'
  if (min === max) return `¥${formatter.format(min)}`
  return `¥${formatter.format(min)} 〜 ¥${formatter.format(Math.max(min, max))}`
}

function getTherapistListHref(hit: ShopHit) {
  const slug = hit.slug || hit.id
  return `/therapists?shop_slug=${encodeURIComponent(slug)}`
}

type Props = {
  hit: ShopHit
}

export function ShopCardNavigateToTherapists({ hit }: Props) {
  const availabilityBadge = hit.today_available ? '本日空きあり' : null
  const staffCount = Array.isArray(hit.staff_preview) ? hit.staff_preview.length : 0

  return (
    <Link
      href={getTherapistListHref(hit)}
      className="block focus:outline-none"
      prefetch
    >
      <Card interactive className="h-full" data-testid="shop-card-navigate">
        <div className="relative aspect-[4/3] overflow-hidden rounded-t-card bg-neutral-surfaceAlt">
          <SafeImage
            src={hit.lead_image_url || undefined}
            alt={`${hit.name} の写真`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
            priority={false}
          />

          {Array.isArray(hit.badges) && hit.badges.length ? (
            <div className="absolute left-2 top-2 flex flex-wrap gap-1">
              {hit.badges.slice(0, 2).map((badge) => (
                <Badge key={badge} variant="brand" className="shadow-lg">
                  {badge}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-2 p-3">
          <div>
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-base font-semibold tracking-tight text-neutral-text group-hover:text-brand-primary line-clamp-1">
                {hit.store_name || hit.name}
              </h3>
              {availabilityBadge ? (
                <Badge variant="success" className="flex-shrink-0 text-[10px]">
                  {availabilityBadge}
                </Badge>
              ) : null}
            </div>
            <p className="text-xs text-neutral-textMuted">
              {hit.area_name || hit.area}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-brand-primaryDark text-xs">
              {formatPriceRange(hit.min_price, hit.max_price)}
            </span>
            {hit.rating ? (
              <span className="flex items-center gap-0.5 text-neutral-text text-xs">
                <span aria-hidden className="text-amber-400">
                  ★
                </span>
                <span className="font-semibold">{hit.rating.toFixed(1)}</span>
              </span>
            ) : null}
          </div>

          {staffCount > 0 && (
            <p className="text-xs text-brand-primary font-medium">
              {staffCount}名のセラピストを見る →
            </p>
          )}
        </div>
      </Card>
    </Link>
  )
}

export default ShopCardNavigateToTherapists
