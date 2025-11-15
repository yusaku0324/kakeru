"use client"

import clsx from 'clsx'
import { type FormEventHandler, useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { BasicSearchSection } from '@/components/filters/BasicSearchSection'
import { FilterChipsSection } from '@/components/filters/FilterChipsSection'
import { StyleFiltersSection } from '@/components/filters/StyleFiltersSection'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { GLASS_SELECT_BUTTON_CLASS, GLASS_SELECT_MENU_CLASS, GLASS_SELECT_OPTION_CLASS } from '@/components/ui/glassStyles'

type FacetValue = {
  value: string
  label?: string | null
  count?: number
  selected?: boolean | null
}

type Facets = Record<string, FacetValue[] | undefined>

type Props = {
  init?: Record<string, any>
  facets?: Facets
  sticky?: boolean
  className?: string
  resultCount?: number
  resultSummaryLabel?: string
}

const AREA_ORDER = [
  '難波/日本橋',
  '梅田',
  '心斎橋',
  '天王寺',
  '谷町九丁目',
  '堺筋本町',
  '京橋',
  '北新地',
  '本町',
  '南森町',
  '新大阪',
  '江坂',
  '堺',
]

const numberFormatter = new Intl.NumberFormat('ja-JP')

const BUST_SIZES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const BUST_MIN_INDEX = 0
const BUST_MAX_INDEX = BUST_SIZES.length - 1
const AGE_MIN = 18
const AGE_MAX_LIMIT = 65
const AGE_DEFAULT_MAX = 35
const HEIGHT_MIN = 145
const HEIGHT_MAX_LIMIT = 190
const HEIGHT_DEFAULT_MAX = 175
const DEFAULT_TAG = '指定なし'
const HAIR_COLOR_OPTIONS = [DEFAULT_TAG, '黒髪', '茶髪', '明るめ', '金髪', 'ピンク', 'その他']
const HAIR_STYLE_OPTIONS = [DEFAULT_TAG, 'ロング', 'ミディアム', 'ショート', 'ボブ', 'ポニーテール']
const BODY_TYPE_OPTIONS = [DEFAULT_TAG, 'スレンダー', '普通', 'グラマー', 'ぽっちゃり']
const TAB_VALUE_SET = new Set(['all', 'therapists', 'shops'])

const buildHighlightStyle = (minValue: number, maxValue: number, minBound: number, maxBound: number) => {
  const range = maxBound - minBound
  if (range <= 0) return { left: '0%', right: '0%' }
  const start = ((minValue - minBound) / range) * 100
  const end = ((maxValue - minBound) / range) * 100
  return {
    left: `${Math.max(0, Math.min(start, 100))}%`,
    right: `${Math.max(0, 100 - Math.max(0, Math.min(end, 100)))}%`,
  }
}

const glassSelectButtonClass = GLASS_SELECT_BUTTON_CLASS
const glassSelectMenuClass = GLASS_SELECT_MENU_CLASS
const glassSelectOptionClass = GLASS_SELECT_OPTION_CLASS

const accordionPanelCardClass =
  'relative overflow-hidden rounded-[28px] border border-white/50 bg-white/70 p-5 shadow-[0_28px_80px_rgba(37,99,235,0.16)] backdrop-blur'

const AREA_SELECT_OPTIONS_DEFAULT = [{ value: '', label: 'すべて' }]
const SERVICE_SELECT_OPTIONS = [
  { value: '', label: 'すべて' },
  { value: 'store', label: '店舗型' },
  { value: 'dispatch', label: '派遣型' },
]
export const SORT_SELECT_OPTIONS = [
  { value: 'recommended', label: "おすすめ順" },
  { value: 'price_asc', label: "料金が安い順" },
  { value: 'price_desc', label: "料金が高い順" },
  { value: 'rating', label: "クチコミ評価順" },
  { value: 'reviews', label: "口コミ件数順" },
  { value: 'availability', label: "予約可能枠が多い順" },
  { value: 'new', label: "更新が新しい順" },
  { value: 'favorites', label: "お気に入り数順" },
] as const

const tagClass = (active: boolean) =>
  clsx(
    'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold transition',
    active
      ? 'border-brand-primary bg-brand-primary/15 text-brand-primary shadow-[0_10px_24px_rgba(37,99,235,0.22)]'
      : 'border-white/55 bg-white/55 text-neutral-text hover:border-brand-primary/40',
  )
export default function SearchFilters({ init, facets, sticky = false, className, resultCount, resultSummaryLabel }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const spKey = sp.toString()
  const [isMobile, setIsMobile] = useState(false)
  const [showFilters, setShowFilters] = useState(true)

  const extractParam = (key: string): string => {
    const initValue = init?.[key]
    if (typeof initValue === 'string') return initValue
    if (Array.isArray(initValue) && initValue.length) return String(initValue[0])
    return sp.get(key) ?? ''
  }

  const [q, setQ] = useState<string>(() => extractParam('q'))
  const [area, setArea] = useState<string>(() => extractParam('area'))
  const [service, setService] = useState<string>(() => extractParam('service'))
  const [today, setToday] = useState<boolean>(() => extractParam('today') === 'true')
  const [promotionsOnly, setPromotionsOnly] = useState<boolean>(() => extractParam('promotions_only') === 'true')
  const [discountsOnly, setDiscountsOnly] = useState<boolean>(() => extractParam('discounts_only') === 'true')
  const [diariesOnly, setDiariesOnly] = useState<boolean>(() => extractParam('diaries_only') === 'true')
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
    const normalized = Number.isFinite(value) ? Math.min(Math.max(value, AGE_MIN), AGE_MAX_LIMIT) : AGE_MIN
    const valueMax = Number.parseInt(extractParam('age_max'), 10)
    const normalizedMax = Number.isFinite(valueMax) ? Math.min(Math.max(valueMax, AGE_MIN), AGE_MAX_LIMIT) : AGE_DEFAULT_MAX
    return Math.min(normalized, normalizedMax)
  })
  const [ageMax, setAgeMax] = useState<number>(() => {
    const value = Number.parseInt(extractParam('age_max'), 10)
    const normalized = Number.isFinite(value) ? Math.min(Math.max(value, AGE_MIN), AGE_MAX_LIMIT) : AGE_DEFAULT_MAX
    return normalized
  })
  const [heightMin, setHeightMin] = useState<number>(() => {
    const value = Number.parseInt(extractParam('height_min'), 10)
    const normalized = Number.isFinite(value) ? Math.min(Math.max(value, HEIGHT_MIN), HEIGHT_MAX_LIMIT) : HEIGHT_MIN
    const valueMax = Number.parseInt(extractParam('height_max'), 10)
    const normalizedMax = Number.isFinite(valueMax) ? Math.min(Math.max(valueMax, HEIGHT_MIN), HEIGHT_MAX_LIMIT) : HEIGHT_DEFAULT_MAX
    return Math.min(normalized, normalizedMax)
  })
  const [heightMax, setHeightMax] = useState<number>(() => {
    const value = Number.parseInt(extractParam('height_max'), 10)
    const normalized = Number.isFinite(value) ? Math.min(Math.max(value, HEIGHT_MIN), HEIGHT_MAX_LIMIT) : HEIGHT_DEFAULT_MAX
    return normalized
  })
  const [hairColor, setHairColor] = useState<string>(() => extractParam('hair_color') || DEFAULT_TAG)
  const [hairStyle, setHairStyle] = useState<string>(() => extractParam('hair_style') || DEFAULT_TAG)
  const [bodyShape, setBodyShape] = useState<string>(() => extractParam('body_shape') || DEFAULT_TAG)
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

  function push() {
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
  }

  function reset() {
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
  }

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
    const normalizedAgeMin = Number.isFinite(parsedAgeMin) ? Math.min(Math.max(parsedAgeMin, AGE_MIN), AGE_MAX_LIMIT) : AGE_MIN
    const parsedAgeMax = Number.parseInt(extractParam('age_max'), 10)
    const normalizedAgeMax = Number.isFinite(parsedAgeMax) ? Math.min(Math.max(parsedAgeMax, AGE_MIN), AGE_MAX_LIMIT) : AGE_DEFAULT_MAX
    setAgeMin(Math.min(normalizedAgeMin, normalizedAgeMax))
    setAgeMax(Math.max(normalizedAgeMin, normalizedAgeMax))
    const parsedHeightMin = Number.parseInt(extractParam('height_min'), 10)
    const normalizedHeightMin = Number.isFinite(parsedHeightMin) ? Math.min(Math.max(parsedHeightMin, HEIGHT_MIN), HEIGHT_MAX_LIMIT) : HEIGHT_MIN
    const parsedHeightMax = Number.parseInt(extractParam('height_max'), 10)
    const normalizedHeightMax = Number.isFinite(parsedHeightMax) ? Math.min(Math.max(parsedHeightMax, HEIGHT_MIN), HEIGHT_MAX_LIMIT) : HEIGHT_DEFAULT_MAX
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

  const bustHighlightStyle = buildHighlightStyle(bustMinIndex, bustMaxIndex, BUST_MIN_INDEX, BUST_MAX_INDEX)
  const ageHighlightStyle = buildHighlightStyle(ageMin, ageMax, AGE_MIN, AGE_MAX_LIMIT)
  const heightHighlightStyle = buildHighlightStyle(heightMin, heightMax, HEIGHT_MIN, HEIGHT_MAX_LIMIT)

  const diariesFacetCount = useMemo(
    () => (facets?.has_diaries || []).find((facet) => facet.value === 'true')?.count ?? 0,
    [facets?.has_diaries],
  )

  const handleBustRangeChange = (minIndex: number, maxIndex: number) => {
    const clampedMin = Math.min(Math.max(minIndex, BUST_MIN_INDEX), BUST_MAX_INDEX)
    const clampedMax = Math.min(Math.max(maxIndex, BUST_MIN_INDEX), BUST_MAX_INDEX)
    setBustMinIndex(Math.min(clampedMin, clampedMax))
    setBustMaxIndex(Math.max(clampedMin, clampedMax))
  }

  const handleAgeRangeChange = (minValue: number, maxValue: number) => {
    const clampedMin = Math.min(Math.max(minValue, AGE_MIN), AGE_MAX_LIMIT)
    const clampedMax = Math.min(Math.max(maxValue, AGE_MIN), AGE_MAX_LIMIT)
    setAgeMin(Math.min(clampedMin, clampedMax))
    setAgeMax(Math.max(clampedMin, clampedMax))
  }

  const handleHeightRangeChange = (minValue: number, maxValue: number) => {
    const clampedMin = Math.min(Math.max(minValue, HEIGHT_MIN), HEIGHT_MAX_LIMIT)
    const clampedMax = Math.min(Math.max(maxValue, HEIGHT_MIN), HEIGHT_MAX_LIMIT)
    setHeightMin(Math.min(clampedMin, clampedMax))
    setHeightMax(Math.max(clampedMin, clampedMax))
  }

  const resetStyleFilters = () => {
    setBustMinIndex(BUST_MIN_INDEX)
    setBustMaxIndex(BUST_MAX_INDEX)
    setAgeMin(AGE_MIN)
    setAgeMax(AGE_DEFAULT_MAX)
    setHeightMin(HEIGHT_MIN)
    setHeightMax(HEIGHT_DEFAULT_MAX)
    setHairColor(DEFAULT_TAG)
    setHairStyle(DEFAULT_TAG)
    setBodyShape(DEFAULT_TAG)
  }

  const fieldClass =
    'w-full rounded-[24px] border border-white/50 bg-white/60 px-4 py-2.5 text-sm text-neutral-text shadow-[0_12px_32px_rgba(37,99,235,0.13)] transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30'


  const onSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    push()
  }
  const filterSummaryText = resultSummaryLabel
    ? resultSummaryLabel
    : typeof resultCount === 'number'
    ? `${numberFormatter.format(resultCount)} 名のセラピストが該当`
    : diariesFacetCount
    ? `写メ日記あり: ${numberFormatter.format(diariesFacetCount)} 名`
    : '現在の検索結果に、条件を追加して絞り込めます'
  return (
    <section
      className={clsx(
        'relative overflow-visible rounded-[48px] border border-white/35 bg-white/40 p-8 shadow-[0_36px_120px_rgba(37,99,235,0.22)] backdrop-blur-[24px]',
        sticky && 'lg:sticky lg:top-16 lg:z-20',
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(147,197,253,0.35)_0%,rgba(147,197,253,0)_60%),linear-gradient(135deg,rgba(239,246,255,0.95)_0%,rgba(236,254,255,0.6)_50%,rgba(239,246,255,0.9)_100%)]"
      />
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-neutral-text">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary text-white shadow-[0_12px_28px_rgba(37,99,235,0.25)]">
            🔍
          </span>
          <div className="space-y-1">
            <p className="text-lg font-semibold">検索フィルター</p>
            <p className="text-sm text-neutral-textMuted">必要な条件だけを開いて設定できるよう、セクションをアコーディオンにまとめました。</p>
            <p className="text-xs text-neutral-textMuted">{filterSummaryText}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {isMobile ? (
            <button
              type="button"
              onClick={() => setShowFilters((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/55 px-3 py-1.5 font-semibold text-brand-primary shadow-[0_10px_28px_rgba(37,99,235,0.18)] transition hover:border-brand-primary hover:bg-brand-primary/10"
            >
              {showFilters ? 'フィルターを閉じる' : 'フィルターを開く'}
            </button>
          ) : (
            <button
              type="button"
              onClick={reset}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-full border border-white/55 bg-white/55 px-3 py-1.5 font-semibold text-brand-primary shadow-[0_10px_28px_rgba(37,99,235,0.18)] transition hover:border-brand-primary hover:bg-brand-primary/10 disabled:opacity-60"
            >
              すべてクリア
            </button>
          )}
        </div>
      </header>

      <form
        onSubmit={onSubmit}
        role="search"
        aria-label="店舗検索条件"
        aria-busy={isPending}
        className={clsx('mt-8 space-y-8', isMobile && !showFilters && 'hidden')}
      >
        <Accordion type="multiple" defaultValue={['basic', 'special']} className="space-y-4">
          <AccordionItem value="basic">
            <AccordionTrigger>基本検索</AccordionTrigger>
            <AccordionContent className="space-y-4">
              <BasicSearchSection
                keyword={q}
                onKeywordChange={setQ}
                area={area}
                onAreaChange={setArea}
                service={service}
                onServiceChange={setService}
                areaOptions={areaSelectOptions}
                serviceOptions={serviceSelectOptions}
                fieldClass={fieldClass}
                selectButtonClass={glassSelectButtonClass}
                selectMenuClass={glassSelectMenuClass}
                selectOptionClass={glassSelectOptionClass}
                className={clsx(accordionPanelCardClass, 'space-y-4')}
                showHeader={false}
                showAreaField={false}
                showServiceField={false}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="special">
            <AccordionTrigger>特別条件</AccordionTrigger>
            <AccordionContent className="space-y-4">
          <FilterChipsSection
            todayOnly={today}
            onToggleToday={setToday}
            promotionsOnly={promotionsOnly}
            onTogglePromotions={setPromotionsOnly}
            discountsOnly={discountsOnly}
            onToggleDiscounts={setDiscountsOnly}
            diariesOnly={diariesOnly}
            onToggleDiaries={setDiariesOnly}
            className={clsx(accordionPanelCardClass, 'space-y-5')}
            showHeader={false}
          />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="style">
            <AccordionTrigger>外見・スタイル</AccordionTrigger>
            <AccordionContent className="space-y-4">
              <StyleFiltersSection
                bustSizes={BUST_SIZES}
                bustMinIndex={bustMinIndex}
                bustMaxIndex={bustMaxIndex}
                bustHighlightStyle={bustHighlightStyle}
                onBustChange={handleBustRangeChange}
                bustMinLimit={BUST_MIN_INDEX}
                bustMaxLimit={BUST_MAX_INDEX}
                ageMin={ageMin}
                ageMax={ageMax}
                ageHighlightStyle={ageHighlightStyle}
                onAgeChange={handleAgeRangeChange}
                ageMinLimit={AGE_MIN}
                ageMaxLimit={AGE_MAX_LIMIT}
                heightMin={heightMin}
                heightMax={heightMax}
                heightHighlightStyle={heightHighlightStyle}
                onHeightChange={handleHeightRangeChange}
                heightMinLimit={HEIGHT_MIN}
                heightMaxLimit={HEIGHT_MAX_LIMIT}
                onReset={resetStyleFilters}
                className={accordionPanelCardClass}
                showHeader={false}
              />

              <section className={clsx(accordionPanelCardClass, 'space-y-5 text-sm text-neutral-text')}>
                <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(191,219,254,0.25)_0%,rgba(191,219,254,0)_60%)]" />
                <header className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
                    🎨
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-neutral-text">スタイルタグ</p>
                    <p className="text-xs text-neutral-textMuted">髪色・髪型・体型などのタグを選択できます</p>
                  </div>
                </header>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">髪色</span>
                    {hairColor !== DEFAULT_TAG ? (
                      <button
                        type="button"
                        onClick={() => setHairColor(DEFAULT_TAG)}
                        className="text-xs font-semibold text-brand-primary underline-offset-2 hover:underline"
                      >
                        指定を解除
                      </button>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {HAIR_COLOR_OPTIONS.map((option) => (
                      <button
                        key={`hair-color-${option}`}
                        type="button"
                        onClick={() => setHairColor(option)}
                        className={tagClass(hairColor === option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">髪型</span>
                    {hairStyle !== DEFAULT_TAG ? (
                      <button
                        type="button"
                        onClick={() => setHairStyle(DEFAULT_TAG)}
                        className="text-xs font-semibold text-brand-primary underline-offset-2 hover:underline"
                      >
                        指定を解除
                      </button>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {HAIR_STYLE_OPTIONS.map((option) => (
                      <button
                        key={`hair-style-${option}`}
                        type="button"
                        onClick={() => setHairStyle(option)}
                        className={tagClass(hairStyle === option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">体型</span>
                    {bodyShape !== DEFAULT_TAG ? (
                      <button
                        type="button"
                        onClick={() => setBodyShape(DEFAULT_TAG)}
                        className="text-xs font-semibold text-brand-primary underline-offset-2 hover:underline"
                      >
                        指定を解除
                      </button>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {BODY_TYPE_OPTIONS.map((option) => (
                      <button
                        key={`body-shape-${option}`}
                        type="button"
                        onClick={() => setBodyShape(option)}
                        className={tagClass(bodyShape === option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="area">
            <AccordionTrigger>エリア / サービス形態</AccordionTrigger>
            <AccordionContent className="space-y-4">
              <BasicSearchSection
                keyword={q}
                onKeywordChange={setQ}
                area={area}
                onAreaChange={setArea}
                service={service}
                onServiceChange={setService}
                areaOptions={areaSelectOptions}
                serviceOptions={serviceSelectOptions}
                fieldClass={fieldClass}
                selectButtonClass={glassSelectButtonClass}
                selectMenuClass={glassSelectMenuClass}
                selectOptionClass={glassSelectOptionClass}
                className={clsx(accordionPanelCardClass, 'space-y-4')}
                showHeader={false}
                showKeywordField={false}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <footer className="flex flex-wrap items-center justify-between gap-4 rounded-[32px] border border-white/45 bg-white/45 px-6 py-4 shadow-[0_24px_70px_rgba(37,99,235,0.18)] backdrop-blur">
          <div className="text-sm text-neutral-textMuted">{filterSummaryText}</div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={reset}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-full border border-white/55 bg-white/55 px-4 py-2 text-sm font-semibold text-brand-primary shadow-[0_10px_28px_rgba(37,99,235,0.18)] transition hover:border-brand-primary hover:bg-brand-primary/10 disabled:opacity-60"
            >
              条件をクリア
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary px-6 py-2.5 text-sm font-semibold text-white shadow-[0_20px_45px_rgba(37,99,235,0.26)] transition hover:from-brand-primary/90 hover:to-brand-secondary/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              この条件で検索する
            </button>
          </div>
        </footer>
      </form>
    </section>
  )
}
