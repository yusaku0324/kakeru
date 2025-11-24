import Link from 'next/link'

import { Card } from '@/components/ui/Card'
import { MagicLinkRequestForm } from './MagicLinkRequestForm'

const BENEFITS = [
  '掲載情報の編集や即日のお知らせ投稿が可能',
  '予約リクエストやお問い合わせの進捗を一元管理',
  'キャンペーン掲載・PR枠の申請状況をいつでも確認',
]

const TROUBLESHOOTING = [
  '迷惑メールフォルダに振り分けられていないかご確認ください。',
  '「@osakamenesu.com」からのメールを受信許可に設定してください。',
  '再送しても届かない場合はサポート (support@osakamenesu.com) までご連絡ください。',
]

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function DashboardLoginPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-10 px-6 py-16">
      <section className="rounded-3xl border border-white/30 bg-white/80 p-8 text-center shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-primary">
          OSAKAMENESU DASHBOARD
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-neutral-900">
          店舗ダッシュボード ログイン
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          掲載情報の更新、予約管理、PR枠の申請までを行う店舗担当者専用のログインページです。登録済みの店舗メールアドレスにマジックリンクを送るだけで、安全にログインできます。
        </p>
        <p className="text-xs text-neutral-500">
          ※お気に入りの閲覧や一般ユーザー向けログインは{' '}
          <Link href="/auth/login" className="font-semibold text-brand-primary hover:underline">
            こちら
          </Link>
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
        <Card className="space-y-6 border-brand-primary/30 bg-white/90 p-6 shadow-lg shadow-brand-primary/10">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-neutral-900">
              メールでログインリンクを受け取る
            </h2>
            <p className="text-xs leading-relaxed text-neutral-600">
              登録済みの店舗アドレス宛にマジックリンクをお送りします。同じブラウザでリンクを開くとログインが完了します。
            </p>
          </div>
          <MagicLinkRequestForm />
          <div className="rounded-2xl border border-dashed border-brand-primary/30 bg-brand-primary/5 px-4 py-3 text-xs text-brand-primaryDark">
            店舗アカウント未登録の方は、お手元の掲載申込メールまたはサポート窓口より発行依頼を行ってください。
          </div>
          <div className="text-xs text-neutral-600">
            <span>一般ユーザーとしてお気に入りを確認したい場合は </span>
            <Link href="/auth/login" className="font-semibold text-brand-primary hover:underline">
              通常のログインページ
            </Link>
            <span> をご利用ください。</span>
          </div>
        </Card>

        <Card className="space-y-4 p-6">
          <h2 className="text-base font-semibold text-neutral-900">ログインでできること</h2>
          <ul className="space-y-2 text-xs text-neutral-600">
            {BENEFITS.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span aria-hidden className="mt-0.5 text-brand-primary">
                  ✓
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="rounded-2xl bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
            ログインリンクは数分間有効です。リンクを開いた後はブラウザを閉じてもログイン状態が維持されます。
          </div>
        </Card>
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-6">
          <h3 className="text-base font-semibold text-neutral-900">メールが届かない場合</h3>
          <ul className="space-y-2 text-xs text-neutral-600">
            {TROUBLESHOOTING.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span aria-hidden className="mt-0.5 text-neutral-400">
                  •
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="space-y-4 p-6">
          <h3 className="text-base font-semibold text-neutral-900">ヘルプとサポート</h3>
          <p className="text-sm leading-relaxed text-neutral-700">
            ログイン後の操作ガイドやPR掲載の申請方法はダッシュボード内の「ヘルプセンター」をご参照ください。至急のご相談はサポート窓口までご連絡ください。
          </p>
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-700">
            <p className="font-semibold text-neutral-800">サポート窓口</p>
            <p className="text-neutral-600">support@osakamenesu.com</p>
            <p className="text-xs text-neutral-500">受付：10:00〜19:00（土日祝除く）</p>
          </div>
        </Card>
      </section>
    </main>
  )
}
