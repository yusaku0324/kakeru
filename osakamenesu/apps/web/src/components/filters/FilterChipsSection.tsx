"use client"

import { GlassSelect } from '@/components/ui/GlassSelect'

type FacetOption = {
  value: string
  label: string
}

type FilterChipsSectionProps = {
  todayOnly: boolean
  onToggleToday: (next: boolean) => void
  promotionsOnly: boolean
  onTogglePromotions: (next: boolean) => void
  discountsOnly: boolean
  onToggleDiscounts: (next: boolean) => void
  diariesOnly: boolean
  onToggleDiaries: (next: boolean) => void
  sort: string
  sortOptions: FacetOption[]
  onSortChange: (value: string) => void
  selectButtonClass: string
  selectMenuClass: string
  selectOptionClass: string
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
  sort,
  sortOptions,
  onSortChange,
  selectButtonClass,
  selectMenuClass,
  selectOptionClass,
}: FilterChipsSectionProps) {
  return (
    <section className="relative overflow-visible rounded-[32px] border border-white/45 bg-white/45 p-6 shadow-[0_24px_70px_rgba(37,99,235,0.18)] backdrop-blur">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.25)_0%,rgba(125,211,252,0)_60%)]" />
      <header className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-secondary/10 text-brand-secondary">
          ✧
        </span>
        <div>
          <p className="text-sm font-semibold text-neutral-text">こだわり条件</p>
          <p className="text-xs text-neutral-textMuted">チェックやタグで詳細に絞り込めます</p>
        </div>
      </header>

      <div className="mt-6 space-y-5">
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

        <div className="space-y-2 text-xs font-semibold uppercase tracking-wide text-neutral-textMuted">
          並び替え
          <GlassSelect
            name="sort"
            value={sort}
            onChange={onSortChange}
            options={sortOptions}
            buttonClassName={selectButtonClass}
            menuClassName={selectMenuClass}
            optionClassName={selectOptionClass}
          />
        </div>
      </div>
    </section>
  )
}
