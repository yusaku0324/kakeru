import clsx from 'clsx'
import Link from 'next/link'

import { SORT_SELECT_OPTIONS } from '@/components/SearchFilters'
import ShopCard, { type ShopHit } from '@/components/shop/ShopCard'
import TherapistCard, { type TherapistHit } from '@/components/staff/TherapistCard'
import { TherapistFavoritesProvider } from '@/features/favorites'
import ReservationOverlayPortal from '@/components/ReservationOverlayPortal'
import { Badge } from '@/components/ui/Badge'
import { Section } from '@/components/ui/Section'
import { Card } from '@/components/ui/Card'
import { buildApiUrl, resolveApiBases } from '@/lib/api'
import { buildStaffIdentifier } from '@/lib/staff'
import { toNextAvailableSlotPayload } from '@/lib/nextAvailableSlot'
import { ResultsSortControl } from '@/features/search/ui/ResultsSortControl'
import { normalizeHobbyTags } from '@/features/therapist/profileTags'
import { SearchAvailableToday, type SpotlightItem } from './_components/SearchHeroSections'
import { SearchTabs, type SearchTabValue } from './_components/SearchTabs'
import { SearchPageClientWrapper } from './_components/SearchPageClientWrapper'
import { SearchHero } from './_components/SearchHero'

// Cache search results for 30 seconds to improve performance
// This allows Next.js to serve cached SSR results for subsequent requests
export const revalidate = 30

