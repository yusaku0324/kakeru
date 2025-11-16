"use client"

import clsx from 'clsx'

type FilterChipsSectionProps = {
  todayOnly: boolean
  onToggleToday: (next: boolean) => void
  promotionsOnly: boolean
  onTogglePromotions: (next: boolean) => void
  discountsOnly: boolean
  onToggleDiscounts: (next: boolean) => void
  diariesOnly: boolean
  onToggleDiaries: (next: boolean) => void
  className?: string
  showHeader?: boolean
}

export function FilterChipsSection({
  todayOnly,
  onToggleToday,
  promotionsOnly,
  onTogglePromotions,
  discountsOnly,
  onToggleDiscounts,
  diariesOnly,
  onToggleDiaries,
  className,
  showHeader = true,
}: FilterChipsSectionProps) {
  const wrapperClass = className
    ? className
    : 'relative overflow-visible rounded-[32px] border border-white/45 bg-white/45 p-6 shadow-[0_24px_70px_rgba(37,99,235,0.18)] backdrop-blur'
  return (
    <section className={wrapperClass}>
      {!className ? (
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.25)_0%,rgba(125,211,252,0)_60%)]" />
      ) : null}
      {showHeader ? (
        <header className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-secondary/10 text-brand-secondary">
            ✧
          </span>
          <div>
            <p className="text-sm font-semibold text-neutral-text">こだわり条件</p>
            <p className="text-xs text-neutral-textMuted">チェックやタグで詳細に絞り込めます</p>
          </div>
        </header>
      ) : null}

      <div className={clsx('space-y-5', showHeader ? 'mt-6' : 'mt-0')}>
        <div className="flex flex-wrap gap-2 text-sm">
          <label className="inline-flex items-center gap-2 rounded-full border border-white/55 bg-white/55 px-3 py-1 text-sm text-neutral-text shadow-[0_12px_30px_rgba(37,99,235,0.16)]">
            <input
              type="checkbox"
              checked={todayOnly}
              onChange={(event) => onToggleToday(event.target.checked)}
              className="h-4 w-4 rounded border-brand-primary text-brand-primary focus:ring-brand-primary"
            />
            本日出勤のみ
          </label>
          <label className="inline-flex items-center gap-2 rounded-full border border-white/55 bg-white/55 px-3 py-1 text-sm text-neutral-text shadow-[0_12px_30px_rgba(37,99,235,0.16)]">
            <input
              type="checkbox"
              checked={promotionsOnly}
              onChange={(event) => onTogglePromotions(event.target.checked)}
              className="h-4 w-4 rounded border-brand-primary text-brand-primary focus:ring-brand-primary"
            />
            キャンペーンあり
          </label>
          <label className="inline-flex items-center gap-2 rounded-full border border-white/55 bg-white/55 px-3 py-1 text-sm text-neutral-text shadow-[0_12px_30px_rgba(37,99,235,0.16)]">
            <input
              type="checkbox"
              checked={discountsOnly}
              onChange={(event) => onToggleDiscounts(event.target.checked)}
              className="h-4 w-4 rounded border-brand-primary text-brand-primary focus:ring-brand-primary"
            />
            割引あり
          </label>
          <label className="inline-flex items-center gap-2 rounded-full border border-white/55 bg-white/55 px-3 py-1 text-sm text-neutral-text shadow-[0_12px_30px_rgba(37,99,235,0.16)]">
            <input
              type="checkbox"
              checked={diariesOnly}
              onChange={(event) => onToggleDiaries(event.target.checked)}
              className="h-4 w-4 rounded border-brand-primary text-brand-primary focus:ring-brand-primary"
            />
            写メ日記あり
          </label>
        </div>

        <p className="text-xs text-neutral-textMuted">※ 並び替えは検索結果上部から操作できます</p>
      </div>
    </section>
  )
}
