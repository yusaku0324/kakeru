import { buildApiUrl, resolveApiBases } from '@/lib/api'
import { buildStaffIdentifier } from '@/lib/staff'
import { toNextAvailableSlotPayload } from '@/lib/nextAvailableSlot'

import type { ShopHit } from '@/components/shop/ShopCard'
import type { TherapistHit } from '@/components/staff/TherapistCard'

function isoHoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

export const SAMPLE_RESULTS: ShopHit[] = [
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
    lead_image_url:
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=900&q=80',
    badges: ['人気店', '駅チカ'],
    today_available: true,
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
        rating: 4.6,
        review_count: 87,
        specialties: ['リンパ', 'ホットストーン'],
        avatar_url:
          'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=640&q=80',
        next_available_at: isoHoursFromNow(2),
      },
      {
        id: '22222222-2222-2222-8888-222222222222',
        name: '凛',
        alias: 'Rin',
        headline: 'ストレッチと指圧を組み合わせた独自施術',
        rating: 4.3,
        review_count: 52,
        specialties: ['ストレッチ', '指圧'],
        avatar_url:
          'https://images.unsplash.com/photo-1487412912498-0447578fcca8?auto=format&fit=crop&w=400&q=80',
        next_available_at: isoHoursFromNow(5),
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
    lead_image_url:
      'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=80',
    badges: ['上質空間'],
    today_available: false,
    next_available_at: isoHoursFromNow(28),
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
        name: '美咲',
        headline: 'アロマ×ヒーリングで極上のリラックス体験を提供',
        rating: 4.9,
        review_count: 64,
        specialties: ['ホットストーン', 'ディープリンパ'],
        avatar_url:
          'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=640&q=80',
        next_available_at: isoHoursFromNow(28),
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
    lead_image_url:
      'https://images.unsplash.com/photo-1507537417841-1ae12265b9c9?auto=format&fit=crop&w=900&q=80',
    today_available: true,
    next_available_at: isoHoursFromNow(4),
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
        avatar_url:
          'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=640&q=80',
        next_available_at: isoHoursFromNow(3),
      },
      {
        id: '55555555-5555-5555-8888-555555555555',
        name: '優希',
        headline: 'アロマとリンパを組み合わせたしっかり圧で疲れを解消',
        rating: 4.5,
        review_count: 44,
        specialties: ['肩こりケア', 'アロマトリートメント'],
        avatar_url:
          'https://images.unsplash.com/photo-1554384645-13eab165c24b?auto=format&fit=crop&w=640&q=80',
        next_available_at: isoHoursFromNow(6),
      },
    ],
  },
  {
    id: 'sample-tennoji-garden',
    slug: 'sample-tennoji-garden',
    name: 'リラクゼーションGarden 天王寺',
    store_name: 'リラクゼーションGarden',
    area: '天王寺',
    area_name: '天王寺',
    address: '大阪市阿倍野区旭町2-4-1',
    categories: ['メンズエステ'],
    service_tags: ['個室完備', 'フリー割', 'ペアルーム対応'],
    min_price: 10000,
    max_price: 17000,
    rating: 4.4,
    review_count: 61,
    lead_image_url:
      'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=900&q=80',
    badges: ['本日空きあり'],
    today_available: true,
    next_available_at: isoHoursFromNow(2.5),
    online_reservation: true,
    has_promotions: true,
    promotions: [{ label: '平日フリー指名 ¥1,000OFF', expires_at: '2025-11-30' }],
    ranking_reason: '天王寺駅徒歩5分。観葉植物に囲まれた癒やし空間でゆったりと。',
    price_band_label: '90分 11,000円〜',
    diary_count: 6,
    has_diaries: true,
    updated_at: '2025-10-02T09:30:00+09:00',
    staff_preview: [
      {
        id: '66666666-6666-6666-8888-666666666666',
        name: '結衣',
        alias: 'Yui',
        headline: 'アロマ×ストレッチで姿勢ケアも人気。リピート率80%超。',
        rating: 4.7,
        review_count: 48,
        specialties: ['ストレッチ', 'ホットストーン'],
        avatar_url:
          'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=640&q=80',
        today_available: true,
        next_available_at: isoHoursFromNow(2.5),
      },
    ],
  },
  {
    id: 'sample-kyobashi-luxe',
    slug: 'sample-kyobashi-luxe',
    name: 'Luxury Spa 京橋',
    store_name: 'Luxury Spa 京橋',
    area: '京橋',
    area_name: '京橋',
    address: '大阪市都島区東野田町3-5-7',
    categories: ['メンズエステ'],
    service_tags: ['深夜営業', '駅チカ', 'VIPルーム'],
    min_price: 12000,
    max_price: 21000,
    rating: 4.2,
    review_count: 45,
    lead_image_url:
      'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=900&q=80',
    badges: ['駅チカ'],
    today_available: false,
    next_available_at: isoHoursFromNow(40),
    has_promotions: false,
    has_discounts: true,
    promotion_count: 1,
    ranking_reason: '京橋駅徒歩1分。ラグジュアリーな個室とホットアロマで人気。',
    price_band_label: '100分 16,000円〜',
    diary_count: 3,
    updated_at: '2025-09-28T14:00:00+09:00',
    staff_preview: [
      {
        id: '77777777-7777-7777-8888-777777777777',
        name: '彩音',
        headline: 'リンパドレナージュとヘッドスパで疲れをリセット。',
        rating: 4.5,
        review_count: 37,
        specialties: ['リンパドレナージュ', 'ドライヘッドスパ'],
        avatar_url:
          'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=640&q=80',
        next_available_at: isoHoursFromNow(40),
      },
    ],
  },
  {
    id: 'sample-kitashinchi-bloom',
    slug: 'sample-kitashinchi-bloom',
    name: 'Bloom 北新地',
    store_name: 'Bloom 北新地',
    area: '北新地',
    area_name: '北新地',
    address: '大阪市北区曽根崎新地1-3-19',
    categories: ['メンズエステ'],
    service_tags: ['完全個室', '指名無料', 'ドリンクサービス'],
    min_price: 13000,
    max_price: 24000,
    rating: 4.8,
    review_count: 72,
    lead_image_url:
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80',
    badges: ['上質空間', '口コミ高評価'],
    today_available: true,
    next_available_at: isoHoursFromNow(6),
    online_reservation: true,
    has_promotions: true,
    promotions: [
      { label: '新人割 ¥2,000OFF', expires_at: '2025-11-15' },
      { label: 'ペア利用10%OFF', expires_at: '2025-12-31' },
    ],
    ranking_reason: '北新地ならではのラグジュアリー空間。ホスピタリティ重視の接客。',
    price_band_label: '120分 18,000円〜',
    diary_count: 10,
    has_diaries: true,
    updated_at: '2025-10-03T11:15:00+09:00',
    staff_preview: [
      {
        id: '88888888-8888-8888-8888-888888888888',
        name: '紗羅',
        alias: 'Sara',
        headline: 'エネルギーワークを取り入れたディープリンパで極上のリラックスを提供。',
        rating: 4.9,
        review_count: 58,
        specialties: ['ディープリンパ', 'アロマトリートメント'],
        avatar_url:
          'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=640&q=80',
        today_available: true,
        next_available_at: isoHoursFromNow(6),
      },
    ],
  },
]

