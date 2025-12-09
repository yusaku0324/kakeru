import Link from 'next/link'
import { cookies } from 'next/headers'

import { ReviewList } from './ReviewList'
import { ReviewStats } from './ReviewStats'
import { fetchDashboardReviews, fetchDashboardReviewStats } from '@/lib/dashboard-reviews'

async function cookieHeaderFromStore(): Promise<string | undefined> {
  const store = await cookies()
  const entries = store.getAll()
  if (!entries.length) {
    return undefined
  }
  return entries.map((entry) => `${entry.name}=${entry.value}`).join('; ')
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardReviewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ profileId: string }>
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  const { profileId } = await params
  const { status, page } = await searchParams
  const cookieHeader = await cookieHeaderFromStore()

  const [reviewsResult, statsResult] = await Promise.all([
    fetchDashboardReviews(
      profileId,
      {
        status_filter: status as 'pending' | 'published' | 'rejected' | undefined,
        page: page ? parseInt(page, 10) : 1,
        page_size: 20,
      },
      { cookieHeader },
    ),
    fetchDashboardReviewStats(profileId, { cookieHeader }),
  ])

  if (reviewsResult.status === 'unauthorized') {
    return (
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-12">
        <h1 className="text-2xl font-semibold">口コミ管理</h1>
        <p className="text-neutral-600">
          口コミを確認するにはログインが必要です。ログインページからマジックリンクを送信し、メール経由でログインした後にこのページを再読み込みしてください。
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/login"
            className="inline-flex rounded bg-black px-4 py-2 text-sm font-medium text-white"
          >
            ログインページへ
          </Link>
          <Link
            href="/"
            className="inline-flex rounded border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
          >
            トップへ戻る
          </Link>
        </div>
      </main>
    )
  }

  if (reviewsResult.status === 'forbidden') {
    return (
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-12">
        <h1 className="text-2xl font-semibold">口コミ管理</h1>
        <p className="text-neutral-600">
          このプロフィールの口コミを閲覧する権限がありません。運営に問い合わせてアクセス権を付与してください。
        </p>
      </main>
    )
  }

  if (reviewsResult.status === 'not_found') {
    return (
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-12">
        <h1 className="text-2xl font-semibold">口コミ管理</h1>
        <p className="text-neutral-600">指定されたプロフィールが見つかりませんでした。</p>
      </main>
    )
  }

  if (reviewsResult.status === 'error') {
    return (
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-12">
        <h1 className="text-2xl font-semibold">口コミ管理</h1>
        <p className="text-neutral-600">{reviewsResult.message}</p>
      </main>
    )
  }

  const reviews = reviewsResult.data
  const stats = statsResult.status === 'success' ? statsResult.data : null

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-6 py-12">
      <header className="space-y-2">
        <p className="text-sm text-neutral-500">プロフィール ID: {profileId}</p>
        <h1 className="text-3xl font-semibold tracking-tight">口コミ管理</h1>
        <p className="text-sm text-neutral-600">
          お客様からの口コミを確認し、承認・非承認の管理ができます。
        </p>
      </header>

      {stats && <ReviewStats stats={stats} />}

      <ReviewList
        profileId={profileId}
        reviews={reviews.items}
        total={reviews.total}
        currentPage={page ? parseInt(page, 10) : 1}
        currentStatus={status as 'pending' | 'published' | 'rejected' | undefined}
      />

      <Link
        href={`/dashboard/${profileId}`}
        className="inline-flex rounded border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
      >
        ダッシュボードトップに戻る
      </Link>
    </main>
  )
}