// Helper to get next 30-minute aligned slot time (for canonicalization)
// e.g., 09:28 → 09:30, 09:00 → 09:00, 09:31 → 10:00
function nextSlotAlignedTime(hours: number): string {
  const date = new Date(Date.now() + hours * 60 * 60 * 1000)
  const minutes = date.getMinutes()
  // Round up to next 30-minute boundary
  const alignedMinutes = minutes === 0 ? 0 : minutes <= 30 ? 30 : 60
  date.setMinutes(alignedMinutes === 60 ? 0 : alignedMinutes, 0, 0)
  if (alignedMinutes === 60) {
    date.setHours(date.getHours() + 1)
  }
  // Format as ISO string with JST timezone offset
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hour}:${min}:00+09:00`
}

const SAMPLE_RESULTS: ShopHit[] = [
  {
    id: '00000001-0000-0000-0000-000000000001',
    slug: 'sample-namba-resort',
    name: 'アロマリゾート 難波本店プレミアム',
    store_name: 'アロマリゾート 難波本店',
    area: '難波/日本橋',
    area_name: '難波/日本橋',
    address: '大阪市中央区難波1-2-3',
    categories: ['メンズエステ'],
    service_tags: ['個室完備', '日本人セラピスト', 'ペアルーム対応'],
    min_price: 11000,
    max_price: 18000,
    rating: 4.7,
    review_count: 128,
    lead_image_url: '/images/demo-shop-1.svg',
    badges: ['人気店', '駅チカ'],
    today_available: true,
    next_available_at: nextSlotAlignedTime(1),
    online_reservation: true,
    has_promotions: true,
    promotions: [{ label: 'プレミアム体験 ¥2,000OFF', expires_at: '2025-12-31' }],
    promotion_count: 2,
    ranking_reason: '口コミ評価4.7★。プレミアム個室で極上リラクゼーション体験。',
    price_band_label: '90分 12,000円〜',
    diary_count: 12,
    has_diaries: true,
    updated_at: '2025-10-01T09:00:00+09:00',
    staff_preview: [
      {
        id: '11111111-1111-1111-8888-111111111111',
        name: '葵',
        alias: 'Aoi',
        headline: '丁寧なオイルトリートメントで人気のセラピスト',
        rating: 4.3,
        review_count: 47,
        specialties: ['リンパ', 'ホットストーン'],
        avatar_url: '/images/sample-therapist-aoi.png',
        today_available: true,
        next_available_at: nextSlotAlignedTime(2),
      },
      {
        id: '22222222-2222-2222-8888-222222222222',
        name: '凛',
        alias: 'Rin',
        headline: 'ストレッチと指圧を組み合わせた独自施術',
        rating: 4.1,
        review_count: 35,
        specialties: ['ストレッチ', '指圧'],
        avatar_url: '/images/sample-therapist-rin.png',
        today_available: true,
        next_available_at: nextSlotAlignedTime(3),
      },
    ],
  },
  {
    id: '00000003-0000-0000-0000-000000000003',
    slug: 'sample-umeda-suite',
    name: 'リラクゼーションSUITE 梅田',
    store_name: 'リラクゼーションSUITE 梅田',
    area: '梅田',
    area_name: '梅田',
    address: '大阪市北区茶屋町5-8',
    categories: ['メンズエステ'],
    service_tags: ['完全予約制', 'VIPルーム', '深夜営業'],
    min_price: 13000,
    max_price: 22000,
    rating: 4.9,
    review_count: 86,
    lead_image_url: '/images/demo-shop-2.svg',
    badges: ['上質空間'],
    today_available: false,
    next_available_at: '2025-10-05T18:00:00+09:00',
    has_promotions: false,
    has_discounts: true,
    promotion_count: 1,
    ranking_reason: '百貨店近くの完全個室。VIPルームで贅沢スパ体験。',
    price_band_label: '120分 18,000円〜',
    diary_count: 4,
    updated_at: '2025-09-29T12:00:00+09:00',
    staff_preview: [
      {
        id: '33333333-3333-3333-8888-333333333333',
        name: '真央',
        headline: 'アロマ×ヒーリングで極上のリラックス体験を提供',
        rating: 4.1,
        review_count: 35,
        specialties: ['ホットストーン', 'ディープリンパ'],
        avatar_url: '/images/sample-therapist-mao.png',
        today_available: false,
        next_available_at: '2025-12-10T14:00:00+09:00',
      },
    ],
  },
  {
    id: '00000002-0000-0000-0000-000000000002',
    slug: 'sample-shinsaibashi-lounge',
    name: 'メンズアロマ Lounge 心斎橋',
    store_name: 'メンズアロマ Lounge 心斎橋',
    area: '心斎橋',
    area_name: '心斎橋',
    address: '大阪市中央区心斎橋筋2-7-14',
    categories: ['メンズエステ'],
    service_tags: ['オイルトリートメント', '指名無料', 'シャワールーム完備'],
    min_price: 9000,
    max_price: 16000,
    rating: 4.5,
    review_count: 54,
    lead_image_url: '/images/demo-shop-3.svg',
    today_available: true,
    online_reservation: true,
    has_promotions: true,
    promotions: [{ label: '平日昼割 ¥2,000OFF', expires_at: '2025-10-31' }],
    ranking_reason: 'ビジネス帰りの利用多数。21時以降のクイックコース人気。',
    price_band_label: '75分 9,000円〜',
    diary_count: 8,
    has_diaries: true,
    updated_at: '2025-09-30T22:00:00+09:00',
    staff_preview: [
      {
        id: '44444444-4444-4444-8888-444444444444',
        name: '陽菜',
        alias: 'Hinata',
        headline: '笑顔と包み込むタッチでリピーター多数',
        rating: 4.4,
        review_count: 38,
        specialties: ['ドライヘッドスパ', 'ストレッチ'],
        avatar_url: '/images/sample-therapist-aoi.png',
        today_available: true,
        next_available_at: nextSlotAlignedTime(1),
      },
      {
        id: '55555555-5555-5555-8888-555555555555',
        name: '優希',
        headline: 'アロマとリンパを組み合わせたしっかり圧で疲れを解消',
        rating: 4.5,
        review_count: 44,
        specialties: ['肩こりケア', 'アロマトリートメント'],
        avatar_url: '/images/sample-therapist-rin.png',
        today_available: false,
        next_available_at: '2025-12-11T10:00:00+09:00',
      },
    ],
  },
]

SAMPLE_RESULTS.forEach((hit) => {
  if (!hit.next_available_slot) {
    hit.next_available_slot = hit.next_available_at
      ? toNextAvailableSlotPayload(hit.next_available_at)
      : null
  }
  if (Array.isArray(hit.staff_preview)) {
    hit.staff_preview.forEach((staff) => {
      if (!staff.next_available_slot) {
        staff.next_available_slot = staff.next_available_at
          ? toNextAvailableSlotPayload(staff.next_available_at)
          : null
      }
    })
  }
})

type FacetValue = {
  value: string
  label?: string | null
  count: number
  selected?: boolean | null
}

type Promotion = {
  label: string
  description?: string | null
  expires_at?: string | null
  highlight?: string | null
}

type StaffPreview = {
  id?: string
  name: string
  alias?: string | null
  headline?: string | null
  rating?: number | null
  review_count?: number | null
  avatar_url?: string | null
  specialties?: string[] | null
  today_available?: boolean | null
  next_available_at?: string | null
  next_available_slot?: {
    start_at: string
    end_at?: string | null
    status: 'ok' | 'maybe'
  } | null
  mood_tag?: string | null
  talk_level?: string | null
  style_tag?: string | null
  look_type?: string | null
  contact_style?: string | null
  hobby_tags?: string[] | null
}

type Params = {
  q?: string
  area?: string
  station?: string
  service?: string
  body?: string
  today?: string
  price_min?: string
  price_max?: string
  price_band?: string
  ranking_badges?: string
  promotions_only?: string
  discounts_only?: string
  diaries_only?: string
  sort?: string
  page?: string
  page_size?: string
  force_samples?: string
  force_demo_submit?: string
  tab?: string
}

function toQueryString(p: Record<string, string | undefined>) {
  const q = Object.entries(p)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
    .join('&')
  return q ? `?${q}` : ''
}

type SearchResponse = {
  page: number
  page_size: number
  total: number
  results: ShopHit[]
  facets: Record<string, FacetValue[]>
  _error?: string
}

async function fetchProfiles(params: Params): Promise<SearchResponse> {
  const query = toQueryString({
    q: params.q,
    area: params.area,
    station: params.station,
    category: params.service,
    service_tags: params.body,
    open_now: params.today,
    price_min: params.price_min,
    price_max: params.price_max,
    price_band: params.price_band,
    ranking_badges: params.ranking_badges,
    promotions_only: params.promotions_only,
    discounts_only: params.discounts_only,
    diaries_only: params.diaries_only,
    sort: params.sort,
    page: params.page || '1',
    page_size: params.page_size || '12',
  })

  let lastErr: Error | null = null
  const targets = resolveApiBases()
  const endpoint = `/api/v1/shops${query}`

  for (const base of targets) {
    try {
      const res = await fetch(buildApiUrl(base, endpoint), { next: { revalidate: 30 } })
      if (res.ok) {
        const data = await res.json()
        const rawResults = (data.results ?? data.hits ?? []) as ShopHit[]
        // Convert next_available_at to next_available_slot for shop and staff_preview
        rawResults.forEach((hit) => {
          if (!hit.next_available_slot && hit.next_available_at) {
            hit.next_available_slot = toNextAvailableSlotPayload(hit.next_available_at)
          }
          if (Array.isArray(hit.staff_preview)) {
            hit.staff_preview.forEach((staff) => {
              if (!staff.next_available_slot && staff.next_available_at) {
                staff.next_available_slot = toNextAvailableSlotPayload(staff.next_available_at)
              }
            })
          }
        })
        return {
          page: Number(data.page ?? params.page ?? 1),
          page_size: Number(data.page_size ?? params.page_size ?? 12),
          total: Number(data.total ?? 0),
          results: rawResults,
          facets: (data.facets ?? {}) as Record<string, FacetValue[]>,
        }
      }
      lastErr = new Error(`search failed: ${res.status}`)
    } catch (err) {
      lastErr = err as Error
    }
  }

  return {
    page: Number(params.page || '1'),
    page_size: Number(params.page_size || '12'),
    total: 0,
    results: [],
    facets: {},
    _error: lastErr?.message || '検索に失敗しました',
  }
}

function parseBoolParam(value?: string): boolean {
  if (!value) return false
  const lowered = value.toLowerCase()
  return lowered === '1' || lowered === 'true' || lowered === 'yes' || lowered === 'on'
}

function buildSampleFacets(hits: ShopHit[]): Record<string, FacetValue[]> {
  const areaCounts = hits.reduce<Record<string, number>>((acc, hit) => {
    const key = hit.area_name || hit.area
    if (!key) return acc
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const facets: Record<string, FacetValue[]> = {}
  if (Object.keys(areaCounts).length) {
    facets.area = Object.entries(areaCounts).map(([value, count]) => ({
      value,
      label: value,
      count,
    }))
  }
  return facets
}

function buildSampleResponse(): SearchResponse {
  return {
    page: 1,
    page_size: SAMPLE_RESULTS.length,
    total: SAMPLE_RESULTS.length,
    results: SAMPLE_RESULTS,
    facets: buildSampleFacets(SAMPLE_RESULTS),
  }
}

function buildEditorialSpots(total: number): SpotlightItem[] {
  if (total === 0) return []
  return [
    {
      id: 'pr-feature-apply',
      title: '掲載をご検討の店舗さまへ',
      description: '抽選で上位表示のPR枠をご案内中。専任コンシェルジュがサポートします。',
      href: '/apply',
    },
    {
      id: 'pr-campaign',
      title: '季節キャンペーン受付中',
      description: 'GW・夏休みなど特集ページでの露出を強化。空枠わずかにつきお早めに。',
      href: '/apply',
    },
  ]
}

function buildTherapistHits(hits: ShopHit[]): TherapistHit[] {
  return hits.flatMap((hit) => {
    if (!Array.isArray(hit.staff_preview) || hit.staff_preview.length === 0) return []
    return hit.staff_preview
      .filter((staff): staff is StaffPreview & { name: string } => Boolean(staff && staff.name))
      .map((staff, index) => {
        const staffIdentifier = buildStaffIdentifier(
          { id: staff.id ?? null, alias: staff.alias ?? null, name: staff.name },
          `${index}`,
        )
        const uniqueId = `${hit.id}-${staffIdentifier}`
        const specialties = Array.isArray(staff.specialties)
          ? staff.specialties
            .filter((tag): tag is string => Boolean(tag))
            .map((tag) => tag.trim())
            .filter(Boolean)
          : []
        const hobbyTags = normalizeHobbyTags(staff.hobby_tags)
        const todayAvailable =
          typeof staff.today_available === 'boolean'
            ? staff.today_available
            : typeof hit.today_available === 'boolean'
              ? hit.today_available
              : null
        const nextAvailableSlot = staff.next_available_slot ?? hit.next_available_slot ?? null
        // availabilitySlots を null にして、TherapistCard がクリック時に API から全てのスロットを取得するようにする
        // nextAvailableSlot は最初の空き枠の表示専用
        const availabilitySlots: Array<{ start_at: string; end_at: string; status?: string }> | null = null
        return {
          id: uniqueId,
          therapistId: staff.id ? String(staff.id) : null,
          staffId: staffIdentifier,
          name: staff.name,
          alias: staff.alias ?? null,
          headline: staff.headline ?? null,
          specialties,
          avatarUrl: staff.avatar_url ?? null,
          rating: staff.rating ?? hit.rating ?? null,
          reviewCount: staff.review_count ?? hit.review_count ?? null,
          shopId: hit.id,
          shopSlug: hit.slug ?? null,
          shopName: hit.store_name || hit.name,
          shopArea: hit.area,
          shopAreaName: hit.area_name ?? null,
          todayAvailable,
          nextAvailableSlot,
          availabilitySlots,
          mood_tag: staff.mood_tag ?? null,
          style_tag: staff.style_tag ?? null,
          look_type: staff.look_type ?? null,
          contact_style: staff.contact_style ?? null,
          hobby_tags: hobbyTags,
          talk_level: staff.talk_level ?? null,
        } satisfies TherapistHit
      })
  })
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<Params> }) {
  const resolvedSearchParams = await searchParams
  const allowedTabs: SearchTabValue[] = ['therapists', 'shops']
  const tabCandidate = resolvedSearchParams.tab
  const activeTab: SearchTabValue = allowedTabs.includes(tabCandidate as SearchTabValue)
    ? (tabCandidate as SearchTabValue)
    : 'therapists'
  const forceSampleMode = parseBoolParam(
    Array.isArray(resolvedSearchParams.force_samples)
      ? resolvedSearchParams.force_samples[0]
      : resolvedSearchParams.force_samples,
  )
  const allowDemoSubmission = parseBoolParam(
    Array.isArray(resolvedSearchParams.force_demo_submit)
      ? resolvedSearchParams.force_demo_submit[0]
      : resolvedSearchParams.force_demo_submit,
  )
  const data = forceSampleMode ? buildSampleResponse() : await fetchProfiles(resolvedSearchParams)
  const { page, page_size: pageSize, total, results, facets, _error } = data
  const hits = results ?? []

  // Check if any search filters are active (excluding pagination and display options)
  const hasActiveFilters = Object.entries(resolvedSearchParams || {}).some(
    ([key, value]) =>
      value !== undefined &&
      value !== null &&
      value !== '' &&
      key !== 'page' &&
      key !== 'page_size' &&
      key !== 'force_samples' &&
      key !== 'tab' &&
      key !== 'sort',
  )

  // Only use sample data when:
  // 1. force_samples mode is enabled, OR
  // 2. No results AND no active filters (to show a showcase on empty search page)
  // When user has active filters but no results, show empty state instead
  const useSampleData = forceSampleMode || (hits.length === 0 && !hasActiveFilters)
  const displayHits = useSampleData ? SAMPLE_RESULTS : hits
  const editorialSpots = buildEditorialSpots(total)
  const displayEditorialSpots = useSampleData
    ? buildEditorialSpots(SAMPLE_RESULTS.length)
    : editorialSpots
  const numberFormatter = new Intl.NumberFormat('ja-JP')

  const therapistHitsFromResults = buildTherapistHits(displayHits)
  const usingSampleTherapists = !hasActiveFilters && therapistHitsFromResults.length === 0
  const therapistHits = usingSampleTherapists
    ? buildTherapistHits(SAMPLE_RESULTS)
    : therapistHitsFromResults
  const therapistTotal = therapistHits.length
  const hasTherapistResults = therapistTotal > 0

  const resolvedPageSize = pageSize || 12
  const resolvedPage = page || 1
  const hasShopResults = displayHits.length > 0
  const shopTotal = useSampleData ? SAMPLE_RESULTS.length : total || 0
  const shopPage = useSampleData ? 1 : resolvedPage
  const shopLastPage = useSampleData ? 1 : Math.max(1, Math.ceil((total || 0) / resolvedPageSize))
  const renderTherapistSection = hasTherapistResults && activeTab === 'therapists'
  const renderShopSection = hasShopResults && activeTab === 'shops'
  const heroShowsTherapist = activeTab === 'therapists'
  const heroResultCount = heroShowsTherapist ? therapistTotal : shopTotal
  const heroResultUnit = heroShowsTherapist ? '名' : '件'
  const isDev = process.env.NODE_ENV !== 'production'

  const currentSortValue = (() => {
    const raw = resolvedSearchParams.sort
    if (Array.isArray(raw)) return raw[0] || 'recommended'
    return raw || 'recommended'
  })()

  const filterSummaryLabel = `現在の条件: すべて表示（店舗 ${numberFormatter.format(shopTotal)}件 / セラピスト ${numberFormatter.format(therapistTotal)}名）`

  const searchKeyword =
    typeof resolvedSearchParams.q === 'string' ? resolvedSearchParams.q.trim() : ''
  const normalizedKeyword = searchKeyword.toLowerCase()
  const heroShop =
    activeTab === 'shops' && normalizedKeyword
      ? (displayHits.find((hit) => {
        const target = `${hit.store_name || ''} ${hit.name || ''}`.toLowerCase()
        return target.includes(normalizedKeyword)
      }) ?? null)
      : null
  const prioritizedShopHits =
    heroShop && displayHits.length
      ? [heroShop, ...displayHits.filter((hit) => hit.id !== heroShop.id)]
      : displayHits
  const availableTodayQuickList = prioritizedShopHits
    .filter((hit) => hit.today_available)
    .slice(0, 4)


  const qp = (n: number) => {
    const sp = new URLSearchParams()
    Object.entries(resolvedSearchParams || {}).forEach(([key, value]) => {
      if (value == null || value === '') return
      sp.set(key, String(value))
    })
    sp.set('page', String(Math.min(Math.max(n, 1), shopLastPage)))
    if (activeTab === 'therapists') {
      sp.delete('tab')
    } else {
      sp.set('tab', activeTab)
    }
    const query = sp.toString()
    return query ? `/search?${query}` : '/search'
  }

  const buildTabHref = (value: SearchTabValue) => {
    const sp = new URLSearchParams()
    Object.entries(resolvedSearchParams || {}).forEach(([key, paramValue]) => {
      if (paramValue == null || paramValue === '' || key === 'tab') return
      sp.set(key, String(paramValue))
    })
    sp.delete('page')
    if (value !== 'therapists') {
      sp.set('tab', value)
    }
    const query = sp.toString()
    return query ? `/search?${query}` : '/search'
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-neutral-surface">
      <a
        href="#search-results"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-badge focus:bg-brand-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        検索結果へスキップ
      </a>
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(147,197,253,0.18),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(196,181,253,0.16),_transparent_50%)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-6xl space-y-8 px-4 py-10 lg:space-y-10 lg:px-6">
        <SearchHero>
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
            <Link
              href="/search?tab=therapists&today=1"
              className="group relative flex flex-col items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-brand-primary to-brand-primaryDark px-6 py-8 text-white shadow-[0_20px_60px_rgba(37,99,235,0.35)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_25px_70px_rgba(37,99,235,0.45)] sm:py-10"
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.2),transparent_50%)]" />
              <svg className="mb-3 h-10 w-10 sm:h-12 sm:w-12" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              <span className="text-lg font-bold sm:text-xl">本日予約できる</span>
              <span className="text-lg font-bold sm:text-xl">セラピストを見る</span>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-white/80 transition-colors group-hover:text-white">
                今すぐチェック
                <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </span>
            </Link>

            <Link
              href="/guest/match-chat"
              className="group relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-brand-secondary/30 bg-gradient-to-br from-brand-secondary/10 via-white to-brand-primary/5 px-6 py-8 text-brand-secondaryDark shadow-[0_15px_50px_rgba(147,51,234,0.15)] transition-all duration-300 hover:scale-[1.02] hover:border-brand-secondary/50 hover:shadow-[0_20px_60px_rgba(147,51,234,0.25)] sm:py-10"
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(147,51,234,0.1),transparent_50%)]" />
              <svg className="mb-3 h-10 w-10 text-brand-secondary sm:h-12 sm:w-12" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
              </svg>
              <span className="text-lg font-bold sm:text-xl">本能AI</span>
              <span className="text-lg font-bold sm:text-xl">マッチング</span>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-secondary/70 transition-colors group-hover:text-brand-secondary">
                好みを伝えてマッチング
                <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </span>
            </Link>
          </div>

          <p className="text-xs text-neutral-textMuted">
            {Intl.NumberFormat('ja-JP').format(heroResultCount)}{heroResultUnit}のセラピストが登録中
          </p>
        </SearchHero>

        {_error ? (
          <Card role="alert" aria-live="polite" className="border-state-dangerBg bg-state-dangerBg/60 p-4 text-sm text-state-dangerText">
            {_error}
          </Card>
        ) : null}

        <div className="space-y-6 lg:space-y-8">
          <SearchAvailableToday shops={availableTodayQuickList} />

          <SearchPageClientWrapper
            init={resolvedSearchParams as Record<string, string | undefined>}
            facets={facets}
            resultSummaryLabel={filterSummaryLabel}
            shopTotal={shopTotal}
            therapistTotal={therapistTotal}
            activeTab={activeTab}
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-[240px] flex-1">
                  <SearchTabs current={activeTab} buildHref={buildTabHref} />
                </div>
                <ResultsSortControl options={SORT_SELECT_OPTIONS} currentSort={currentSortValue} />
              </div>
              <div id="search-results" aria-hidden className="sr-only" />

              {renderShopSection ? (
                <Section
                  id="shop-results"
                  ariaLive="polite"
                  title={`店舗（${numberFormatter.format(shopTotal)}件）`}
                  className="border border-neutral-borderLight/70 bg-white/85 shadow-lg shadow-neutral-950/5 backdrop-blur supports-[backdrop-filter]:bg-white/70"
                >
                  {isDev && useSampleData ? (
                    <div className="mb-6 rounded-card border border-dashed border-brand-primary/40 bg-brand-primary/5 p-4 text-sm text-brand-primaryDark">
                      API から検索結果を取得できなかったため、参考用のサンプル店舗を表示しています。
                    </div>
                  ) : null}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {prioritizedShopHits.map((hit) => (
                      <div
                        key={hit.id}
                        className={clsx(
                          'h-full',
                          heroShop &&
                          heroShop.id === hit.id &&
                          'relative rounded-card ring-2 ring-brand-primary/40 sm:col-span-2 lg:col-span-3',
                        )}
                      >
                        {heroShop && heroShop.id === hit.id ? (
                          <span className="absolute left-3 top-3 z-10 inline-flex items-center rounded-full bg-brand-primary px-3 py-1 text-[11px] font-semibold text-white shadow">
                            該当店舗
                          </span>
                        ) : null}
                        <ShopCard hit={hit} />
                      </div>
                    ))}
                  </div>

                  <nav
                    className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-borderLight/70 pt-5 text-sm"
                    aria-label="検索結果ページネーション"
                  >
                    <p className="text-neutral-textMuted" aria-live="polite" aria-atomic="true">
                      <span className="font-medium text-neutral-text">{shopPage}</span>
                      <span className="mx-1">/</span>
                      <span>{shopLastPage}ページ</span>
                      <span className="ml-1">（{Intl.NumberFormat('ja-JP').format(shopTotal)}件）</span>
                    </p>
                    <div className="flex items-center gap-2" role="group" aria-label="ページ移動">
                      {shopPage > 1 ? (
                        <a
                          href={qp(shopPage - 1)}
                          className="inline-flex items-center gap-1 rounded-full border border-neutral-borderLight bg-white px-4 py-1.5 font-medium shadow-sm transition-all hover:border-brand-primary hover:text-brand-primary hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                          aria-label={`前のページへ（${shopPage - 1}ページ目）`}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                          </svg>
                          前へ
                        </a>
                      ) : (
                        <span
                          className="inline-flex cursor-not-allowed items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-1.5 text-neutral-400"
                          aria-disabled="true"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                          </svg>
                          前へ
                        </span>
                      )}
                      {shopPage < shopLastPage ? (
                        <a
                          href={qp(shopPage + 1)}
                          className="inline-flex items-center gap-1 rounded-full border border-neutral-borderLight bg-white px-4 py-1.5 font-medium shadow-sm transition-all hover:border-brand-primary hover:text-brand-primary hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                          aria-label={`次のページへ（${shopPage + 1}ページ目）`}
                        >
                          次へ
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                          </svg>
                        </a>
                      ) : (
                        <span
                          className="inline-flex cursor-not-allowed items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-1.5 text-neutral-400"
                          aria-disabled="true"
                        >
                          次へ
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                          </svg>
                        </span>
                      )}
                    </div>
                  </nav>
                </Section>
              ) : null}

              {renderTherapistSection ? (
                <TherapistFavoritesProvider>
                  <Section
                    id="therapist-results"
                    ariaLive="polite"
                    title={`セラピスト（${numberFormatter.format(therapistTotal)}名）`}
                    className="border border-neutral-borderLight/70 bg-white/85 shadow-lg shadow-neutral-950/5 backdrop-blur supports-[backdrop-filter]:bg-white/70"
                  >
                    {usingSampleTherapists ? (
                      <div className="mb-6 rounded-card border border-brand-primary/30 bg-brand-primary/5 p-4 text-sm text-brand-primaryDark">
                        API
                        の検索結果にセラピスト情報が含まれていなかったため、参考用のサンプルセラピストを表示しています。
                      </div>
                    ) : null}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {therapistHits.map((hit) => (
                        <TherapistCard key={hit.id} hit={hit} useOverlay allowDemoSubmission={allowDemoSubmission} />
                      ))}
                    </div>
                  </Section>
                  <ReservationOverlayPortal />
                </TherapistFavoritesProvider>
              ) : null}

              {!renderTherapistSection && !renderShopSection ? (
                <div className="flex flex-col items-center justify-center gap-6 rounded-card border border-dashed border-neutral-borderLight/80 bg-gradient-to-b from-neutral-50 to-neutral-100/50 p-10 text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-sm">
                    <svg className="h-10 w-10 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <div className="space-y-2">
                    <p className="text-lg font-semibold text-neutral-text">
                      {hasActiveFilters
                        ? '条件に一致する結果が見つかりませんでした'
                        : '検索結果がありません'}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-textMuted">
                      {hasActiveFilters
                        ? '条件を変更するか、フィルターをリセットしてお試しください。'
                        : 'キーワードを入力して検索してください。'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    {hasActiveFilters ? (
                      <Link
                        href="/search"
                        className="inline-flex items-center gap-2 rounded-full bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-brand-primary/90"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        条件をリセット
                      </Link>
                    ) : null}
                    <Link
                      href="/"
                      className="inline-flex items-center gap-2 rounded-full border border-neutral-borderLight bg-white px-5 py-2.5 text-sm font-medium text-neutral-text shadow-sm transition hover:bg-neutral-50"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      トップページへ
                    </Link>
                  </div>
                  {hasActiveFilters ? (
                    <div className="mt-2 space-y-3">
                      <p className="text-xs font-medium text-neutral-textMuted">人気のエリアで探す</p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {['難波', '梅田', '心斎橋', '天王寺'].map((area) => (
                          <Link
                            key={area}
                            href={`/search?area=${encodeURIComponent(area)}`}
                            className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-neutral-text shadow-sm ring-1 ring-neutral-200 transition hover:bg-brand-primary/5 hover:ring-brand-primary/30"
                          >
                            {area}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </SearchPageClientWrapper>

          {displayEditorialSpots.length ? (
            <Section
              title="掲載をご検討の店舗さまへ"
              subtitle="PR枠や季節キャンペーンのご案内"
              className="border border-neutral-borderLight/70 bg-white/90 shadow-lg shadow-neutral-950/5 backdrop-blur supports-[backdrop-filter]:bg-white/80"
            >
              <div className="grid gap-4 md:grid-cols-2">
                {displayEditorialSpots.map((item) => (
                  <a key={item.id} href={item.href} className="block focus:outline-none">
                    <Card
                      interactive
                      className="h-full bg-gradient-to-br from-brand-primary/15 via-brand-primary/10 to-brand-secondary/15 p-6"
                    >
                      <Badge variant="brand" className="mb-3 w-fit shadow-sm">
                        SHOP PR
                      </Badge>
                      <h3 className="text-lg font-semibold text-neutral-text">{item.title}</h3>
                      <p className="mt-2 text-sm text-neutral-textMuted">{item.description}</p>
                      <span className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-brand-primaryDark">
                        くわしく見る
                        <span aria-hidden>→</span>
                      </span>
                    </Card>
                  </a>
                ))}
              </div>
            </Section>
          ) : null}
        </div>
      </div>
    </main>
  )
}
