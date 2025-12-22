import TherapistCard, { type TherapistHit } from '@/components/staff/TherapistCard'
import { TherapistFavoritesProvider } from '@/components/staff/TherapistFavoritesProvider'
import { TherapistShopTabs } from '@/components/search/TherapistShopTabs'
import { ShopFilterHeader } from '@/components/search/ShopFilterHeader'
import { buildApiUrl, resolveApiBases } from '@/lib/api'
import { buildStaffIdentifier } from '@/lib/staff'
import { toNextAvailableSlotPayload } from '@/lib/nextAvailableSlot'
import { normalizeHobbyTags } from '@/features/therapist/profileTags'
import type { ShopHit } from '@/components/shop/ShopCard'

// サンプルデータ（API未接続時のフォールバック）
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
    min_price: 11000,
    max_price: 18000,
    rating: 4.7,
    review_count: 128,
    lead_image_url: '/images/demo-shop-1.svg',
    today_available: true,
    next_available_at: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(),
    staff_preview: [
      {
        id: '11111111-1111-1111-8888-111111111111',
        name: '葵',
        alias: 'Aoi',
        headline: '丁寧なオイルトリートメントで人気のセラピスト',
        rating: 4.6,
        review_count: 87,
        specialties: ['リンパ', 'ホットストーン'],
        avatar_url: '/images/demo-therapist-1.svg',
        today_available: true,
        next_available_slot: { start_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), status: 'ok' as const },
      },
      {
        id: '22222222-2222-2222-8888-222222222222',
        name: '凛',
        alias: 'Rin',
        headline: 'ストレッチと指圧を組み合わせた独自施術',
        rating: 4.3,
        review_count: 52,
        specialties: ['ストレッチ', '指圧'],
        avatar_url: '/images/demo-therapist-2.svg',
        today_available: true,
        next_available_slot: { start_at: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(), status: 'ok' as const },
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
    min_price: 13000,
    max_price: 22000,
    rating: 4.9,
    review_count: 86,
    lead_image_url: '/images/demo-shop-2.svg',
    today_available: false,
    next_available_at: '2025-10-05T18:00:00+09:00',
    staff_preview: [
      {
        id: '33333333-3333-3333-8888-333333333333',
        name: '美咲',
        headline: 'アロマ×ヒーリングで極上のリラックス体験を提供',
        rating: 4.9,
        review_count: 64,
        specialties: ['ホットストーン', 'ディープリンパ'],
        avatar_url: '/images/demo-therapist-3.svg',
        today_available: false,
        next_available_slot: { start_at: '2025-12-10T10:00:00+09:00', status: 'ok' as const },
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
    min_price: 9000,
    max_price: 16000,
    rating: 4.5,
    review_count: 54,
    lead_image_url: '/images/demo-shop-3.svg',
    today_available: true,
    staff_preview: [
      {
        id: '44444444-4444-4444-8888-444444444444',
        name: '陽菜',
        alias: 'Hinata',
        headline: '笑顔と包み込むタッチでリピーター多数',
        rating: 4.4,
        review_count: 38,
        specialties: ['ドライヘッドスパ', 'ストレッチ'],
        avatar_url: '/images/demo-therapist-1.svg',
        today_available: true,
        next_available_slot: { start_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), status: 'ok' as const },
      },
      {
        id: '55555555-5555-5555-8888-555555555555',
        name: '優希',
        headline: 'アロマとリンパを組み合わせたしっかり圧で疲れを解消',
        rating: 4.5,
        review_count: 44,
        specialties: ['肩こりケア', 'アロマトリートメント'],
        avatar_url: '/images/demo-therapist-2.svg',
        today_available: true,
        next_available_slot: { start_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), status: 'ok' as const },
      },
    ],
  },
]

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
  shop_slug?: string
  q?: string
  area?: string
  page?: string
  page_size?: string
}

type SearchResponse = {
  page: number
  page_size: number
  total: number
  results: ShopHit[]
}

