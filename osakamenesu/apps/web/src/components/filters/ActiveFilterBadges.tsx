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
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 shadow-sm transition-all duration-150 hover:bg-blue-100"
        >
          {badge.label}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              badge.onRemove()
            }}
            className="relative -my-2 -mr-1 ml-0.5 inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-blue-500 transition-colors hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            aria-label={`${badge.label}を解除`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-blue-200">
              <X className="h-3 w-3" aria-hidden="true" />
            </span>
          </button>
        </span>
      ))}
    </div>
  )
}

export default ActiveFilterBadges
