'use client'

import Link from 'next/link'
import clsx from 'clsx'

const tabBaseClass =
  'inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary/60'

export type SearchMode = 'therapists' | 'shops'

type Props = {
  current: SearchMode
  shopSlug?: string | null
}

const TABS: { value: SearchMode; label: string; href: string }[] = [
  { value: 'therapists', label: 'セラピスト', href: '/therapists' },
  { value: 'shops', label: '店舗', href: '/shops' },
]

export function TherapistShopTabs({ current, shopSlug }: Props) {
  return (
    <nav aria-label="検索モード切替" className="overflow-x-auto pb-2">
      <div className="inline-flex items-center rounded-full border border-neutral-borderLight/70 bg-white/80 p-1 text-neutral-text shadow-sm">
        {TABS.map((tab) => {
          const active = current === tab.value
          // セラピストタブで店舗絞り込み中の場合、shop_slugを保持
          const href =
            tab.value === 'therapists' && shopSlug
              ? `/therapists?shop_slug=${encodeURIComponent(shopSlug)}`
              : tab.href
          return (
            <Link
              key={tab.value}
              href={href}
              className={clsx(
                tabBaseClass,
                active
                  ? 'bg-brand-primary text-white shadow-[0_8px_24px_rgba(37,99,235,0.28)]'
                  : 'text-neutral-text hover:text-brand-primary/90',
              )}
              aria-current={active ? 'page' : undefined}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
