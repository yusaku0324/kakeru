import clsx from 'clsx'

export type DashboardReservationToolbarProps = {
  total: number
  visibleCount: number
  hasPrevCursor: boolean
  isLoadingPrevious: boolean
  isRefreshing: boolean
  onLoadPrevious: () => Promise<void> | void
  onRefresh: () => Promise<void> | void
}

export function DashboardReservationToolbar({
  total,
  visibleCount,
  hasPrevCursor,
  isLoadingPrevious,
  isRefreshing,
  onLoadPrevious,
  onRefresh,
}: DashboardReservationToolbarProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h3 className="text-lg font-semibold text-neutral-text">最近の予約リクエスト</h3>
        <p className="text-xs text-neutral-500">
          全 {total} 件中 {visibleCount} 件を表示中
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {hasPrevCursor ? (
          <button
            type="button"
            onClick={onLoadPrevious}
            disabled={isLoadingPrevious}
            className={clsx(
              'inline-flex items-center gap-2 rounded-full border border-brand-primary/40 px-3 py-1.5 text-sm font-semibold text-brand-primary transition hover:bg-brand-primary/10',
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
          >
            {isLoadingPrevious ? '最新分を取得中…' : '新しい予約を読み込む'}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className={clsx(
            'inline-flex items-center gap-2 rounded-full border border-brand-primary/40 px-3 py-1.5 text-sm font-semibold text-brand-primary transition hover:bg-brand-primary/10',
            'disabled:cursor-not-allowed disabled:opacity-60',
          )}
        >
          {isRefreshing ? '更新中…' : '最新の情報に更新'}
        </button>
      </div>
    </div>
  )
}
