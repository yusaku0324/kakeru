import Link from 'next/link'
import { cookies } from 'next/headers'

import RecentlyViewedList from '@/components/RecentlyViewedList'
import { Card } from '@/components/ui/Card'
import { buildApiUrl, resolveApiBases } from '@/lib/api'
import { getJaFormatter } from '@/utils/date'

import {
  fetchShop,
  type ShopDetail,
  type StaffSummary,
} from '@/lib/shops'

type FavoriteRecord = {
  shop_id: string
  created_at: string
}

type FavoritesResult =
  | { status: 'ok'; favorites: FavoriteRecord[] }
  | { status: 'unauthorized' }
  | { status: 'error'; message: string }

type TherapistFavoriteRecord = {
  therapist_id: string
  shop_id: string
  created_at: string
}

type TherapistFavoritesResult =
  | { status: 'ok'; favorites: TherapistFavoriteRecord[] }
  | { status: 'unauthorized' }
  | { status: 'error'; message: string }

type TherapistFavoriteEntry = {
  favorite: TherapistFavoriteRecord
  summary: ShopDetail | null
  staff: StaffSummary | null
}

type SiteUserResult = { status: 'authenticated'; displayName: string | null } | { status: 'guest' }

const dateFormatter = getJaFormatter('dateMediumTimeShort')

const currencyFormatter = new Intl.NumberFormat('ja-JP')

async function serializeCookies(): Promise<string | undefined> {
  const store = await cookies()
  const entries = store.getAll()
  if (!entries.length) {
    return undefined
  }
  return entries.map((item) => `${item.name}=${item.value}`).join('; ')
}

