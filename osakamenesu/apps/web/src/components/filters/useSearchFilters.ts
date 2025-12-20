'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import type { FilterBadge } from './ActiveFilterBadges'
import {
  BUST_SIZES,
  BUST_MIN_INDEX,
  BUST_MAX_INDEX,
  AGE_MIN,
  AGE_MAX_LIMIT,
  AGE_DEFAULT_MAX,
  HEIGHT_MIN,
  HEIGHT_MAX_LIMIT,
  HEIGHT_DEFAULT_MAX,
  DEFAULT_TAG,
  TAB_VALUE_SET,
  AREA_ORDER,
  AREA_SELECT_OPTIONS_DEFAULT,
  SERVICE_SELECT_OPTIONS,
  buildHighlightStyle,
  type Facets,
} from './searchFiltersConstants'

type UseSearchFiltersOptions = {
  init?: Record<string, unknown>
  facets?: Facets
}

export function useSearchFilters({ init, facets }: UseSearchFiltersOptions) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const spKey = sp.toString()
  const [isMobile, setIsMobile] = useState(false)
  const [showFilters, setShowFilters] = useState(true)

  const extractParam = useCallback((key: string): string => {
    const initValue = init?.[key]
    if (typeof initValue === 'string') return initValue
    if (Array.isArray(initValue) && initValue.length) return String(initValue[0])
    return sp.get(key) ?? ''
  }, [init, sp])

  const [q, setQ] = useState<string>(() => extractParam('q'))
  const [area, setArea] = useState<string>(() => extractParam('area'))
  const [service, setService] = useState<string>(() => extractParam('service'))
  const [today, setToday] = useState<boolean>(() => extractParam('today') === 'true')
  const [promotionsOnly, setPromotionsOnly] = useState<boolean>(
    () => extractParam('promotions_only') === 'true',
  )
  const [discountsOnly, setDiscountsOnly] = useState<boolean>(
    () => extractParam('discounts_only') === 'true',
  )
  const [diariesOnly, setDiariesOnly] = useState<boolean>(
    () => extractParam('diaries_only') === 'true',
  )
  const [sort, setSort] = useState<string>(() => extractParam('sort') || 'recommended')
  const [bustMinIndex, setBustMinIndex] = useState<number>(() => {
    const minPreset = BUST_SIZES.indexOf(extractParam('bust_min').toUpperCase())
    const maxPreset = BUST_SIZES.indexOf(extractParam('bust_max').toUpperCase())
    const minValue = minPreset >= 0 ? minPreset : BUST_MIN_INDEX
    const maxValue = maxPreset >= 0 ? maxPreset : BUST_MAX_INDEX
    return Math.min(minValue, maxValue)
  })
  const [bustMaxIndex, setBustMaxIndex] = useState<number>(() => {
    const minPreset = BUST_SIZES.indexOf(extractParam('bust_min').toUpperCase())
    const maxPreset = BUST_SIZES.indexOf(extractParam('bust_max').toUpperCase())
    const minValue = minPreset >= 0 ? minPreset : BUST_MIN_INDEX
    const maxValue = maxPreset >= 0 ? maxPreset : BUST_MAX_INDEX
    return Math.max(minValue, maxValue)
  })
  const [ageMin, setAgeMin] = useState<number>(() => {
    const value = Number.parseInt(extractParam('age_min'), 10)
    const normalized = Number.isFinite(value)
      ? Math.min(Math.max(value, AGE_MIN), AGE_MAX_LIMIT)
      : AGE_MIN
    const valueMax = Number.parseInt(extractParam('age_max'), 10)
    const normalizedMax = Number.isFinite(valueMax)
      ? Math.min(Math.max(valueMax, AGE_MIN), AGE_MAX_LIMIT)
      : AGE_DEFAULT_MAX
    return Math.min(normalized, normalizedMax)
  })
  const [ageMax, setAgeMax] = useState<number>(() => {
    const value = Number.parseInt(extractParam('age_max'), 10)
    const normalized = Number.isFinite(value)
      ? Math.min(Math.max(value, AGE_MIN), AGE_MAX_LIMIT)
      : AGE_DEFAULT_MAX
    return normalized
  })
  const [heightMin, setHeightMin] = useState<number>(() => {
    const value = Number.parseInt(extractParam('height_min'), 10)
    const normalized = Number.isFinite(value)
      ? Math.min(Math.max(value, HEIGHT_MIN), HEIGHT_MAX_LIMIT)
      : HEIGHT_MIN
    const valueMax = Number.parseInt(extractParam('height_max'), 10)
    const normalizedMax = Number.isFinite(valueMax)
      ? Math.min(Math.max(valueMax, HEIGHT_MIN), HEIGHT_MAX_LIMIT)
      : HEIGHT_DEFAULT_MAX
    return Math.min(normalized, normalizedMax)
  })
  const [heightMax, setHeightMax] = useState<number>(() => {
    const value = Number.parseInt(extractParam('height_max'), 10)
    const normalized = Number.isFinite(value)
      ? Math.min(Math.max(value, HEIGHT_MIN), HEIGHT_MAX_LIMIT)
      : HEIGHT_DEFAULT_MAX
    return normalized
  })
  const [hairColor, setHairColor] = useState<string>(
    () => extractParam('hair_color') || DEFAULT_TAG,
  )
  const [hairStyle, setHairStyle] = useState<string>(
    () => extractParam('hair_style') || DEFAULT_TAG,
  )
  const [bodyShape, setBodyShape] = useState<string>(
    () => extractParam('body_shape') || DEFAULT_TAG,
  )
  const firstRender = useRef(true)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(max-width: 768px)')
    const applyMatch = (matches: boolean) => {
      setIsMobile(matches)
      if (!matches) setShowFilters(true)
    }
    applyMatch(media.matches)
    const listener = (event: MediaQueryListEvent) => applyMatch(event.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [])

  const scrollToResults = useCallback(() => {
    if (typeof window === 'undefined') return
    requestAnimationFrame(() => {
      const el = document.getElementById('search-results')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

  const push = useCallback(() => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (area) params.set('area', area)
    if (service) params.set('service', service)
    if (today) params.set('today', 'true')
    if (promotionsOnly) params.set('promotions_only', 'true')
    if (discountsOnly) params.set('discounts_only', 'true')
    if (diariesOnly) params.set('diaries_only', 'true')
    if (bustMinIndex !== BUST_MIN_INDEX) params.set('bust_min', BUST_SIZES[bustMinIndex])
    if (bustMaxIndex !== BUST_MAX_INDEX) params.set('bust_max', BUST_SIZES[bustMaxIndex])
    if (ageMin !== AGE_MIN) params.set('age_min', String(ageMin))
    if (ageMax !== AGE_DEFAULT_MAX) params.set('age_max', String(ageMax))
    if (heightMin !== HEIGHT_MIN) params.set('height_min', String(heightMin))
    if (heightMax !== HEIGHT_DEFAULT_MAX) params.set('height_max', String(heightMax))
    if (hairColor && hairColor !== DEFAULT_TAG) params.set('hair_color', hairColor)
    if (hairStyle && hairStyle !== DEFAULT_TAG) params.set('hair_style', hairStyle)
    if (bodyShape && bodyShape !== DEFAULT_TAG) params.set('body_shape', bodyShape)
    if (sort && sort !== 'recommended') params.set('sort', sort)
    const currentTab = extractParam('tab') || sp.get('tab') || ''
    if (currentTab && TAB_VALUE_SET.has(currentTab)) {
      if (currentTab === 'all') {
        params.delete('tab')
      } else {
        params.set('tab', currentTab)
      }
    }
    params.set('page', '1')
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`)
      scrollToResults()
    })
    if (isMobile) setShowFilters(false)
    try {
      localStorage.setItem('search.last', params.toString())
    } catch {
      // ignore
    }
  }, [
    q, area, service, today, promotionsOnly, discountsOnly, diariesOnly,
    bustMinIndex, bustMaxIndex, ageMin, ageMax, heightMin, heightMax,
    hairColor, hairStyle, bodyShape, sort, extractParam, sp, pathname,
    router, scrollToResults, isMobile,
  ])

  const reset = useCallback(() => {
    setQ('')
    setArea('')
    setService('')
    setToday(false)
    setPromotionsOnly(false)
    setDiscountsOnly(false)
    setDiariesOnly(false)
    setBustMinIndex(BUST_MIN_INDEX)
    setBustMaxIndex(BUST_MAX_INDEX)
    setAgeMin(AGE_MIN)
    setAgeMax(AGE_DEFAULT_MAX)
    setHeightMin(HEIGHT_MIN)
    setHeightMax(HEIGHT_DEFAULT_MAX)
    setHairColor(DEFAULT_TAG)
    setHairStyle(DEFAULT_TAG)
    setBodyShape(DEFAULT_TAG)
    setSort('recommended')
    startTransition(() => {
      router.replace(pathname)
      scrollToResults()
    })
    if (isMobile) setShowFilters(false)
    try {
      localStorage.removeItem('search.last')
    } catch {
      // ignore
    }
  }, [pathname, router, scrollToResults, isMobile])

  useEffect(() => {
    setQ(extractParam('q'))
    setArea(extractParam('area'))
    setService(extractParam('service'))
    setToday(extractParam('today') === 'true')
    setPromotionsOnly(extractParam('promotions_only') === 'true')
    setDiscountsOnly(extractParam('discounts_only') === 'true')
    setDiariesOnly(extractParam('diaries_only') === 'true')
    setSort(extractParam('sort') || 'recommended')
    const bustMinPreset = BUST_SIZES.indexOf(extractParam('bust_min').toUpperCase())
    const bustMaxPreset = BUST_SIZES.indexOf(extractParam('bust_max').toUpperCase())
    const minValue = bustMinPreset >= 0 ? bustMinPreset : BUST_MIN_INDEX
    const maxValue = bustMaxPreset >= 0 ? bustMaxPreset : BUST_MAX_INDEX
    setBustMinIndex(Math.min(minValue, maxValue))
    setBustMaxIndex(Math.max(minValue, maxValue))
    const parsedAgeMin = Number.parseInt(extractParam('age_min'), 10)
    const normalizedAgeMin = Number.isFinite(parsedAgeMin)
      ? Math.min(Math.max(parsedAgeMin, AGE_MIN), AGE_MAX_LIMIT)
      : AGE_MIN
    const parsedAgeMax = Number.parseInt(extractParam('age_max'), 10)
    const normalizedAgeMax = Number.isFinite(parsedAgeMax)
      ? Math.min(Math.max(parsedAgeMax, AGE_MIN), AGE_MAX_LIMIT)
      : AGE_DEFAULT_MAX
    setAgeMin(Math.min(normalizedAgeMin, normalizedAgeMax))
    setAgeMax(Math.max(normalizedAgeMin, normalizedAgeMax))
    const parsedHeightMin = Number.parseInt(extractParam('height_min'), 10)
    const normalizedHeightMin = Number.isFinite(parsedHeightMin)
      ? Math.min(Math.max(parsedHeightMin, HEIGHT_MIN), HEIGHT_MAX_LIMIT)
      : HEIGHT_MIN
    const parsedHeightMax = Number.parseInt(extractParam('height_max'), 10)
    const normalizedHeightMax = Number.isFinite(parsedHeightMax)
      ? Math.min(Math.max(parsedHeightMax, HEIGHT_MIN), HEIGHT_MAX_LIMIT)
      : HEIGHT_DEFAULT_MAX
    setHeightMin(Math.min(normalizedHeightMin, normalizedHeightMax))
    setHeightMax(Math.max(normalizedHeightMin, normalizedHeightMax))
    setHairColor(extractParam('hair_color') || DEFAULT_TAG)
    setHairStyle(extractParam('hair_style') || DEFAULT_TAG)
    setBodyShape(extractParam('body_shape') || DEFAULT_TAG)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spKey])

  useEffect(() => {
    if (!sp.toString() && typeof window !== 'undefined') {
      const last = localStorage.getItem('search.last')
      if (last) router.replace(`${pathname}?${last}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    if (isMobile) {
      setShowFilters(false)
      scrollToResults()
    }
  }, [spKey, isMobile, scrollToResults])

  const areaSelectOptions = useMemo(() => {
    const facetList = facets?.area ?? []
    const seen = new Set<string>([''])
    const options: { value: string; label: string }[] = [...AREA_SELECT_OPTIONS_DEFAULT]
    for (const value of AREA_ORDER) {
      if (seen.has(value)) continue
      options.push({ value, label: value })
      seen.add(value)
    }
    for (const facet of facetList) {
      const value = facet.value
      if (!value || seen.has(value)) continue
      options.push({ value, label: facet.label || value })
      seen.add(value)
    }
    if (area && !seen.has(area)) {
      options.push({ value: area, label: area })
    }
    return options
  }, [area, facets?.area])

  const serviceSelectOptions = useMemo(() => {
    const seen = new Set<string>()
    const options: { value: string; label: string }[] = []
    for (const option of SERVICE_SELECT_OPTIONS) {
      if (seen.has(option.value)) continue
      options.push(option)
      seen.add(option.value)
    }
    if (service && !seen.has(service)) {
      options.push({ value: service, label: service })
    }
    return options
  }, [service])

  const bustHighlightStyle = buildHighlightStyle(
    bustMinIndex,
    bustMaxIndex,
    BUST_MIN_INDEX,
    BUST_MAX_INDEX,
  )
  const ageHighlightStyle = buildHighlightStyle(ageMin, ageMax, AGE_MIN, AGE_MAX_LIMIT)
  const heightHighlightStyle = buildHighlightStyle(
    heightMin,
    heightMax,
    HEIGHT_MIN,
    HEIGHT_MAX_LIMIT,
  )

  const diariesFacetCount = useMemo(
    () => (facets?.has_diaries || []).find((facet) => facet.value === 'true')?.count ?? 0,
    [facets?.has_diaries],
  )

  const handleBustRangeChange = useCallback((minIndex: number, maxIndex: number) => {
    const clampedMin = Math.min(Math.max(minIndex, BUST_MIN_INDEX), BUST_MAX_INDEX)
    const clampedMax = Math.min(Math.max(maxIndex, BUST_MIN_INDEX), BUST_MAX_INDEX)
    setBustMinIndex(Math.min(clampedMin, clampedMax))
    setBustMaxIndex(Math.max(clampedMin, clampedMax))
  }, [])

  const handleAgeRangeChange = useCallback((minValue: number, maxValue: number) => {
    const clampedMin = Math.min(Math.max(minValue, AGE_MIN), AGE_MAX_LIMIT)
    const clampedMax = Math.min(Math.max(maxValue, AGE_MIN), AGE_MAX_LIMIT)
    setAgeMin(Math.min(clampedMin, clampedMax))
    setAgeMax(Math.max(clampedMin, clampedMax))
  }, [])

  const handleHeightRangeChange = useCallback((minValue: number, maxValue: number) => {
    const clampedMin = Math.min(Math.max(minValue, HEIGHT_MIN), HEIGHT_MAX_LIMIT)
    const clampedMax = Math.min(Math.max(maxValue, HEIGHT_MIN), HEIGHT_MAX_LIMIT)
    setHeightMin(Math.min(clampedMin, clampedMax))
    setHeightMax(Math.max(clampedMin, clampedMax))
  }, [])

  const resetStyleFilters = useCallback(() => {
    setBustMinIndex(BUST_MIN_INDEX)
    setBustMaxIndex(BUST_MAX_INDEX)
    setAgeMin(AGE_MIN)
    setAgeMax(AGE_DEFAULT_MAX)
    setHeightMin(HEIGHT_MIN)
    setHeightMax(HEIGHT_DEFAULT_MAX)
    setHairColor(DEFAULT_TAG)
    setHairStyle(DEFAULT_TAG)
    setBodyShape(DEFAULT_TAG)
  }, [])

  // Generate active filter badges
  const activeFilterBadges = useMemo((): FilterBadge[] => {
    const badges: FilterBadge[] = []

    if (q) {
      badges.push({
        key: 'q',
        label: `キーワード: ${q}`,
        onRemove: () => setQ(''),
      })
    }
    if (area) {
      badges.push({
        key: 'area',
        label: `エリア: ${area}`,
        onRemove: () => setArea(''),
      })
    }
    if (service) {
      const serviceLabel = SERVICE_SELECT_OPTIONS.find((o) => o.value === service)?.label || service
      badges.push({
        key: 'service',
        label: `形態: ${serviceLabel}`,
        onRemove: () => setService(''),
      })
    }
    if (today) {
      badges.push({
        key: 'today',
        label: '本日空きあり',
        onRemove: () => setToday(false),
      })
    }
    if (promotionsOnly) {
      badges.push({
        key: 'promotions',
        label: 'キャンペーン中',
        onRemove: () => setPromotionsOnly(false),
      })
    }
    if (discountsOnly) {
      badges.push({
        key: 'discounts',
        label: '割引あり',
        onRemove: () => setDiscountsOnly(false),
      })
    }
    if (diariesOnly) {
      badges.push({
        key: 'diaries',
        label: '写メ日記あり',
        onRemove: () => setDiariesOnly(false),
      })
    }
    if (ageMin !== AGE_MIN || ageMax !== AGE_DEFAULT_MAX) {
      badges.push({
        key: 'age',
        label: `年齢: ${ageMin}-${ageMax}歳`,
        onRemove: () => {
          setAgeMin(AGE_MIN)
          setAgeMax(AGE_DEFAULT_MAX)
        },
      })
    }
    if (heightMin !== HEIGHT_MIN || heightMax !== HEIGHT_DEFAULT_MAX) {
      badges.push({
        key: 'height',
        label: `身長: ${heightMin}-${heightMax}cm`,
        onRemove: () => {
          setHeightMin(HEIGHT_MIN)
          setHeightMax(HEIGHT_DEFAULT_MAX)
        },
      })
    }
    if (bustMinIndex !== BUST_MIN_INDEX || bustMaxIndex !== BUST_MAX_INDEX) {
      badges.push({
        key: 'bust',
        label: `バスト: ${BUST_SIZES[bustMinIndex]}-${BUST_SIZES[bustMaxIndex]}`,
        onRemove: () => {
          setBustMinIndex(BUST_MIN_INDEX)
          setBustMaxIndex(BUST_MAX_INDEX)
        },
      })
    }
    if (hairColor && hairColor !== DEFAULT_TAG) {
      badges.push({
        key: 'hairColor',
        label: `髪色: ${hairColor}`,
        onRemove: () => setHairColor(DEFAULT_TAG),
      })
    }
    if (hairStyle && hairStyle !== DEFAULT_TAG) {
      badges.push({
        key: 'hairStyle',
        label: `髪型: ${hairStyle}`,
        onRemove: () => setHairStyle(DEFAULT_TAG),
      })
    }
    if (bodyShape && bodyShape !== DEFAULT_TAG) {
      badges.push({
        key: 'bodyShape',
        label: `体型: ${bodyShape}`,
        onRemove: () => setBodyShape(DEFAULT_TAG),
      })
    }

    return badges
  }, [
    q, area, service, today, promotionsOnly, discountsOnly, diariesOnly,
    ageMin, ageMax, heightMin, heightMax, bustMinIndex, bustMaxIndex,
    hairColor, hairStyle, bodyShape,
  ])

  return {
    // State values
    q,
    area,
    service,
    today,
    promotionsOnly,
    discountsOnly,
    diariesOnly,
    sort,
    bustMinIndex,
    bustMaxIndex,
    ageMin,
    ageMax,
    heightMin,
    heightMax,
    hairColor,
    hairStyle,
    bodyShape,
    isMobile,
    showFilters,
    isPending,

    // Setters
    setQ,
    setArea,
    setService,
    setToday,
    setPromotionsOnly,
    setDiscountsOnly,
    setDiariesOnly,
    setSort,
    setHairColor,
    setHairStyle,
    setBodyShape,
    setShowFilters,

    // Computed values
    areaSelectOptions,
    serviceSelectOptions,
    bustHighlightStyle,
    ageHighlightStyle,
    heightHighlightStyle,
    diariesFacetCount,
    activeFilterBadges,
    hasActiveFilters: activeFilterBadges.length > 0,

    // Actions
    push,
    reset,
    handleBustRangeChange,
    handleAgeRangeChange,
    handleHeightRangeChange,
    resetStyleFilters,
  }
}
