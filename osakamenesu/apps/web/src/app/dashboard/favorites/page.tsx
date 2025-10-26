import Link from 'next/link'
import { cookies } from 'next/headers'

import RecentlyViewedList from '@/components/RecentlyViewedList'
import { buildApiUrl, resolveApiBases } from '@/lib/api'

type FavoriteRecord = {
  shop_id: string
  created_at: string
}

type ShopSummary = {
  id: string
  name: string
  area?: string | null
  slug?: string | null
  min_price?: number | null
  max_price?: number | null
  address?: string | null
}

type FavoritesResult =
  | { status: 'ok'; favorites: FavoriteRecord[] }
  | { status: 'unauthorized' }
  | { status: 'error'; message: string }

type SiteUserResult =
  | { status: 'authenticated'; displayName: string | null }
  | { status: 'guest' }

const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const currencyFormatter = new Intl.NumberFormat('ja-JP')

function serializeCookies(): string | undefined {
  const store = cookies()
  const entries = store.getAll()
  if (!entries.length) {
    return undefined
  }
  return entries.map((item) => `${item.name}=${item.value}`).join('; ')
}

async function fetchSiteUser(cookieHeader?: string): Promise<SiteUserResult> {
  for (const base of resolveApiBases()) {
    try {
      const res = await fetch(buildApiUrl(base, 'api/auth/me'), {
        headers: cookieHeader ? { cookie: cookieHeader } : undefined,
        credentials: cookieHeader ? 'omit' : 'include',
        cache: 'no-store',
      })

      if (res.status === 401) {
        return { status: 'guest' }
      }

      if (!res.ok) {
        continue
      }

      const data = await res.json().catch(() => ({}))
      const displayName = (() => {
        const rawName = typeof data?.display_name === 'string' ? data.display_name.trim() : ''
        if (rawName) return rawName
        const rawEmail = typeof data?.email === 'string' ? data.email.trim() : ''
        return rawEmail || null
      })()
      return { status: 'authenticated', displayName }
    } catch (error) {
      continue
    }
  }

  return { status: 'guest' }
}

async function fetchFavorites(cookieHeader?: string): Promise<FavoritesResult> {
  let lastError: Error | null = null

  for (const base of resolveApiBases()) {
    try {
      const res = await fetch(buildApiUrl(base, 'api/favorites'), {
        headers: cookieHeader ? { cookie: cookieHeader } : undefined,
        credentials: cookieHeader ? 'omit' : 'include',
        cache: 'no-store',
      })

      if (res.status === 401) {
        return { status: 'unauthorized' }
      }

      if (!res.ok) {
        lastError = new Error(`お気に入りの取得に失敗しました (${res.status})`)
        continue
      }

      const favorites = (await res.json()) as FavoriteRecord[]
      return { status: 'ok', favorites }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('お気に入りの取得に失敗しました')
    }
  }

  return {
    status: 'error',
    message: lastError?.message ?? 'お気に入りの取得中にエラーが発生しました',
  }
}

async function fetchShopSummary(shopId: string, cookieHeader?: string): Promise<ShopSummary | null> {
  for (const base of resolveApiBases()) {
    try {
      const res = await fetch(buildApiUrl(base, `api/v1/shops/${shopId}`), {
        headers: cookieHeader ? { cookie: cookieHeader } : undefined,
        credentials: cookieHeader ? 'omit' : 'include',
        cache: 'no-store',
      })

      if (!res.ok) {
        continue
      }

      const data = await res.json()
      return {
        id: data.id ?? shopId,
        name: data.name ?? '名称未設定',
        area: data.area_name ?? data.area ?? null,
        slug: data.slug ?? null,
        min_price: data.price_min ?? null,
        max_price: data.price_max ?? null,
        address: data.address ?? null,
      }
    } catch (error) {
      continue
    }
  }

  return null
}

