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
            className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-blue-500 transition-colors hover:bg-blue-200 hover:text-blue-700"
            aria-label={`${badge.label}を解除`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  )
}

export default ActiveFilterBadges
