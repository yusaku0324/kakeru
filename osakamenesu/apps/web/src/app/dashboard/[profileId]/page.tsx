import Link from 'next/link'
import { cookies } from 'next/headers'

import DashboardReservationFeed from '@/features/reservations/ui/DashboardReservationFeed'
import DashboardReservationDaySummary from '@/features/reservations/ui/DashboardReservationDaySummary'
import { DashboardReservationAvailabilityPreview } from '@/features/reservations/ui'
import { Card } from '@/components/ui/Card'
import { fetchDashboardShopProfile } from '@/lib/dashboard-shops'

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

export default async function DashboardHomePage({
  params,
}: {
  params: Promise<{ profileId: string }>
}) {
  const { profileId } = await params
  const cookieHeader = await cookieHeaderFromStore()
  const result = await fetchDashboardShopProfile(profileId, { cookieHeader })

  if (result.status === 'unauthorized') {
    return (
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-12">
        <h1 className="text-2xl font-semibold">店舗ダッシュボード</h1>
        <p className="text-neutral-600">
          ダッシュボードを表示するにはログインが必要です。ログインページからマジックリンクを送信し、メール経由でログインした後にこのページを再読み込みしてください。
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
        <h1 className="text-2xl font-semibold">店舗ダッシュボード</h1>
        <p className="text-neutral-600">
          このプロフィールにアクセスする権限がありません。運営までお問い合わせください。
        </p>
      </main>
    )
  }

  if (result.status === 'not_found') {
    return (
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-12">
        <h1 className="text-2xl font-semibold">店舗ダッシュボード</h1>
        <p className="text-neutral-600">指定されたプロフィールが見つかりませんでした。</p>
      </main>
    )
  }

  if (result.status === 'error') {
    return (
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-12">
        <h1 className="text-2xl font-semibold">店舗ダッシュボード</h1>
        <p className="text-neutral-600">{result.message}</p>
      </main>
    )
  }

  const data = result.data

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 py-12">
      <header className="space-y-2">
        <p className="text-sm text-neutral-600">プロフィール ID: {data.id}</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {data.name || '店舗ダッシュボード'}
        </h1>
        <p className="text-sm text-neutral-600">
          店舗ページの情報管理や予約通知の設定をまとめて行えます。右のメニューから編集したい項目を選んでください。
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3 rounded border border-neutral-borderLight/70 bg-neutral-surfaceAlt px-4 py-3 text-sm text-neutral-600">
        <span>新しい店舗を追加する場合はこちらから。</span>
        <Link
          href="/dashboard/new"
          className="inline-flex items-center rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-neutral-700"
        >
          新しい店舗を追加
        </Link>
      </div>

      <section className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-neutral-900">店舗プロフィールを編集</h2>
            <p className="text-sm text-neutral-600">
              基本情報・メニュー・在籍スタッフ・連絡先などの掲載内容を更新します。保存すると公開ページへ反映されます。
            </p>
            <Link
              href={`/dashboard/${data.id}/profile`}
              className="inline-flex items-center justify-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700"
            >
              プロフィール編集へ進む
            </Link>
          </div>
        </Card>

        <Card className="p-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-neutral-900">予約通知の設定</h2>
            <p className="text-sm text-neutral-600">
              予約リクエスト受信時に通知を送るメール / LINE / Slack
              などのチャネルを管理します。宛先のテスト送信も可能です。
            </p>
            <Link
              href={`/dashboard/${data.id}/notifications`}
              className="inline-flex items-center justify-center rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100"
            >
              通知設定へ進む
            </Link>
          </div>
        </Card>

        <Card className="p-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-neutral-900">口コミ管理</h2>
            <p className="text-sm text-neutral-600">
              お客様から投稿された口コミを確認し、承認・非承認の管理ができます。
            </p>
            <Link
              href={`/dashboard/${data.id}/reviews`}
              className="inline-flex items-center justify-center rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100"
            >
              口コミ管理へ進む
            </Link>
          </div>
        </Card>

        <Card className="p-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-neutral-900">シフト管理</h2>
            <p className="text-sm text-neutral-600">
              セラピストの出勤スケジュールを登録・編集し、空き状況を管理できます。
            </p>
            <Link
              href={`/dashboard/${data.id}/shifts`}
              className="inline-flex items-center justify-center rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100"
            >
              シフト管理へ進む
            </Link>
          </div>
        </Card>

        <Card className="p-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-neutral-900">スタッフ管理</h2>
            <p className="text-sm text-neutral-600">
              ダッシュボードにアクセスできるスタッフを追加・削除できます。オーナーのみ操作可能です。
            </p>
            <Link
              href={`/dashboard/${data.id}/staff`}
              className="inline-flex items-center justify-center rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100"
            >
              スタッフ管理へ進む
            </Link>
          </div>
        </Card>
      </section>

      <DashboardReservationAvailabilityPreview
        availabilityDays={data.availability_calendar?.days}
        generatedAt={data.availability_calendar?.generated_at}
        slotDurationMinutes={data.default_slot_duration_minutes}
      />

      <DashboardReservationDaySummary profileId={data.id} />

      <DashboardReservationFeed
        profileId={data.id}
        slug={data.slug}
        className="border-none shadow-none p-0"
      />
    </main>
  )
}