function formatPriceRange(min?: number | null, max?: number | null): string {
  if (!min && !max) return '—'
  if (min && max && min === max) {
    return `¥${currencyFormatter.format(min)}`
  }
  const minLabel = min ? `¥${currencyFormatter.format(min)}` : '—'
  const maxLabel = max ? `¥${currencyFormatter.format(max)}` : '—'
  return `${minLabel} 〜 ${maxLabel}`
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function FavoritesDashboardPage() {
  const cookieHeader = serializeCookies()
  const [userResult, favoritesResult] = await Promise.all([
    fetchSiteUser(cookieHeader),
    fetchFavorites(cookieHeader),
  ])

  if (favoritesResult.status === 'error') {
    return (
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-12">
        <h1 className="text-2xl font-semibold">マイページ</h1>
        <p className="text-neutral-600">{favoritesResult.message}</p>
        <RecentlyViewedList />
      </main>
    )
  }

  if (favoritesResult.status === 'unauthorized') {
    return (
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-12">
        <h1 className="text-2xl font-semibold">マイページ</h1>
        <p className="text-neutral-600">
          お気に入りを表示するにはログインが必要です。ログインページからマジックリンクを送信し、メール経由でログインした後にこのページを再読み込みしてください。
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/auth/login" className="inline-flex rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white">
            ログインページへ
          </Link>
          <Link
            href="/"
            className="inline-flex rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
          >
            トップへ戻る
          </Link>
        </div>
        <RecentlyViewedList />
      </main>
    )
  }

  const summaries = await Promise.all(
    favoritesResult.favorites.map(async (favorite) => {
      const summary = await fetchShopSummary(favorite.shop_id, cookieHeader)
      return { favorite, summary }
    }),
  )

  const greeting = userResult.status === 'authenticated' ? userResult.displayName ?? 'ゲスト' : null

  return (
    <main className="mx-auto max-w-5xl space-y-10 px-6 py-12">
      <header className="space-y-2">
        <p className="text-sm text-neutral-600">{greeting ? `${greeting} さん、こんにちは！` : 'ようこそ。'}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">マイページ</h1>
        <p className="text-sm text-neutral-600">
          お気に入りや最近チェックした店舗をまとめて確認できます。ログイン状態は30日間保持されます。
        </p>
      </header>

      <section aria-labelledby="favorites-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="favorites-heading" className="text-xl font-semibold text-neutral-900">
            お気に入りの店舗
          </h2>
          <Link href="/search" className="text-sm font-medium text-brand-primary hover:underline">
            店舗を探す
          </Link>
        </div>

        {summaries.length === 0 ? (
          <div className="rounded border border-dashed border-neutral-300 bg-neutral-100 p-8 text-center text-neutral-600">
            まだお気に入りの店舗がありません。検索ページから気になる店舗を追加してみてください。
          </div>
        ) : (
          <div className="overflow-x-auto rounded border border-neutral-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-neutral-200 text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-neutral-600">
                    店舗
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-neutral-600">
                    エリア
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-neutral-600">
                    料金目安
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-neutral-600">
                    登録日時
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {summaries.map(({ favorite, summary }) => {
                  const href = summary ? (summary.slug ? `/profiles/${summary.slug}` : `/profiles/${summary.id}`) : undefined
                  return (
                    <tr key={`${favorite.shop_id}-${favorite.created_at}`} className="hover:bg-neutral-50">
                      <td className="px-4 py-3">
                        {summary ? (
                          <Link href={href!} className="text-brand-primary hover:underline">
                            {summary.name}
                          </Link>
                        ) : (
                          <span className="text-neutral-500">この店舗は現在表示できません</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">{summary?.area ?? '—'}</td>
                      <td className="px-4 py-3 text-neutral-600">{formatPriceRange(summary?.min_price, summary?.max_price)}</td>
                      <td className="px-4 py-3 text-neutral-600">{dateFormatter.format(new Date(favorite.created_at))}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <RecentlyViewedList />

      <section aria-labelledby="reservation-history-heading" className="space-y-2 rounded border border-neutral-200 bg-neutral-50 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 id="reservation-history-heading" className="text-xl font-semibold text-neutral-900">
              予約履歴
            </h2>
            <p className="text-sm text-neutral-600">近日中に、過去の予約状況をここで確認できるようになります。</p>
          </div>
          <Link href="/therapists" className="hidden rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 sm:inline-flex">
            セラピストを探す
          </Link>
        </div>
        <p className="text-sm text-neutral-600">
          現在は予約確認メールから詳細をご確認ください。キャンセルが必要な場合は店舗に直接連絡をお願いします。
        </p>
      </section>
    </main>
  )
}
