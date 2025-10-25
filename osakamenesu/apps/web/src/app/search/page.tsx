import SearchFilters from '@/components/SearchFilters'
import ShopCard, { type ShopHit } from '@/components/shop/ShopCard'
import TherapistCard, { type TherapistHit } from '@/components/staff/TherapistCard'
import { TherapistFavoritesProvider } from '@/components/staff/TherapistFavoritesProvider'
import { Badge } from '@/components/ui/Badge'
import { Section } from '@/components/ui/Section'
import { Card } from '@/components/ui/Card'
import { buildApiUrl, resolveApiBases } from '@/lib/api'
import { buildStaffIdentifier } from '@/lib/staff'

const SAMPLE_RESULTS: ShopHit[] = [
  {
    id: 'sample-namba-resort',
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
    lead_image_url: 'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=900&q=80',
    badges: ['人気店', '駅チカ'],
    today_available: true,
    online_reservation: true,
    has_promotions: true,
    promotions: [
      { label: 'プレミアム体験 ¥2,000OFF', expires_at: '2025-12-31' },
    ],
    promotion_count: 2,
    ranking_reason: '口コミ評価4.7★。プレミアム個室で極上リラクゼーション体験。',
    price_band_label: '90分 12,000円〜',
    diary_count: 12,
    has_diaries: true,
    updated_at: '2025-10-01T09:00:00+09:00',
    staff_preview: [
      {
        id: 'therapist-aki',
        name: '葵',
        alias: 'Aoi',
        headline: '丁寧なオイルトリートメントで人気のセラピスト',
        rating: 4.6,
        review_count: 87,
        specialties: ['リンパ', 'ホットストーン'],
        avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=640&q=80',
      },
      {
        id: 'therapist-rin',
        name: '凛',
        alias: 'Rin',
        headline: 'ストレッチと指圧を組み合わせた独自施術',
        rating: 4.3,
        review_count: 52,
        specialties: ['ストレッチ', '指圧'],
        avatar_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=640&q=80',
      },
    ],
  },
  {
    id: 'sample-umeda-suite',
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
    lead_image_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80',
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
        id: 'therapist-misaki',
        name: '美咲',
        headline: 'アロマ×ヒーリングで極上のリラックス体験を提供',
        rating: 4.9,
        review_count: 64,
        specialties: ['ホットストーン', 'ディープリンパ'],
        avatar_url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=640&q=80',
      },
    ],
  },
  {
    id: 'sample-shinsaibashi-lounge',
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
    lead_image_url: 'https://images.unsplash.com/photo-1500043202863-753a880aa0f0?auto=format&fit=crop&w=900&q=80',
    today_available: true,
    online_reservation: true,
    has_promotions: true,
    promotions: [
      { label: '平日昼割 ¥2,000OFF', expires_at: '2025-10-31' },
    ],
    ranking_reason: 'ビジネス帰りの利用多数。21時以降のクイックコース人気。',
    price_band_label: '75分 9,000円〜',
    diary_count: 8,
    has_diaries: true,
    updated_at: '2025-09-30T22:00:00+09:00',
    staff_preview: [
      {
        id: 'therapist-hinata',
        name: '陽菜',
        alias: 'Hinata',
        headline: '笑顔と包み込むタッチでリピーター多数',
        rating: 4.4,
        review_count: 38,
        specialties: ['ドライヘッドスパ', 'ストレッチ'],
        avatar_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=640&q=80',
      },
      {
        id: 'therapist-yuki',
        name: '優希',
        headline: 'アロマとリンパを組み合わせたしっかり圧で疲れを解消',
        rating: 4.5,
        review_count: 44,
        specialties: ['肩こりケア', 'アロマトリートメント'],
        avatar_url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=640&q=80',
      },
    ],
  },
]

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
      const res = await fetch(buildApiUrl(base, endpoint), { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        return {
          page: Number(data.page ?? params.page ?? 1),
          page_size: Number(data.page_size ?? params.page_size ?? 12),
          total: Number(data.total ?? 0),
          results: (data.results ?? data.hits ?? []) as ShopHit[],
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
    facets.area = Object.entries(areaCounts).map(([value, count]) => ({ value, label: value, count }))
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

type SpotlightItem = {
  id: string
  title: string
  description: string
  href: string
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

function buildHighlights(facets: Record<string, FacetValue[]>, hits: ShopHit[]) {
  const highlights: string[] = []

  const areas = [...(facets.area ?? [])]
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
    .slice(0, 3)
  if (areas.length) {
    highlights.push(`人気エリア: ${areas.map((a) => a.label || a.value).join(' / ')}`)
  }

  const services = [...(facets.service_type ?? [])]
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
    .slice(0, 2)
  if (services.length) {
    highlights.push(`主な業態: ${services.map((s) => s.label || s.value).join('・')}`)
  }

  const priceBands = [...(facets.price_band ?? [])]
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
    .slice(0, 2)
  if (priceBands.length) {
    highlights.push(`人気料金帯: ${priceBands.map((p) => p.label || p.value).join(' / ')}`)
  }

  const todayCount = hits.filter((h) => h.today_available).length
  if (todayCount) {
    highlights.push(`本日予約可能: ${todayCount}件`)
  }

  const priced = hits.filter((h) => h.min_price || h.max_price)
  if (priced.length) {
    const minAvg = Math.round(priced.reduce((sum, h) => sum + (h.min_price || 0), 0) / priced.length)
    const maxAvg = Math.round(priced.reduce((sum, h) => sum + (h.max_price || h.min_price || 0), 0) / priced.length)
    if (minAvg) {
      const intl = new Intl.NumberFormat('ja-JP')
      highlights.push(`予算目安: ¥${intl.format(minAvg)}〜¥${intl.format(Math.max(minAvg, maxAvg))}`)
    }
  }

  const rated = hits.filter((h) => typeof h.rating === 'number' && h.rating)
  if (rated.length) {
    const avg = rated.reduce((sum, h) => sum + (h.rating || 0), 0) / rated.length
    highlights.push(`平均評価 ${avg.toFixed(1)}★`)
  }

  const promotionLabels = hits
    .flatMap((h) => (Array.isArray(h.promotions) ? h.promotions : []))
    .map((promotion) => promotion?.label)
    .filter((label): label is string => Boolean(label))
  if (promotionLabels.length) {
    const unique = [...new Set(promotionLabels)].slice(0, 2)
    highlights.push(`開催中キャンペーン: ${unique.join(' / ')}`)
  }

  const promoShops = hits.filter((h) => h.has_promotions)
  if (!promotionLabels.length && promoShops.length) {
    highlights.push(`割引・キャンペーン掲載店舗: ${promoShops.length}件`)
  }

  const diaryShops = hits.filter((h) => h.has_diaries || (h.diary_count ?? 0) > 0)
  if (diaryShops.length) {
    const totalDiaries = diaryShops.reduce((sum, h) => sum + (h.diary_count || 0), 0)
    highlights.push(`写メ日記掲載店舗: ${diaryShops.length}件／公開数 ${totalDiaries}件`)
  }

  const rankingReasons = hits
    .map((h) => h.ranking_reason)
    .filter((reason): reason is string => Boolean(reason))
  if (rankingReasons.length) {
    highlights.push(`編集部ピックアップ: ${rankingReasons[0]}`)
  }

  return highlights
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
          ? staff.specialties.filter((tag): tag is string => Boolean(tag)).map((tag) => tag.trim()).filter(Boolean)
          : []
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
        } satisfies TherapistHit
      })
  })
}

