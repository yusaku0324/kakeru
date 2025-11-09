import Link from 'next/link'
import { cookies } from 'next/headers'

import { NotificationSettingsForm } from './NotificationSettingsForm'
import { fetchDashboardNotificationSettings } from '@/lib/dashboard-notifications'

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

export default async function DashboardNotificationsPage({
  params,
}: {
  params: Promise<{ profileId: string }>
}) {
  const { profileId } = await params
  const cookieHeader = await cookieHeaderFromStore()
  const result = await fetchDashboardNotificationSettings(profileId, { cookieHeader })

  if (result.status === 'unauthorized') {
    return (
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-12">
        <h1 className="text-2xl font-semibold">通知設定</h1>
        <p className="text-neutral-600">
          通知設定を確認するにはログインが必要です。ログインページからマジックリンクを送信し、メール経由でログインした後にこのページを再読み込みしてください。
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
        <h1 className="text-2xl font-semibold">通知設定</h1>
        <p className="text-neutral-600">このプロフィールの通知設定を閲覧する権限がありません。運営に問い合わせてアクセス権を付与してください。</p>
      </main>
    )
  }

  if (result.status === 'not_found') {
    return (
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-12">
        <h1 className="text-2xl font-semibold">通知設定</h1>
        <p className="text-neutral-600">指定されたプロフィールが見つかりませんでした。</p>
      </main>
    )
  }

  if (result.status === 'error') {
    return (
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-12">
        <h1 className="text-2xl font-semibold">通知設定</h1>
        <p className="text-neutral-600">{result.message}</p>
      </main>
    )
  }

  const { data } = result

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-6 py-12">
      <header className="space-y-2">
        <p className="text-sm text-neutral-500">プロフィール ID: {data.profile_id}</p>
        <h1 className="text-3xl font-semibold tracking-tight">通知設定</h1>
        <p className="text-sm text-neutral-600">
          通知チャネルの有効化や宛先を編集し、テスト送信でバリデーションを確認できます。
        </p>
      </header>

      <NotificationSettingsForm profileId={data.profile_id} initialData={data} />

      <section className="rounded border border-dashed border-neutral-300 bg-neutral-50 p-6 text-sm text-neutral-600">
        <p className="font-medium text-neutral-700">今後の改善アイデア</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>入力項目ごとのエラー表示や保存履歴の閲覧など UX をさらに改善する</li>
          <li>ステージング環境で実通知を送信するエンドツーエンド検証を追加する</li>
          <li>変更履歴・アクセスログを表示する監査機能をダッシュボードに統合する</li>
        </ul>
      </section>

      <Link
        href={`/dashboard/${data.profile_id}`}
        className="inline-flex rounded border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
      >
        ダッシュボードトップに戻る
      </Link>
    </main>
  )
}
