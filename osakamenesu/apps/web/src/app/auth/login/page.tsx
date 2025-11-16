import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function SiteLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-primary/5 to-white px-4 py-16 text-neutral-text">
      <div className="max-w-md space-y-6 rounded-3xl border border-white/60 bg-white/90 p-8 text-center shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-primary">OSAKAMENESU LOGIN</p>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">一般ユーザー向けログイン</h1>
        <p className="text-sm leading-relaxed text-neutral-600">
          お気に入りや閲覧履歴を同期するには、ページ右上の <span className="font-semibold">「ログイン」</span> ボタンを押し、表示されるオーバーレイからマジックリンクを取得してください。
        </p>
        <p className="text-xs text-neutral-500">
          ログインパネルは必要になったときにだけ開く構成です。店舗向け管理画面とは別になっています。
        </p>
        <div className="rounded-2xl bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
          店舗担当者の方は
          <Link href="/dashboard/login" className="ml-1 font-semibold text-brand-primary hover:underline">
            店舗ダッシュボード ログイン
          </Link>
          をご利用ください。
        </div>
        <Link
          href="/"
          className="inline-flex w-full items-center justify-center rounded-full border border-neutral-borderLight px-6 py-2 text-sm font-semibold text-neutral-text transition hover:border-brand-primary hover:text-brand-primary"
        >
          トップページに戻る
        </Link>
      </div>
    </main>
  )
}
