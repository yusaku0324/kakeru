'use client'

import { X } from 'lucide-react'

export type FilterBadge = {
  key: string
  label: string
  onRemove: () => void
}

type Props = {
  badges: FilterBadge[]
  className?: string
}

export function ActiveFilterBadges({ badges, className = '' }: Props) {
  if (badges.length === 0) return null

  return (
    <div
      className={`flex gap-2 overflow-x-auto scrollbar-hide py-2 ${className}`}
      role="list"
      aria-label="適用中のフィルター"
    >
      {badges.map((badge) => (
        <span
          key={badge.key}
          role="listitem"
          className="group inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-brand-primary/10 px-3 py-1.5 text-xs font-medium text-brand-primaryDark shadow-sm ring-1 ring-brand-primary/20 transition-all duration-200 hover:bg-brand-primary/15 hover:shadow-md hover:ring-brand-primary/30"
        >
          {badge.label}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              badge.onRemove()
            }}
            className="relative -my-1.5 -mr-1.5 ml-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-brand-primary/70 transition-all duration-150 hover:bg-brand-primary/20 hover:text-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-primary active:scale-90"
            aria-label={`${badge.label}を解除`}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </span>
      ))}
    </div>
  )
}

export default ActiveFilterBadges
