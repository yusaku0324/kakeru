'use client'

import Link from 'next/link'
import SafeImage from '@/components/SafeImage'

type ShopInfo = {
  name: string
  slug: string
  area?: string | null
  leadImageUrl?: string | null
}

type Props = {
  shop: ShopInfo
}

export function ShopFilterHeader({ shop }: Props) {
  return (
    <div className="mb-4 rounded-xl bg-gradient-to-r from-brand-primary/5 to-brand-primary/10 p-4">
      <div className="flex items-center gap-4">
        {/* Shop thumbnail */}
        <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-100">
          {shop.leadImageUrl ? (
            <SafeImage
              src={shop.leadImageUrl}
              alt={shop.name}
              fill
              className="object-cover"
              sizes="48px"
              fallbackSrc="/images/placeholder-shop.svg"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-neutral-400">
              {shop.name.slice(0, 1)}
            </div>
          )}
        </div>

        {/* Shop info */}
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-neutral-text">
            {shop.name}のセラピスト一覧
          </h2>
          {shop.area && (
            <p className="mt-0.5 text-xs text-neutral-textMuted">{shop.area}</p>
          )}
        </div>

        {/* Clear filter button */}
        <Link
          href="/therapists"
          className="flex-shrink-0 rounded-full border border-neutral-borderLight bg-white px-3 py-1.5 text-xs font-medium text-neutral-text shadow-sm transition hover:bg-neutral-50 hover:border-neutral-border"
        >
          絞り込み解除
        </Link>
      </div>
    </div>
  )
}