SAMPLE_RESULTS.forEach((hit) => {
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

export type FacetValue = {
  value: string
  label?: string | null
  count: number
  selected?: boolean | null
}

export type SearchResponse = {
  page: number
  page_size: number
  total: number
  results: ShopHit[]
  facets: Record<string, FacetValue[]>
  _error?: string
}

export type Params = {
  q?: string
  area?: string
  station?: string
  service?: string
  body?: string
  bust?: string
  height_min?: string
  height_max?: string
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

function parseNumber(value?: string): number | null {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function applyClientFilters(params: Params, hits: ShopHit[]): ShopHit[] {
  return hits.filter((hit) => {
    if (params.area) {
      const area = params.area.trim()
      if (area && ![hit.area, hit.area_name].includes(area)) return false
    }

    if (params.today && parseBoolParam(params.today)) {
      const hasNextSlot = Boolean(hit.next_available_slot?.start_at)
      if (!hit.today_available && !hasNextSlot) return false
    }

    if (params.promotions_only && parseBoolParam(params.promotions_only)) {
      if (!hit.has_promotions && !(hit.promotions && hit.promotions.length)) return false
    }

    if (params.diaries_only && parseBoolParam(params.diaries_only)) {
      if (!(hit.has_diaries || (hit.diary_count ?? 0) > 0)) return false
    }

    const priceMin = parseNumber(params.price_min)
    const priceMax = parseNumber(params.price_max)
    if (priceMin !== null && (hit.min_price ?? 0) < priceMin) return false
    if (priceMax !== null && (hit.max_price ?? hit.min_price ?? priceMax) > priceMax) return false

    return true
  })
}

export async function fetchSearchResults(params: Params): Promise<SearchResponse> {
  const query = toQueryString({
    q: params.q,
    area: params.area,
    station: params.station,
    category: params.service,
    service_tags: params.body,
    bust: params.bust,
    height_min: params.height_min,
    height_max: params.height_max,
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
        const rawResults = (data.results ?? data.hits ?? []) as ShopHit[]
        const filtered = applyClientFilters(params, rawResults)
        return {
          page: Number(data.page ?? params.page ?? 1),
          page_size: Number(data.page_size ?? params.page_size ?? 12),
          total: filtered.length,
          results: filtered,
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

export function parseBoolParam(value?: string): boolean {
  if (!value) return false
  const lowered = value.toLowerCase()
  return lowered === '1' || lowered === 'true' || lowered === 'yes' || lowered === 'on'
}

export function buildSampleFacets(hits: ShopHit[]): Record<string, FacetValue[]> {
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

export function buildSampleResponse(params: Params = {}): SearchResponse {
  const filtered = applyClientFilters(params, SAMPLE_RESULTS)
  return {
    page: 1,
    page_size: filtered.length,
    total: filtered.length,
    results: filtered,
    facets: buildSampleFacets(filtered),
  }
}

export function buildTherapistHits(hits: ShopHit[]): TherapistHit[] {
  return hits.flatMap((hit) => {
    if (!Array.isArray(hit.staff_preview) || hit.staff_preview.length === 0) return []
    return hit.staff_preview
      .filter((staff): staff is NonNullable<typeof hit.staff_preview>[number] & { name: string } =>
        Boolean(staff && staff.name),
      )
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
        const todayAvailable =
          typeof staff.today_available === 'boolean'
            ? staff.today_available
            : typeof hit.today_available === 'boolean'
              ? hit.today_available
              : null
        const nextAvailableSlot = staff.next_available_slot ?? hit.next_available_slot ?? null
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
        } satisfies TherapistHit
      })
  })
}

export type SpotlightItem = {
  id: string
  title: string
  description: string
  href: string
}

export function buildEditorialSpots(total: number): SpotlightItem[] {
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
