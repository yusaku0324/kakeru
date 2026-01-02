'use client'

import { useState, useCallback, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { SlidersHorizontal } from 'lucide-react'
import SearchFilters from '@/components/SearchFilters'
import { type FilterBadgeData } from '@/components/filters/FilterSummaryBar'
import { MobileFilterDrawer } from '@/components/filters/MobileFilterDrawer'

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
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

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

  const handleMobileSearch = useCallback(() => {
    setIsMobileDrawerOpen(false)
    const resultsEl = document.getElementById('search-results')
    if (resultsEl) {
      resultsEl.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  const resultCount = activeTab === 'therapists' ? therapistTotal : shopTotal
  const resultUnit = activeTab === 'therapists' ? '名' : '件'

  return (
    <>
      {/* Desktop: Sidebar Layout */}
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Left Sidebar - Filters (Desktop only) */}
        <aside className="hidden lg:block">
          <div className="sticky top-4">
            <SearchFilters
              init={init}
              facets={facets}
              resultSummaryLabel={resultSummaryLabel}
            />
          </div>
        </aside>

        {/* Right Content - Results */}
        <div id="search-results">
          {/* Active Filter Badges */}
          {activeBadges.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {activeBadges.map((badge) => (
                <span
                  key={badge.key}
                  className="inline-flex items-center gap-1 rounded-full bg-brand-primary/10 px-3 py-1 text-sm text-brand-primary"
                >
                  {badge.label}
                  <button
                    type="button"
                    onClick={badge.onRemove}
                    className="ml-1 rounded-full p-0.5 hover:bg-brand-primary/20"
                    aria-label={`${badge.label}を削除`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={handleClearAll}
                className="text-sm text-neutral-textMuted hover:text-brand-primary"
              >
                すべてクリア
              </button>
            </div>
          )}
          {children}
        </div>
      </div>

      {/* Mobile Filter FAB */}
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

      {/* Mobile Filter Drawer */}
      <MobileFilterDrawer
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
        onApply={handleMobileSearch}
        resultCount={resultCount}
        resultUnit={resultUnit}
        activeFilterCount={activeBadges.length}
      >
        <SearchFilters
          init={init}
          facets={facets}
          resultSummaryLabel={resultSummaryLabel}
        />
      </MobileFilterDrawer>
    </>
  )
}

export default SearchPageClientWrapper
