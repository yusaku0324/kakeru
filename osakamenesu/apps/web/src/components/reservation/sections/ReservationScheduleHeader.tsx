import clsx from 'clsx'
import { useEffect, useState } from 'react'

type ReservationScheduleHeaderProps = {
  scheduleRangeLabel: string
  currentMonthLabel: string
  schedulePage: number
  schedulePageCount: number
  canGoPrev: boolean
  canGoNext: boolean
  onPrev: () => void
  onNext: () => void
  onReset: () => void
  hasAvailability: boolean
  /** Whether availability data is being refreshed */
  isRefreshing?: boolean
  /** Last refresh timestamp (Unix ms) */
  lastRefreshAt?: number | null
  /** Callback to manually refresh availability */
  onRefresh?: () => Promise<void>
}

export function ReservationScheduleHeader({
  scheduleRangeLabel,
  currentMonthLabel,
  schedulePage,
  schedulePageCount,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  onReset,
  hasAvailability,
  isRefreshing = false,
  lastRefreshAt,
  onRefresh,
}: ReservationScheduleHeaderProps) {
  // Calculate relative time string and update it every 10 seconds
  const [relativeTime, setRelativeTime] = useState<string>('')

  useEffect(() => {
    const calcRelativeTime = (): string => {
      if (!lastRefreshAt) return ''
      const now = Date.now()
      const diffMs = now - lastRefreshAt
      const diffSec = Math.floor(diffMs / 1000)
      if (diffSec < 10) return 'たった今'
      if (diffSec < 60) return `${diffSec}秒前`
      const diffMin = Math.floor(diffSec / 60)
      if (diffMin < 60) return `${diffMin}分前`
      return '1時間以上前'
    }

    // Update immediately
    setRelativeTime(calcRelativeTime())

    // Update every 10 seconds
    const intervalId = setInterval(() => {
      setRelativeTime(calcRelativeTime())
    }, 10000)

    return () => clearInterval(intervalId)
  }, [lastRefreshAt])

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-neutral-text">希望日時を選択</h3>
          <p className="text-xs text-neutral-textMuted">最大3枠まで候補を追加できます。◯をタップしてください。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/90 px-4 py-1 text-xs font-semibold text-brand-primary shadow-sm shadow-brand-primary/10">
            {scheduleRangeLabel}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-1 text-[11px] font-semibold text-brand-primary">
            ⭐️ {hasAvailability ? '公開枠あり' : 'お問い合わせで調整'}
          </span>
          {isRefreshing ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[10px] font-medium text-blue-600">
              <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              更新中
            </span>
          ) : (
            onRefresh && (
              <button
                type="button"
                onClick={() => void onRefresh()}
                className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-medium text-blue-600 transition hover:bg-blue-100"
                aria-label="空き状況を更新"
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {relativeTime || '更新'}
              </button>
            )
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/60 bg-white/75 px-4 py-2 text-[11px] font-semibold text-neutral-text">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onPrev}
            disabled={canGoPrev}
            className={clsx(
              'inline-flex h-11 w-11 items-center justify-center rounded-full border transition',
              canGoPrev
                ? 'cursor-not-allowed border-white/60 text-neutral-textMuted'
                : 'border-brand-primary/20 bg-white text-brand-primary hover:border-brand-primary/40',
            )}
            aria-label="前の週を表示"
          >
            ←
          </button>
          <div className="text-sm text-neutral-text">{currentMonthLabel}</div>
          <button
            type="button"
            onClick={onNext}
            disabled={canGoNext}
            className={clsx(
              'inline-flex h-11 w-11 items-center justify-center rounded-full border transition',
              canGoNext
                ? 'cursor-not-allowed border-white/60 text-neutral-textMuted'
                : 'border-brand-primary/20 bg-white text-brand-primary hover:border-brand-primary/40',
            )}
            aria-label="次の週を表示"
          >
            →
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="text-neutral-textMuted"
            role="status"
            aria-live="polite"
            aria-label={`${schedulePageCount}週中${schedulePage + 1}週目を表示中`}
          >
            <span className="hidden sm:inline">第</span>
            {schedulePage + 1}
            <span className="hidden sm:inline">週</span>
            <span className="mx-0.5">/</span>
            <span className="hidden sm:inline">全</span>
            {schedulePageCount}
            <span className="hidden sm:inline">週</span>
          </span>
          <button
            type="button"
            onClick={onReset}
            disabled={canGoPrev}
            className={clsx(
              'rounded-full px-3 py-1 text-xs transition',
              canGoPrev
                ? 'cursor-not-allowed border border-white/60 text-neutral-textMuted'
                : 'border border-brand-primary/20 bg-white text-brand-primary hover:border-brand-primary/40',
            )}
          >
            今週
          </button>
        </div>
      </div>
    </>
  )
}
