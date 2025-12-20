'use client'

import clsx from 'clsx'
import { type FormEventHandler } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'

import { BasicSearchSection } from '@/components/filters/BasicSearchSection'
import { StyleFiltersSection } from '@/components/filters/StyleFiltersSection'
import { StyleTagsSection } from '@/components/filters/StyleTagsSection'
import { ActiveFilterBadges } from '@/components/filters/ActiveFilterBadges'
import { QuickFilters } from '@/components/filters/QuickFilters'
import { useSearchFilters } from '@/components/filters/useSearchFilters'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  GLASS_SELECT_BUTTON_CLASS,
  GLASS_SELECT_MENU_CLASS,
  GLASS_SELECT_OPTION_CLASS,
} from '@/components/ui/glassStyles'
import {
  BUST_SIZES,
  BUST_MIN_INDEX,
  BUST_MAX_INDEX,
  AGE_MIN,
  AGE_MAX_LIMIT,
  HEIGHT_MIN,
  HEIGHT_MAX_LIMIT,
  numberFormatter,
  type Facets,
} from '@/components/filters/searchFiltersConstants'

// Re-export for backward compatibility
export { SORT_SELECT_OPTIONS } from '@/components/filters/searchFiltersConstants'

type Props = {
  init?: Record<string, unknown>
  facets?: Facets
  sticky?: boolean
  className?: string
  resultCount?: number
  resultSummaryLabel?: string
}

const fieldClass =
  'w-full rounded-[24px] border border-white/50 bg-white/60 px-4 py-2.5 text-sm text-neutral-text shadow-[0_12px_32px_rgba(37,99,235,0.13)] transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30'

