import Link from 'next/link'
import clsx from 'clsx'

const tabBaseClass =
  'inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary/60'

export type SearchTabValue = 'therapists' | 'shops'

type Props = {
  current: SearchTabValue
  buildHref: (value: SearchTabValue) => string
}

const TABS: { value: SearchTabValue; label: string }[] = [
  { value: 'therapists', label: 'セラピスト' },
  { value: 'shops', label: '店舗' },
]

export function SearchTabs({ current, buildHref }: Props) {
  return (
    <nav aria-label="検索結果タブ" className="overflow-x-auto pb-2">
      <div className="inline-flex items-center rounded-full border border-neutral-borderLight/70 bg-white/80 p-1 text-neutral-text shadow-sm">
        {TABS.map((tab) => {
          const active = current === tab.value
          return (
            <Link
              key={tab.value}
              href={buildHref(tab.value)}
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
