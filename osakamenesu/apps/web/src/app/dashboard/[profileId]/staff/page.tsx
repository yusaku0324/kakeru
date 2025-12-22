import Link from 'next/link'
import { cookies } from 'next/headers'

import { StaffList } from './StaffList'
import { fetchShopManagers } from '@/lib/dashboard-managers'

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

export default async function DashboardStaffPage({
  params,
}: {
  params: Promise<{ profileId: string }>
}) {
  const { profileId } = await params
  const cookieHeader = await cookieHeaderFromStore()

  const result = await fetchShopManagers(profileId, { cookieHeader })

  if (result.status === 'unauthorized') {
    return (
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-12">
        <h1 className="text-2xl font-semibold">スタッフ管理</h1>
        <p className="text-neutral-600">
          スタッフ管理にはログインが必要です。ログインページからマジックリンクを送信し、メール経由でログインした後にこのページを再読み込みしてください。
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

  if (result.status === 'forbidden') {
    return (
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-12">
        <h1 className="text-2xl font-semibold">スタッフ管理</h1>
        <p className="text-neutral-600">
          スタッフ管理にはオーナー権限が必要です。オーナーに連絡して権限を付与してもらってください。
        </p>
      </main>
    )
  }

  if (result.status === 'not_found') {
    return (
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-12">
        <h1 className="text-2xl font-semibold">スタッフ管理</h1>
        <p className="text-neutral-600">指定された店舗が見つかりませんでした。</p>
      </main>
    )
  }

  if (result.status === 'error') {
    return (
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-12">
        <h1 className="text-2xl font-semibold">スタッフ管理</h1>
        <p className="text-neutral-600">{result.message}</p>
      </main>
    )
  }

  const managers = result.data

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-6 py-12">
      <header className="space-y-2">
        <p className="text-sm text-neutral-500">プロフィール ID: {profileId}</p>
        <h1 className="text-3xl font-semibold tracking-tight">スタッフ管理</h1>
        <p className="text-sm text-neutral-600">
          この店舗のダッシュボードにアクセスできるスタッフを管理します。オーナーのみがスタッフの追加・削除ができます。
        </p>
      </header>

      <StaffList profileId={profileId} initialManagers={managers} />

      <Link
        href={`/dashboard/${profileId}`}
        className="inline-flex rounded border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
      >
        ダッシュボードトップに戻る
      </Link>
    </main>
  )
}
