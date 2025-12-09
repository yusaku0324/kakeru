'use client'

import { Search } from 'lucide-react'
import clsx from 'clsx'

type Props = {
  onSubmit: () => void
  isPending?: boolean
  resultCount?: number
  resultUnit?: string
  className?: string
}

export function MobileFilterCTA({
  onSubmit,
  isPending = false,
  resultCount,
  resultUnit = '件',
  className = '',
}: Props) {
  const numberFormatter = new Intl.NumberFormat('ja-JP')

  return (
    <div
      className={clsx(
        'fixed inset-x-0 bottom-0 z-40 border-t border-neutral-100 bg-white/95 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur-sm md:hidden',
        className
      )}
    >
      <div className="mx-auto flex max-w-md items-center gap-3">
        {typeof resultCount === 'number' && (
          <span className="flex-shrink-0 text-xs text-neutral-500">
            {numberFormatter.format(resultCount)}
            {resultUnit}
          </span>
        )}
        <button
          type="button"
          onClick={onSubmit}
          disabled={isPending}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary py-3 text-sm font-bold text-white shadow-[0_4px_16px_rgba(37,99,235,0.3)] transition-all duration-150 hover:shadow-[0_6px_20px_rgba(37,99,235,0.4)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Search className="h-4 w-4" />
          {isPending ? '検索中...' : 'この条件で検索する'}
        </button>
      </div>
    </div>
  )
}

export default MobileFilterCTA
