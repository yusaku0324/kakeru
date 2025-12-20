'use client'

import { Calendar, Sparkles, Tag, BookOpen } from 'lucide-react'
import clsx from 'clsx'

type Props = {
  todayOnly: boolean
  onToggleToday: (value: boolean) => void
  promotionsOnly: boolean
  onTogglePromotions: (value: boolean) => void
  discountsOnly?: boolean
  onToggleDiscounts?: (value: boolean) => void
  diariesOnly?: boolean
  onToggleDiaries?: (value: boolean) => void
  className?: string
}

type ToggleChipProps = {
  active: boolean
  onChange: (value: boolean) => void
  icon: React.ReactNode
  children: React.ReactNode
  variant?: 'emerald' | 'amber' | 'blue' | 'purple'
}

function ToggleChip({ active, onChange, icon, children, variant = 'blue' }: ToggleChipProps) {
  const variantStyles = {
    emerald: {
      active: 'border-emerald-400 bg-emerald-50 text-emerald-700 shadow-[0_4px_12px_rgba(16,185,129,0.2)]',
      inactive: 'border-neutral-200 bg-white text-neutral-600 hover:border-emerald-300 hover:bg-emerald-50/50',
      icon: 'text-emerald-500',
    },
    amber: {
      active: 'border-amber-400 bg-amber-50 text-amber-700 shadow-[0_4px_12px_rgba(245,158,11,0.2)]',
      inactive: 'border-neutral-200 bg-white text-neutral-600 hover:border-amber-300 hover:bg-amber-50/50',
      icon: 'text-amber-500',
    },
    blue: {
      active: 'border-blue-400 bg-blue-50 text-blue-700 shadow-[0_4px_12px_rgba(59,130,246,0.2)]',
      inactive: 'border-neutral-200 bg-white text-neutral-600 hover:border-blue-300 hover:bg-blue-50/50',
      icon: 'text-blue-500',
    },
    purple: {
      active: 'border-purple-400 bg-purple-50 text-purple-700 shadow-[0_4px_12px_rgba(168,85,247,0.2)]',
      inactive: 'border-neutral-200 bg-white text-neutral-600 hover:border-purple-300 hover:bg-purple-50/50',
      icon: 'text-purple-500',
    },
  }

  const styles = variantStyles[variant]

  return (
    <button
      type="button"
      onClick={() => onChange(!active)}
      className={clsx(
        'inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-all duration-150',
        active ? styles.active : styles.inactive
      )}
      aria-pressed={active}
    >
      <span className={clsx('flex-shrink-0', active ? styles.icon : 'text-neutral-400')} aria-hidden="true">
        {icon}
      </span>
      {children}
    </button>
  )
}

export function QuickFilters({
  todayOnly,
  onToggleToday,
  promotionsOnly,
  onTogglePromotions,
  discountsOnly,
  onToggleDiscounts,
  diariesOnly,
  onToggleDiaries,
  className = '',
}: Props) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <ToggleChip
        active={todayOnly}
        onChange={onToggleToday}
        icon={<Calendar className="h-4 w-4" />}
        variant="emerald"
      >
        本日空きあり
      </ToggleChip>

      <ToggleChip
        active={promotionsOnly}
        onChange={onTogglePromotions}
        icon={<Sparkles className="h-4 w-4" />}
        variant="amber"
      >
        キャンペーン中
      </ToggleChip>

      {onToggleDiscounts && (
        <ToggleChip
          active={discountsOnly ?? false}
          onChange={onToggleDiscounts}
          icon={<Tag className="h-4 w-4" />}
          variant="blue"
        >
          割引あり
        </ToggleChip>
      )}

      {onToggleDiaries && (
        <ToggleChip
          active={diariesOnly ?? false}
          onChange={onToggleDiaries}
          icon={<BookOpen className="h-4 w-4" />}
          variant="purple"
        >
          写メ日記あり
        </ToggleChip>
      )}
    </div>
  )
}

export default QuickFilters
