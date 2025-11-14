import Link from 'next/link'
import { cookies } from 'next/headers'

import { ShopProfileEditor } from './ShopProfileEditor'
import { fetchDashboardShopProfile } from '@/lib/dashboard-shops'
import { fetchDashboardTherapists } from '@/lib/dashboard-therapists'

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

export default async function DashboardShopProfilePage({
  params,
}: {
  params: { profileId: string }
}) {
  const cookieHeader = await cookieHeaderFromStore()
  const result = await fetchDashboardShopProfile(params.profileId, { cookieHeader })

  if (result.status === 'unauthorized') {
    return (
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-12">
        <h1 className="text-2xl font-semibold">店舗プロフィール編集</h1>
        <p className="text-neutral-600">
          店舗プロフィールを編集するにはログインが必要です。ログインページからマジックリンクを送信し、メール経由でログインした後にこのページを再読み込みしてください。
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/login" className="inline-flex rounded bg-black px-4 py-2 text-sm font-medium text-white">
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
        <h1 className="text-2xl font-semibold">店舗プロフィール編集</h1>
        <p className="text-neutral-600">
          このプロフィールを編集する権限がありません。運営までお問い合わせください。
        </p>
      </main>
    )
  }

  if (result.status === 'not_found') {
    return (
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-12">
        <h1 className="text-2xl font-semibold">店舗プロフィール編集</h1>
        <p className="text-neutral-600">指定されたプロフィールが見つかりませんでした。</p>
      </main>
    )
  }

  if (result.status === 'error') {
    return (
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-12">
        <h1 className="text-2xl font-semibold">店舗プロフィール編集</h1>
        <p className="text-neutral-600">{result.message}</p>
      </main>
    )
  }

  const data = result.data

  const therapistResult = await fetchDashboardTherapists(params.profileId, { cookieHeader })

  const initialTherapists = therapistResult.status === 'success' ? therapistResult.data : []
  const initialTherapistsError = (() => {
    switch (therapistResult.status) {
      case 'success':
        return null
      case 'unauthorized':
      case 'forbidden':
        return 'セラピスト情報を読み込む権限がありません。権限を確認してください。'
      case 'not_found':
        return 'セラピスト情報が見つかりませんでした。'
      case 'error':
        return therapistResult.message
      default:
        return null
    }
  })()

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 py-12">
      <header className="space-y-2">
        <p className="text-sm text-neutral-500">プロフィール ID: {data.id}</p>
        <h1 className="text-3xl font-semibold tracking-tight">店舗プロフィール編集</h1>
        <p className="text-sm text-neutral-600">
          店舗ページに表示される基本情報やメニュー、在籍スタッフを更新できます。入力内容を保存すると公開ページに反映されます。
        </p>
      </header>

      <ShopProfileEditor
        profileId={data.id}
        initialData={data}
        initialTherapists={initialTherapists}
        initialTherapistsError={initialTherapistsError}
      />

      <Link
        href={`/dashboard/${data.id}`}
        className="inline-flex rounded border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
      >
        ダッシュボードトップに戻る
      </Link>
    </main>
  )
}