async function fetchSiteUser(cookieHeader?: string): Promise<SiteUserResult> {
  // Try both site and dashboard sessions (dashboard users should also be recognized)
  const endpoints = ['api/auth/me/site', 'api/auth/me']

  for (const endpoint of endpoints) {
    for (const base of resolveApiBases()) {
      try {
        const res = await fetch(buildApiUrl(base, endpoint), {
          headers: cookieHeader ? { cookie: cookieHeader } : undefined,
          credentials: cookieHeader ? 'omit' : 'include',
          cache: 'no-store',
        })

        if (res.status === 401) {
          // Try next endpoint
          break
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
  }

  return { status: 'guest' }
}

async function fetchFavorites(cookieHeader?: string): Promise<FavoritesResult> {
  let lastError: Error | null = null
  let sawUnauthorized = false

  for (const base of resolveApiBases()) {
    try {
      const res = await fetch(buildApiUrl(base, 'api/favorites'), {
        headers: cookieHeader ? { cookie: cookieHeader } : undefined,
        credentials: cookieHeader ? 'omit' : 'include',
        cache: 'no-store',
      })

      if (res.status === 401) {
        sawUnauthorized = true
        continue
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

  if (sawUnauthorized && process.env.NODE_ENV !== 'production') {
    return { status: 'ok', favorites: [] }
  }

  return {
    status: 'error',
    message: lastError?.message ?? 'お気に入りの取得中にエラーが発生しました',
  }
}

async function fetchTherapistFavorites(cookieHeader?: string): Promise<TherapistFavoritesResult> {
  let lastError: Error | null = null
  const bases = resolveApiBases()

  for (const base of bases) {
    const url = buildApiUrl(base, 'api/favorites/therapists')
    try {
      const res = await fetch(url, {
        headers: cookieHeader ? { cookie: cookieHeader } : undefined,
        credentials: cookieHeader ? 'omit' : 'include',
        cache: 'no-store',
      })

      if (res.status === 401) {
        return { status: 'unauthorized' }
      }

      if (res.status === 404) {
        return { status: 'ok', favorites: [] }
      }

      if (!res.ok) {
        lastError = new Error(`セラピストお気に入りの取得に失敗しました (${res.status})`)
        continue
      }

      const favorites = (await res.json()) as TherapistFavoriteRecord[]
      return { status: 'ok', favorites }
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error('セラピストお気に入りの取得に失敗しました')
    }
  }

  return {
    status: 'error',
    message: lastError?.message ?? 'セラピストお気に入りの取得中にエラーが発生しました',
  }
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
  const cookieHeader = await serializeCookies()
  const [userResult, favoritesResult, therapistFavoritesResult] = await Promise.all([
    fetchSiteUser(cookieHeader),
    fetchFavorites(cookieHeader),
    fetchTherapistFavorites(cookieHeader),
  ])

  if (favoritesResult.status === 'error' && therapistFavoritesResult.status === 'error') {
    const combinedMessage = [favoritesResult.message, therapistFavoritesResult.message]
      .filter(Boolean)
      .join(' / ')
    return (
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-12">
        <h1 className="text-2xl font-semibold">マイページ</h1>
        <p className="text-neutral-600">{combinedMessage}</p>
        <RecentlyViewedList />
      </main>
    )
  }

  if (
    favoritesResult.status === 'unauthorized' ||
    therapistFavoritesResult.status === 'unauthorized'
  ) {
    return (
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-12">
        <h1 className="text-2xl font-semibold">マイページ</h1>
        <p className="text-neutral-600">
          お気に入りを表示するにはログインが必要です。ログインページからマジックリンクを送信し、メール経由でログインした後にこのページを再読み込みしてください。
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/auth/login"
            className="inline-flex rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
          >
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

  const shopFavoritesError = favoritesResult.status === 'error' ? favoritesResult.message : null
  const therapistFavoritesError =
    therapistFavoritesResult.status === 'error' ? therapistFavoritesResult.message : null

  const shopDetailMap = new Map<string, ShopDetail | null>()

  const shopFavorites = favoritesResult.status === 'ok' ? favoritesResult.favorites : []
  const summaries = await Promise.all(
    shopFavorites.map(async (favorite) => {
      let summary: ShopDetail | null = null
      try {
        summary = await fetchShop(favorite.shop_id)
      } catch {
        summary = null
      }
      shopDetailMap.set(favorite.shop_id, summary)
      return { favorite, summary }
    }),
  )

  const therapistFavorites =
    therapistFavoritesResult.status === 'ok' ? therapistFavoritesResult.favorites : []
  const therapistEntries: TherapistFavoriteEntry[] = await Promise.all(
    therapistFavorites.map(async (favorite) => {
      if (!shopDetailMap.has(favorite.shop_id)) {
        let detail: ShopDetail | null = null
        try {
          detail = await fetchShop(favorite.shop_id)
        } catch {
          detail = null
        }
        shopDetailMap.set(favorite.shop_id, detail)
      }
      const summary = shopDetailMap.get(favorite.shop_id) ?? null
      const targetId = favorite.therapist_id ? favorite.therapist_id.trim().toLowerCase() : ''
      let staff: StaffSummary | null = null
      if (summary?.staff && summary.staff.length > 0) {
        staff =
          summary.staff.find(
            (member) => member.id && member.id.trim().toLowerCase() === targetId,
          ) ?? null
        if (!staff && summary.staff.length === 1) {
          staff = summary.staff[0]
        }
      }
      return { favorite, summary, staff }
    }),
  )
  therapistEntries.sort((a, b) => {
    const left = new Date(a.favorite.created_at).getTime()
    const right = new Date(b.favorite.created_at).getTime()
    return right - left
  })

  const greeting =
    userResult.status === 'authenticated' ? (userResult.displayName ?? 'ゲスト') : null

  return (
    <main className="mx-auto max-w-5xl space-y-10 px-6 py-12">
      <header className="space-y-2">
        <p className="text-sm text-neutral-600">
          {greeting ? `${greeting} さん、こんにちは！` : 'ようこそ。'}
        </p>
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

        {shopFavoritesError ? (
          <div className="rounded border border-dashed border-red-200 bg-red-50 p-6 text-sm text-red-700">
            {shopFavoritesError}
          </div>
        ) : summaries.length === 0 ? (
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
                  const href = summary
                    ? summary.slug
                      ? `/profiles/${summary.slug}`
                      : `/profiles/${summary.id}`
                    : undefined
                  return (
                    <tr
                      key={`${favorite.shop_id}-${favorite.created_at}`}
                      className="hover:bg-neutral-50"
                    >
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
                      <td className="px-4 py-3 text-neutral-600">
                        {formatPriceRange(summary?.min_price, summary?.max_price)}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {dateFormatter.format(new Date(favorite.created_at))}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="therapist-favorites-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="therapist-favorites-heading" className="text-xl font-semibold text-neutral-900">
            お気に入りのセラピスト
          </h2>
          <Link
            href="/search?force_samples=1"
            className="text-sm font-medium text-brand-primary hover:underline"
          >
            セラピストを探す
          </Link>
        </div>

        {therapistFavoritesError ? (
          <div className="rounded border border-dashed border-red-200 bg-red-50 p-6 text-sm text-red-700">
            {therapistFavoritesError}
          </div>
        ) : therapistEntries.length === 0 ? (
          <div className="rounded border border-dashed border-neutral-300 bg-neutral-100 p-8 text-center text-neutral-600">
            まだお気に入りのセラピストがありません。検索ページで気になるスタッフを追加してみてください。
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {therapistEntries.map(({ favorite, summary, staff }) => {
              const therapistName = staff?.name ?? 'セラピスト'
              const alias = staff?.alias
              const headline = staff?.headline
              const initial = therapistName ? therapistName.slice(0, 1) : '？'
              const href = summary
                ? summary.slug
                  ? `/profiles/${summary.slug}`
                  : `/profiles/${summary.id}`
                : null
              return (
                <Card
                  key={`${favorite.therapist_id}-${favorite.created_at}`}
                  className="space-y-3 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-200 text-lg font-semibold text-neutral-700">
                      {initial}
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-neutral-900">{therapistName}</h3>
                      {alias ? <div className="text-xs text-neutral-500">{alias}</div> : null}
                      {headline ? <p className="text-sm text-neutral-600">{headline}</p> : null}
                    </div>
                  </div>
                  <div className="text-sm text-neutral-600">
                    {summary ? (
                      <>
                        <span className="font-medium text-neutral-700">所属店舗: </span>
                        {href ? (
                          <Link href={href} className="text-brand-primary hover:underline">
                            {summary.name}
                          </Link>
                        ) : (
                          <span>{summary.name}</span>
                        )}
                        {summary.area ? (
                          <span className="ml-1 text-xs text-neutral-500">({summary.area})</span>
                        ) : null}
                      </>
                    ) : (
                      <span>所属店舗情報を取得できませんでした。</span>
                    )}
                  </div>
                  <div className="text-xs text-neutral-500">
                    登録日時: {dateFormatter.format(new Date(favorite.created_at))}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      <RecentlyViewedList />

      <section
        aria-labelledby="reservation-history-heading"
        className="space-y-2 rounded border border-neutral-200 bg-neutral-50 p-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 id="reservation-history-heading" className="text-xl font-semibold text-neutral-900">
              予約履歴
            </h2>
            <p className="text-sm text-neutral-600">
              近日中に、過去の予約状況をここで確認できるようになります。
            </p>
          </div>
          <Link
            href="/therapists"
            className="hidden rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 sm:inline-flex"
          >
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
