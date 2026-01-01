'use client'

import { useState, useCallback, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { SlidersHorizontal, X } from 'lucide-react'
import clsx from 'clsx'
import SearchFilters from '@/components/SearchFilters'
import { FilterSummaryBar, type FilterBadgeData } from '@/components/filters/FilterSummaryBar'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/Sheet'

type FacetValue = {
  value: string
  label?: string | null
  count?: number
  selected?: boolean | null
}

type Facets = Record<string, FacetValue[] | undefined>

type Props = {
  init: Record<string, string | undefined>
  facets: Facets
  resultSummaryLabel: string
  shopTotal: number
  therapistTotal: number
  activeTab: 'therapists' | 'shops'
  children: React.ReactNode
}

const FILTER_KEYS = [
  'q',
  'area',
  'station',
  'service',
  'body',
  'today',
  'price_min',
  'price_max',
  'price_band',
  'ranking_badges',
  'promotions_only',
  'discounts_only',
  'diaries_only',
] as const

const FILTER_LABELS: Record<string, string> = {
  q: 'キーワード',
  area: 'エリア',
  station: '駅',
  service: 'サービス',
  body: '施術',
  today: '本日空きあり',
  price_min: '最低価格',
  price_max: '最高価格',
  price_band: '価格帯',
  ranking_badges: 'ランキング',
  promotions_only: 'キャンペーン',
  discounts_only: '割引あり',
  diaries_only: '写メ日記あり',
}

export function SearchPageClientWrapper({
  init,
  facets,
  resultSummaryLabel,
  shopTotal,
  therapistTotal,
  activeTab,
  children,
}: Props) {
  // Mobile drawer state - default closed
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false)
  // Desktop sidebar collapsed state
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const toggleDesktopSidebar = useCallback(() => {
    setIsDesktopSidebarCollapsed((prev) => !prev)
  }, [])

  const activeBadges = useMemo<FilterBadgeData[]>(() => {
    const badges: FilterBadgeData[] = []

    FILTER_KEYS.forEach((key) => {
      const value = init[key]
      if (!value) return

      let label: string
      if (key === 'today' && (value === '1' || value === 'true')) {
        label = '本日空きあり'
      } else if (key === 'promotions_only' && (value === '1' || value === 'true')) {
        label = 'キャンペーン中'
      } else if (key === 'discounts_only' && (value === '1' || value === 'true')) {
        label = '割引あり'
      } else if (key === 'diaries_only' && (value === '1' || value === 'true')) {
        label = '写メ日記あり'
      } else if (key === 'q') {
        label = `"${value}"`
      } else {
        label = `${FILTER_LABELS[key] || key}: ${value}`
      }

      badges.push({
        key,
        label,
        onRemove: () => {
          const params = new URLSearchParams(searchParams.toString())
          params.delete(key)
          router.push(`/search?${params.toString()}`)
        },
      })
    })

    return badges
  }, [init, searchParams, router])

  const handleClearAll = useCallback(() => {
    const params = new URLSearchParams()
    const tab = searchParams.get('tab')
    if (tab && tab !== 'therapists') {
      params.set('tab', tab)
    }
    router.push(`/search${params.toString() ? `?${params.toString()}` : ''}`)
  }, [searchParams, router])

  const resultCount = activeTab === 'therapists' ? therapistTotal : shopTotal
  const resultUnit = activeTab === 'therapists' ? '名' : '件'

  return (
    <>
      {/* Desktop: Two-column layout with left sidebar */}
      <div className="flex gap-6">
        {/* Desktop Sidebar - Hidden on mobile */}
        <aside
          className={clsx(
            'hidden lg:block transition-all duration-300 ease-in-out',
            isDesktopSidebarCollapsed ? 'w-0 overflow-hidden opacity-0' : 'w-80 flex-shrink-0'
          )}
        >
          <div className="sticky top-20">
            <SearchFilters
              init={init}
              facets={facets}
              resultSummaryLabel={resultSummaryLabel}
              sticky
            />
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
          {/* Filter Summary Bar */}
          <FilterSummaryBar
            badges={activeBadges}
            isFilterOpen={!isDesktopSidebarCollapsed}
            onToggleFilter={toggleDesktopSidebar}
            resultCount={resultCount}
            resultUnit={resultUnit}
            onClearAll={activeBadges.length > 0 ? handleClearAll : undefined}
            sticky
            className="mb-4 hidden lg:flex"
          />

          {/* Mobile Filter Summary - Shows active filters */}
          {activeBadges.length > 0 && (
            <div className="mb-4 lg:hidden">
              <div className="flex flex-wrap gap-2">
                {activeBadges.map((badge) => (
                  <span
                    key={badge.key}
                    className="inline-flex items-center gap-1 rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-medium text-brand-primary"
                  >
                    {badge.label}
                    <button
                      type="button"
                      onClick={badge.onRemove}
                      className="ml-1 rounded-full p-0.5 hover:bg-brand-primary/20"
                      aria-label={`${badge.label}を削除`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {activeBadges.length > 1 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-xs font-medium text-brand-primary hover:underline"
                  >
                    すべてクリア
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Search Results */}
          <div id="search-results">
            {children}
          </div>
        </div>
      </div>

      {/* Mobile Filter Sheet - Opens from bottom */}
      <Sheet open={isMobileDrawerOpen} onOpenChange={setIsMobileDrawerOpen}>
        <SheetContent side="bottom" className="h-[85vh] overflow-y-auto rounded-t-3xl">
          <SheetHeader className="mb-4 text-left">
            <SheetTitle>絞り込み検索</SheetTitle>
            <SheetDescription>
              お好みの条件でセラピストや店舗を探せます
            </SheetDescription>
          </SheetHeader>

          <SearchFilters
            init={init}
            facets={facets}
            resultSummaryLabel={resultSummaryLabel}
          />

          <SheetFooter className="mt-6 pb-safe">
            <button
              onClick={() => setIsMobileDrawerOpen(false)}
              className="w-full rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary py-3.5 font-bold text-white shadow-lg transition-transform active:scale-95"
            >
              {resultCount}{resultUnit}を表示
            </button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Mobile Filter FAB - Bottom center */}
      <button
        type="button"
        onClick={() => setIsMobileDrawerOpen(true)}
        className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary px-5 py-3 text-sm font-bold text-white shadow-[0_4px_20px_rgba(37,99,235,0.35)] transition-all duration-200 hover:shadow-[0_6px_24px_rgba(37,99,235,0.45)] active:scale-95 lg:hidden"
        aria-label="フィルターを開く"
      >
        <SlidersHorizontal className="h-4 w-4" />
        絞り込み
        {activeBadges.length > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/20 px-1.5 text-[10px] font-bold">
            {activeBadges.length}
          </span>
        )}
      </button>
    </>
  )
}

export default SearchPageClientWrapper
