import clsx from 'clsx'

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
}: ReservationScheduleHeaderProps) {
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
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/60 bg-white/75 px-4 py-2 text-[11px] font-semibold text-neutral-text">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onPrev}
            disabled={canGoPrev}
            className={clsx(
              'inline-flex h-9 w-9 items-center justify-center rounded-full border transition',
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
              'inline-flex h-9 w-9 items-center justify-center rounded-full border transition',
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
          <span className="text-neutral-textMuted">
            {schedulePage + 1} / {schedulePageCount}
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
