'use client'

import { X, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react'
import clsx from 'clsx'

export type FilterBadgeData = {
  key: string
  label: string
  onRemove?: () => void
}

type Props = {
  badges: FilterBadgeData[]
  isFilterOpen: boolean
  onToggleFilter: () => void
  resultCount?: number
  resultUnit?: string
  onClearAll?: () => void
  sticky?: boolean
  className?: string
}

export function FilterSummaryBar({
  badges,
  isFilterOpen,
  onToggleFilter,
  resultCount,
  resultUnit = '件',
  onClearAll,
  sticky = false,
  className = '',
}: Props) {
  const hasActiveBadges = badges.length > 0
  const numberFormatter = new Intl.NumberFormat('ja-JP')

  return (
    <div
      className={clsx(
        'z-30 border-b border-neutral-100 bg-white/95 backdrop-blur-sm transition-all duration-200',
        sticky && 'sticky top-0',
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        {/* Left: Active Badges */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {hasActiveBadges ? (
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
              <span className="flex-shrink-0 text-xs font-medium text-neutral-500">
                現在の条件:
              </span>
              <div className="flex gap-1.5">
                {badges.slice(0, 4).map((badge) => (
                  <span
                    key={badge.key}
                    className="inline-flex flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-gradient-to-r from-brand-primary/10 to-brand-secondary/10 px-2.5 py-1 text-xs font-medium text-brand-primaryDark"
                  >
                    {badge.label}
                    {badge.onRemove && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          badge.onRemove?.()
                        }}
                        className="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-brand-primary/60 transition-colors hover:bg-brand-primary/20 hover:text-brand-primary"
                        aria-label={`${badge.label}を解除`}
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </span>
                ))}
                {badges.length > 4 && (
                  <span className="flex-shrink-0 text-xs text-neutral-500">
                    +{badges.length - 4}件
                  </span>
                )}
              </div>
            </div>
          ) : (
            <span className="text-xs text-neutral-500">すべて表示中</span>
          )}
        </div>

        {/* Right: Result Count + Toggle Button */}
        <div className="flex flex-shrink-0 items-center gap-3">
          {typeof resultCount === 'number' && (
            <span className="hidden text-xs text-neutral-500 sm:inline">
              {numberFormatter.format(resultCount)}
              {resultUnit}
            </span>
          )}

          {hasActiveBadges && onClearAll && (
            <button
              type="button"
              onClick={onClearAll}
              className="hidden text-xs font-medium text-brand-primary transition-colors hover:text-brand-primaryDark sm:inline"
            >
              クリア
            </button>
          )}

          <button
            type="button"
            onClick={onToggleFilter}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-150',
              isFilterOpen
                ? 'bg-brand-primary text-white shadow-[0_4px_12px_rgba(37,99,235,0.3)]'
                : 'border border-neutral-200 bg-white text-neutral-700 shadow-sm hover:border-brand-primary/40 hover:bg-brand-primary/5'
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">フィルター</span>
            {isFilterOpen ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default FilterSummaryBar
