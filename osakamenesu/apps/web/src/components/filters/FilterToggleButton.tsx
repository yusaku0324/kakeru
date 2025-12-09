'use client'

import { SlidersHorizontal, ChevronUp } from 'lucide-react'
import clsx from 'clsx'

type Props = {
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'compact'
  className?: string
}

export function FilterToggleButton({ onClick, variant = 'primary', className = '' }: Props) {
  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 shadow-sm transition-all duration-150 hover:border-brand-primary/40 hover:bg-brand-primary/5 hover:text-brand-primary',
          className
        )}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        フィルターを変更
        <ChevronUp className="h-3 w-3" />
      </button>
    )
  }

  if (variant === 'secondary') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={clsx(
          'inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 shadow-sm transition-all duration-150 hover:border-brand-primary/40 hover:bg-brand-primary/5',
          className
        )}
      >
        <SlidersHorizontal className="h-4 w-4" />
        フィルターを開く
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary px-5 py-3 text-sm font-bold text-white shadow-[0_4px_16px_rgba(37,99,235,0.3)] transition-all duration-150 hover:shadow-[0_6px_20px_rgba(37,99,235,0.4)] active:scale-[0.98]',
        className
      )}
    >
      <SlidersHorizontal className="h-4 w-4" />
      フィルターを開く
    </button>
  )
}

export default FilterToggleButton