function toQueryString(p: Record<string, string | undefined>) {
  const q = Object.entries(p)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
    .join('&')
  return q ? `?${q}` : ''
}

async function fetchProfiles(params: Params): Promise<SearchResponse> {
  const query = toQueryString({
    slug: params.shop_slug,
    q: params.q,
    area: params.area,
    page: params.page || '1',
    page_size: params.page_size || '50',
  })

  let lastErr: Error | null = null
  const targets = resolveApiBases()
  const endpoint = `/api/v1/shops${query}`

  for (const base of targets) {
    try {
      const res = await fetch(buildApiUrl(base, endpoint), { next: { revalidate: 30 } })
      if (res.ok) {
        const data = await res.json()
        return {
          page: Number(data.page ?? params.page ?? 1),
          page_size: Number(data.page_size ?? params.page_size ?? 50),
          total: Number(data.total ?? 0),
          results: (data.results ?? data.hits ?? []) as ShopHit[],
        }
      }
      lastErr = new Error(`search failed: ${res.status}`)
    } catch (err) {
      lastErr = err as Error
    }
  }

  return {
    page: Number(params.page || '1'),
    page_size: Number(params.page_size || '50'),
    total: 0,
    results: [],
  }
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
        const nextAvailableSlot = staff.next_available_slot ??
          (hit.next_available_at ? toNextAvailableSlotPayload(hit.next_available_at) : null)
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

export default async function TherapistsPage({
  searchParams,
}: {
  searchParams: Promise<Params>
}) {
  const resolvedSearchParams = await searchParams
  const shopSlug = resolvedSearchParams.shop_slug ?? null

  // APIからデータ取得
  const data = await fetchProfiles(resolvedSearchParams)
  const { results } = data

  // 店舗絞り込みの場合、その店舗情報を取得
  let filterShop: {
    name: string
    slug: string
    area?: string | null
    leadImageUrl?: string | null
  } | null = null
  if (shopSlug && results.length > 0) {
    const foundShop = results.find((shop) => shop.slug === shopSlug)
    if (foundShop) {
      filterShop = {
        name: foundShop.store_name || foundShop.name,
        slug: foundShop.slug || '',
        area: foundShop.area_name ?? foundShop.area,
        leadImageUrl: foundShop.lead_image_url ?? null,
      }
    }
  }

  // セラピストデータを抽出
  const displayHits = results.length > 0 ? results : SAMPLE_RESULTS
  const therapistHits = buildTherapistHits(displayHits)
  const usingSampleData = results.length === 0
  const therapistTotal = therapistHits.length

  return (
    <TherapistFavoritesProvider>
      <main className="min-h-screen bg-neutral-bgLight pb-20">
        {/* Header with tabs */}
        <div className="px-4 pt-6 pb-4">
          <div className="flex flex-col gap-4">
            <h1 className="text-xl font-bold text-neutral-text">
              {shopSlug ? 'セラピスト一覧' : 'セラピストを探す'}
            </h1>
            <TherapistShopTabs current="therapists" shopSlug={shopSlug} />
          </div>
        </div>

        {/* Shop filter header (when filtering by shop) */}
        {filterShop && (
          <div className="px-4 pb-2">
            <ShopFilterHeader shop={filterShop} />
          </div>
        )}

        {/* Results */}
        <div className="px-4">
          {usingSampleData && (
            <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              サンプルデータを表示しています
            </div>
          )}

          <div className="mb-4 text-sm text-neutral-textMuted">
            {therapistTotal}名のセラピストが見つかりました
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {therapistHits.map((hit) => (
              <TherapistCard key={hit.id} hit={hit} />
            ))}
          </div>

          {therapistHits.length === 0 && (
            <div className="py-12 text-center text-neutral-textMuted">
              条件に一致するセラピストが見つかりませんでした
            </div>
          )}
        </div>
      </main>
    </TherapistFavoritesProvider>
  )
}
