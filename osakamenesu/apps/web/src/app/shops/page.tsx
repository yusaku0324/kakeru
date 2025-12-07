import { ShopFavoritesProvider } from '@/components/shop/ShopFavoritesProvider'
import ShopCardNavigateToTherapists from '@/components/shop/ShopCardNavigateToTherapists'
import { TherapistShopTabs } from '@/components/search/TherapistShopTabs'
import { buildApiUrl, resolveApiBases } from '@/lib/api'
import { toNextAvailableSlotPayload } from '@/lib/nextAvailableSlot'
import type { ShopHit } from '@/components/shop/ShopCard'

// サンプルデータ（API未接続時のフォールバック）
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
    min_price: 11000,
    max_price: 18000,
    rating: 4.7,
    review_count: 128,
    lead_image_url: '/images/demo-shop-1.svg',
    badges: ['人気店', '駅チカ'],
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
    badges: ['上質空間'],
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
      },
      {
        id: '55555555-5555-5555-8888-555555555555',
        name: '優希',
        headline: 'アロマとリンパを組み合わせたしっかり圧で疲れを解消',
        rating: 4.5,
        review_count: 44,
        specialties: ['肩こりケア', 'アロマトリートメント'],
        avatar_url: '/images/demo-therapist-2.svg',
      },
    ],
  },
]

// next_available_slot の設定
SAMPLE_RESULTS.forEach((hit) => {
  if (!hit.next_available_slot) {
    hit.next_available_slot = hit.next_available_at
      ? toNextAvailableSlotPayload(hit.next_available_at)
      : null
  }
})

type Params = {
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
    q: params.q,
    area: params.area,
    page: params.page || '1',
    page_size: params.page_size || '24',
  })

  let lastErr: Error | null = null
  const targets = resolveApiBases()
  const endpoint = `/api/v1/shops${query}`

  for (const base of targets) {
    try {
      const res = await fetch(buildApiUrl(base, endpoint), { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        const results = (data.results ?? data.hits ?? []) as ShopHit[]
        // next_available_slot を設定
        results.forEach((hit) => {
          if (!hit.next_available_slot && hit.next_available_at) {
            hit.next_available_slot = toNextAvailableSlotPayload(hit.next_available_at)
          }
        })
        return {
          page: Number(data.page ?? params.page ?? 1),
          page_size: Number(data.page_size ?? params.page_size ?? 24),
          total: Number(data.total ?? 0),
          results,
        }
      }
      lastErr = new Error(`search failed: ${res.status}`)
    } catch (err) {
      lastErr = err as Error
    }
  }

  return {
    page: Number(params.page || '1'),
    page_size: Number(params.page_size || '24'),
    total: 0,
    results: [],
  }
}

export default async function ShopsPage({
  searchParams,
}: {
  searchParams: Promise<Params>
}) {
  const resolvedSearchParams = await searchParams

  // APIからデータ取得
  const data = await fetchProfiles(resolvedSearchParams)
  const { results, total } = data

  // 結果がなければサンプルデータを使用
  const displayHits = results.length > 0 ? results : SAMPLE_RESULTS
  const usingSampleData = results.length === 0
  const shopTotal = usingSampleData ? SAMPLE_RESULTS.length : total

  return (
    <ShopFavoritesProvider>
      <main className="min-h-screen bg-neutral-bgLight pb-20">
        {/* Header with tabs */}
        <div className="px-4 pt-6 pb-4">
          <div className="flex flex-col gap-4">
            <h1 className="text-xl font-bold text-neutral-text">店舗から探す</h1>
            <TherapistShopTabs current="shops" />
          </div>
        </div>

        {/* Results */}
        <div className="px-4">
          {usingSampleData && (
            <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              サンプルデータを表示しています
            </div>
          )}

          <div className="mb-4 text-sm text-neutral-textMuted">
            {shopTotal}件の店舗が見つかりました
          </div>

          <p className="mb-4 text-xs text-neutral-textMuted">
            店舗をタップすると、その店舗のセラピスト一覧が表示されます
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {displayHits.map((hit) => (
              <ShopCardNavigateToTherapists key={hit.id} hit={hit} />
            ))}
          </div>

          {displayHits.length === 0 && (
            <div className="py-12 text-center text-neutral-textMuted">
              条件に一致する店舗が見つかりませんでした
            </div>
          )}
        </div>
      </main>
    </ShopFavoritesProvider>
  )
}
