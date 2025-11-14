import Link from 'next/link'

import ReservationThankYouTracker from '@/components/ReservationThankYouTracker'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Section } from '@/components/ui/Section'

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ reservation?: string; shop?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const reservationId = resolvedSearchParams.reservation || ''
  const shopId = resolvedSearchParams.shop || ''

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10 text-center">
      <ReservationThankYouTracker reservationId={reservationId} shopId={shopId} />
      <Section
        title="ご予約リクエストありがとうございます"
        subtitle="担当スタッフが内容を確認し折り返しご連絡いたします"
        className="shadow-none border border-neutral-borderLight bg-neutral-surface"
        actions={reservationId ? <Badge variant="outline">受付番号: {reservationId}</Badge> : undefined}
      >
        <p className="text-sm leading-relaxed text-neutral-textMuted">
          1〜2時間以内に返信がない場合は、お手数ですがお電話またはLINEで直接お問い合わせください。迷惑メールフォルダのご確認もお願いいたします。
        </p>
      </Section>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-neutral-text">次のステップ</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {shopId ? (
            <Link
              href={`/profiles/${shopId}`}
              className="inline-flex items-center justify-center rounded-badge bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-primaryDark"
            >
              予約した店舗ページへ戻る
            </Link>
          ) : null}
          <Link
            href="/search"
            className="inline-flex items-center justify-center rounded-badge border border-neutral-borderLight px-4 py-2 text-sm font-semibold text-brand-primaryDark hover:border-brand-primary hover:text-brand-primary"
          >
            他の店舗も探してみる
          </Link>
        </div>
      </Card>
    </main>
  )
}