export default async function SearchPage({ searchParams }: { searchParams: Params }) {
  const forceSampleMode = parseBoolParam(
    Array.isArray(searchParams.force_samples) ? searchParams.force_samples[0] : searchParams.force_samples,
  )
  const data = forceSampleMode ? buildSampleResponse() : await fetchProfiles(searchParams)
  const { page, page_size: pageSize, total, results, facets, _error } = data
  const hits = results ?? []
  const useSampleData = forceSampleMode || hits.length === 0
  const displayHits = useSampleData ? SAMPLE_RESULTS : hits
  const highlights = buildHighlights(facets, hits)
  const displayHighlights = useSampleData ? buildHighlights({}, SAMPLE_RESULTS) : highlights
  const editorialSpots = buildEditorialSpots(total)
  const displayEditorialSpots = useSampleData ? buildEditorialSpots(SAMPLE_RESULTS.length) : editorialSpots

  const hasActiveFilters = Object.entries(searchParams || {}).some(
    ([key, value]) =>
      value !== undefined &&
      value !== null &&
      value !== '' &&
      key !== 'page' &&
      key !== 'page_size',
  )

  const therapistHitsFromResults = buildTherapistHits(displayHits)
  const usingSampleTherapists = !hasActiveFilters && therapistHitsFromResults.length === 0
  const therapistHits = usingSampleTherapists ? buildTherapistHits(SAMPLE_RESULTS) : therapistHitsFromResults
  const showTherapistSection = therapistHits.length > 0
  const therapistTotal = therapistHits.length

  const resolvedPageSize = pageSize || 12
  const resolvedPage = page || 1
  const showShopSection = displayHits.length > 0
  const shopTotal = useSampleData ? SAMPLE_RESULTS.length : (total || 0)
  const shopPageSize = useSampleData ? SAMPLE_RESULTS.length : resolvedPageSize
  const shopPage = useSampleData ? 1 : resolvedPage
  const shopLastPage = useSampleData ? 1 : Math.max(1, Math.ceil((total || 0) / resolvedPageSize))

  const areaFacetSource = facets.area ?? []
  const derivedAreaFacets: FacetValue[] = areaFacetSource.length
    ? areaFacetSource
    : Object.entries(
        displayHits.reduce<Record<string, number>>((acc, hit) => {
          const key = hit.area_name || hit.area
          if (!key) return acc
          acc[key] = (acc[key] ?? 0) + 1
          return acc
        }, {}),
      ).map(([value, count]) => ({ value, label: value, count }))

  const popularAreas = derivedAreaFacets
    .filter((facet) => facet.count && facet.value)
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
    .slice(0, 6)

  const quickLinks = [
    { label: '梅田エリア', href: '/search?area=梅田' },
    { label: '難波/日本橋', href: '/search?area=難波/日本橋' },
    { label: '派遣型で探す', href: '/search?service=dispatch' },
    { label: '本日出勤あり', href: '/search?today=true' },
    { label: '割引キャンペーン中', href: '/search?promotions_only=true' },
  ]

  const qp = (n: number) => {
    const entries = Object.entries(searchParams || {}).filter(([, v]) => v !== undefined && v !== null)
    const sp = new URLSearchParams(entries as [string, string][])
    sp.set('page', String(Math.min(Math.max(n, 1), shopLastPage)))
    return `/search?${sp.toString()}`
  }

  const heroResultCount = showTherapistSection ? therapistTotal : shopTotal
  const heroResultUnit = showTherapistSection ? '名' : '件'

  return (
    <main className="relative min-h-screen overflow-hidden bg-neutral-surface">
      <a
        href="#search-results"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-badge focus:bg-brand-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        検索結果へスキップ
      </a>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(147,197,253,0.18),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(196,181,253,0.16),_transparent_50%)]" aria-hidden />
      <div className="relative mx-auto max-w-6xl space-y-8 px-4 py-10 lg:space-y-10 lg:px-6">
        <header className="relative overflow-hidden rounded-section border border-white/60 bg-white/75 px-6 py-8 shadow-xl shadow-brand-primary/5 backdrop-blur supports-[backdrop-filter]:bg-white/65">
          <div className="pointer-events-none absolute -top-10 right-0 h-32 w-32 rounded-full bg-brand-primary/10 blur-3xl" aria-hidden />
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3 text-neutral-text">
              <span className="inline-flex items-center gap-1 rounded-badge border border-brand-primary/20 bg-brand-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-primary/90">
                大阪メンエス.com
              </span>
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-text">
                {showTherapistSection ? 'セラピストを探す' : '大阪メンエスを探す'}
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-neutral-textMuted">
                最新の出勤情報や写メ日記、スタッフ紹介まで、メンエス選びに欲しい情報をワンストップで届けます。
                {showTherapistSection
                  ? ' エリアや得意な施術から、あなたにぴったりのセラピストを見つけてください。'
                  : ' 気になるエリアや料金帯を組み合わせて、ぴったりの店舗を見つけましょう。'}
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 text-left lg:items-end lg:text-right">
              <span className="text-xs font-semibold uppercase tracking-wide text-brand-primary/80">掲載件数</span>
              <div className="text-3xl font-bold text-neutral-text">
                {Intl.NumberFormat('ja-JP').format(heroResultCount)}
                <span className="ml-1 text-base font-medium text-neutral-textMuted">{heroResultUnit}</span>
              </div>
              <span className="text-xs text-neutral-textMuted">毎日アップデート中</span>
            </div>
          </div>
          {displayHighlights.length ? (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              {displayHighlights.map((item) => (
                <Badge key={item} variant="outline" className="border-brand-primary/30 bg-brand-primary/5 text-brand-primaryDark">
                  {item}
                </Badge>
              ))}
            </div>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-2 text-xs text-neutral-text">
            {(popularAreas.length ? popularAreas.map((facet) => ({ label: `${facet.label || facet.value} (${facet.count})`, href: `/search?area=${encodeURIComponent(facet.value)}` })) : quickLinks).map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="inline-flex items-center gap-1 rounded-badge border border-neutral-borderLight/70 bg-neutral-surfaceAlt px-3 py-1 font-semibold text-neutral-text transition hover:border-brand-primary hover:text-brand-primary"
              >
                <span aria-hidden>🔍</span>
                {link.label}
              </a>
            ))}
          </div>
        </header>

        {_error ? (
          <Card className="border-state-dangerBg bg-state-dangerBg/60 p-4 text-sm text-state-dangerText">
            {_error}
          </Card>
        ) : null}

        <div className="space-y-6 lg:space-y-8">
          <SearchFilters init={searchParams} facets={facets} />

          {showTherapistSection ? (
            <TherapistFavoritesProvider>
              <Section
                id="therapist-results"
                ariaLive="polite"
                title={`セラピスト ${Intl.NumberFormat('ja-JP').format(therapistTotal)}名`}
                subtitle="人気セラピストをピックアップ"
                actions={<span className="text-xs text-neutral-textMuted">最新情報は毎日更新</span>}
                className="border border-neutral-borderLight/70 bg-white/85 shadow-lg shadow-neutral-950/5 backdrop-blur supports-[backdrop-filter]:bg-white/70"
              >
                {usingSampleTherapists ? (
                  <div className="mb-6 rounded-card border border-brand-primary/30 bg-brand-primary/5 p-4 text-sm text-brand-primaryDark">
                    API の検索結果にセラピスト情報が含まれていなかったため、参考用のサンプルセラピストを表示しています。
                  </div>
                ) : null}
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {therapistHits.map((hit) => (
                    <TherapistCard key={hit.id} hit={hit} />
                  ))}
                </div>
              </Section>
            </TherapistFavoritesProvider>
          ) : null}

          {showShopSection ? (
            <Section
              id="search-results"
              ariaLive="polite"
              title={`店舗検索結果 ${Intl.NumberFormat('ja-JP').format(shopTotal)}件`}
              subtitle={`ページ ${shopPage} / ${shopLastPage}（${shopPageSize}件ずつ表示）`}
              actions={<span className="text-xs text-neutral-textMuted">最新情報は毎日更新</span>}
              className="border border-neutral-borderLight/70 bg-white/85 shadow-lg shadow-neutral-950/5 backdrop-blur supports-[backdrop-filter]:bg-white/70"
            >
              {useSampleData ? (
                <div className="mb-6 rounded-card border border-brand-primary/30 bg-brand-primary/5 p-4 text-sm text-brand-primaryDark">
                  API から検索結果を取得できなかったため、参考用のサンプル店舗を表示しています。
                </div>
              ) : null}
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {(() => {
                  type GridItem =
                    | { kind: 'shop'; value: ShopHit }
                    | { kind: 'spotlight'; value: SpotlightItem }

                  const gridItems: GridItem[] = []
                  const prSlots = [1, 8, 15]

                  if (displayHits.length > 0) {
                    let prIndex = 0
                    displayHits.forEach((hit, idx) => {
                      if (prSlots.includes(idx + 1) && prIndex < displayEditorialSpots.length) {
                        gridItems.push({ kind: 'spotlight', value: displayEditorialSpots[prIndex] })
                        prIndex += 1
                      }
                      gridItems.push({ kind: 'shop', value: hit })
                    })
                    while (gridItems.length < displayHits.length + displayEditorialSpots.length && prIndex < displayEditorialSpots.length) {
                      gridItems.push({ kind: 'spotlight', value: displayEditorialSpots[prIndex] })
                      prIndex += 1
                    }
                  }

                  const itemsToRender = gridItems.length ? gridItems : displayHits.map((hit) => ({ kind: 'shop', value: hit }))

                  return itemsToRender.map((item) =>
                    item.kind === 'shop' ? (
                      <ShopCard key={item.value.id} hit={item.value} />
                    ) : (
                      <a key={item.value.id} href={item.value.href} className="block focus:outline-none">
                        <Card interactive className="h-full bg-gradient-to-br from-brand-primary/15 via-brand-primary/10 to-brand-secondary/15 p-6">
                          <Badge variant="brand" className="mb-3 w-fit shadow-sm">
                            PR
                          </Badge>
                          <h3 className="text-lg font-semibold text-neutral-text">{item.value.title}</h3>
                          <p className="mt-2 text-sm text-neutral-textMuted">{item.value.description}</p>
                          <span className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-brand-primaryDark">
                            くわしく見る
                            <span aria-hidden>→</span>
                          </span>
                        </Card>
                      </a>
                    ),
                  )
                })()}
              </div>

              <nav className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-borderLight/70 pt-5 text-sm" aria-label="検索結果ページネーション">
                <div className="text-neutral-textMuted" aria-live="polite">
                  {shopPage} / {shopLastPage}ページ（{Intl.NumberFormat('ja-JP').format(shopTotal)}件）
                </div>
                <div className="flex items-center gap-2">
                  {shopPage > 1 ? (
                    <a href={qp(shopPage - 1)} className="rounded-badge border border-neutral-borderLight px-3 py-1 transition hover:border-brand-primary hover:text-brand-primary">
                      前へ
                    </a>
                  ) : (
                    <span className="rounded-badge border border-neutral-borderLight/70 px-3 py-1 text-neutral-textMuted/60">前へ</span>
                  )}
                  {shopPage < shopLastPage ? (
                    <a href={qp(shopPage + 1)} className="rounded-badge border border-neutral-borderLight px-3 py-1 transition hover:border-brand-primary hover:text-brand-primary">
                      次へ
                    </a>
                  ) : (
                    <span className="rounded-badge border border-neutral-borderLight/70 px-3 py-1 text-neutral-textMuted/60">次へ</span>
                  )}
                </div>
              </nav>
            </Section>
          ) : null}

          {!showTherapistSection && !showShopSection ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-card border border-dashed border-neutral-borderLight/80 bg-neutral-surfaceAlt/70 p-10 text-center text-neutral-textMuted">
              <p className="text-base font-medium text-neutral-text">一致するセラピスト・店舗が見つかりませんでした</p>
              <p className="text-sm leading-relaxed">キーワードや条件を調整すると候補が表示される場合があります。</p>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  )
}