export default function SearchFilters({
  init,
  facets,
  sticky = false,
  className,
  resultCount,
  resultSummaryLabel,
}: Props) {
  const filters = useSearchFilters({ init, facets })

  const onSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    filters.push()
  }

  const currentConditionText =
    resultSummaryLabel ??
    (typeof resultCount === 'number'
      ? `${numberFormatter.format(resultCount)}件の結果`
      : filters.diariesFacetCount
        ? `写メ日記あり ${numberFormatter.format(filters.diariesFacetCount)}名`
        : '')

  return (
    <section
      className={clsx(
        'relative overflow-visible rounded-[32px] border border-white/60 bg-white/85 shadow-[0_8px_32px_rgba(37,99,235,0.08)] backdrop-blur-xl transition-all duration-200',
        sticky && 'lg:sticky lg:top-16 lg:z-20',
        className,
      )}
    >
      {/* Subtle gradient background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-[32px] bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.06),transparent_50%)]"
      />

      {/* Header */}
      <header className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary text-white shadow-[0_4px_12px_rgba(37,99,235,0.25)]">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-neutral-text">フィルター</h2>
            {currentConditionText && (
              <p className="text-xs text-neutral-textMuted">{currentConditionText}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {filters.hasActiveFilters && (
            <button
              type="button"
              onClick={filters.reset}
              className="text-sm font-medium text-brand-primary transition-colors hover:text-brand-primary/80"
            >
              すべてクリア
            </button>
          )}
          {filters.isMobile && (
            <button
              type="button"
              onClick={() => filters.setShowFilters((prev) => !prev)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 transition-colors hover:bg-neutral-50"
              aria-label={filters.showFilters ? 'フィルターを閉じる' : 'フィルターを開く'}
            >
              {filters.showFilters ? <X className="h-4 w-4" /> : <SlidersHorizontal className="h-4 w-4" />}
            </button>
          )}
        </div>
      </header>

      {/* Active Filter Badges */}
      {filters.hasActiveFilters && (
        <div className="border-b border-neutral-50 px-5">
          <ActiveFilterBadges badges={filters.activeFilterBadges} />
        </div>
      )}

      <form
        onSubmit={onSubmit}
        role="search"
        aria-label="店舗検索条件"
        aria-busy={filters.isPending}
        className={clsx(filters.isMobile && !filters.showFilters && 'hidden')}
      >
        {/* Quick Filters - Always visible */}
        <div className="border-b border-neutral-50 px-5 py-4">
          <QuickFilters
            todayOnly={filters.today}
            onToggleToday={filters.setToday}
            promotionsOnly={filters.promotionsOnly}
            onTogglePromotions={filters.setPromotionsOnly}
            discountsOnly={filters.discountsOnly}
            onToggleDiscounts={filters.setDiscountsOnly}
            diariesOnly={filters.diariesOnly}
            onToggleDiaries={filters.setDiariesOnly}
          />
        </div>

        {/* Filter Accordion */}
        <div className="px-5 py-4">
          <Accordion type="multiple" defaultValue={['basic']} className="space-y-3">
            <AccordionItem value="basic" className="border-none">
              <AccordionTrigger className="py-2 text-sm font-semibold text-neutral-text hover:no-underline">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-neutral-400" />
                  基本検索
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2">
                <BasicSearchSection
                  keyword={filters.q}
                  onKeywordChange={filters.setQ}
                  area={filters.area}
                  onAreaChange={filters.setArea}
                  service={filters.service}
                  onServiceChange={filters.setService}
                  areaOptions={filters.areaSelectOptions}
                  serviceOptions={filters.serviceSelectOptions}
                  fieldClass={fieldClass}
                  selectButtonClass={GLASS_SELECT_BUTTON_CLASS}
                  selectMenuClass={GLASS_SELECT_MENU_CLASS}
                  selectOptionClass={GLASS_SELECT_OPTION_CLASS}
                  className="space-y-3 rounded-2xl border border-neutral-100 bg-neutral-50/50 p-4"
                  showHeader={false}
                  showAreaField={false}
                  showServiceField={false}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="style" className="border-none">
              <AccordionTrigger className="py-2 text-sm font-semibold text-neutral-text hover:no-underline">
                <div className="flex items-center gap-2">
                  <span className="text-neutral-400">✨</span>
                  外見・スタイル
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <StyleFiltersSection
                  bustSizes={BUST_SIZES}
                  bustMinIndex={filters.bustMinIndex}
                  bustMaxIndex={filters.bustMaxIndex}
                  bustHighlightStyle={filters.bustHighlightStyle}
                  onBustChange={filters.handleBustRangeChange}
                  bustMinLimit={BUST_MIN_INDEX}
                  bustMaxLimit={BUST_MAX_INDEX}
                  ageMin={filters.ageMin}
                  ageMax={filters.ageMax}
                  ageHighlightStyle={filters.ageHighlightStyle}
                  onAgeChange={filters.handleAgeRangeChange}
                  ageMinLimit={AGE_MIN}
                  ageMaxLimit={AGE_MAX_LIMIT}
                  heightMin={filters.heightMin}
                  heightMax={filters.heightMax}
                  heightHighlightStyle={filters.heightHighlightStyle}
                  onHeightChange={filters.handleHeightRangeChange}
                  heightMinLimit={HEIGHT_MIN}
                  heightMaxLimit={HEIGHT_MAX_LIMIT}
                  onReset={filters.resetStyleFilters}
                  className="space-y-4 rounded-2xl border border-neutral-100 bg-neutral-50/50 p-4"
                  showHeader={false}
                />

                {/* Style Tags */}
                <StyleTagsSection
                  hairColor={filters.hairColor}
                  onHairColorChange={filters.setHairColor}
                  hairStyle={filters.hairStyle}
                  onHairStyleChange={filters.setHairStyle}
                  bodyShape={filters.bodyShape}
                  onBodyShapeChange={filters.setBodyShape}
                  className="rounded-2xl border border-neutral-100 bg-neutral-50/50 p-4"
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="area" className="border-none">
              <AccordionTrigger className="py-2 text-sm font-semibold text-neutral-text hover:no-underline">
                <div className="flex items-center gap-2">
                  <span className="text-neutral-400">📍</span>
                  エリア / サービス形態
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2">
                <BasicSearchSection
                  keyword={filters.q}
                  onKeywordChange={filters.setQ}
                  area={filters.area}
                  onAreaChange={filters.setArea}
                  service={filters.service}
                  onServiceChange={filters.setService}
                  areaOptions={filters.areaSelectOptions}
                  serviceOptions={filters.serviceSelectOptions}
                  fieldClass={fieldClass}
                  selectButtonClass={GLASS_SELECT_BUTTON_CLASS}
                  selectMenuClass={GLASS_SELECT_MENU_CLASS}
                  selectOptionClass={GLASS_SELECT_OPTION_CLASS}
                  className="space-y-3 rounded-2xl border border-neutral-100 bg-neutral-50/50 p-4"
                  showHeader={false}
                  showKeywordField={false}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Footer with Search Button */}
        <footer className="border-t border-neutral-100 bg-white/90 px-5 py-4 backdrop-blur-sm">
          {currentConditionText && (
            <p className="mb-3 text-center text-xs text-neutral-textMuted" aria-live="polite">
              {currentConditionText}
            </p>
          )}
          <button
            type="submit"
            disabled={filters.isPending}
            className="w-full rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary py-3 text-sm font-bold text-white shadow-[0_4px_16px_rgba(37,99,235,0.3)] transition-all duration-150 hover:shadow-[0_6px_20px_rgba(37,99,235,0.4)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {filters.isPending ? '検索中...' : 'この条件で検索する'}
          </button>
        </footer>
      </form>
    </section>
  )
}
