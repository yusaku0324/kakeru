'use client'

import { useState, useCallback, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import SearchFilters, { SORT_SELECT_OPTIONS } from '@/components/SearchFilters'
import { FilterSummaryBar, type FilterBadgeData } from '@/components/filters/FilterSummaryBar'
import { FilterToggleButton } from '@/components/filters/FilterToggleButton'
import { MobileFilterCTA } from '@/components/filters/MobileFilterCTA'

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
  const [isFilterOpen, setIsFilterOpen] = useState(true)
  const router = useRouter()
  const searchParams = useSearchParams()

  const toggleFilter = useCallback(() => {
    setIsFilterOpen((prev) => !prev)
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

  const handleMobileSearch = useCallback(() => {
    setIsFilterOpen(false)
    const resultsEl = document.getElementById('search-results')
    if (resultsEl) {
      resultsEl.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  const resultCount = activeTab === 'therapists' ? therapistTotal : shopTotal
  const resultUnit = activeTab === 'therapists' ? '名' : '件'

  return (
    <>
      {/* Sticky Filter Summary Bar */}
      <FilterSummaryBar
        badges={activeBadges}
        isFilterOpen={isFilterOpen}
        onToggleFilter={toggleFilter}
        resultCount={resultCount}
        resultUnit={resultUnit}
        onClearAll={activeBadges.length > 0 ? handleClearAll : undefined}
        sticky
        className="mb-4"
      />

      {/* Filter Section (collapsible) */}
      {isFilterOpen && (
        <div className="mb-6 animate-in slide-in-from-top-2 duration-200">
          <SearchFilters
            init={init}
            facets={facets}
            resultSummaryLabel={resultSummaryLabel}
          />
        </div>
      )}

      {/* Search Results */}
      {children}

      {/* Bottom Filter Toggle Button (desktop) */}
      <div className="mt-8 hidden justify-center md:flex">
        <FilterToggleButton
          onClick={toggleFilter}
          variant="secondary"
        />
      </div>

      {/* Mobile Bottom CTA */}
      <MobileFilterCTA
        onSubmit={handleMobileSearch}
        resultCount={resultCount}
        resultUnit={resultUnit}
      />
    </>
  )
}

export default SearchPageClientWrapper
