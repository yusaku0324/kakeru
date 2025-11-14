import { NextResponse } from 'next/server'

import type { ShopHit } from '@/components/shop/ShopCard'
import { SAMPLE_SHOPS } from '@/lib/sampleShops'
import { sampleShopToHit } from '@/lib/sampleShopAdapters'

type FacetValue = {
  value: string
  label?: string | null
  count: number
}

function parsePositiveInt(value: string | null | undefined, fallback: number, max: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, max)
}

function parseBooleanFlag(value: string | null | undefined): boolean {
  if (!value) return false
  const normalized = value.toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

function normalizeString(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

function parseCommaSeparated(value: string | null | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((entry) => normalizeString(entry))
    .filter((entry): entry is string => Boolean(entry))
}

function parsePrice(value: string | null | undefined): number | null {
  if (!value) return null
  const normalized = value.replace(/[^\d]/g, '')
  if (!normalized) return null
  const parsed = Number.parseInt(normalized, 10)
  return Number.isNaN(parsed) ? null : parsed
}

function sortHits(hits: ShopHit[], sortParam: string | null): ShopHit[] {
  const sortKey = (sortParam || 'recommended').toLowerCase()
  const sorted = [...hits]

  const parseDate = (value?: string | null) => {
    if (!value) return 0
    const time = new Date(value).getTime()
    return Number.isNaN(time) ? 0 : time
  }

  switch (sortKey) {
    case 'price_asc':
      sorted.sort((a, b) => (a.min_price ?? 0) - (b.min_price ?? 0))
      break
    case 'price_desc':
      sorted.sort((a, b) => (b.max_price ?? b.min_price ?? 0) - (a.max_price ?? a.min_price ?? 0))
      break
    case 'rating':
      sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      break
    case 'new':
      sorted.sort((a, b) => parseDate(b.updated_at) - parseDate(a.updated_at))
      break
    default:
      sorted.sort((a, b) => {
        const ratingDiff = (b.rating ?? 0) - (a.rating ?? 0)
        if (ratingDiff !== 0) return ratingDiff
        const promoDiff = (b.promotion_count ?? 0) - (a.promotion_count ?? 0)
        if (promoDiff !== 0) return promoDiff
        return (a.min_price ?? 0) - (b.min_price ?? 0)
      })
      break
  }
  return sorted
}

function buildFacets(hits: ShopHit[]): Record<string, FacetValue[]> {
  const areaCounts = new Map<string, number>()
  const priceBandCounts = new Map<string, { count: number; label: string | null }>()
  hits.forEach((hit) => {
    const areaKey = hit.area_name || hit.area
    if (!areaKey) return
    areaCounts.set(areaKey, (areaCounts.get(areaKey) ?? 0) + 1)
    if (hit.price_band) {
      const existing = priceBandCounts.get(hit.price_band)
      const label = existing?.label ?? hit.price_band_label ?? hit.price_band
      priceBandCounts.set(hit.price_band, { count: (existing?.count ?? 0) + 1, label })
    }
  })

  const facets: Record<string, FacetValue[]> = {}
  if (areaCounts.size) {
    facets.area = Array.from(areaCounts.entries()).map(([value, count]) => ({
      value,
      label: value,
      count,
    }))
  }
  if (priceBandCounts.size) {
    facets.price_band = Array.from(priceBandCounts.entries()).map(([value, meta]) => ({
      value,
      label: meta.label ?? value,
      count: meta.count,
    }))
  }
  return facets
}

function filterByQuery(hits: ShopHit[], query: string): ShopHit[] {
  const keyword = query.toLowerCase()
  return hits.filter((hit) => {
    const targets = [
      hit.name,
      hit.store_name,
      hit.area,
      hit.area_name,
      hit.ranking_reason,
      ...(hit.service_tags ?? []),
      ...(hit.badges ?? []),
    ]
    return targets.some((value) => value && value.toLowerCase().includes(keyword))
  })
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const params = url.searchParams

  const q = normalizeString(params.get('q'))
  const areaParam = normalizeString(params.get('area') || params.get('area_name'))
  const openNow = parseBooleanFlag(params.get('open_now') || params.get('today'))
  const promotionsOnly = parseBooleanFlag(params.get('promotions_only'))
  const discountsOnly = parseBooleanFlag(params.get('discounts_only'))
  const diariesOnly = parseBooleanFlag(params.get('diaries_only'))
  const categoryFilters = parseCommaSeparated(params.get('category'))
  const serviceTagFilters = parseCommaSeparated(params.get('service_tags'))
  const priceMin = parsePrice(params.get('price_min'))
  const priceMax = parsePrice(params.get('price_max'))
  const priceBandFilters = parseCommaSeparated(params.get('price_band'))
  const sortParam = params.get('sort')
  const page = parsePositiveInt(params.get('page'), 1, 1000)
  const pageSize = parsePositiveInt(params.get('page_size'), 12, 50)

  let hits = SAMPLE_SHOPS.map((shop) => sampleShopToHit(shop))

  if (q) {
    hits = filterByQuery(hits, q)
  }

  if (areaParam) {
    hits = hits.filter((hit) => {
      const candidates = [hit.area, hit.area_name].filter(Boolean).map((value) => value!.toLowerCase())
      return candidates.some((value) => value.includes(areaParam.toLowerCase()))
    })
  }

  if (categoryFilters.length) {
    const normalized = categoryFilters.map((value) => value.toLowerCase())
    hits = hits.filter((hit) => {
      if (!Array.isArray(hit.categories) || hit.categories.length === 0) return false
      const categories = hit.categories
        .map((category) => (category ? category.toLowerCase() : null))
        .filter((category): category is string => Boolean(category))
      return categories.some((category) => normalized.some((filter) => category.includes(filter)))
    })
  }

  if (serviceTagFilters.length) {
    const normalized = serviceTagFilters.map((value) => value.toLowerCase())
    hits = hits.filter((hit) => {
      if (!Array.isArray(hit.service_tags) || hit.service_tags.length === 0) return false
      const tags = hit.service_tags
        .map((tag) => (tag ? tag.toLowerCase() : null))
        .filter((tag): tag is string => Boolean(tag))
      if (!tags.length) return false
      return normalized.every((filter) => tags.some((tag) => tag.includes(filter)))
    })
  }

  if (priceMin != null) {
    hits = hits.filter((hit) => {
      const upperBound = hit.max_price ?? hit.min_price ?? 0
      return upperBound >= priceMin
    })
  }

  if (priceMax != null) {
    hits = hits.filter((hit) => {
      const lowerBound = hit.min_price ?? hit.max_price ?? priceMax
      return lowerBound <= priceMax
    })
  }

  if (priceBandFilters.length) {
    const normalized = new Set(priceBandFilters.map((value) => value.toLowerCase()))
    hits = hits.filter((hit) => {
      if (!hit.price_band) return false
      return normalized.has(hit.price_band.toLowerCase())
    })
  }

  if (openNow) {
    hits = hits.filter((hit) => hit.today_available || Boolean(hit.next_available_at))
  }

  if (promotionsOnly) {
    hits = hits.filter((hit) => (hit.has_promotions ?? false) || (hit.promotion_count ?? 0) > 0)
  }

  if (discountsOnly) {
    hits = hits.filter((hit) => hit.has_discounts ?? false)
  }

  if (diariesOnly) {
    hits = hits.filter((hit) => (hit.diary_count ?? 0) > 0)
  }

  const sortedHits = sortHits(hits, sortParam)
  const total = sortedHits.length

  const start = (page - 1) * pageSize
  const paginated = sortedHits.slice(start, start + pageSize)
  const facets = buildFacets(sortedHits)

  return NextResponse.json({
    page,
    page_size: pageSize,
    total,
    results: paginated,
    facets,
    sample: true,
  })
}
